-- Seed inicial para projeto novo (sem dados legados)
-- Rode APÓS executar supabase-schema-v2.sql

begin;

-- Contas de app (servidores + 1 denunciante)
insert into user_accounts (id, email, provider, senha, access_type, server_type)
values
  ('ua-ger-001', 'ger001@sifau.local', 'email', 'marconi2026', 'servidor', 'gerente'),
  ('ua-fsc-001', 'fsc001@sifau.local', 'email', 'marie2026', 'servidor', 'fiscal'),
  ('ua-fsc-002', 'fsc002@sifau.local', 'email', 'balbino2026', 'servidor', 'fiscal'),
  ('ua-fsc-003', 'fsc003@sifau.local', 'email', 'demetrius2026', 'servidor', 'fiscal'),
  ('ua-fsc-004', 'fsc004@sifau.local', 'email', 'kamila2026', 'servidor', 'fiscal'),
  ('ua-fsc-005', 'fsc005@sifau.local', 'email', 'evanisio2026', 'servidor', 'fiscal'),
  ('ua-fsc-006', 'fsc006@sifau.local', 'email', 'iris2026', 'servidor', 'fiscal'),
  ('ua-fsc-007', 'fsc007@sifau.local', 'email', 'paulo2026', 'servidor', 'fiscal'),
  ('ua-fsc-008', 'fsc008@sifau.local', 'email', 'adriana2026', 'servidor', 'fiscal'),
  ('ua-fsc-009', 'fsc009@sifau.local', 'email', 'andre2026', 'servidor', 'fiscal'),
  ('ua-fsc-010', 'fsc010@sifau.local', 'email', 'rebeca2026', 'servidor', 'fiscal'),
  ('ua-fsc-011', 'fsc011@sifau.local', 'email', 'gissieri2026', 'servidor', 'fiscal'),
  ('ua-fsc-012', 'fsc012@sifau.local', 'email', 'edson2026', 'servidor', 'fiscal'),
  ('ua-cid-001', 'cidadao@sifau.local', 'email', 'cidadao123', 'denunciante', null)
on conflict (email) do update
set
  senha = excluded.senha,
  access_type = excluded.access_type,
  server_type = excluded.server_type,
  updated_at = now();

-- Perfis prontos (iguais ao mockData)
insert into profiles (id, app_user_id, nome, tipo, matricula, senha, status, pontos, latitude, longitude)
values
  ('ger-001', 'ua-ger-001', 'Marconi', 'gerente', 'GER-001', 'marconi2026', 'offline', 0, null, null),
  ('fsc-001', 'ua-fsc-001', 'Marie', 'fiscal', 'FSC-001', 'marie2026', 'offline', 0, -8.0476, -34.8770),
  ('fsc-002', 'ua-fsc-002', 'Balbino', 'fiscal', 'FSC-002', 'balbino2026', 'offline', 0, -8.0530, -34.8710),
  ('fsc-003', 'ua-fsc-003', 'Demétrius', 'fiscal', 'FSC-003', 'demetrius2026', 'offline', 0, -8.0610, -34.8690),
  ('fsc-004', 'ua-fsc-004', 'Kamila Queiroz', 'fiscal', 'FSC-004', 'kamila2026', 'offline', 0, -8.0490, -34.8800),
  ('fsc-005', 'ua-fsc-005', 'Evanisio Lopes', 'fiscal', 'FSC-005', 'evanisio2026', 'offline', 0, -8.0550, -34.8750),
  ('fsc-006', 'ua-fsc-006', 'Iris', 'fiscal', 'FSC-006', 'iris2026', 'offline', 0, -8.0580, -34.8720),
  ('fsc-007', 'ua-fsc-007', 'Paulo Karas', 'fiscal', 'FSC-007', 'paulo2026', 'offline', 0, -8.0620, -34.8680),
  ('fsc-008', 'ua-fsc-008', 'Adriana Gondim', 'fiscal', 'FSC-008', 'adriana2026', 'offline', 0, -8.0500, -34.8790),
  ('fsc-009', 'ua-fsc-009', 'André', 'fiscal', 'FSC-009', 'andre2026', 'offline', 0, -8.0560, -34.8730),
  ('fsc-010', 'ua-fsc-010', 'Rebeca Cavalcanti', 'fiscal', 'FSC-010', 'rebeca2026', 'offline', 0, -8.0540, -34.8760),
  ('fsc-011', 'ua-fsc-011', 'Gissieri', 'fiscal', 'FSC-011', 'gissieri2026', 'offline', 0, -8.0510, -34.8740),
  ('fsc-012', 'ua-fsc-012', 'Edson', 'fiscal', 'FSC-012', 'edson2026', 'offline', 0, -8.0525, -34.8755)
on conflict (id) do update
set
  nome = excluded.nome,
  tipo = excluded.tipo,
  matricula = excluded.matricula,
  senha = excluded.senha,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  updated_at = now();

-- Denúncia exemplo para validar fluxo fiscal/gerente
insert into denuncias (
  id, protocolo, tipo, descricao, endereco, latitude, longitude, status,
  fiscal_id, gerente_id, denunciante_nome, denunciante_anonimo, sla_horas, pontos_provisorio, auth_email
)
values (
  'den-seed-001',
  '2026-00001',
  'Construção Irregular',
  'Denúncia de teste para validar fluxo do app no projeto novo.',
  'Rua de Teste, 100',
  -8.0476,
  -34.8770,
  'designada',
  'fsc-001',
  'ger-001',
  'Usuário Teste',
  false,
  72,
  50,
  'cidadao@sifau.local'
)
on conflict (id) do update
set
  status = excluded.status,
  fiscal_id = excluded.fiscal_id,
  gerente_id = excluded.gerente_id,
  updated_at = now();

commit;
