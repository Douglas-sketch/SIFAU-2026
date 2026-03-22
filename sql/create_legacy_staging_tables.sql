-- Tabelas staging para importar CSVs exportados do projeto antigo
-- Execute ANTES de rodar: sql/migrate_legacy_exports_to_v2.sql

create table if not exists legacy_user_accounts (
  id text,
  email text,
  provider text,
  senha text,
  primeiro_acesso timestamptz,
  ultimo_acesso timestamptz,
  total_acessos integer,
  dispositivo text,
  scheduled_deletion timestamptz,
  created_at timestamptz
);

create table if not exists legacy_profiles (
  id text,
  nome text,
  tipo text,
  matricula text,
  senha text,
  status text,
  pontos integer,
  latitude double precision,
  longitude double precision,
  created_at timestamptz,
  updated_at timestamptz
);

create table if not exists legacy_denuncias (
  id text,
  protocolo text,
  tipo text,
  descricao text,
  endereco text,
  latitude double precision,
  longitude double precision,
  status text,
  fiscal_id text,
  gerente_id text,
  denunciante_nome text,
  denunciante_anonimo boolean,
  sla_horas integer,
  pontos_provisorio integer,
  auth_email text,
  motivo_rejeicao text,
  created_at timestamptz,
  updated_at timestamptz
);

create table if not exists legacy_relatorios (
  id text,
  denuncia_id text,
  fiscal_id text,
  texto text,
  assinatura_base64 text,
  dados_extras jsonb,
  created_at timestamptz,
  updated_at timestamptz
);

create table if not exists legacy_autos_infracao (
  id text,
  denuncia_id text,
  fiscal_id text,
  valor numeric(12,2),
  tipo text,
  embargo boolean,
  created_at timestamptz
);

create table if not exists legacy_historico_atividades (
  id text,
  fiscal_id text,
  denuncia_id text,
  tipo text,
  descricao text,
  pontos integer,
  created_at timestamptz
);

create table if not exists legacy_mensagens (
  id text,
  de_id text,
  para_id text,
  de_nome text,
  para_nome text,
  texto text,
  lida boolean,
  denuncia_id text,
  created_at timestamptz
);

create table if not exists legacy_fotos (
  id text,
  denuncia_id text,
  base64 text,
  tipo text,
  created_at timestamptz
);
