# Novo projeto Supabase — passo a passo (sem enviar secrets ao GitHub)

## 1) Criar projeto novo
1. Entre no Supabase.
2. Clique em **New project**.
3. Escolha organização, nome, região e senha do banco.
4. Aguarde ficar `Healthy`.

## 2) Aplicar schema do banco (código novo)
No **SQL Editor** do projeto novo:
1. Clique em **New query**.
2. Copie e cole TODO o conteúdo de `supabase-schema-v2.sql`.
3. Execute (**Run**).

Esse arquivo cria:
- `app_users`
- `user_accounts` (compat com app atual)
- `profiles`
- `denuncias`
- `relatorios`
- `autos_infracao`
- `historico_atividades`
- `mensagens`
- `fotos`

## 3) (Se tiver export antigo) criar tabelas staging
Ainda no SQL Editor:
1. Nova query.
2. Cole `sql/create_legacy_staging_tables.sql`.
3. Run.

## 4) Importar CSVs (seu backup)
No **Table Editor**:
- Importe cada CSV para as tabelas `legacy_*` correspondentes.

> Se você **não** vai importar legado (banco só de teste), pode pular direto para o passo 6 e rodar `sql/seed_fresh_project.sql`.

## 5) Migrar staging -> tabelas finais
No SQL Editor:
1. Nova query.
2. Cole `sql/migrate_legacy_exports_to_v2.sql`.
3. Run.

## 6) Configurar o app local (SEM subir para GitHub)
No seu computador, na raiz do projeto, crie/edite `.env.local` com:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SEU_ANON_KEY
```

- `.env.local` já deve ficar fora do Git.
- Nunca commitar keys reais.

## 7) Testar localmente
```bash
npm install
npm run dev
```

## 8) Checklist rápido
- Login encontra conta existente.
- Cadastro de servidor gera matrícula.
- Fiscal recebe tarefas/notificações.
- Relatório imprime e volta para o app.

## 9) Seed rápido (projeto vazio)
No SQL Editor, rode também:
- `sql/seed_fresh_project.sql`

Credenciais de teste:
- Gerente: `GER-001` / `gerente123`
- Fiscal: `FSC-001` / `fiscal123`
- Denunciante (email): `cidadao@sifau.local` / `cidadao123`

Perfis completos já preparados no seed:
- 1 gerente: `GER-001` (Marconi)
- 12 fiscais: `FSC-001` até `FSC-012` (mesmos nomes/senhas do `mockData.ts`)

## Observação
Se quiser, eu posso te guiar **query por query** conforme você for executando, validando cada etapa em tempo real.
