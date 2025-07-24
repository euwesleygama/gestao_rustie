# Correções Realizadas nos Erros do Banco de Dados

## Problemas Identificados e Soluções

### 1. Erro: "column usuarios.id_auth does not exist"
**Problema:** O código estava tentando acessar uma coluna `id_auth` que não existe na tabela `usuarios`.

**Solução:** 
- Corrigido em `src/lib/UserContext.tsx`
- Alterado de `.eq('id_auth', data.user.id)` para `.eq('id', data.user.id)`

### 2. Erro: "duplicate key value violates unique constraint usuarios_email_key"
**Problema:** Tentativa de inserir usuários com emails duplicados.

**Solução:**
- Corrigido em `src/components/Login.tsx`
- Adicionada verificação de email existente antes do registro
- Melhorado o processo de criação de usuário para evitar duplicações

### 3. Erro: "insert or update on table ingredientes violates foreign key constraint"
**Problema:** Tentativa de inserir ingredientes com `usuario_id` inválido.

**Causa Raiz:** O Supabase Auth usa um ID diferente do ID da tabela `usuarios`. O código estava tentando usar o ID do Supabase Auth diretamente como `usuario_id`.

**Solução:**
- **Nova migração:** Adicionada coluna `auth_id` na tabela `usuarios` para relacionar com o Supabase Auth
- **Login.tsx:** Corrigido para usar `auth_id` em vez de `id` para relacionar com o Supabase Auth
- **UserContext.tsx:** Corrigido para buscar usuário por `auth_id` + função utilitária `getUserData`
- **CustosInsumos.tsx:** Simplificado para usar a função utilitária do UserContext
- **CustosPratos.tsx:** Aplicadas as mesmas correções

### 4. Problema: "Usuário não encontrado"
**Problema:** Mesmo após as correções, ainda aparecia "usuário não encontrado" ao tentar salvar ingredientes.

**Causa:** O Supabase Auth pode gerar IDs diferentes entre sessões ou o processo de sincronização entre auth_id e id não estava funcionando corretamente.

**Solução:**
- **Função Utilitária:** Criada função `getUserData` no UserContext que tenta buscar por `auth_id` primeiro, depois por email
- **Fallback Robusto:** Se não encontrar por `auth_id`, tenta por email e atualiza o `auth_id`
- **Logs Detalhados:** Adicionados logs em todos os componentes para facilitar debug
- **Sincronização Automática:** O sistema agora sincroniza automaticamente `auth_id` quando encontra usuário por email

### 5. Problema: Incompatibilidade de Nomes de Campos
**Problema:** A interface `Insumo` no código não correspondia aos nomes dos campos no banco de dados.

**Causa:** 
- **Banco:** `nome`, `valor_total`, `quantidade`, `custo_por_unidade`
- **Código:** `ingrediente`, `valorTotal`, `quantidade`, `custoPor1`

**Solução:**
- **Interface Corrigida:** Atualizada interface `Insumo` para usar os nomes corretos do banco
- **Exibição Corrigida:** Corrigida exibição na tabela para usar `insumo.nome`, `insumo.valor_total`, etc.
- **Edição Corrigida:** Corrigida função `handleEdit` para mapear corretamente os campos

### 6. Problema: Políticas RLS (Row Level Security) Faltando
**Problema:** As tabelas `ingredientes` e `usuarios` tinham RLS habilitado, mas não tinham políticas completas.

**Causa:** 
- RLS estava habilitado nas tabelas `ingredientes` e `usuarios`
- Só havia política para INSERT
- Faltavam políticas para SELECT, UPDATE e DELETE
- Isso causava bloqueio de todas as operações de leitura e modificação

**Solução:**
- **Tabela ingredientes:**
  - Política SELECT: Usuários podem ver apenas seus próprios ingredientes
  - Política UPDATE: Usuários podem atualizar apenas seus próprios ingredientes  
  - Política DELETE: Usuários podem deletar apenas seus próprios ingredientes
  - Política INSERT: Atualizada para usar `auth_id` corretamente

- **Tabela usuarios:**
  - Política SELECT: Usuários podem ver seus próprios dados
  - Política UPDATE: Usuários podem atualizar seus próprios dados
  - Política DELETE: Usuários podem deletar seus próprios dados
  - Política INSERT: Atualizada para usar `auth_id` e email

### 7. Problema: auth_id Incorreto
**Problema:** O `auth_id` estava igual ao `id` da tabela `usuarios`, causando confusão no sistema.

