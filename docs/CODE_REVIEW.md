# Análise do código do app SIFAU (Março/2026)

## Visão geral

O app já está funcional, mas há pontos importantes para evoluir em **segurança**, **manutenibilidade** e **observabilidade**.

## Melhorias prioritárias (alta prioridade)

1. **Remover credenciais hardcoded no frontend**
   - O projeto tinha fallback de URL/chave do Supabase no código cliente.
   - Mesmo com `anon key`, deixar isso hardcoded aumenta risco operacional e dificulta rotação de credenciais.

2. **Autenticação sem senha em texto puro**
   - Hoje existem trechos com uso de `senha` em leitura/comparação direta.
   - Recomendação: migrar para Supabase Auth (ou hash + política de senha no backend), evitando senha em claro no banco e em estado de aplicação.

3. **Reduzir acoplamento do `AppContext`**
   - O contexto central concentra regras de autenticação, sincronização, notificações, storage, status de usuário etc.
   - Recomendação: separar em domínios (ex.: `auth`, `denuncias`, `mensagens`, `sync`) para facilitar testes e manutenção.

## Melhorias de curto prazo (médio impacto)

1. **Padronizar tratamento de erro**
   - Há muitos `catch { /* */ }` silenciosos.
   - Recomendação: criar utilitário único de erro/log para diferenciar erros esperados de falhas reais.

2. **Adicionar lint/testes automatizados**
   - O projeto possui build, mas sem scripts de lint/test no `package.json`.
   - Recomendação: incluir `eslint` + testes unitários mínimos para regras críticas (login, criação de denúncia, sync offline).

3. **Mapeamento tipado do Supabase**
   - Existem vários usos de `any` no serviço de dados.
   - Recomendação: gerar tipos de schema do Supabase e reduzir `any` para aumentar segurança de tipos.

## Melhorias estruturais (médio/longo prazo)

1. **Estratégia offline-first mais explícita**
   - Hoje a estratégia existe, mas distribuída em vários pontos.
   - Recomendação: centralizar política de reconciliação de conflitos e fila offline para previsibilidade.

2. **Camada de configuração do app**
   - Consolidar chaves e variáveis em módulo único (com validação), evitando regras dispersas.

3. **Observabilidade e auditoria**
   - Criar telemetria mínima (erros por fluxo, falhas de sync, tempo de resposta do Supabase).

## Plano sugerido (30 dias)

- **Semana 1:** hardening de configuração + remoção de credenciais em código + logging de erro padronizado.
- **Semana 2:** refatoração inicial de `AppContext` (extração de auth/sync).
- **Semana 3:** testes unitários de fluxos críticos + lint/CI básico.
- **Semana 4:** tipagem forte com schema Supabase e revisão de autenticação.

## Resultado esperado

Com essas mudanças, o app tende a ganhar:
- menor risco de segurança,
- menor custo de manutenção,
- maior previsibilidade em cenários offline/online,
- base mais confiável para escalar funcionalidades.
