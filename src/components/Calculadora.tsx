import { useState, useEffect } from 'react';
import { Plus, Trash2, Calculator, CreditCard, Smartphone, Banknote, Save, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useUser } from '../lib/UserContext';

interface Prato {
  id: string;
  nomePrato: string;
  ingredientes: any[];
  custoTotal: number;
}

interface FormaPagamento {
  id: string;
  nome: string;
  icon: React.ReactNode;
  taxa?: number; // Taxa da forma de pagamento (se houver)
}

interface VendaItem {
  id: string;
  pratoId: string;
  quantidade: number;
  formaPagamentoId: string;
}

interface CalculoResultado {
  faturamento: number;
  custo: number;
  lucro: number;
}

const formasPagamento: FormaPagamento[] = [
  { id: 'dinheiro', nome: 'Dinheiro', icon: <Banknote size={16} /> },
  { id: 'pix', nome: 'PIX', icon: <Smartphone size={16} /> },
  { id: 'debito', nome: 'Cartão de Débito', icon: <CreditCard size={16} /> },
  { id: 'credito', nome: 'Cartão de Crédito', icon: <CreditCard size={16} /> },
];

function Calculadora() {
  const { user } = useUser();
  const [pratos, setPratos] = useState<Prato[]>([]);
  const [vendas, setVendas] = useState<VendaItem[]>([]);
  const [vendasSalvas, setVendasSalvas] = useState<VendaItem[]>([]);
  const [precosVenda, setPrecosVenda] = useState<{[key: string]: number}>({});
  const [custosFixos, setCustosFixos] = useState<any[]>([]);
  const [custosIncalculaveis, setCustosIncalculaveis] = useState<any[]>([]);
  const [taxasPagamento, setTaxasPagamento] = useState<{[key: string]: number}>({});
  const [resultado, setResultado] = useState<CalculoResultado>({
    faturamento: 0,
    custo: 0,
    lucro: 0
  });
  // Buscar faturamento total do mês do Supabase para custos fixos
  const [faturamentoMensal, setFaturamentoMensal] = useState(0);

  // Função para calcular porcentagem de custos fixos
  const calcularPorcentagemCustosFixos = () => {
    const totalCustosFixos = custosFixos.reduce((total: number, custo: any) => total + (custo.valor || 0), 0);
    if (faturamentoMensal === 0) return 0;
    return (totalCustosFixos / faturamentoMensal) * 100;
  };

  // Função para calcular porcentagem de custos incalculáveis
  const calcularPorcentagemCustosIncalculaveis = () => {
    return custosIncalculaveis.reduce((total: number, custo: any) => total + (custo.percentual || 0), 0);
  };

  // Funções auxiliares para padronizar cálculo igual à aba de Preços
  const getPorcentagemCustosFixos = () => {
    if (faturamentoMensal === 0) return 0;
    const totalCustosFixos = custosFixos.reduce((total: number, custo: any) => total + (custo.valor || 0), 0);
    return (totalCustosFixos / faturamentoMensal) * 100;
  };
  const getPorcentagemCustosIncalculaveis = () => {
    return custosIncalculaveis.reduce((total: number, custo: any) => total + (custo.percentual || 0), 0);
  };
  const getTaxaPorTipo = (tipo: string) => {
    const valorTaxa = taxasPagamento[tipo] || 0;
    return isNaN(valorTaxa) ? 0 : valorTaxa;
  };
  const calcularPrecificacao = (custoPrato: number, precoVenda: number) => {
    const custoValidado = isNaN(custoPrato) ? 0 : custoPrato;
    const precoValidado = isNaN(precoVenda) ? 0 : precoVenda;
    const custoFixoPercent = getPorcentagemCustosFixos();
    const custoIncalculavelPercent = getPorcentagemCustosIncalculaveis();
    const totalTaxasPercent = custoFixoPercent + custoIncalculavelPercent;
    const custoReal = custoValidado + (custoValidado * totalTaxasPercent / 100);
    if (precoValidado === 0) {
      return {
        custoFixoPercent,
        custoIncalculavelPercent,
        custoReal: isNaN(custoReal) ? 0 : custoReal,
        lucroCredito: 0,
        lucroDebito: 0,
        lucroPix: 0,
        lucroDinheiro: 0
      };
    }
    const taxaCredito = getTaxaPorTipo('credito');
    const taxaDebito = getTaxaPorTipo('debito');
    const taxaPix = getTaxaPorTipo('pix');
    const taxaDinheiro = getTaxaPorTipo('dinheiro');
    const valorLiquidoCredito = precoValidado - (precoValidado * taxaCredito / 100);
    const valorLiquidoDebito = precoValidado - (precoValidado * taxaDebito / 100);
    const valorLiquidoPix = precoValidado - (precoValidado * taxaPix / 100);
    const valorLiquidoDinheiro = precoValidado - (precoValidado * taxaDinheiro / 100);
    const lucroCredito = valorLiquidoCredito - custoReal;
    const lucroDebito = valorLiquidoDebito - custoReal;
    const lucroPix = valorLiquidoPix - custoReal;
    const lucroDinheiro = valorLiquidoDinheiro - custoReal;
    return {
      custoFixoPercent,
      custoIncalculavelPercent,
      custoReal: isNaN(custoReal) ? 0 : custoReal,
      lucroCredito: isNaN(lucroCredito) ? 0 : lucroCredito,
      lucroDebito: isNaN(lucroDebito) ? 0 : lucroDebito,
      lucroPix: isNaN(lucroPix) ? 0 : lucroPix,
      lucroDinheiro: isNaN(lucroDinheiro) ? 0 : lucroDinheiro
    };
  };

  // Adicione a função auxiliar para capitalizar a forma de pagamento
  const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

  // Buscar pratos do Supabase ao invés do localStorage
  useEffect(() => {
    const fetchPratos = async () => {
      if (!user?.id) return;
      const { data: pratosData, error } = await supabase
        .from('pratos')
        .select(`
          id,
          nome,
          custo_total,
          usuario_id,
          prato_ingredientes:prato_ingredientes (
            id,
            ingrediente_nome,
            quantidade,
            custo,
            prato_id
          )
        `)
        .eq('usuario_id', user.id);
      if (!error && pratosData) {
        // Mapear para o formato esperado
        const pratosFormatados = pratosData.map((prato: any) => ({
          id: prato.id,
          nomePrato: prato.nome,
          ingredientes: prato.prato_ingredientes || [],
          custoTotal: prato.custo_total,
        }));
        setPratos(pratosFormatados);
      } else {
        setPratos([]);
      }
    };
    fetchPratos();
  }, [user?.id]);

  // Buscar preços de venda do Supabase ao invés do localStorage
  useEffect(() => {
    const fetchPrecosVenda = async () => {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from('precos_venda')
        .select('prato_id, preco')
        .eq('usuario_id', user.id);
      if (!error && data) {
        const precos = {} as {[key: string]: number};
        data.forEach((item: any) => {
          precos[item.prato_id] = item.preco;
        });
        setPrecosVenda(precos);
    } else {
        setPrecosVenda({});
      }
    };
    fetchPrecosVenda();
  }, [user?.id]);

  // Buscar custos fixos e incalculáveis do Supabase
  useEffect(() => {
    const fetchCustos = async () => {
      if (!user?.id) return;
      // Custos Fixos
      const { data: fixos, error: fixosError } = await supabase
        .from('custos_fixos')
        .select('*')
        .eq('usuario_id', user.id);
      if (!fixosError && fixos) setCustosFixos(fixos);
      else setCustosFixos([]);
      // Custos Incalculáveis
      const { data: incalculaveis, error: incalculaveisError } = await supabase
        .from('custos_incalculaveis')
        .select('*')
        .eq('usuario_id', user.id);
      if (!incalculaveisError && incalculaveis) setCustosIncalculaveis(incalculaveis);
      else setCustosIncalculaveis([]);
    };
    fetchCustos();
  }, [user?.id]);

  // Buscar taxas de pagamento do Supabase
  useEffect(() => {
    const fetchTaxas = async () => {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from('taxas_pagamento')
        .select('*')
        .eq('usuario_id', user.id);
      if (!error && data) {
        // Converter para objeto {tipo: taxa}
        const taxasObj = data.reduce((acc: any, taxa: any) => {
          acc[taxa.tipo] = taxa.taxa;
          return acc;
        }, {});
        setTaxasPagamento(taxasObj);
      } else {
        setTaxasPagamento({});
      }
    };
    fetchTaxas();
  }, [user?.id]);

  // Buscar faturamento total do mês do Supabase para custos fixos
  useEffect(() => {
    const fetchFaturamento = async () => {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from('vendas_diarias')
        .select('faturamento')
        .eq('usuario_id', user.id);
      if (!error && data) {
        const total = data.reduce((acc: number, venda: any) => acc + (venda.faturamento || 0), 0);
        setFaturamentoMensal(total);
    } else {
        setFaturamentoMensal(0);
      }
    };
    fetchFaturamento();
  }, [user?.id]);

  // Carregar taxas de pagamento do localStorage
  useEffect(() => {
    // const taxasPagamentoData = localStorage.getItem('taxasPagamento');
    
    // if (taxasPagamentoData) {
    //   try {
    //     const taxasArray = JSON.parse(taxasPagamentoData);
    //     const taxasObj = taxasArray.reduce((acc: any, taxa: any) => {
    //       acc[taxa.tipo] = taxa.taxa;
    //       return acc;
    //     }, {});
    //     console.log('Taxas de pagamento carregadas:', taxasObj);
    //     setTaxasPagamento(taxasObj);
    //   } catch (error) {
    //     console.error('Erro ao carregar taxas de pagamento:', error);
    //     setTaxasPagamento({});
    //   }
    // } else {
    //   setTaxasPagamento({});
    // }

    // Calcular porcentagens de custos
    const custosFixosPercent = calcularPorcentagemCustosFixos();
    const custosIncalculaveisPercent = calcularPorcentagemCustosIncalculaveis();
    
    // setPorcentagemCustosFixos(custosFixosPercent);
    // setPorcentagemCustosIncalculaveis(custosIncalculaveisPercent);
    
    console.log('Custos fixos %:', custosFixosPercent);
    console.log('Custos incalculáveis %:', custosIncalculaveisPercent);
  }, [custosFixos, vendasSalvas, precosVenda, faturamentoMensal]);

  // Recalcular resultado sempre que as vendas, pratos, preços ou taxas mudarem
  useEffect(() => {
    if (pratos.length > 0) {
      calcularResultado();
    }
  }, [vendasSalvas, pratos, precosVenda, custosFixos, custosIncalculaveis, taxasPagamento, faturamentoMensal]);

  const adicionarVenda = () => {
    console.log('Adicionando venda, pratos disponíveis:', pratos.length);
    const novaVenda: VendaItem = {
      id: Date.now().toString(),
      pratoId: '',
      quantidade: 1,
      formaPagamentoId: 'dinheiro'
    };
    console.log('Nova venda criada:', novaVenda);
    setVendas([...vendas, novaVenda]);
  };

  const removerVenda = (id: string) => {
    setVendas(vendas.filter(venda => venda.id !== id));
  };

  const salvarVenda = (id: string) => {
    const venda = vendas.find(v => v.id === id);
    if (venda && venda.pratoId) {
      // Adicionar à lista de vendas salvas
      setVendasSalvas([...vendasSalvas, venda]);
      // Remover da lista de vendas em edição
      setVendas(vendas.filter(v => v.id !== id));
    }
  };

  const excluirVendaSalva = (id: string) => {
    setVendasSalvas(vendasSalvas.filter(venda => venda.id !== id));
  };

  const atualizarVenda = (id: string, campo: keyof VendaItem, valor: any) => {
    setVendas(vendas.map(venda => 
      venda.id === id ? { ...venda, [campo]: valor } : venda
    ));
  };

  const calcularResultado = () => {
    let totalFaturamento = 0;
    let totalCusto = 0;

    // Verificar se há pratos disponíveis
    if (pratos.length === 0) {
      setResultado({
        faturamento: 0,
        custo: 0,
        lucro: 0
      });
      return;
    }

    vendasSalvas.forEach(venda => {
      const prato = pratos.find(p => p.id === venda.pratoId);
      
      if (prato && venda.quantidade > 0) {
        // Usar o preço de venda real da aba "Preços"
        const precoVenda = precosVenda[prato.id] || 0;
        
        if (precoVenda > 0) {
          // Usar taxa real da aba "Outros"
          
          // Calcular custo total incluindo taxas fixas e incalculáveis
          const custoPrato = prato.custoTotal * venda.quantidade;
          const totalTaxasPercent = calcularPorcentagemCustosFixos() + calcularPorcentagemCustosIncalculaveis();
          const custoComTaxas = custoPrato + (custoPrato * totalTaxasPercent / 100);
          
          totalFaturamento += precoVenda * venda.quantidade;
          totalCusto += custoComTaxas;
        }
      }
    });

    setResultado({
      faturamento: totalFaturamento,
      custo: totalCusto,
      lucro: totalFaturamento - totalCusto
    });
  };

  const limparCalculadora = () => {
    setVendasSalvas([]);
  };

  const getPrato = (id: string) => pratos.find(p => p.id === id);
  const getFormaPagamento = (id: string) => formasPagamento.find(f => f.id === id);

  return (
    <div className="animate-fadeIn">
      <div className="card">
        <div className="flex justify-between items-center mb-6">
          <h2>
            Calculadora de Lucro Diário
          </h2>
          <button 
            onClick={limparCalculadora}
            className="btn btn-secondary"
            disabled={vendasSalvas.length === 0}
            style={{ height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            Limpar Tudo
          </button>
        </div>

        <div className="calculadora-content">
        {/* Card Único - Vendas */}
        <div className="card" style={{ backgroundColor: 'rgba(45, 45, 45, 0.9)', marginBottom: 0 }}>
          <div className="flex justify-between items-center mb-4">
            <h3>Vendas do Dia</h3>
            <button 
              onClick={adicionarVenda} 
              className="btn btn-primary"
              disabled={pratos.length === 0}
              title={pratos.length === 0 ? "Cadastre pratos primeiro na aba 'Pratos'" : "Adicionar nova venda"}
            >
              <Plus size={16} />
              Adicionar Venda
            </button>
          </div>

          {pratos.length === 0 ? (
            <div className="empty-state" style={{ textAlign: 'center', padding: '40px', color: 'var(--medium-text)' }}>
              <Calculator size={48} style={{ color: 'var(--light-text)', marginBottom: '16px' }} />
              <p style={{ fontSize: '18px', fontWeight: '500', marginBottom: '8px', color: 'var(--white-text)' }}>Nenhum prato cadastrado</p>
              <span style={{ fontSize: '14px' }}>Cadastre pratos na aba "Pratos" para começar a calcular vendas</span>
            </div>
          ) : (
            <>
              {/* Formulários de vendas em edição */}
              {vendas.map((venda) => (
                <div key={venda.id} className="venda-form-novo animate-scaleIn" style={{ marginBottom: '20px' }}>
                  <h4>Nova Venda</h4>
                  
                  <div className="form-grid-horizontal">
                    <div className="form-field">
                      <label className="form-label-novo">PRATO</label>
                      <select
                        value={venda.pratoId}
                        onChange={(e) => atualizarVenda(venda.id, 'pratoId', e.target.value)}
                        className="form-input-novo"
                      >
                        <option value="">Selecione um prato</option>
                        {pratos.map(prato => (
                          <option key={prato.id} value={prato.id}>
                            {prato.nomePrato}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field">
                      <label className="form-label-novo">QUANTIDADE</label>
                      <input
                        type="number"
                        min="1"
                        value={venda.quantidade}
                        onChange={(e) => atualizarVenda(venda.id, 'quantidade', parseInt(e.target.value) || 1)}
                        className="form-input-novo"
                        placeholder="0"
                      />
                    </div>

                    <div className="form-field">
                      <label className="form-label-novo">FORMA DE PAGAMENTO</label>
                      <select
                        value={venda.formaPagamentoId}
                        onChange={(e) => atualizarVenda(venda.id, 'formaPagamentoId', e.target.value)}
                        className="form-input-novo"
                      >
                        {formasPagamento.map(forma => (
                          <option key={forma.id} value={forma.id}>
                            {forma.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button 
                      onClick={() => salvarVenda(venda.id)}
                      className="btn btn-success"
                      disabled={!venda.pratoId}
                    >
                      <Save size={16} />
                      Salvar
                    </button>
                    <button 
                      onClick={() => removerVenda(venda.id)}
                      className="btn btn-secondary"
                    >
                      <X size={16} />
                      Cancelar
                    </button>
                  </div>
                </div>
              ))}

              {/* Lista de vendas salvas */}
              {vendasSalvas.length > 0 && (
                <>
                  {vendas.length === 0 && (
                    <div className="vendas-salvas-header">
                      <div className="header-col">NOME DO PRATO</div>
                      <div className="header-col">LUCRO</div>
                      <div className="header-col">AÇÕES</div>
                    </div>
                  )}

                  <div className="vendas-salvas-list">
                    {vendasSalvas.map(venda => {
                      const prato = getPrato(venda.pratoId);
                      if (!prato) return null;

                      const precoVenda = precosVenda[prato.id] || 0;
                      if (precoVenda === 0) return null;

                      const quantidade = venda.quantidade;
                      // Lucro correto
                      const calc = calcularPrecificacao(prato.custoTotal, precoVenda);
                      const lucro = (calc as any)['lucro' + capitalize(venda.formaPagamentoId)];

                      return (
                        <div key={venda.id} className="venda-salva-item">
                          <div className="venda-col">
                            <span className="prato-nome">{prato.nomePrato}</span>
                            <span className="venda-detalhes">
                              {quantidade}x • {getFormaPagamento(venda.formaPagamentoId)?.nome}
                            </span>
                          </div>
                          <div className="venda-col lucro-valor">
                            R$ {lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="venda-col acoes">
                            <button 
                              onClick={() => excluirVendaSalva(venda.id)}
                              className="btn-excluir"
                              title="Excluir venda"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Estado vazio quando não há vendas */}
              {vendas.length === 0 && vendasSalvas.length === 0 && (
                <div className="empty-state" style={{ textAlign: 'center', padding: '40px', color: 'var(--medium-text)' }}>
                  <Calculator size={48} style={{ color: 'var(--light-text)', marginBottom: '16px' }} />
                  <p style={{ fontSize: '18px', fontWeight: '500', marginBottom: '8px', color: 'var(--white-text)' }}>Nenhuma venda adicionada</p>
                  <span style={{ fontSize: '14px' }}>Clique em "Adicionar Venda" para começar</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Resultado Final */}
        <div className="card" style={{ backgroundColor: 'rgba(45, 45, 45, 0.9)' }}>
          <h3 style={{ marginBottom: '20px' }}>Resultado do Dia</h3>
          <div className="resultado-cards">
            <div className="resultado-card-novo">
              <div className="card-header">FATURAMENTO TOTAL</div>
              <div className="card-valor">R$ {resultado.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>

            <div className="resultado-card-novo">
              <div className="card-header">CUSTO TOTAL</div>
              <div className="card-valor">R$ {resultado.custo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>

            <div className="resultado-card-novo">
              <div className="card-header">LUCRO TOTAL</div>
              <div className="card-valor" style={{ color: resultado.lucro >= 0 ? '#10b981' : '#ef4444' }}>
                R$ {resultado.lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {vendas.length > 0 && (
            <div className="resumo-vendas">
              <p>
                <strong>{vendas.length}</strong> venda{vendas.length !== 1 ? 's' : ''} registrada{vendas.length !== 1 ? 's' : ''}
              </p>
              <p>
                Margem de lucro: <strong>
                  {resultado.faturamento > 0 ? ((resultado.lucro / resultado.faturamento) * 100).toFixed(1) : '0'}%
                </strong>
              </p>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

export default Calculadora; 