**Causa:** 
- O usuário foi criado antes da implementação correta do `auth_id`
- O `auth_id` estava sendo definido como igual ao `id` da tabela
- Isso impedia o sistema de encontrar o usuário corretamente

**Solução:**
- Limpado o `auth_id` para NULL
- Isso força o sistema a buscar por email e atualizar o `auth_id` corretamente
- O sistema agora vai funcionar corretamente no próximo login

### 8. Problema: Falta de Validação e Logs
**Problema:** Não havia validação adequada dos dados e logs detalhados para debug.

**Causa:** 
- Falta de validação dos dados do formulário
- Logs insuficientes para identificar problemas
- Falta de validação do userData.id

**Solução:**
- **Validação de Dados:** Adicionada validação para nome, valor total e quantidade
- **Validação de userData:** Verificação se userData.id é válido
- **Logs Detalhados:** Adicionados logs para debug de inserção
- **Tratamento de Erro:** Melhorado tratamento de erros com detalhes

## Correções Adicionais Realizadas

#### Estrutura do Banco de Dados
- Corrigida a coluna `custo_por_unidade` na tabela `ingredientes` para ser calculada automaticamente
- Adicionada coluna `auth_id` na tabela `usuarios` para relacionar com Supabase Auth
- **NOVO:** Configuradas políticas RLS para a tabela `ingredientes`
- Aplicadas migrações para ajustar a estrutura

#### Componentes Corrigidos
1. **UserContext.tsx**
   - Corrigida referência à coluna inexistente
   - Alterado para usar `auth_id` para buscar dados do usuário
   - **NOVO:** Adicionada função utilitária `getUserData`
   - Melhorado tratamento de erros com logs detalhados

2. **Login.tsx**
   - Adicionada verificação de email duplicado
   - Corrigido para usar `auth_id` em vez de `id`
   - **NOVO:** Adicionados logs detalhados para debug
   - Melhorado processo de criação de usuário
   - Adicionados logs de erro para debug

3. **CustosInsumos.tsx**
   - **NOVO:** Simplificado para usar função utilitária `getUserData`
   - Removida lógica duplicada de busca de usuário
   - **NOVO:** Interface `Insumo` corrigida para corresponder ao banco
   - **NOVO:** Exibição na tabela corrigida
   - Melhorado tratamento de erros
   - Corrigidas operações de CRUD para usar o ID correto

4. **CustosPratos.tsx**
   - Aplicadas as mesmas correções de segurança
   - Adicionada busca do ID correto do usuário
   - Melhorado tratamento de erros
   - Corrigidas operações de CRUD

## Fluxo de Autenticação Corrigido

### Antes (Problemático):
1. Supabase Auth cria usuário com ID próprio
2. Código tentava usar esse ID diretamente como `usuario_id`
3. Erro de chave estrangeira porque o ID não existia na tabela `usuarios`

### Agora (Correto):
1. Supabase Auth cria usuário com ID próprio
2. Código busca/insere na tabela `usuarios` usando `auth_id`
3. **NOVO:** Função `getUserData` tenta por `auth_id`, depois por email
4. **NOVO:** Se encontrar por email, atualiza `auth_id` automaticamente
5. Operações CRUD usam o `id` da tabela `usuarios` (não o `auth_id`)
6. **NOVO:** Interface e exibição corrigidas para corresponder ao banco
7. Relacionamentos funcionam corretamente

## Como Debuggar

### Logs Disponíveis:
- 🔍 Busca de usuário por auth_id
- 📧 Busca de usuário por email (fallback)
- 🔄 Atualização de auth_id
- ✅ Usuário encontrado
- ❌ Erros detalhados
- 📦 Dados carregados

### Para Testar:
1. Abra o console do navegador (F12)
2. Faça login/logout
3. Tente adicionar ingredientes
4. Observe os logs para identificar onde está o problema

## Verificações Realizadas

✅ **Estrutura do Banco:** Todas as tabelas estão corretas
✅ **Relacionamentos:** Chaves estrangeiras funcionando corretamente
✅ **Dados Órfãos:** Nenhum ingrediente sem usuário válido
✅ **Emails Duplicados:** Nenhum email duplicado encontrado
✅ **Colunas Calculadas:** `custo_por_unidade` agora é calculada automaticamente
✅ **Relacionamento Auth:** `auth_id`