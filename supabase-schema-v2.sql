-- SIFAU v2 schema (rebuild seguro + compatibilidade com app atual)
-- Data: 22/03/2026
-- Objetivo: manter o app funcionando sem quebrar fluxos que ainda usam `user_accounts`.

create extension if not exists pgcrypto;

-- ============================================
-- 1) Tabela canônica de usuários do app
-- ============================================
drop table if exists app_users cascade;
create table app_users (
  id text primary key default gen_random_uuid()::text,
  email text unique not null,
  access_type text not null check (access_type in ('denunciante','servidor')),
  server_type text check (server_type in ('fiscal','gerente')),
  provider text default 'email',
  senha_legacy text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_app_users_email on app_users(email);
create index idx_app_users_access on app_users(access_type);

-- ============================================
-- 2) Compatibilidade: user_accounts (usada hoje no app)
-- ============================================
drop table if exists user_accounts cascade;
create table user_accounts (
  id text primary key default gen_random_uuid()::text,
  email text unique not null,
  provider text default 'email',
  senha text,
  primeiro_acesso timestamptz default now(),
  ultimo_acesso timestamptz default now(),
  total_acessos integer default 1,
  dispositivo text,
  scheduled_deletion timestamptz,
  access_type text default 'denunciante' check (access_type in ('denunciante','servidor')),
  server_type text check (server_type in ('fiscal','gerente')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_ua_email on user_accounts(email);
create index idx_ua_access on user_accounts(access_type);

create or replace function sync_user_accounts_to_app_users()
returns trigger as $$
begin
  insert into app_users (id, email, access_type, server_type, provider, senha_legacy, created_at, updated_at)
  values (
    coalesce(new.id, gen_random_uuid()::text),
    lower(new.email),
    coalesce(new.access_type, 'denunciante'),
    new.server_type,
    coalesce(new.provider, 'email'),
    new.senha,
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (email)
  do update set
    access_type = excluded.access_type,
    server_type = excluded.server_type,
    provider = excluded.provider,
    senha_legacy = excluded.senha_legacy,
    updated_at = now();

  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sync_ua_to_app_users on user_accounts;
create trigger trg_sync_ua_to_app_users
before insert or update on user_accounts
for each row execute function sync_user_accounts_to_app_users();

-- ============================================
-- 3) Perfis operacionais (somente servidor usa matrícula)
-- ============================================
drop table if exists profiles cascade;
create table profiles (
  id text primary key,
  app_user_id text references app_users(id) on delete set null,
  nome text not null,
  tipo text not null check (tipo in ('fiscal','gerente')),
  matricula text unique not null,
  senha text,
  status text default 'offline',
  pontos integer default 0,
  latitude double precision,
  longitude double precision,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_profiles_tipo on profiles(tipo);
create index idx_profiles_matricula on profiles(matricula);

-- ============================================
-- 4) Tabelas operacionais (compatíveis com app)
-- ============================================
drop table if exists denuncias cascade;
create table denuncias (
  id text primary key,
  protocolo text unique not null,
  tipo text not null,
  descricao text,
  endereco text,
  latitude double precision,
  longitude double precision,
  status text default 'pendente',
  fiscal_id text references profiles(id),
  gerente_id text references profiles(id),
  denunciante_nome text,
  denunciante_anonimo boolean default false,
  sla_horas integer default 72,
  pontos_provisorio integer default 0,
  auth_email text,
  motivo_rejeicao text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_den_status on denuncias(status);
create index idx_den_email on denuncias(auth_email);
create index idx_den_fiscal on denuncias(fiscal_id);

-- ============================================
-- 5) RLS base (aberta para manter comportamento atual do app)
-- ============================================
alter table app_users enable row level security;
alter table user_accounts enable row level security;
alter table profiles enable row level security;
alter table denuncias enable row level security;

create policy "allow_all_app_users" on app_users for all using (true) with check (true);
create policy "allow_all_user_accounts" on user_accounts for all using (true) with check (true);
create policy "allow_all_profiles" on profiles for all using (true) with check (true);
create policy "allow_all_denuncias" on denuncias for all using (true) with check (true);
