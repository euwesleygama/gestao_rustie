import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useUser } from '../lib/UserContext';

interface CustoFixo {
  id: string;
  nome: string;
  valor: number;
}

interface CustoIncalculavel {
  id: string;
  nome: string;
  percentual: number;
}

interface TaxaPagamento {
  id: string;
  tipo: 'credito' | 'debito' | 'pix' | 'dinheiro';
  taxa: number; // porcentagem
}

const OutrosCustos: React.FC = () => {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<'fixos' | 'incalculaveis' | 'taxas'>('fixos');
  
  // Custos Fixos
  const [custosFixos, setCustosFixos] = useState<CustoFixo[]>([]);
  const [showFormFixos, setShowFormFixos] = useState(false);
  const [formDataFixos, setFormDataFixos] = useState({ nome: '', valor: 0 });
  
  // Custos Incalculáveis
  const [custosIncalculaveis, setCustosIncalculaveis] = useState<CustoIncalculavel[]>([]);
  const [showFormIncalculaveis, setShowFormIncalculaveis] = useState(false);
  const [formDataIncalculaveis, setFormDataIncalculaveis] = useState({ nome: '', valor: 0 });
  
  // Taxas de Pagamento
  const [taxasPagamento, setTaxasPagamento] = useState<TaxaPagamento[]>([]);
  const [showFormTaxas, setShowFormTaxas] = useState(false);
  const [formDataTaxas, setFormDataTaxas] = useState<{ tipo: 'credito' | 'debito' | 'pix' | 'dinheiro'; taxa: number }>({ tipo: 'credito', taxa: 0 });
  
  // Faturamento
  const [faturamentoMensal, setFaturamentoMensal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      // Custos Fixos
      const { data: fixos, error: fixosError } = await supabase
        .from('custos_fixos')
        .select('*')
        .eq('usuario_id', user?.id);
      if (fixosError) setError('Erro ao buscar custos fixos.');
      else setCustosFixos(fixos || []);
      // Custos Incalculáveis
      const { data: incalculaveis, error: incalculaveisError } = await supabase
        .from('custos_incalculaveis')
        .select('*')
        .eq('usuario_id', user?.id);
      if (incalculaveisError) setError('Erro ao buscar custos incalculáveis.');
      else setCustosIncalculaveis(incalculaveis || []);
      // Taxas de Pagamento
      const { data: taxas, error: taxasError } = await supabase
        .from('taxas_pagamento')
        .select('*')
        .eq('usuario_id', user?.id);
      if (taxasError) setError('Erro ao buscar taxas de pagamento.');
      else setTaxasPagamento(taxas || []);
      // Faturamento Mensal
      const { data: vendas, error: vendasError } = await supabase
        .from('vendas_diarias')
        .select('faturamento')
        .eq('usuario_id', user?.id);
      if (vendasError) setError('Erro ao buscar faturamento mensal.');
      else setFaturamentoMensal((vendas || []).reduce((total: number, venda: any) => total + (venda.faturamento || 0), 0));
      setLoading(false);
    };
    if (user) fetchData();
  }, [user]);

  // Cálculos
  const getTotalCustosFixos = () => {
    return custosFixos.reduce((total, custo) => total + custo.valor, 0);
  };



  const getPorcentagemCustos = () => {
    return custosIncalculaveis.reduce((total, custo) => total + (custo.percentual ?? 0), 0);
  };

  const getPorcentagemCustosFixos = () => {
    const totalCustosFixos = getTotalCustosFixos();
    if (faturamentoMensal === 0 || isNaN(faturamentoMensal)) return 0;
    
    const percentagem = (totalCustosFixos / faturamentoMensal) * 100;
    return isNaN(percentagem) ? 0 : percentagem;
  };

  // Handlers para Custos Fixos
  const handleSubmitFixos = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase
        .from('custos_fixos')
        .insert([
          { nome: formDataFixos.nome, valor: formDataFixos.valor, usuario_id: user?.id },
        ]);
      if (error) throw error;
      const { data: fixos } = await supabase
        .from('custos_fixos')
        .select('*')
        .eq('usuario_id', user?.id);
      setCustosFixos(fixos || []);
      setFormDataFixos({ nome: '', valor: 0 });
      setShowFormFixos(false);
    } catch (err) {
      setError('Erro ao salvar custo fixo.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFixo = async (id: string) => {
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase
        .from('custos_fixos')
        .delete()
        .eq('id', id)
        .eq('usuario_id', user?.id);
      if (error) throw error;
      const { data: fixos } = await supabase
        .from('custos_fixos')
        .select('*')
        .eq('usuario_id', user?.id);
      setCustosFixos(fixos || []);
    } catch (err) {
      setError('Erro ao deletar custo fixo.');
    } finally {
      setLoading(false);
    }
  };

  // Handlers para Custos Incalculáveis
  const handleSubmitIncalculaveis = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase
        .from('custos_incalculaveis')
        .insert([
          { nome: formDataIncalculaveis.nome, percentual: formDataIncalculaveis.valor, usuario_id: user?.id },
        ]);
      if (error) throw error;
      const { data: incalculaveis } = await supabase
        .from('custos_incalculaveis')
        .select('*')
        .eq('usuario_id', user?.id);
      setCustosIncalculaveis(incalculaveis || []);
      setFormDataIncalculaveis({ nome: '', valor: 0 });
      setShowFormIncalculaveis(false);
    } catch (err) {
      setError('Erro ao salvar custo incalculável.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteIncalculavel = async (id: string) => {
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase
        .from('custos_incalculaveis')
        .delete()
        .eq('id', id)
        .eq('usuario_id', user?.id);
      if (error) throw error;
      const { data: incalculaveis } = await supabase
        .from('custos_incalculaveis')
        .select('*')
        .eq('usuario_id', user?.id);
      setCustosIncalculaveis(incalculaveis || []);
    } catch (err) {
      setError('Erro ao deletar custo incalculável.');
    } finally {
      setLoading(false);
    }
  };

  // Handlers para Taxas de Pagamento
  const handleSubmitTaxas = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase
        .from('taxas_pagamento')
        .insert([
          { tipo: formDataTaxas.tipo, taxa: formDataTaxas.taxa, usuario_id: user?.id },
        ]);
      if (error) throw error;
      const { data: taxas } = await supabase
        .from('taxas_pagamento')
        .select('*')
        .eq('usuario_id', user?.id);
      setTaxasPagamento(taxas || []);
      setFormDataTaxas({ tipo: 'credito', taxa: 0 });
      setShowFormTaxas(false);
    } catch (err) {
      setError('Erro ao salvar taxa de pagamento.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTaxa = async (id: string) => {
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase
        .from('taxas_pagamento')
        .delete()
        .eq('id', id)
        .eq('usuario_id', user?.id);
      if (error) throw error;
      const { data: taxas } = await supabase
        .from('taxas_pagamento')
        .select('*')
        .eq('usuario_id', user?.id);
      setTaxasPagamento(taxas || []);
    } catch (err) {
      setError('Erro ao deletar taxa de pagamento.');
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="animate-fadeIn">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>Outros Custos</h2>
        </div>

        {error && (
          <div className="alert alert-danger animate-slideIn">{error}</div>
        )}
        {loading && (
          <div className="loading-spinner" style={{ margin: '2rem auto' }} />
        )}

        {/* Resumo Geral */}
        <div className="grid grid-4" style={{ marginBottom: '20px' }}>
          <div className="card summary-card">
            <h3>Custos fixos (R$)</h3>
            <div className="value">R$ {getTotalCustosFixos().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          
          <div className="card summary-card">
            <h3>Custos Fixos (%)</h3>
            <div className="value">{getPorcentagemCustosFixos().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</div>
          </div>
          
          <div className="card summary-card">
            <h3>Custos Incalculáveis</h3>
            <div className="value">{getPorcentagemCustos().toFixed(1)}%</div>
          </div>
          
          <div className="card summary-card">
            <h3>Faturamento Total</h3>
            <div className="value">R$ {faturamentoMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        </div>

        {/* Abas */}
        <div className="sub-tabs">
          <button
            className={`sub-tab ${activeTab === 'fixos' ? 'active' : ''}`}
            onClick={() => setActiveTab('fixos')}
          >
            Custos Fixos
          </button>
          <button
            className={`sub-tab ${activeTab === 'incalculaveis' ? 'active' : ''}`}
            onClick={() => setActiveTab('incalculaveis')}
          >
            Custos Incalculáveis
          </button>
          <button
            className={`sub-tab ${activeTab === 'taxas' ? 'active' : ''}`}
            onClick={() => setActiveTab('taxas')}
          >
            Taxas de Pagamento
          </button>
        </div>

        {/* Conteúdo das Abas */}
        {activeTab === 'fixos' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Custos Fixos</h3>
              <button 
                className="btn btn-primary" 
                onClick={() => setShowFormFixos(true)}
                disabled={showFormFixos}
                style={{ height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Plus size={18} style={{ marginRight: '8px' }} />
                Adicionar Custo
              </button>
            </div>

            {showFormFixos && (
              <form onSubmit={handleSubmitFixos} className="card animate-scaleIn" style={{ backgroundColor: 'rgba(45, 45, 45, 0.9)', marginBottom: '20px' }}>
                <div className="grid grid-2">
                  <div className="form-group">
                    <label>Nome da Despesa</label>
                    <input
                      type="text"
                      value={formDataFixos.nome}
                      onChange={(e) => setFormDataFixos({ ...formDataFixos, nome: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Valor (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formDataFixos.valor}
                      onChange={(e) => setFormDataFixos({ ...formDataFixos, valor: parseFloat(e.target.value) || 0 })}
                      required
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" className="btn btn-success">
                    <Save size={18} style={{ marginRight: '8px' }} />
                    Salvar
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowFormFixos(false)}>
                    <X size={18} style={{ marginRight: '8px' }} />
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {custosFixos.length > 0 ? (
              <div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nome da Despesa</th>
                      <th>Valor</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {custosFixos.map((custo) => (
                      <tr key={custo.id}>
                        <td>{custo.nome}</td>
                        <td>R$ {custo.valor.toFixed(2)}</td>
                        <td>
                          <button 
                            className="btn btn-danger btn-small" 
                            onClick={() => handleDeleteFixo(custo.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Removido o total de custos fixos e incalculáveis */}
              </div>
            ) : (
              <p>Nenhum custo fixo cadastrado.</p>
            )}
          </div>
        )}

        {activeTab === 'incalculaveis' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Custos Incalculáveis</h3>
              <button 
                className="btn btn-primary" 
                onClick={() => setShowFormIncalculaveis(true)}
                disabled={showFormIncalculaveis}
                style={{ height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Plus size={18} style={{ marginRight: '8px' }} />
                Adicionar Custo
              </button>
            </div>

            {showFormIncalculaveis && (
              <form onSubmit={handleSubmitIncalculaveis} className="card animate-scaleIn" style={{ backgroundColor: 'rgba(45, 45, 45, 0.9)', marginBottom: '20px' }}>
                <div className="grid grid-2">
                  <div className="form-group">
                    <label>Nome do Custo</label>
                    <input
                      type="text"
                      value={formDataIncalculaveis.nome}
                      onChange={(e) => setFormDataIncalculaveis({ ...formDataIncalculaveis, nome: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Valor (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formDataIncalculaveis.valor}
                      onChange={(e) => setFormDataIncalculaveis({ ...formDataIncalculaveis, valor: parseFloat(e.target.value) || 0 })}
                      required
                      placeholder="Ex: 5.5"
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" className="btn btn-success">
                    <Save size={18} style={{ marginRight: '8px' }} />
                    Salvar
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowFormIncalculaveis(false)}>
                    <X size={18} style={{ marginRight: '8px' }} />
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {custosIncalculaveis.length > 0 ? (
              <div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nome do Custo</th>
                      <th>Porcentagem</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {custosIncalculaveis.map((custo) => (
                      <tr key={custo.id}>
                        <td>{custo.nome}</td>
                        <td>{(custo.percentual ?? 0).toFixed(2)}%</td>
                        <td>
                          <button 
                            className="btn btn-danger btn-small" 
                            onClick={() => handleDeleteIncalculavel(custo.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Removido o total de custos incalculáveis */}
              </div>
            ) : (
              <p>Nenhum custo incalculável cadastrado.</p>
            )}
          </div>
        )}

        {activeTab === 'taxas' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Taxas de Pagamento</h3>
              <button 
                className="btn btn-primary" 
                onClick={() => setShowFormTaxas(true)}
                disabled={showFormTaxas}
                style={{ height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Plus size={18} style={{ marginRight: '8px' }} />
                Adicionar Taxa
              </button>
            </div>

            {showFormTaxas && (
              <form onSubmit={handleSubmitTaxas} className="card animate-scaleIn" style={{ backgroundColor: 'rgba(45, 45, 45, 0.9)', marginBottom: '20px' }}>
                <div className="grid grid-2">
                  <div className="form-group">
                    <label>Tipo de Pagamento</label>
                    <select
                      value={formDataTaxas.tipo}
                      onChange={(e) => setFormDataTaxas({ ...formDataTaxas, tipo: e.target.value as any })}
                      required
                    >
                      <option value="credito">Cartão de Crédito</option>
                      <option value="debito">Cartão de Débito</option>
                      <option value="pix">PIX</option>
                      <option value="dinheiro">Dinheiro</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Taxa (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formDataTaxas.taxa}
                      onChange={(e) => setFormDataTaxas({ ...formDataTaxas, taxa: parseFloat(e.target.value) || 0 })}
                      required
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" className="btn btn-success">
                    <Save size={18} style={{ marginRight: '8px' }} />
                    Salvar
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowFormTaxas(false)}>
                    <X size={18} style={{ marginRight: '8px' }} />
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            <table className="table">
              <thead>
                <tr>
                  <th>Tipo de Pagamento</th>
                  <th>Taxa</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {taxasPagamento.map((taxa) => (
                  <tr key={taxa.id}>
                    <td>
                      {taxa.tipo === 'credito' && 'Cartão de Crédito'}
                      {taxa.tipo === 'debito' && 'Cartão de Débito'}
                      {taxa.tipo === 'pix' && 'PIX'}
                      {taxa.tipo === 'dinheiro' && 'Dinheiro'}
                    </td>
                    <td>{taxa.taxa.toFixed(2)}%</td>
                    <td>
                      <button 
                        className="btn btn-danger btn-small" 
                        onClick={() => handleDeleteTaxa(taxa.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default OutrosCustos; 