import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Eye, AlertCircle, RotateCw } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useUser } from '../lib/UserContext';

interface Ingrediente {
  ingrediente: string;
  quantidade: number;
  custo: number;
}

interface Prato {
  id: string;
  nome: string;
  custo_total: number;
  usuario_id: string;
  data_criacao?: string;
  data_atualizacao?: string;
  ingredientes?: PratoIngrediente[];
}

interface PratoIngrediente {
  id: string;
  prato_id: string;
  ingrediente_nome: string;
  quantidade: number;
  custo: number;
  data_criacao?: string;
}

const CustosPratos: React.FC = () => {
  
  const { user } = useUser();
  const [pratos, setPratos] = useState<Prato[]>([]);
  const [ingredientesDisponiveis, setIngredientesDisponiveis] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [viewingDetails, setViewingDetails] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nomePrato: '',
    ingredientes: [] as Ingrediente[]
  });
  const [ingredienteForm, setIngredienteForm] = useState({
    ingrediente: '',
    quantidade: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [desincronizacaoDetectada, setDesincronizacaoDetectada] = useState(false);

  
  useEffect(() => {
    const fetchIngredientesEPratos = async () => {
      if (!user?.id) return;
      
      setLoading(true);
      setError('');
      try {
        
        // Buscar ingredientes diretamente
        const { data: ingredientes, error: ingredientesError } = await supabase
          .from('ingredientes')
          .select('nome, custo_por_unidade')
          .eq('usuario_id', user.id);
          
        if (ingredientesError) {
          setError('Erro ao buscar ingredientes.');
        } else {
          const nomesIngredientes = (ingredientes || []).map((ing: any) => ing.nome);
          setIngredientesDisponiveis(nomesIngredientes);
        }
        
        // Buscar pratos com ingredientes
        const { data: pratosData, error: pratosError } = await supabase
          .from('pratos')
          .select(`
            id,
            nome,
            custo_total,
            usuario_id,
            data_criacao,
            data_atualizacao,
            prato_ingredientes:prato_ingredientes (
              id,
              ingrediente_nome,
              quantidade,
              custo,
              prato_id
            )
          `)
          .eq('usuario_id', user.id);
          
        if (pratosError) {
          setError('Erro ao buscar pratos.');
        } else {
          const pratosCorrigidos = (pratosData || []).map((prato: any) => ({
            ...prato,
            ingredientes: prato.prato_ingredientes || []
          }));
          setPratos(pratosCorrigidos);
          
          // Verificar se há desincronização entre preços de ingredientes e custos dos pratos
          await verificarSincronizacao(pratosCorrigidos, ingredientes || []);
        }
      } catch (err) {
        setError('Erro ao buscar dados.');
      } finally {
        setLoading(false);
      }
    };
    fetchIngredientesEPratos();
  }, [user?.id]);

  // Função para verificar se há desincronização entre preços de ingredientes e custos dos pratos
  const verificarSincronizacao = async (pratos: Prato[], ingredientes: any[]) => {
    if (!user?.id || pratos.length === 0) return;

    try {
      let precisaRecalcular = false;

      for (const prato of pratos) {
        for (const ingredientePrato of prato.ingredientes || []) {
          // Buscar o preço atual do ingrediente
          const ingredienteAtual = ingredientes.find(ing => ing.nome === ingredientePrato.ingrediente_nome);
          
          if (ingredienteAtual) {
            const custoCalculado = ingredienteAtual.custo_por_unidade * ingredientePrato.quantidade;
            const diferenca = Math.abs(custoCalculado - ingredientePrato.custo);
            
            // Se a diferença for maior que 0.01, há desincronização
            if (diferenca > 0.01) {
              console.log(`⚠️ Desincronização detectada no prato "${prato.nome}" - ingrediente "${ingredientePrato.ingrediente_nome}"`);
              console.log(`   Custo atual: R$ ${ingredientePrato.custo.toFixed(4)}`);
              console.log(`   Custo calculado: R$ ${custoCalculado.toFixed(4)}`);
              precisaRecalcular = true;
            }
          }
        }
      }

      if (precisaRecalcular) {
        console.log('🔄 Detectada desincronização de preços. Recarregando dados...');
        setDesincronizacaoDetectada(true);
        
        // Recarregar os dados para mostrar os preços atualizados
        const { data: pratosAtualizados, error } = await supabase
          .from('pratos')
          .select(`
            id,
            nome,
            custo_total,
            usuario_id,
            data_criacao,
            data_atualizacao,
            prato_ingredientes:prato_ingredientes (
              id,
              ingrediente_nome,
              quantidade,
              custo,
              prato_id
            )
          `)
          .eq('usuario_id', user.id);

        if (!error && pratosAtualizados) {
          const pratosCorrigidos = pratosAtualizados.map((prato: any) => ({
            ...prato,
            ingredientes: prato.prato_ingredientes || []
          }));
          setPratos(pratosCorrigidos);
        }
      } else {
        setDesincronizacaoDetectada(false);
      }
    } catch (err) {
      console.error('Erro ao verificar sincronização:', err);
    }
  };

  // Função para formatar quantidade sem decimais desnecessários
  const formatarQuantidade = (quantidade: number) => {
    return quantidade % 1 === 0 ? quantidade.toString() : quantidade.toFixed(2);
  };

  const calcularCustoIngrediente = async (ingrediente: string, quantidade: number): Promise<number> => {
    try {
      const { data, error } = await supabase
        .from('ingredientes')
        .select('custo_por_unidade')
        .eq('usuario_id', user.id)
        .eq('nome', ingrediente)
        .single();
        
      if (error || !data) {
        return 0;
      }
      
      return data.custo_por_unidade * quantidade;
    } catch (err) {
      return 0;
    }
  };

  // Função para recalcular automaticamente todos os custos dos pratos existentes
  const recalcularTodosCustosPratos = async () => {
    if (!user?.id) return;

    setLoading(true);
    setError('');

    try {
      // Buscar todos os pratos do usuário
      const { data: pratos, error: pratosError } = await supabase
        .from('pratos')
        .select('id, nome')
        .eq('usuario_id', user.id);

      if (pratosError) {
        console.error('Erro ao buscar pratos para recálculo:', pratosError);
        setError('Erro ao buscar pratos para recálculo.');
        return;
      }

      // Para cada prato, recalcular seus custos
      for (const prato of pratos || []) {
        // Buscar ingredientes do prato
        const { data: ingredientesPrato, error: ingredientesError } = await supabase
          .from('prato_ingredientes')
          .select('ingrediente_nome, quantidade')
          .eq('prato_id', prato.id);

        if (ingredientesError) {
          console.error(`Erro ao buscar ingredientes do prato ${prato.nome}:`, ingredientesError);
          continue;
        }

        let custoTotalPrato = 0;

        // Recalcular custo de cada ingrediente
        for (const ingrediente of ingredientesPrato || []) {
          const novoCusto = await calcularCustoIngrediente(ingrediente.ingrediente_nome, ingrediente.quantidade);
          
          // Atualizar o custo do ingrediente no prato
          const { error: updateError } = await supabase
            .from('prato_ingredientes')
            .update({ custo: novoCusto })
            .eq('prato_id', prato.id)
            .eq('ingrediente_nome', ingrediente.ingrediente_nome);

          if (updateError) {
            console.error(`Erro ao atualizar custo do ingrediente ${ingrediente.ingrediente_nome} no prato ${prato.nome}:`, updateError);
          } else {
            custoTotalPrato += novoCusto;
          }
        }

        // Atualizar o custo total do prato
        const { error: updatePratoError } = await supabase
          .from('pratos')
          .update({ custo_total: custoTotalPrato })
          .eq('id', prato.id);

        if (updatePratoError) {
          console.error(`Erro ao atualizar custo total do prato ${prato.nome}:`, updatePratoError);
        }
      }

      // Recarregar os dados para mostrar as atualizações
      const { data: pratosData, error: fetchError } = await supabase
        .from('pratos')
        .select(`
          id,
          nome,
          custo_total,
          usuario_id,
          data_criacao,
          data_atualizacao,
          prato_ingredientes:prato_ingredientes (
            id,
            ingrediente_nome,
            quantidade,
            custo,
            prato_id
          )
        `)
        .eq('usuario_id', user.id);

      if (fetchError) {
        setError('Erro ao recarregar dados após sincronização.');
      } else {
        const pratosCorrigidos = (pratosData || []).map((prato: any) => ({
          ...prato,
          ingredientes: prato.prato_ingredientes || []
        }));
        setPratos(pratosCorrigidos);
        setDesincronizacaoDetectada(false);
      }

      console.log('✅ Todos os custos dos pratos foram recalculados automaticamente');
    } catch (err) {
      console.error('Erro ao recalcular custos dos pratos:', err);
      setError('Erro ao sincronizar custos dos pratos.');
    } finally {
      setLoading(false);
    }
  };

  const calcularCustoTotal = (ingredientes: Ingrediente[]): number => {
    return ingredientes.reduce((total, ing) => total + ing.custo, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    
    if (!user?.id) {
      setError('Usuário não autenticado.');
      return;
    }
    
    // Validações do formulário
    if (!formData.nomePrato || formData.nomePrato.trim() === '') {
      setError('Nome do prato é obrigatório.');
      return;
    }
    
    if (formData.ingredientes.length === 0) {
      setError('Pelo menos um ingrediente é obrigatório.');
      return;
    }
    
    
    setLoading(true);
    setError('');
    const custoTotal = calcularCustoTotal(formData.ingredientes);
    
    
    try {
      
      if (editingId) {
        
        // Atualizar prato
        const { error } = await supabase
          .from('pratos')
          .update({
            nome: formData.nomePrato,
            custo_total: custoTotal,
          })
          .eq('id', editingId);
          
        if (error) {
          throw error;
        }
        
        // Deletar ingredientes antigos
        const { error: deleteError } = await supabase
          .from('prato_ingredientes')
          .delete()
          .eq('prato_id', editingId);
          
        if (deleteError) {
          throw deleteError;
        }
        
      } else {
        
        // Adicionar novo prato
        const { data: newPrato, error } = await supabase
          .from('pratos')
          .insert([
            {
              nome: formData.nomePrato,
              custo_total: custoTotal,
              usuario_id: user.id,
            },
          ])
          .select()
          .single();
          
        if (error) {
          throw error;
        }
        
        
        if (newPrato && formData.ingredientes.length > 0) {
          
          const ingredientesToInsert = formData.ingredientes.map(ing => ({
            prato_id: newPrato.id,
            ingrediente_nome: ing.ingrediente,
            quantidade: ing.quantidade,
            custo: ing.custo
          }));
          
          
          const { error: ingredientesError } = await supabase
            .from('prato_ingredientes')
            .insert(ingredientesToInsert)
            .select();
            
          if (ingredientesError) {
            throw ingredientesError;
          }
          
        } else {
        }
      }
      
      
      // Recarregar pratos com ingredientes
      const { data: pratosData, error: fetchError } = await supabase
        .from('pratos')
        .select(`
          id,
          nome,
          custo_total,
          usuario_id,
          data_criacao,
          data_atualizacao,
          prato_ingredientes:prato_ingredientes (
            id,
            ingrediente_nome,
            quantidade,
            custo,
            prato_id
          )
        `)
        .eq('usuario_id', user.id);
        
      if (fetchError) {
        setError('Erro ao recarregar dados.');
      } else {
        // Garantir que o estado seja atualizado antes de fechar o formulário
        const pratosCorrigidos = (pratosData || []).map((prato: any) => ({
          ...prato,
          ingredientes: prato.prato_ingredientes || []
        }));
        setPratos(pratosCorrigidos);
        setFormData({ nomePrato: '', ingredientes: [] });
        setShowForm(false);
        setEditingId(null);
      }
    } catch (err) {
      setError('Erro ao salvar prato.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (prato: Prato) => {
    
    // Converter ingredientes do banco para o formato do formulário
    const ingredientesForm = (prato.ingredientes || []).map(ing => ({
      ingrediente: ing.ingrediente_nome,
      quantidade: ing.quantidade,
      custo: ing.custo
    }));
    
    setFormData({
      nomePrato: prato.nome,
      ingredientes: ingredientesForm
    });
    setEditingId(prato.id);
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
      // Primeiro deletar os ingredientes do prato
      const { error: ingredientesError } = await supabase
        .from('prato_ingredientes')
        .delete()
        .eq('prato_id', id);
      if (ingredientesError) {
        throw ingredientesError;
      }
      // Deletar o preço de venda do prato (para evitar erro de chave estrangeira)
      const { error: precoVendaError } = await supabase
        .from('precos_venda')
        .delete()
        .eq('prato_id', id);
      if (precoVendaError) {
        throw precoVendaError;
      }
      // Depois deletar o prato
      const { error } = await supabase
        .from('pratos')
        .delete()
        .eq('id', id);
      if (error) {
        throw error;
      }
      // Recarregar pratos com ingredientes
      const { data: pratosData, error: fetchError } = await supabase
        .from('pratos')
        .select(`
          id,
          nome,
          custo_total,
          usuario_id,
          data_criacao,
          data_atualizacao,
          prato_ingredientes:prato_ingredientes (
            id,
            ingrediente_nome,
            quantidade,
            custo,
            prato_id
          )
        `)
        .eq('usuario_id', user.id);
      if (fetchError) {
        setError('Erro ao recarregar dados.');
      } else {
        setPratos(pratosData || []);
      }
    } catch (err) {
      setError('Erro ao deletar prato.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({ nomePrato: '', ingredientes: [] });
    setEditingId(null);
    setShowForm(false);
  };

  const addIngrediente = async () => {
    
    if (ingredienteForm.ingrediente && ingredienteForm.quantidade > 0) {
      
      const custo = await calcularCustoIngrediente(ingredienteForm.ingrediente, ingredienteForm.quantidade);
      
      const novoIngrediente: Ingrediente = {
        ingrediente: ingredienteForm.ingrediente,
        quantidade: ingredienteForm.quantidade,
        custo
      };
      
      
      setFormData({
        ...formData,
        ingredientes: [...formData.ingredientes, novoIngrediente]
      });
      
      setIngredienteForm({ ingrediente: '', quantidade: 0 });
    } else {
    }
  };

  const removeIngrediente = (index: number) => {
    setFormData({
      ...formData,
      ingredientes: formData.ingredientes.filter((_, i) => i !== index)
    });
  };

  const insumosDisponiveis = ingredientesDisponiveis;

  return (
    <div className="animate-fadeIn">
      <div className="card">
        <div className="flex justify-between items-center mb-6">
          <h2>
            Custos por Pratos
          </h2>
          <div className="flex gap-2">
            <button 
              className="btn btn-secondary" 
              onClick={recalcularTodosCustosPratos}
              disabled={loading}
              style={{ height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Recalcular todos os custos dos pratos com base nos preços atuais dos ingredientes"
            >
              <RotateCw size={16} />
              Sincronizar Custos
            </button>
            <button 
              className="btn btn-primary" 
              onClick={() => setShowForm(true)}
              disabled={showForm}
              style={{ height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Plus size={16} />
              Adicionar Prato
            </button>
          </div>
        </div>



        {insumosDisponiveis.length === 0 && (
          <div className="alert alert-warning animate-scaleIn">
            <AlertCircle size={18} />
            <div>
              <strong>Atenção!</strong> Você precisa cadastrar ingredientes na aba "Custos por Insumos" antes de criar pratos.
            </div>
          </div>
        )}

        {desincronizacaoDetectada && (
          <div className="alert alert-info animate-scaleIn">
            <RotateCw size={18} />
            <div>
              <strong>Sincronização Automática!</strong> Os preços dos ingredientes foram atualizados e os custos dos pratos foram recalculados automaticamente.
            </div>
          </div>
        )}

        {error && (
          <div className="alert alert-danger animate-slideIn">{error}</div>
        )}
        {loading && (
          <div className="loading-spinner" style={{ margin: '2rem auto' }} />
        )}

        {showForm && (
          <div className="card animate-scaleIn" style={{ backgroundColor: 'rgba(45, 45, 45, 0.9)' }}>
            <h3>{editingId ? 'Editar Prato' : 'Novo Prato'}</h3>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nome do Prato</label>
                <input
                  type="text"
                  value={formData.nomePrato}
                  onChange={(e) => setFormData({ ...formData, nomePrato: e.target.value })}
                  placeholder="Nome do prato"
                  required
                />
              </div>

              <div className="card" style={{ backgroundColor: 'rgba(55, 55, 55, 0.8)', marginTop: '1rem' }}>
                <h4>Adicionar Ingredientes</h4>
                
                <div className="grid grid-2">
                  <div className="form-group">
                    <label>Ingrediente</label>
                    <select
                      value={ingredienteForm.ingrediente}
                      onChange={(e) => setIngredienteForm({ ...ingredienteForm, ingrediente: e.target.value })}
                    >
                      <option value="">Selecione um ingrediente</option>
                      {insumosDisponiveis.map((ingrediente) => (
                        <option key={ingrediente} value={ingrediente}>
                          {ingrediente}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Quantidade</label>
                    <input
                      type="number"
                      step="0.01"
                      value={ingredienteForm.quantidade}
                      onChange={(e) => setIngredienteForm({ ...ingredienteForm, quantidade: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                    />
                  </div>
                </div>
                
                <button 
                  type="button" 
                  className="btn btn-success" 
                  onClick={addIngrediente}
                  disabled={!ingredienteForm.ingrediente || ingredienteForm.quantidade <= 0}
                >
                  <Plus size={16} />
                  Adicionar Ingrediente
                </button>
              </div>

              {/* Lista de Ingredientes do Prato */}
              {formData.ingredientes.length > 0 && (
                <div className="card animate-slideIn" style={{ backgroundColor: 'rgba(55, 55, 55, 0.8)', marginTop: '1rem' }}>
                  <h4>Ingredientes do Prato</h4>
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Ingrediente</th>
                          <th>Quantidade</th>
                          <th>Custo</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.ingredientes.map((ing, index) => (
                          <tr key={index}>
                            <td className="font-medium">{ing.ingrediente}</td>
                            <td>{formatarQuantidade(ing.quantidade)}</td>
                            <td>R$ {ing.custo.toFixed(2)}</td>
                            <td>
                              <button 
                                type="button" 
                                className="btn btn-danger" 
                                onClick={() => removeIngrediente(index)}
                                style={{ padding: '0.5rem', minWidth: 'auto' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="summary-card" style={{ marginTop: '1rem' }}>
                    <h3>Custo Total</h3>
                    <div className="value">R$ {calcularCustoTotal(formData.ingredientes).toFixed(2)}</div>
                  </div>
                </div>
              )}
              
              <div className="flex gap-2 mt-4">
                <button type="submit" className="btn btn-success" disabled={formData.ingredientes.length === 0}>
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

        {pratos.length > 0 ? (
          <div className="table-container animate-slideIn">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome do Prato</th>
                  <th>Custo Total</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {pratos.map((prato) => (
                  <tr key={prato.id}>
                    <td className="font-medium">{prato.nome}</td>
                    <td className="font-semibold">R$ {prato.custo_total.toFixed(2)}</td>
                    <td>
                      <div className="flex gap-2">
                        <button 
                          className="btn btn-secondary" 
                          onClick={() => setViewingDetails(viewingDetails === prato.id ? null : prato.id)}
                          style={{ padding: '0.5rem', minWidth: 'auto' }}
                          title="Ver detalhes"
                        >
                          <Eye size={14} />
                        </button>
                        <button 
                          className="btn btn-primary" 
                          onClick={() => handleEdit(prato)}
                          style={{ padding: '0.5rem', minWidth: 'auto' }}
                          title="Editar"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          className="btn btn-danger" 
                          onClick={() => handleDelete(prato.id)}
                          style={{ padding: '0.5rem', minWidth: 'auto' }}
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Detalhes do Prato */}
            {viewingDetails && (
              <div className="card animate-slideIn" style={{ marginTop: '20px', backgroundColor: 'rgba(45, 45, 45, 0.9)' }}>
                {(() => {
                  const prato = pratos.find(p => p.id === viewingDetails);
                  
                  if (!prato) {
                    return null;
                  }
                  
                  const ingredientes = prato.ingredientes || [];
                  
                  const totalIngredientes = ingredientes.length;
                  const pesoTotal = ingredientes.reduce((total, ing) => total + ing.quantidade, 0);
                  
                  
                  return (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3>Detalhes do Prato: {prato.nome}</h3>
                        <button 
                          className="btn btn-secondary"
                          onClick={() => setViewingDetails(null)}
                          style={{ padding: '0.5rem', minWidth: 'auto' }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                      
                      <div className="table-container">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Ingrediente</th>
                              <th>Quantidade</th>
                              <th>Custo Individual</th>
                              <th>% do Custo Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ingredientes.length > 0 ? (
                              ingredientes.map((ing, index) => {
                                return (
                                  <tr key={index}>
                                    <td className="font-medium">{ing.ingrediente_nome}</td>
                                    <td>{formatarQuantidade(ing.quantidade)}</td>
                                    <td>R$ {ing.custo.toFixed(2)}</td>
                                    <td>{((ing.custo / prato.custo_total) * 100).toFixed(1)}%</td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan={4} style={{ textAlign: 'center' }}>
                                  Nenhum ingrediente cadastrado para este prato.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      
                      <div className="summary-card" style={{ marginTop: '1rem' }}>
                        <h4>Resumo do Prato</h4>
                        <div className="grid grid-3" style={{ marginTop: '10px' }}>
                          <div style={{ textAlign: 'center' }}>
                            <strong>Total de Ingredientes:</strong>
                            <div style={{ fontSize: '16px', color: 'var(--orange-accent)' }}>
                              {totalIngredientes}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <strong>Peso Total:</strong>
                            <div style={{ fontSize: '16px', color: 'var(--orange-accent)' }}>
                              {formatarQuantidade(pesoTotal)}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <strong>Custo Total:</strong>
                            <div style={{ fontSize: '16px', color: '#28a745' }}>
                              R$ {prato.custo_total.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        ) : (
          <div className="empty-state">
            <Plus size={48} className="empty-state-icon" />
            <h3>Nenhum prato cadastrado</h3>
            <p>Crie seus primeiros pratos para calcular os custos automaticamente.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustosPratos; 