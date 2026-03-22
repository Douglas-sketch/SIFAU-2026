-- Migração de dados exportados para schema v2
-- Pré-requisito: importar CSVs antigos em tabelas staging com prefixo legacy_
-- Tabelas staging esperadas (mínimo):
--   legacy_user_accounts, legacy_profiles, legacy_denuncias

begin;

-- 1) User accounts (compat + canônica)
insert into user_accounts (
  id, email, provider, senha, primeiro_acesso, ultimo_acesso, total_acessos,
  dispositivo, scheduled_deletion, access_type, server_type, created_at
)
select
  coalesce(id, gen_random_uuid()::text),
  lower(email),
  coalesce(provider, 'email'),
  senha,
  coalesce(primeiro_acesso, now()),
  coalesce(ultimo_acesso, now()),
  coalesce(total_acessos, 1),
  dispositivo,
  scheduled_deletion,
  case
    when upper(coalesce(email, '')) like '%@PREFEITURA.%' then 'servidor'
    else 'denunciante'
  end as access_type,
  null::text as server_type,
  coalesce(created_at, now())
from legacy_user_accounts
on conflict (email) do update
set
  provider = excluded.provider,
  senha = excluded.senha,
  ultimo_acesso = excluded.ultimo_acesso,
  total_acessos = excluded.total_acessos,
  dispositivo = excluded.dispositivo,
  scheduled_deletion = excluded.scheduled_deletion,
  updated_at = now();

-- 2) Profiles de servidor
insert into profiles (
  id, app_user_id, nome, tipo, matricula, senha, status, pontos,
  latitude, longitude, created_at, updated_at
)
select
  p.id,
  au.id as app_user_id,
  p.nome,
  p.tipo,
  p.matricula,
  p.senha,
  coalesce(p.status, 'offline'),
  coalesce(p.pontos, 0),
  p.latitude,
  p.longitude,
  coalesce(p.created_at, now()),
  coalesce(p.updated_at, now())
from legacy_profiles p
left join app_users au on au.email = lower(p.nome) -- fallback fraco
where p.tipo in ('fiscal', 'gerente')
on conflict (id) do update
set
  nome = excluded.nome,
  tipo = excluded.tipo,
  matricula = excluded.matricula,
  senha = excluded.senha,
  status = excluded.status,
  pontos = excluded.pontos,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  updated_at = now();

-- 3) Denúncias
insert into denuncias (
  id, protocolo, tipo, descricao, endereco, latitude, longitude,
  status, fiscal_id, gerente_id, denunciante_nome, denunciante_anonimo,
  sla_horas, pontos_provisorio, auth_email, motivo_rejeicao, created_at, updated_at
)
select
  id, protocolo, tipo, descricao, endereco, latitude, longitude,
  coalesce(status, 'pendente'), fiscal_id, gerente_id, denunciante_nome,
  coalesce(denunciante_anonimo, false), coalesce(sla_horas, 72),
  coalesce(pontos_provisorio, 0), auth_email, motivo_rejeicao,
  coalesce(created_at, now()), coalesce(updated_at, now())
from legacy_denuncias
on conflict (id) do update
set
  protocolo = excluded.protocolo,
  tipo = excluded.tipo,
  descricao = excluded.descricao,
  endereco = excluded.endereco,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  status = excluded.status,
  fiscal_id = excluded.fiscal_id,
  gerente_id = excluded.gerente_id,
  denunciante_nome = excluded.denunciante_nome,
  denunciante_anonimo = excluded.denunciante_anonimo,
  sla_horas = excluded.sla_horas,
  pontos_provisorio = excluded.pontos_provisorio,
  auth_email = excluded.auth_email,
  motivo_rejeicao = excluded.motivo_rejeicao,
  updated_at = now();

commit;

-- Validação rápida
select 'user_accounts' as tabela, count(*) from user_accounts
union all
select 'app_users' as tabela, count(*) from app_users
union all
select 'profiles' as tabela, count(*) from profiles
union all
select 'denuncias' as tabela, count(*) from denuncias;
