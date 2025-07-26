import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Package } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useUser } from '../lib/UserContext';

interface Insumo {
  id: string;
  nome: string; // corresponde ao campo 'nome' do banco
  valor_total: number; // corresponde ao campo 'valor_total' do banco
  quantidade: number; // corresponde ao campo 'quantidade' do banco
  custo_por_unidade: number; // corresponde ao campo 'custo_por_unidade' do banco
}

const CustosInsumos: React.FC = () => {
  const { user } = useUser();
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    ingrediente: '',
    valorTotal: 0,
    quantidade: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchInsumos = async () => {
      if (!user?.id) return;
      
      setLoading(true);
      setError('');
      try {
        
        // Buscar ingredientes diretamente usando o ID do usuário autenticado
        const { data, error } = await supabase
          .from('ingredientes')
          .select('*')
          .eq('usuario_id', user.id);
          
        if (error) {
          setError('Erro ao buscar ingredientes.');
        } else {
          setInsumos(data || []);
        }
      } catch (err) {
        setError('Erro ao buscar ingredientes.');
      } finally {
        setLoading(false);
      }
    };
    fetchInsumos();
  }, [user?.id]);

  const calcularCustoPor1 = (valorTotal: number, quantidade: number): number => {
    return quantidade > 0 ? valorTotal / quantidade : 0;
  };

  // Função para formatar números com separadores de milhares
  const formatarNumero = (numero: number) => {
    return numero.toLocaleString('pt-BR', { 
      minimumFractionDigits: 0,
      maximumFractionDigits: 2 
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      setError('Usuário não autenticado.');
      return;
    }
    
    setLoading(true);
    setError('');
    
    // Validar dados do formulário
    if (!formData.ingrediente || formData.ingrediente.trim() === '') {
      setError('Nome do ingrediente é obrigatório.');
      setLoading(false);
      return;
    }
    
    if (formData.valorTotal <= 0) {
      setError('Valor total deve ser maior que zero.');
      setLoading(false);
      return;
    }
    
    if (formData.quantidade <= 0) {
      setError('Quantidade deve ser maior que zero.');
      setLoading(false);
      return;
    }
    
    try {
      
      if (editingId) {
        // Atualizar ingrediente
        const { error } = await supabase
          .from('ingredientes')
          .update({
            nome: formData.ingrediente,
            valor_total: formData.valorTotal,
            quantidade: formData.quantidade,
          })
          .eq('id', editingId);
          
        if (error) {
          throw error;
        }
      } else {
        // Adicionar novo ingrediente
        const { error } = await supabase
          .from('ingredientes')
          .insert([
            {
              nome: formData.ingrediente,
              valor_total: formData.valorTotal,
              quantidade: formData.quantidade,
              usuario_id: user.id,
            },
          ]);
          
        if (error) {
          throw error;
        }
      }
      
      // Recarregar ingredientes
      const { data, error: fetchError } = await supabase
        .from('ingredientes')
        .select('*')
        .eq('usuario_id', user.id);
        
      if (fetchError) {
        setError('Erro ao recarregar dados.');
      } else {
        setInsumos(data || []);
        setFormData({ ingrediente: '', valorTotal: 0, quantidade: 0 });
        setShowForm(false);
        setEditingId(null);
      }
    } catch (err) {
      setError('Erro ao salvar ingrediente.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (insumo: Insumo) => {
    setFormData({
      ingrediente: insumo.nome,
      valorTotal: insumo.valor_total,
      quantidade: insumo.quantidade
    });
    setEditingId(insumo.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!user?.id) {
      setError('Usuário não autenticado.');
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase
        .from('ingredientes')
        .delete()
        .eq('id', id);
      if (error) {
        throw error;
      }
      // Atualizar lista de insumos imediatamente após deletar
      const { data, error: fetchError } = await supabase
        .from('ingredientes')
        .select('*')
        .eq('usuario_id', user.id);
      if (fetchError) {
        setError('Erro ao recarregar dados.');
      } else {
        setInsumos(data || []);
      }
    } catch (err) {
      setError('Erro ao deletar ingrediente.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({ ingrediente: '', valorTotal: 0, quantidade: 0 });
    setEditingId(null);
    setShowForm(false);
  };

  return (
    <div className="animate-fadeIn">
      <div className="card">
        <div className="flex justify-between items-center mb-6">
          <h2>
            Custos por Insumos
          </h2>
          <button 
            className="btn btn-primary" 
            onClick={() => setShowForm(true)}
            disabled={showForm}
            style={{ height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Plus size={16} />
            Adicionar Ingrediente
          </button>
        </div>

        {showForm && (
          <div className="card animate-scaleIn" style={{ backgroundColor: 'rgba(45, 45, 45, 0.9)' }}>
            <h3>{editingId ? 'Editar Ingrediente' : 'Novo Ingrediente'}</h3>
            
            <form onSubmit={handleSubmit}>
              <div className="grid grid-2">
                <div className="form-group">
                  <label>Ingrediente</label>
                  <input
                    type="text"
                    value={formData.ingrediente}
                    onChange={(e) => setFormData({ ...formData, ingrediente: e.target.value })}
                    placeholder="Nome do ingrediente"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Valor Total</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.valorTotal}
                    onChange={(e) => setFormData({ ...formData, valorTotal: parseFloat(e.target.value) || 0 })}
                    placeholder="0,00"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Quantidade</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.quantidade}
                    onChange={(e) => setFormData({ ...formData, quantidade: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Custo por 1</label>
                  <input
                    type="number"
                    step="0.01"
                    value={calcularCustoPor1(formData.valorTotal, formData.quantidade).toFixed(4)}
                    readOnly
                  />
                </div>
              </div>
              
              <div className="flex gap-2 mt-4">
                <button type="submit" className="btn btn-success">
                  <Save size={16} />
                  {editingId ? 'Atualizar' : 'Salvar'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                  <X size={16} />
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {error && (
          <div className="alert alert-danger animate-slideIn">{error}</div>
        )}
        {loading && (
          <div className="loading-spinner" style={{ margin: '2rem auto' }} />
        )}

        {insumos.length > 0 ? (
          <div className="table-container animate-slideIn">
            <table className="table">
              <thead>
                <tr>
                  <th>Ingrediente</th>
                  <th>Valor Total</th>
                                  <th>Quantidade</th>
                <th>Custo por 1</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {insumos.map((insumo) => (
                  <tr key={insumo.id}>
                    <td className="font-medium">{insumo.nome}</td>
                    <td>R$ {insumo.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td>{formatarNumero(insumo.quantidade)}</td>
                    <td className="font-semibold">R$ {insumo.custo_por_unidade.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</td>
                    <td>
                      <div className="flex gap-2">
                        <button 
                          className="btn btn-primary" 
                          onClick={() => handleEdit(insumo)}
                          style={{ padding: '0.5rem', minWidth: 'auto' }}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          className="btn btn-danger" 
                          onClick={() => handleDelete(insumo.id)}
                          style={{ padding: '0.5rem', minWidth: 'auto' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <Package size={48} className="empty-state-icon" />
            <h3>Nenhum ingrediente cadastrado</h3>
            <p>Adicione seus primeiros ingredientes para começar a calcular custos.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustosInsumos; 