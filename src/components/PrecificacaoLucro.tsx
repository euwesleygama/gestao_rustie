import React, { useState, useEffect } from 'react';
import { Calculator, Save } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useUser } from '../lib/UserContext';

interface PrecificacaoItem {
  id: string;
  nomePrato: string;
  custoPrato: number;
  custoFixoPercent: number;
  custoIncalculavelPercent: number;
  custoReal: number;
  precoVenda: number;
  lucroCredito: number;
  lucroDebito: number;
  lucroPix: number;
  lucroDinheiro: number;
}

const PrecificacaoLucro: React.FC = () => {
  const { user } = useUser();
  const [itens, setItens] = useState<PrecificacaoItem[]>([]);
  const [precosVendaTemp, setPrecosVendaTemp] = useState<{[key: string]: number}>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Dados dos outros componentes
  const [pratos, setPratos] = useState<any[]>([]);
  const [custosFixos, setCustosFixos] = useState<any[]>([]);
  const [custosIncalculaveis, setCustosIncalculaveis] = useState<any[]>([]);
  const [taxasPagamento, setTaxasPagamento] = useState<any[]>([]);
  const [faturamento, setFaturamento] = useState(0);

  // Buscar pratos do Supabase
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
          custoTotal: prato.custo_total,
        }));
        setPratos(pratosFormatados);
      }
    };
    fetchPratos();
  }, [user?.id]);
      
  // Carregar preços de venda do Supabase
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
        setPrecosVendaTemp(precos);
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

  // Buscar faturamento mensal do Supabase para calcular % dos custos fixos
  useEffect(() => {
    const fetchFaturamento = async () => {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from('vendas_diarias')
        .select('faturamento')
        .eq('usuario_id', user.id);
      if (!error && data) {
        const total = data.reduce((acc: number, venda: any) => acc + (venda.faturamento || 0), 0);
        setFaturamento(total);
      } else {
        setFaturamento(0);
      }
    };
    fetchFaturamento();
  }, [user?.id]);

  // Buscar taxas de pagamento do Supabase
  useEffect(() => {
    const fetchTaxas = async () => {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from('taxas_pagamento')
        .select('*')
        .eq('usuario_id', user.id);
      if (!error && data) setTaxasPagamento(data);
      else setTaxasPagamento([]);
    };
    fetchTaxas();
  }, [user?.id]);

  // Gerar itens automaticamente baseado nos pratos cadastrados
  useEffect(() => {
    const itensAtualizados = pratos.map(prato => {
      const precoVenda = precosVendaTemp[prato.id] || 0;
      const calculo = calcularPrecificacao(prato.custoTotal, precoVenda);
      
      return {
        id: prato.id,
        nomePrato: prato.nomePrato,
        custoPrato: prato.custoTotal,
        custoFixoPercent: calculo.custoFixoPercent,
        custoIncalculavelPercent: calculo.custoIncalculavelPercent,
        custoReal: calculo.custoReal,
        precoVenda: precoVenda,
        lucroCredito: calculo.lucroCredito,
        lucroDebito: calculo.lucroDebito,
        lucroPix: calculo.lucroPix,
        lucroDinheiro: calculo.lucroDinheiro
      };
    });
    
    setItens(itensAtualizados);
  }, [pratos, precosVendaTemp, custosFixos, custosIncalculaveis, taxasPagamento, faturamento]);

  // Cálculos

  const getPorcentagemCustosFixos = () => {
    if (faturamento === 0) return 0;
    const totalCustosFixos = custosFixos.reduce((total: number, custo: any) => total + (custo.valor || 0), 0);
    return (totalCustosFixos / faturamento) * 100;
  };
  const getPorcentagemCustosIncalculaveis = () => {
    return custosIncalculaveis.reduce((total: number, custo: any) => total + (custo.percentual || 0), 0);
  };

  const getTaxaPorTipo = (tipo: string) => {
    const taxa = taxasPagamento.find(t => t.tipo === tipo);
    const valorTaxa = taxa ? taxa.taxa : 0;
    return isNaN(valorTaxa) ? 0 : valorTaxa;
  };

  const calcularPrecificacao = (custoPrato: number, precoVenda: number) => {
    // Validar entradas
    const custoValidado = isNaN(custoPrato) ? 0 : custoPrato;
    const precoValidado = isNaN(precoVenda) ? 0 : precoVenda;
    
    const custoFixoPercent = getPorcentagemCustosFixos();
    const custoIncalculavelPercent = getPorcentagemCustosIncalculaveis();
    
    // Calcular custo real somando as porcentagens
    const totalTaxasPercent = custoFixoPercent + custoIncalculavelPercent;
    const custoReal = custoValidado + (custoValidado * totalTaxasPercent / 100);
    
    // Se não há preço de venda, retornar valores zerados para lucro
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
    
    // Calcular lucro por forma de pagamento
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

  const handlePrecoVendaChange = (pratoId: string, novoPreco: number) => {
    setPrecosVendaTemp(prev => ({
      ...prev,
      [pratoId]: novoPreco
    }));
    setHasChanges(true);
  };

  const handleSalvar = async () => {
    // Salvar no Supabase
    if (!user?.id) return;
    const precosParaSalvar = Object.entries(precosVendaTemp).map(([pratoId, preco]) => ({
      usuario_id: user.id,
      prato_id: pratoId,
      preco: preco,
      data_atualizacao: new Date().toISOString(),
    }));
    if (precosParaSalvar.length > 0) {
      await supabase
        .from('precos_venda')
        .upsert(precosParaSalvar, { onConflict: 'usuario_id,prato_id' });
    }
    setHasChanges(false);
  };

  return (
    <div className="animate-fadeIn">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>Precificação e Lucro</h2>
          {hasChanges && (
            <button 
              className="btn btn-success" 
              onClick={handleSalvar}
              style={{ height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Save size={18} style={{ marginRight: '8px' }} />
              Salvar Alterações
            </button>
          )}
        </div>

        {/* Tabela de Resultados */}
        {itens.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome do Prato</th>
                  <th>Custo do Prato</th>
                  <th>Taxas</th>
                  <th>Custo Real</th>
                  <th>Preço de Venda</th>
                  <th>Cartão de Crédito</th>
                  <th>Cartão de Débito</th>
                  <th>PIX</th>
                  <th>Dinheiro</th>
                </tr>
              </thead>
              <tbody>
                {itens.map(item => (
                  <tr key={item.id}>
                    <td>{item.nomePrato}</td>
                    <td>R$ {item.custoPrato.toFixed(2)}</td>
                    <td>{(item.custoFixoPercent + item.custoIncalculavelPercent).toFixed(2)}%</td>
                    <td>R$ {item.custoReal.toFixed(2)}</td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={item.precoVenda}
                        onChange={(e) => handlePrecoVendaChange(item.id, parseFloat(e.target.value) || 0)}
                        style={{
                          width: '100px',
                          padding: '4px 8px',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(255, 255, 255, 0.1)',
                          color: 'inherit',
                          fontSize: '14px'
                        }}
                        placeholder="0.00"
                      />
                    </td>
                    <td style={{ color: item.lucroCredito >= 0 ? '#28a745' : '#dc3545' }}>
                      R$ {item.lucroCredito.toFixed(2)}
                    </td>
                    <td style={{ color: item.lucroDebito >= 0 ? '#28a745' : '#dc3545' }}>
                      R$ {item.lucroDebito.toFixed(2)}
                    </td>
                    <td style={{ color: item.lucroPix >= 0 ? '#28a745' : '#dc3545' }}>
                      R$ {item.lucroPix.toFixed(2)}
                    </td>
                    <td style={{ color: item.lucroDinheiro >= 0 ? '#28a745' : '#dc3545' }}>
                      R$ {item.lucroDinheiro.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <Calculator size={48} style={{ color: 'var(--text-secondary)', marginBottom: '16px' }} />
            <p>Nenhum prato cadastrado ainda.</p>
            <p>Vá para a aba "Pratos" para cadastrar seus pratos e eles aparecerão aqui automaticamente.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PrecificacaoLucro; 