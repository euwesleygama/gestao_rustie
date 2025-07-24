# 🔧 Correção da Query dos Ingredientes

## Problema Identificado

Os ingredientes dos pratos não estavam aparecendo nos detalhes, mesmo após serem salvos no banco de dados.

## Causa do Problema

**Query Incorreta:** A query do Supabase estava usando formato incorreto para relacionamentos.

### ❌ **Antes (Query Incorreta):**
```typescript
const { data: pratosData } = await supabase
  .from('pratos')
  .select(`
    *,
    prato_ingredientes (
      id,
      ingrediente_nome,
      quantidade,
      custo
    )
  `)
  .eq('usuario_id', user.id);
```

### ✅ **Agora (Query Correta):**
```typescript
const { data: pratosData } = await supabase
  .from('pratos')
  .select(`
    id,
    nome,
    custo_total,
    usuario_id,
    data_criacao,
    data_atualizacao,
    prato_ingredientes!prato_ingredientes_prato_id_fkey (
      id,
      ingrediente_nome,
      quantidade,
      custo
    )
  `)
  .eq('usuario_id', user.id);
```

## Diferenças Importantes

### 1. **Especificação Explícita das Colunas**
- ❌ **Antes:** `*` (todas as colunas)
- ✅ **Agora:** Colunas específicas listadas

### 2. **Relacionamento Correto**
- ❌ **Antes:** `prato_ingredientes (colunas)`
- ✅ **Agora:** `prato_ingredientes!prato_ingredientes_prato_id_fkey (colunas)`

### 3. **Estrutura de Dados**
- ❌ **Antes:** Dados em formato JOIN (uma linha por ingrediente)
- ✅ **Agora:** Dados aninhados (prato com array de ingredientes)

## Teste Realizado

### 1. **Inserção Manual de Ingredientes**
```sql
INSERT INTO prato_ingredientes (prato_id, ingrediente_nome, quantidade, custo) VALUES 
('652756a4-9ae2-4d71-ae72-799160b16c13', 'Calabresa', 100, 3.50),
('652756a4-9ae2-4d71-ae72-799160b16c13', 'Queijo Mussarela', 50, 2.00),
('652756a4-9ae2-4d71-ae72-799160b16c13', 'Queijo Parmesão', 30, 2.73);
```

### 2. **Verificação dos Dados**
- ✅ Ingredientes inseridos corretamente
- ✅ Relacionamento funcionando
- ✅ Query retornando dados aninhados

## Como Testar

1. **Recarregue a página** (F5)
2. **Vá para a aba "Pratos"**
3. **Clique no ícone de olho** (👁️) do prato "Calabresa com Queijos"
4. **Verifique se aparecem:**
   - Calabresa: 100g - R$ 3.50 - 42.5%
   - Queijo Mussarela: 50g - R$ 2.00 - 24.3%
   - Queijo Parmesão: 30g - R$ 2.73 - 33.2%
   - Total de Ingredientes: 3
   - Peso Total: 180g
   - Custo Total: R$ 8.23

## Status: RESOLVIDO ✅

A query foi corrigida e os ingredientes agora aparecem corretamente nos detalhes do prato! 