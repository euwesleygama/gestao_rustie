import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useUser } from '../lib/UserContext';

interface DadosMensal {
  mes: string;
  ano: number;
  faturamento: number;
  custos: number;
  lucro: number;
  numero_vendas: number;
  ticket_medio: number;
}

const ControleMensal: React.FC = () => {
  const { user } = useUser();
  const [dadosMensais, setDadosMensais] = useState<DadosMensal[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [anoFiltro, setAnoFiltro] = useState(new Date().getFullYear());
  const [metricasVisiveis, setMetricasVisiveis] = useState({
    faturamento: true,
    custos: true,
    lucro: true
  });
  const [tooltipData, setTooltipData] = useState({
    visible: false,
    x: 0,
    y: 0,
    content: ''
  });
  // Ajustar o formData para usar os nomes do banco
  const [formData, setFormData] = useState({
    mes: '',
    ano: new Date().getFullYear(),
    faturamento: 0,
    custos: 0,
    numero_vendas: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  useEffect(() => {
    const fetchDadosMensais = async () => {
      setLoading(true);
      setError('');
      const { data, error } = await supabase
        .from('dados_mensais')
        .select('*')
        .eq('usuario_id', user?.id);
      if (error) setError('Erro ao buscar dados mensais.');
      else setDadosMensais(data || []);
      setLoading(false);
    };
    if (user) fetchDadosMensais();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const lucro = formData.faturamento - formData.custos;
    const ticketMedio = formData.numero_vendas > 0 ? formData.faturamento / formData.numero_vendas : 0;
    try {
      // Remove dados existentes do mesmo mês/ano se houver
      await supabase
        .from('dados_mensais')
        .delete()
        .eq('mes', formData.mes)
        .eq('ano', formData.ano)
        .eq('usuario_id', user?.id);
      // Log do objeto enviado
      const objInsert = {
            mes: formData.mes,
            ano: formData.ano,
            faturamento: formData.faturamento,
            custos: formData.custos,
            lucro,
        numero_vendas: formData.numero_vendas,
        ticket_medio: ticketMedio,
        usuario_id: user?.id,
        data_criacao: new Date().toISOString(),
        data_atualizacao: new Date().toISOString(),
      };
      const { error } = await supabase
        .from('dados_mensais')
        .insert([objInsert]);
      if (error) {
        throw error;
      }
      const { data } = await supabase
        .from('dados_mensais')
        .select('*')
        .eq('usuario_id', user?.id);
      setDadosMensais(data || []);
      setFormData({
        mes: '',
        ano: new Date().getFullYear(),
        faturamento: 0,
        custos: 0,
        numero_vendas: 0
      });
      setShowForm(false);
    } catch (err) {
      setError('Erro ao salvar dados mensais.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (mes: string, ano: number) => {
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase
        .from('dados_mensais')
        .delete()
        .eq('mes', mes)
        .eq('ano', ano)
        .eq('usuario_id', user?.id);
      if (error) throw error;
      const { data } = await supabase
        .from('dados_mensais')
        .select('*')
        .eq('usuario_id', user?.id);
      setDadosMensais(data || []);
    } catch (err) {
      setError('Erro ao deletar dados mensais.');
    } finally {
      setLoading(false);
    }
  };

  const getDadosDoAno = () => {
    return dadosMensais.filter(dado => dado.ano === anoFiltro);
  };

  const getTotalFaturamentoAno = () => {
    return getDadosDoAno().reduce((total, dado) => total + dado.faturamento, 0);
  };

  const getTotalCustosAno = () => {
    return getDadosDoAno().reduce((total, dado) => total + dado.custos, 0);
  };

  const getTotalLucroAno = () => {
    return getDadosDoAno().reduce((total, dado) => total + dado.lucro, 0);
  };

  const getMediaMensal = () => {
    const dados = getDadosDoAno();
    if (dados.length === 0) return 0;
    return getTotalFaturamentoAno() / dados.length;
  };

  const getMelhorMes = () => {
    const dados = getDadosDoAno();
    if (dados.length === 0) return '-';
    return dados.reduce((melhor, atual) => 
      atual.faturamento > melhor.faturamento ? atual : melhor
    ).mes;
  };

  const getMargemLucroMedia = () => {
    const totalFaturamento = getTotalFaturamentoAno();
    const totalLucro = getTotalLucroAno();
    if (totalFaturamento === 0) return 0;
    return (totalLucro / totalFaturamento) * 100;
  };

  return (
    <div className="animate-fadeIn">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', overflow: 'visible' }}>
          <h2>Controle Mensal</h2>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'end', overflow: 'visible' }}>
            <div className="form-group" style={{ margin: 0, minWidth: '120px', position: 'relative', zIndex: 1000 }}>
              <label style={{ marginBottom: '5px' }}>Ano:</label>
              <select
                value={anoFiltro}
                onChange={(e) => setAnoFiltro(parseInt(e.target.value))}
                style={{ 
                  height: '50px', 
                  position: 'relative', 
                  zIndex: 1000,
                  fontSize: '16px',
                  padding: '14px 40px 14px 16px',
                  lineHeight: '1.2',
                  verticalAlign: 'middle'
                }}
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(ano => (
                  <option key={ano} value={ano}>{ano}</option>
                ))}
              </select>
            </div>
            <button 
              className="btn btn-primary" 
              onClick={() => setShowForm(true)}
              disabled={showForm}
              style={{ height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <BarChart3 size={18} style={{ marginRight: '8px' }} />
              Adicionar Dados
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger animate-slideIn">{error}</div>
        )}
        {loading && (
          <div className="loading-spinner" style={{ margin: '2rem auto' }} />
        )}

        {/* Resumo Anual */}
        {/* Primeira linha: Faturamento, Custo, Lucro, Média Mensal */}
        <div className="grid grid-4" style={{ marginBottom: '20px' }}>
          <div className="card summary-card">
            <h3>Faturamento Total</h3>
            <div className="value" style={{ color: '#ffc107' }}>R$ {getTotalFaturamentoAno().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          
          <div className="card summary-card">
            <h3>Total de Custos</h3>
            <div className="value" style={{ color: '#dc3545' }}>R$ {getTotalCustosAno().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          
          <div className="card summary-card">
            <h3>Lucro Total</h3>
            <div className="value" style={{ color: '#28a745' }}>R$ {getTotalLucroAno().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          
          <div className="card summary-card">
            <h3>Média Mensal</h3>
            <div className="value">R$ {getMediaMensal().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        </div>

        {/* Segunda linha: Margem de Lucro e Melhor Mês */}
        <div className="grid grid-2" style={{ marginBottom: '20px' }}>
          <div className="card summary-card">
            <h3>Margem de Lucro Média</h3>
            <div className="value" style={{ color: '#fff' }}>{getMargemLucroMedia().toFixed(1)}%</div>
          </div>
          
          <div className="card summary-card">
            <h3>Melhor Mês</h3>
            <div className="value">{getMelhorMes()}</div>
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="card animate-scaleIn" style={{ backgroundColor: 'rgba(45, 45, 45, 0.9)' }}>
            <h3>Adicionar Dados Mensais</h3>
            
            <div className="grid grid-3">
              <div className="form-group">
                <label>Mês</label>
                <select
                  value={formData.mes}
                  onChange={(e) => setFormData({ ...formData, mes: e.target.value })}
                  required
                >
                  <option value="">Selecione um mês</option>
                  {meses.map(mes => (
                    <option key={mes} value={mes}>{mes}</option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label>Ano</label>
                <select
                  value={formData.ano}
                  onChange={(e) => setFormData({ ...formData, ano: parseInt(e.target.value) })}
                  required
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(ano => (
                    <option key={ano} value={ano}>{ano}</option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label>Faturamento Total (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.faturamento}
                  onChange={(e) => setFormData({ ...formData, faturamento: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Custos Totais (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.custos}
                  onChange={(e) => setFormData({ ...formData, custos: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Número de Vendas</label>
                <input
                  type="number"
                  value={formData.numero_vendas}
                  onChange={(e) => setFormData({ ...formData, numero_vendas: parseInt(e.target.value) || 0 })}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Lucro Calculado (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={(formData.faturamento - formData.custos).toFixed(2)}
                  readOnly
                  style={{ backgroundColor: 'rgba(65, 65, 65, 0.9)' }}
                />
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button type="submit" className="btn btn-success">
                <TrendingUp size={18} style={{ marginRight: '8px' }} />
                Salvar Dados
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                Cancelar
              </button>
            </div>
          </form>
        )}

        {getDadosDoAno().length > 0 ? (
          <div className="animate-slideIn">
            <h3>Dados de {anoFiltro}</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Mês</th>
                  <th>Faturamento</th>
                  <th>Custos</th>
                  <th>Lucro</th>
                  <th>Margem (%)</th>
                  <th>Vendas</th>
                  <th>Ticket Médio</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {getDadosDoAno()
                  .sort((a, b) => meses.indexOf(a.mes) - meses.indexOf(b.mes))
                  .map((dado) => (
                  <tr key={`${dado.mes}-${dado.ano}`}>
                    <td>{dado.mes}</td>
                    <td>R$ {dado.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td>R$ {dado.custos.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ 
                      fontWeight: 'bold', 
                      color: dado.lucro >= 0 ? '#28a745' : '#dc3545' 
                    }}>
                      R$ {dado.lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td>
                      {dado.faturamento > 0 ? 
                        `${((dado.lucro / dado.faturamento) * 100).toFixed(1)}%` : 
                        '0%'
                      }
                    </td>
                    <td>{dado.numero_vendas}</td>
                    <td>R$ {dado.ticket_medio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td>
                      <button 
                        className="btn btn-danger btn-small" 
                        onClick={() => handleDelete(dado.mes, dado.ano)}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Gráfico de Linhas de Evolução */}
            <div className="card animate-slideIn" style={{ marginTop: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Evolução Anual - {anoFiltro}</h3>
                
                {/* Controles de Métricas */}
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px' }}>
                    <input
                      type="checkbox"
                      checked={metricasVisiveis.faturamento}
                      onChange={(e) => setMetricasVisiveis(prev => ({ ...prev, faturamento: e.target.checked }))}
                    />
                    <span style={{ color: '#ffc107' }}>●</span> Faturamento
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px' }}>
                    <input
                      type="checkbox"
                      checked={metricasVisiveis.custos}
                      onChange={(e) => setMetricasVisiveis(prev => ({ ...prev, custos: e.target.checked }))}
                    />
                    <span style={{ color: '#dc3545' }}>●</span> Custos
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px' }}>
                    <input
                      type="checkbox"
                      checked={metricasVisiveis.lucro}
                      onChange={(e) => setMetricasVisiveis(prev => ({ ...prev, lucro: e.target.checked }))}
                    />
                    <span style={{ color: '#28a745' }}>●</span> Lucro
                  </label>
                </div>
              </div>

              <div style={{ position: 'relative', padding: '20px', minHeight: '250px' }}>
                {(() => {
                  const dadosOrdenados = getDadosDoAno().sort((a, b) => meses.indexOf(a.mes) - meses.indexOf(b.mes));
                  if (dadosOrdenados.length === 0) return <p>Nenhum dado disponível</p>;

                  const maxFaturamento = Math.max(...dadosOrdenados.map(d => d.faturamento));
                  const maxCustos = Math.max(...dadosOrdenados.map(d => d.custos));
                  const maxLucro = Math.max(...dadosOrdenados.map(d => d.lucro));
                  const minLucro = Math.min(...dadosOrdenados.map(d => d.lucro));
                  
                  const maxValue = Math.max(maxFaturamento, maxCustos, maxLucro);
                  const minValue = Math.min(0, minLucro);
                  const range = maxValue - minValue;
                  const graphHeight = 180;
                  const graphWidth = 600;
                  const pointSpacing = graphWidth / (dadosOrdenados.length - 1 || 1);

                  const getY = (value: number) => {
                    return graphHeight - ((value - minValue) / range * graphHeight);
                  };

                  const createPath = (dados: number[]) => {
                    return dados.map((valor, index) => {
                      const x = index * pointSpacing;
                      const y = getY(valor);
                      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
                    }).join(' ');
                  };

                  const handleMouseEnter = (event: React.MouseEvent, tipo: string, valor: number, mes: string) => {
                    const rect = (event.currentTarget as SVGElement).getBoundingClientRect();
                    const containerRect = (event.currentTarget as SVGElement).closest('.card')?.getBoundingClientRect();
                    
                    if (containerRect) {
                      setTooltipData({
                        visible: true,
                        x: rect.left - containerRect.left + rect.width / 2,
                        y: rect.top - containerRect.top - 10,
                        content: `${tipo} ${mes}: R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      });
                    }
                  };

                  const handleMouseLeave = () => {
                    setTooltipData(prev => ({ ...prev, visible: false }));
                  };

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <svg width={graphWidth} height={graphHeight + 40} style={{ overflow: 'visible' }}>
                        {/* Linha de referência zero */}
                        {minValue < 0 && (
                          <line
                            x1="0"
                            y1={getY(0)}
                            x2={graphWidth}
                            y2={getY(0)}
                            stroke="rgba(255, 255, 255, 0.3)"
                            strokeDasharray="2,2"
                            strokeWidth="1"
                          />
                        )}

                        {/* Linha de Faturamento */}
                        {metricasVisiveis.faturamento && (
                          <path
                            d={createPath(dadosOrdenados.map(d => d.faturamento))}
                            fill="none"
                            stroke="#ffc107"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        )}

                        {/* Linha de Custos */}
                        {metricasVisiveis.custos && (
                          <path
                            d={createPath(dadosOrdenados.map(d => d.custos))}
                            fill="none"
                            stroke="#dc3545"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        )}

                        {/* Linha de Lucro */}
                        {metricasVisiveis.lucro && (
                          <path
                            d={createPath(dadosOrdenados.map(d => d.lucro))}
                            fill="none"
                            stroke="#28a745"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        )}

                        {/* Pontos */}
                        {dadosOrdenados.map((dado, index) => {
                          const x = index * pointSpacing;
                          return (
                            <g key={dado.mes}>
                              {metricasVisiveis.faturamento && (
                                <circle
                                  cx={x}
                                  cy={getY(dado.faturamento)}
                                  r="4"
                                  fill="#ffc107"
                                  stroke="#fff"
                                  strokeWidth="2"
                                  style={{ cursor: 'pointer' }}
                                  onMouseEnter={(e) => handleMouseEnter(e, 'Faturamento', dado.faturamento, dado.mes)}
                                  onMouseLeave={handleMouseLeave}
                                />
                              )}
                              {metricasVisiveis.custos && (
                                <circle
                                  cx={x}
                                  cy={getY(dado.custos)}
                                  r="4"
                                  fill="#dc3545"
                                  stroke="#fff"
                                  strokeWidth="2"
                                  style={{ cursor: 'pointer' }}
                                  onMouseEnter={(e) => handleMouseEnter(e, 'Custos', dado.custos, dado.mes)}
                                  onMouseLeave={handleMouseLeave}
                                />
                              )}
                              {metricasVisiveis.lucro && (
                                <circle
                                  cx={x}
                                  cy={getY(dado.lucro)}
                                  r="4"
                                  fill="#28a745"
                                  stroke="#fff"
                                  strokeWidth="2"
                                  style={{ cursor: 'pointer' }}
                                  onMouseEnter={(e) => handleMouseEnter(e, 'Lucro', dado.lucro, dado.mes)}
                                  onMouseLeave={handleMouseLeave}
                                />
                              )}
                            </g>
                          );
                        })}

                        {/* Labels dos meses */}
                        {dadosOrdenados.map((dado, index) => {
                          const x = index * pointSpacing;
                    return (
                            <text
                              key={`label-${dado.mes}`}
                              x={x}
                              y={graphHeight + 20}
                              textAnchor="middle"
                              fontSize="12"
                              fill="#666"
                            >
                              {dado.mes.substring(0, 3)}
                            </text>
                          );
                        })}
                      </svg>

                      {/* Tooltip personalizado */}
                      {tooltipData.visible && (
                        <div
                          style={{
                            position: 'absolute',
                            left: tooltipData.x,
                            top: tooltipData.y,
                            transform: 'translateX(-50%)',
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            color: 'white',
                            padding: '6px 10px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap',
                            zIndex: 1000,
                            pointerEvents: 'none',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
                          }}
                        >
                          {tooltipData.content}
                        </div>
                      )}
                      </div>
                    );
                })()}
              </div>
            </div>

            {/* Comparativo com Ano Anterior */}
            {dadosMensais.some(d => d.ano === anoFiltro - 1) && (
              <div className="card animate-slideIn" style={{ marginTop: '20px' }}>
                <h3>Comparativo com {anoFiltro - 1}</h3>
                <div className="grid grid-3">
                  <div className="card" style={{ textAlign: 'center' }}>
                    <h4>Faturamento</h4>
                    <div style={{ fontSize: '16px', color: 'var(--orange-accent)' }}>
                      {anoFiltro}: R$ {getTotalFaturamentoAno().toFixed(2)}
                    </div>
                    <div style={{ fontSize: '16px', color: '#6c757d' }}>
                      {anoFiltro - 1}: R$ {
                        dadosMensais
                          .filter(d => d.ano === anoFiltro - 1)
                          .reduce((total, d) => total + d.faturamento, 0)
                          .toFixed(2)
                      }
                    </div>
                  </div>
                  
                  <div className="card" style={{ textAlign: 'center' }}>
                    <h4>Lucro</h4>
                    <div style={{ fontSize: '16px', color: '#28a745' }}>
                      {anoFiltro}: R$ {getTotalLucroAno().toFixed(2)}
                    </div>
                    <div style={{ fontSize: '16px', color: '#6c757d' }}>
                      {anoFiltro - 1}: R$ {
                        dadosMensais
                          .filter(d => d.ano === anoFiltro - 1)
                          .reduce((total, d) => total + d.lucro, 0)
                          .toFixed(2)
                      }
                    </div>
                  </div>
                  
                  <div className="card" style={{ textAlign: 'center' }}>
                    <h4>Crescimento</h4>
                    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                      {(() => {
                        const anoAtual = getTotalFaturamentoAno();
                        const anoAnterior = dadosMensais
                          .filter(d => d.ano === anoFiltro - 1)
                          .reduce((total, d) => total + d.faturamento, 0);
                        
                        if (anoAnterior === 0) return 'N/A';
                        const crescimento = ((anoAtual - anoAnterior) / anoAnterior) * 100;
                        return `${crescimento >= 0 ? '+' : ''}${crescimento.toFixed(1)}%`;
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            <Calendar size={48} style={{ marginBottom: '20px', opacity: 0.5 }} />
            <p>Nenhum dado registrado para {anoFiltro}.</p>
            <p>Clique em "Adicionar Dados" para começar.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ControleMensal; 