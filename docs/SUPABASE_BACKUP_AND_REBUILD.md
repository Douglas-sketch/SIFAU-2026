# Backup e recriação do Supabase (sem perder dados)

Data: 22/03/2026

## Objetivo
Permitir recriar o banco com nova estrutura (conta denunciante/servidor com matrícula única para servidor) **sem perder as tabelas atuais**.

## 1) Backup ANTES de qualquer mudança (obrigatório)

### Opção A — Dashboard Supabase (rápido)
1. Acesse seu projeto no Supabase.
2. Vá em **Database > Backups** e gere/baixe um backup.
3. Em **Table Editor**, exporte CSV das tabelas críticas:
   - `user_accounts`
   - `profiles`
   - `denuncias`
   - `relatorios`
   - `autos_infracao`
   - `historico_atividades`
   - `mensagens`
   - `fotos`

### Opção B — SQL Editor (manual e auditável)
Rode os selects para copiar os dados em JSON/CSV:
- `select * from user_accounts;`
- `select * from profiles;`
- `select * from denuncias;`
- `select * from relatorios;`
- `select * from autos_infracao;`
- `select * from historico_atividades;`
- `select * from mensagens;`
- `select * from fotos;`

## 2) Estratégia segura de migração

1. Criar um projeto Supabase novo (ou schema novo no mesmo projeto).
2. Executar o schema novo: `supabase-schema-v2.sql`.
3. Importar os dados do backup em etapas:
   - `app_users` (contas por email)
   - `profiles` (somente servidor)
   - entidades operacionais (`denuncias`, `relatorios`, etc.)
4. Validar contagens (`count(*)`) por tabela antiga vs nova.
5. Só depois apontar o app para o novo projeto (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).

## 3) Mapeamento recomendado

- `user_accounts.email` -> `app_users.email`
- `user_accounts.provider` -> `app_users.provider`
- `user_accounts.senha` -> `app_users.senha_legacy` (temporário)
- `profiles` permanece para acesso servidor (fiscal/gerente)

## 4) Boas práticas para não perder dados

- Nunca rodar `DROP TABLE` sem backup validado.
- Migrar primeiro em ambiente de teste.
- Guardar snapshot de contagem por tabela antes/depois.
- Fazer janela de manutenção curta para evitar escrita concorrente durante import.

## 5) Checklist de validação pós-migração

- [ ] Login denunciante funciona.
- [ ] Cadastro de servidor gera matrícula única.
- [ ] Login com matrícula/senha funciona para fiscal e gerente.
- [ ] Denúncias antigas aparecem com histórico e fotos.
- [ ] Dashboard gerente/fiscal carrega normalmente.

## 6) Próximo passo (agora)

Como você já exportou, execute nesta ordem:

1. Crie um projeto Supabase novo.
2. Rode o arquivo `supabase-schema-v2.sql`.
3. Importe seus CSVs antigos em tabelas staging:
   - `legacy_user_accounts`
   - `legacy_profiles`
   - `legacy_denuncias`
   - (opcional) crie essas tabelas automaticamente com `sql/create_legacy_staging_tables.sql`
4. Rode `sql/migrate_legacy_exports_to_v2.sql`.
5. Confira as contagens no final do script.
6. Atualize as envs do app para o novo projeto:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

### Comandos SQL (ordem exata)

```sql
-- 1) Schema novo completo (inclui app_users, user_accounts, profiles, denuncias, relatorios, autos, historico, mensagens, fotos)
-- Cole e execute o conteúdo de: supabase-schema-v2.sql

-- 2) Criação das tabelas staging para import dos CSVs antigos
-- Cole e execute o conteúdo de: sql/create_legacy_staging_tables.sql

-- 3) Após importar os CSVs em legacy_*, execute a migração
-- Cole e execute o conteúdo de: sql/migrate_legacy_exports_to_v2.sql
```

## 7) Preciso criar projeto novo mesmo?

Não obrigatoriamente.

- **Opção A (recomendada): projeto novo**
  - Mais seguro para migração, rollback e testes sem risco.
  - Nesse caso, você precisa trocar no app:
    - `VITE_SUPABASE_URL`
    - `VITE_SUPABASE_ANON_KEY`

- **Opção B: mesmo projeto atual**
  - Também funciona, mas exige mais cuidado para não impactar usuários durante a migração.
  - Se continuar no mesmo projeto, a URL/chave podem permanecer as mesmas.

Em resumo:
- projeto novo => troca URL/anon key;
- mesmo projeto => normalmente não troca.
