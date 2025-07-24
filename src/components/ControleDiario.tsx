import React, { useState, useEffect } from 'react';
import { Plus, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useUser } from '../lib/UserContext';

interface VendaDiaria {
  id: string;
  data: string;
  diaSemana: string;
  numeroPedidos: number;
  faturamento: number;
  custo: number;
  lucro: number;
  notas?: string;
}

const ControleDiario: React.FC = () => {
  const { user } = useUser();
  const [vendas, setVendas] = useState<VendaDiaria[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [dataInicial, setDataInicial] = useState(new Date().toISOString().split('T')[0]);
  const [dataFinal, setDataFinal] = useState(new Date().toISOString().split('T')[0]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectingStart, setSelectingStart] = useState(true);
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
  const [formData, setFormData] = useState({
    data: new Date().toISOString().split('T')[0],
    diaSemana: '',
    numeroPedidos: 1,
    faturamento: 0,
    custo: 0,
    lucro: 0,
    notas: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchVendas = async () => {
      setLoading(true);
      setError('');
      const { data, error } = await supabase
        .from('vendas_diarias')
        .select('*')
        .eq('usuario_id', user?.id);
      if (error) setError('Erro ao buscar vendas diárias.');
      else setVendas((data || []).map(v => ({
        ...v,
        data: v.data_venda,
        diaSemana: v.dia_semana,
        numeroPedidos: v.numero_pedidos
      })));
      setLoading(false);
    };
    if (user) fetchVendas();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    // Calcular dia da semana automaticamente (corrigido para horário local)
    const [ano, mes, dia] = formData.data.split('-').map(Number);
    const data = new Date(ano, mes - 1, dia); // Data local
    const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const diaSemana = diasSemana[data.getDay()];
    try {
      const { error } = await supabase
        .from('vendas_diarias')
        .insert([
          {
            data_venda: formData.data,
            dia_semana: diaSemana,
            numero_pedidos: formData.numeroPedidos,
            faturamento: formData.faturamento,
            custo: formData.custo,
            lucro: formData.faturamento - formData.custo,
            notas: formData.notas,
            usuario_id: user?.id,
            data_criacao: new Date().toISOString(),
            data_atualizacao: new Date().toISOString(),
          },
        ]);
      if (error) throw error;
      // Adicionar a venda salva diretamente ao estado local
      const novaVenda = {
        id: Math.random().toString(36).substr(2, 9), // id temporário
        data: formData.data,
        diaSemana: diaSemana,
        numeroPedidos: formData.numeroPedidos,
        faturamento: formData.faturamento,
        custo: formData.custo,
        lucro: formData.faturamento - formData.custo,
        notas: formData.notas
      };
      setVendas(prev => [novaVenda, ...prev]);
      // Buscar do banco para sincronizar
      const { data: vendasData } = await supabase
        .from('vendas_diarias')
        .select('*')
        .eq('usuario_id', user?.id);
      setVendas((vendasData || []).map(v => ({
        ...v,
        data: v.data_venda,
        diaSemana: v.dia_semana,
        numeroPedidos: v.numero_pedidos
      })));
      setFormData({
        data: new Date().toISOString().split('T')[0],
        diaSemana: '',
        numeroPedidos: 1,
        faturamento: 0,
        custo: 0,
        lucro: 0,
        notas: ''
      });
      setShowForm(false);
    } catch (err) {
      setError('Erro ao salvar venda.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase
        .from('vendas_diarias')
        .delete()
        .eq('id', id)
        .eq('usuario_id', user?.id);
      if (error) throw error;
      // Remover do estado local sem buscar tudo de novo
      setVendas(prev => prev.filter(venda => venda.id !== id));
    } catch (err) {
      setError('Erro ao deletar venda.');
    } finally {
      setLoading(false);
    }
  };

  const getVendasDoPeriodo = () => {
    return vendas.filter(venda => {
      return venda.data >= dataInicial && venda.data <= dataFinal;
    });
  };

  const getTotalVendasPeriodo = () => {
    return getVendasDoPeriodo().reduce((total, venda) => total + venda.faturamento, 0);
  };

  const getTotalPedidosPeriodo = () => {
    return getVendasDoPeriodo().reduce((total, venda) => total + venda.numeroPedidos, 0);
  };

  const getTicketMedioPeriodo = () => {
    const totalPedidos = getTotalPedidosPeriodo();
    if (totalPedidos === 0) return 0;
    return getTotalVendasPeriodo() / totalPedidos;
  };

  const getDiaMaisMovimentado = () => {
    const vendasPeriodo = getVendasDoPeriodo();
    if (vendasPeriodo.length === 0) return '-';
    
    const diaCount = vendasPeriodo.reduce((acc, venda) => {
      acc[venda.diaSemana] = (acc[venda.diaSemana] || 0) + venda.numeroPedidos;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(diaCount).reduce((a, b) => diaCount[a[0]] > diaCount[b[0]] ? a : b)[0];
  };



  const getCustoTotalPeriodo = () => {
    return getVendasDoPeriodo().reduce((total, venda) => total + venda.custo, 0);
  };

  const getLucroTotalPeriodo = () => {
    return getVendasDoPeriodo().reduce((total, venda) => total + venda.lucro, 0);
  };

  const getMargemLucroPeriodo = () => {
    const faturamento = getTotalVendasPeriodo();
    const lucro = getLucroTotalPeriodo();
    if (faturamento === 0) return 0;
    return (lucro / faturamento) * 100;
  };

  const formatarPeriodo = () => {
    const formatarData = (dateString: string) => {
      const [year, month, day] = dateString.split('-');
      return `${day}/${month}/${year}`;
    };
    
    if (dataInicial === dataFinal) {
      return formatarData(dataInicial);
    }
    return `${formatarData(dataInicial)} - ${formatarData(dataFinal)}`;
  };

  // Funções do calendário
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatDateToString = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const isDateInRange = (date: string) => {
    return date >= dataInicial && date <= dataFinal;
  };

  const isDateSelected = (date: string) => {
    return date === dataInicial || date === dataFinal;
  };

  const handleDateClick = (date: string) => {
    if (selectingStart) {
      setDataInicial(date);
      setDataFinal(date);
      setSelectingStart(false);
    } else {
      if (date >= dataInicial) {
        setDataFinal(date);
      } else {
        setDataInicial(date);
        setDataFinal(dataInicial);
      }
      setSelectingStart(true);
    }
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const days = [];

    // Dias vazios no início
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    // Dias do mês
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const dateString = formatDateToString(date);
      const isSelected = isDateSelected(dateString);
      const isInRange = isDateInRange(dateString);
      const isToday = dateString === new Date().toISOString().split('T')[0];

      days.push(
        <div
          key={day}
          className={`calendar-day ${isSelected ? 'selected' : ''} ${isInRange ? 'in-range' : ''} ${isToday ? 'today' : ''}`}
          onClick={() => handleDateClick(dateString)}
        >
          {day}
        </div>
      );
    }

    return days;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      if (direction === 'prev') {
        newMonth.setMonth(newMonth.getMonth() - 1);
      } else {
        newMonth.setMonth(newMonth.getMonth() + 1);
      }
      return newMonth;
    });
  };

  const resetSelection = () => {
    const today = new Date().toISOString().split('T')[0];
    setDataInicial(today);
    setDataFinal(today);
    setSelectingStart(true);
  };

  return (
    <div className="animate-fadeIn">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>Controle Diário</h2>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'end' }}>
            <div className="form-group" style={{ margin: 0, minWidth: '200px' }}>
              <label style={{ marginBottom: '5px' }}>Período Selecionado:</label>
              <div 
                onClick={() => setShowCalendar(!showCalendar)}
                style={{
                  height: '48px',
                  padding: '0 12px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                <Calendar size={16} style={{ marginRight: '8px' }} />
                {formatarPeriodo()}
              </div>
            </div>
            <button 
              className="btn btn-primary" 
              onClick={() => setShowForm(true)}
              disabled={showForm}
              style={{ height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Plus size={18} style={{ marginRight: '8px' }} />
              Registrar Venda
            </button>
          </div>
        </div>

        {/* Calendário */}
        {showCalendar && (
          <div className="calendar-container card animate-scaleIn" style={{ backgroundColor: 'rgba(45, 45, 45, 0.9)', marginBottom: '20px' }}>
            <div className="calendar-header">
              <button 
                className="btn btn-secondary btn-small" 
                onClick={() => navigateMonth('prev')}
              >
                <ChevronLeft size={16} />
              </button>
              <h3>
                {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </h3>
              <button 
                className="btn btn-secondary btn-small" 
                onClick={() => navigateMonth('next')}
              >
                <ChevronRight size={16} />
              </button>
            </div>
            
            <div className="calendar-weekdays">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                <div key={day} className="calendar-weekday">{day}</div>
              ))}
            </div>
            
            <div className="calendar-grid">
              {renderCalendar()}
            </div>
            
            <div className="calendar-footer">
              <button 
                className="btn btn-secondary btn-small" 
                onClick={resetSelection}
              >
                Resetar
              </button>
              <button 
                className="btn btn-success btn-small" 
                onClick={() => setShowCalendar(false)}
              >
                Confirmar
              </button>
            </div>
          </div>
        )}



        <div className="grid grid-4" style={{ marginBottom: '20px' }}>
          <div className="card summary-card">
            <h3>Faturamento Total</h3>
            <div className="value" style={{ color: '#ffc107' }}>R$ {getTotalVendasPeriodo().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          
          <div className="card summary-card">
            <h3>Custo Total</h3>
            <div className="value" style={{ color: '#dc3545' }}>R$ {getCustoTotalPeriodo().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          
          <div className="card summary-card">
            <h3>Lucro Total</h3>
            <div className="value" style={{ color: '#28a745' }}>R$ {getLucroTotalPeriodo().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          
          <div className="card summary-card">
            <h3>Margem de Lucro</h3>
            <div className="value" style={{ color: '#fff' }}>
              {getMargemLucroPeriodo().toFixed(1)}%
            </div>
          </div>
        </div>

        <div className="grid grid-3" style={{ marginBottom: '20px' }}>
          <div className="card summary-card">
            <h3>Ticket Médio</h3>
            <div className="value">R$ {getTicketMedioPeriodo().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          
          <div className="card summary-card">
            <h3>Total de Pedidos</h3>
            <div className="value">{getTotalPedidosPeriodo()} pedidos</div>
          </div>
          
          <div className="card summary-card">
            <h3>Dia Mais Movimentado</h3>
            <div className="value">{getDiaMaisMovimentado()}</div>
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="card animate-scaleIn" style={{ backgroundColor: 'rgba(45, 45, 45, 0.9)' }}>
            <h3>Registrar Nova Venda</h3>
            
            <div className="grid grid-2">
              <div className="form-group">
                <label>Data</label>
                <input
                  type="date"
                  value={formData.data}
                  onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Dia da Semana</label>
                <input
                  type="text"
                  value={(() => {
                    if (!formData.data) return '';
                    const [ano, mes, dia] = formData.data.split('-').map(Number);
                    const dataLocal = new Date(ano, mes - 1, dia);
                    const diasSemana = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
                    const diaSemana = diasSemana[dataLocal.getDay()];
                    return diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
                  })()}
                  disabled
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', textTransform: 'capitalize' }}
                />
              </div>
            </div>
            
            <div className="grid grid-3">
              <div className="form-group">
                <label>Nº de Pedidos</label>
                <input
                  type="number"
                  min="1"
                  value={formData.numeroPedidos}
                  onChange={(e) => setFormData({ ...formData, numeroPedidos: parseInt(e.target.value) || 1 })}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Faturamento (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.faturamento}
                  onChange={(e) => setFormData({ ...formData, faturamento: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Custo (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.custo}
                  onChange={(e) => setFormData({ ...formData, custo: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
            </div>
            
            <div className="form-group">
              <label>Lucro (R$)</label>
              <input
                type="number"
                step="0.01"
                value={(formData.faturamento - formData.custo).toFixed(2)}
                disabled
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
              />
            </div>
            
            <div className="form-group">
              <label>Notas</label>
              <textarea
                value={formData.notas}
                onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" className="btn btn-success">
                Salvar Venda
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                Cancelar
              </button>
            </div>
          </form>
        )}

        {error && (
          <div className="alert alert-danger animate-slideIn">{error}</div>
        )}
        {loading && (
          <div className="loading-spinner" style={{ margin: '2rem auto' }} />
        )}

        {/* Lista de Vendas do Período */}
        <div>
          <h3>Vendas do Período</h3>
          {getVendasDoPeriodo().length > 0 ? (
            <>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Dia da Semana</th>
                      <th>Nº Pedidos</th>
                      <th>Faturamento</th>
                      <th>Custo</th>
                      <th>Lucro</th>
                      <th>Notas</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getVendasDoPeriodo()
                      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
                      .map(venda => (
                      <tr key={venda.id}>
                        <td>{venda.data.split('-').reverse().join('/')}</td>
                        <td>{venda.diaSemana}</td>
                        <td>{venda.numeroPedidos}</td>
                        <td>R$ {venda.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td>R$ {venda.custo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style={{ color: venda.lucro >= 0 ? '#28a745' : '#dc3545' }}>
                          R$ {venda.lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td>{venda.notas || '-'}</td>
                        <td>
                          <button 
                            className="btn btn-danger btn-small" 
                            onClick={() => handleDelete(venda.id)}
                          >
                            Excluir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Gráfico de Linhas de Evolução Diária */}
              <div className="card animate-slideIn" style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3>Evolução Diária - {formatarPeriodo()}</h3>
                  
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
                    const vendasOrdenadas = getVendasDoPeriodo().sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
                    if (vendasOrdenadas.length === 0) return <p>Nenhum dado disponível para o período selecionado</p>;

                    const maxFaturamento = Math.max(...vendasOrdenadas.map(v => v.faturamento));
                    const maxCustos = Math.max(...vendasOrdenadas.map(v => v.custo));
                    const maxLucro = Math.max(...vendasOrdenadas.map(v => v.lucro));
                    const minLucro = Math.min(...vendasOrdenadas.map(v => v.lucro));
                    
                    const maxValue = Math.max(maxFaturamento, maxCustos, maxLucro);
                    const minValue = Math.min(0, minLucro);
                    const range = maxValue - minValue;
                    const graphHeight = 180;
                    const graphWidth = 600;
                    const pointSpacing = graphWidth / (vendasOrdenadas.length - 1 || 1);

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

                    const handleMouseEnter = (event: React.MouseEvent, tipo: string, valor: number, data: string) => {
                      const rect = (event.currentTarget as SVGElement).getBoundingClientRect();
                      const containerRect = (event.currentTarget as SVGElement).closest('.card')?.getBoundingClientRect();
                      
                      if (containerRect) {
                        const dataFormatada = data.split('-').reverse().join('/');
                        setTooltipData({
                          visible: true,
                          x: rect.left - containerRect.left + rect.width / 2,
                          y: rect.top - containerRect.top - 10,
                          content: `${tipo} ${dataFormatada}: R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
                          {metricasVisiveis.faturamento && vendasOrdenadas.length > 1 && (
                            <path
                              d={createPath(vendasOrdenadas.map(v => v.faturamento))}
                              fill="none"
                              stroke="#ffc107"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          )}

                          {/* Linha de Custos */}
                          {metricasVisiveis.custos && vendasOrdenadas.length > 1 && (
                            <path
                              d={createPath(vendasOrdenadas.map(v => v.custo))}
                              fill="none"
                              stroke="#dc3545"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          )}

                          {/* Linha de Lucro */}
                          {metricasVisiveis.lucro && vendasOrdenadas.length > 1 && (
                            <path
                              d={createPath(vendasOrdenadas.map(v => v.lucro))}
                              fill="none"
                              stroke="#28a745"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          )}

                          {/* Pontos */}
                          {vendasOrdenadas.map((venda, index) => {
                            const x = index * pointSpacing;
                            return (
                              <g key={venda.id}>
                                {metricasVisiveis.faturamento && (
                                  <circle
                                    cx={x}
                                    cy={getY(venda.faturamento)}
                                    r="4"
                                    fill="#ffc107"
                                    stroke="#fff"
                                    strokeWidth="2"
                                    style={{ cursor: 'pointer' }}
                                    onMouseEnter={(e) => handleMouseEnter(e, 'Faturamento', venda.faturamento, venda.data)}
                                    onMouseLeave={handleMouseLeave}
                                  />
                                )}
                                {metricasVisiveis.custos && (
                                  <circle
                                    cx={x}
                                    cy={getY(venda.custo)}
                                    r="4"
                                    fill="#dc3545"
                                    stroke="#fff"
                                    strokeWidth="2"
                                    style={{ cursor: 'pointer' }}
                                    onMouseEnter={(e) => handleMouseEnter(e, 'Custos', venda.custo, venda.data)}
                                    onMouseLeave={handleMouseLeave}
                                  />
                                )}
                                {metricasVisiveis.lucro && (
                                  <circle
                                    cx={x}
                                    cy={getY(venda.lucro)}
                                    r="4"
                                    fill="#28a745"
                                    stroke="#fff"
                                    strokeWidth="2"
                                    style={{ cursor: 'pointer' }}
                                    onMouseEnter={(e) => handleMouseEnter(e, 'Lucro', venda.lucro, venda.data)}
                                    onMouseLeave={handleMouseLeave}
                                  />
                                )}
                              </g>
                            );
                          })}

                          {/* Labels das datas */}
                          {vendasOrdenadas.map((venda, index) => {
                            const x = index * pointSpacing;
                            const dataFormatada = venda.data.split('-')[2] + '/' + venda.data.split('-')[1];
                            return (
                              <text
                                key={`label-${venda.id}`}
                                x={x}
                                y={graphHeight + 20}
                                textAnchor="middle"
                                fontSize="12"
                                fill="#666"
                              >
                                {dataFormatada}
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
            </>
          ) : (
            <div className="empty-state">
              <Calendar size={48} style={{ color: 'var(--text-secondary)', marginBottom: '16px' }} />
              <p>Nenhuma venda registrada no período selecionado.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ControleDiario; 