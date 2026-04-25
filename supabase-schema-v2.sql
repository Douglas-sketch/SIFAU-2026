-- ============================================
-- SIFAU — SCHEMA COMPLETO v2
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. TENANTS
CREATE TABLE tenants (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome           text NOT NULL,
  municipio      text NOT NULL,
  estado         char(2) NOT NULL,
  subdominio     text UNIQUE,
  logo_url       text,
  cor_primaria   text DEFAULT '#185FA5',
  cor_secundaria text DEFAULT '#0F6E56',
  ativo          boolean DEFAULT true,
  plano          text DEFAULT 'basico',
  created_at     timestamptz DEFAULT now()
);

-- 2. USUÁRIOS
CREATE TABLE app_users (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid REFERENCES tenants(id),
  auth_id               uuid UNIQUE,
  email                 text UNIQUE NOT NULL,
  nome                  text NOT NULL,
  telefone              text,
  tipo_acesso           text NOT NULL CHECK (tipo_acesso IN ('cidadao','fiscal','gerente','admin')),
  matricula             text UNIQUE,
  ativo                 boolean DEFAULT true,
  lgpd_consent_at       timestamptz,
  lgpd_versao_politica  text,
  deletion_requested_at timestamptz,
  whatsapp_opt_in       boolean DEFAULT false,
  whatsapp_numero       text,
  push_token            text,
  ultimo_acesso_at      timestamptz,
  govbr_id              text UNIQUE,
  avatar_url            text,
  created_at            timestamptz DEFAULT now()
);

CREATE TABLE user_accounts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  provider    text DEFAULT 'email',
  provider_id text,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE profiles (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL UNIQUE REFERENCES app_users(id) ON DELETE CASCADE,
  pontuacao_total     int DEFAULT 0,
  pontuacao_mes       int DEFAULT 0,
  total_os_concluidas int DEFAULT 0,
  total_os_devolvidas int DEFAULT 0,
  badge_nivel         text DEFAULT 'iniciante',
  secretaria          text,
  zona_atuacao        text,
  foto_url            text,
  bio                 text,
  updated_at          timestamptz DEFAULT now()
);

-- 3. LGPD
CREATE TABLE lgpd_consentimentos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES app_users(id),
  versao_politica text NOT NULL,
  ip_address      text,
  user_agent      text,
  consentiu       boolean NOT NULL DEFAULT true,
  revogado_em     timestamptz,
  created_at      timestamptz DEFAULT now()
);

-- 4. TIPOS DE INFRAÇÃO
CREATE TABLE tipos_infracao (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid REFERENCES tenants(id),
  codigo          text NOT NULL,
  nome            text NOT NULL,
  descricao       text,
  secretaria      text,
  multa_min       numeric(10,2),
  multa_max       numeric(10,2),
  prazo_resolucao int,
  icone           text,
  ativo           boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

-- 5. DENÚNCIAS
CREATE TABLE denuncias (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid REFERENCES tenants(id),
  protocolo            text UNIQUE NOT NULL,
  cidadao_id           uuid REFERENCES app_users(id),
  fiscal_id            uuid REFERENCES app_users(id),
  tipo_infracao_id     uuid REFERENCES tipos_infracao(id),
  descricao            text NOT NULL,
  anonima              boolean DEFAULT false,
  canal_origem         text DEFAULT 'app',
  endereco             text,
  bairro               text,
  latitude             float8,
  longitude            float8,
  status               text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','designada','em_vistoria','aguardando_aprovacao','concluida','devolvida','arquivada')),
  prioridade           text DEFAULT 'normal' CHECK (prioridade IN ('baixa','normal','alta','urgente')),
  ia_tipo_sugerido     text,
  ia_urgencia_sugerida text,
  ia_justificativa     text,
  upvotes_count        int DEFAULT 0,
  pontos_previsto      float4,
  pontos_bonus         float4,
  designada_em         timestamptz,
  vistoria_inicio_em   timestamptz,
  resolvida_em         timestamptz,
  prazo_limite         timestamptz,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION fn_set_resolvida_em() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'concluida' AND OLD.status != 'concluida' THEN
    NEW.resolvida_em := now();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_resolvida_em
BEFORE UPDATE ON denuncias
FOR EACH ROW EXECUTE FUNCTION fn_set_resolvida_em();

-- 6. UPVOTES
CREATE TABLE upvotes_denuncias (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  denuncia_id uuid NOT NULL REFERENCES denuncias(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES app_users(id),
  created_at  timestamptz DEFAULT now(),
  UNIQUE (denuncia_id, user_id)
);

CREATE OR REPLACE FUNCTION fn_update_upvotes_count() RETURNS trigger AS $$
BEGIN
  UPDATE denuncias
  SET upvotes_count = (SELECT COUNT(*) FROM upvotes_denuncias WHERE denuncia_id = COALESCE(NEW.denuncia_id, OLD.denuncia_id))
  WHERE id = COALESCE(NEW.denuncia_id, OLD.denuncia_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_upvotes_count
AFTER INSERT OR DELETE ON upvotes_denuncias
FOR EACH ROW EXECUTE FUNCTION fn_update_upvotes_count();

-- 7. FOTOS
CREATE TABLE fotos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  denuncia_id  uuid REFERENCES denuncias(id) ON DELETE CASCADE,
  relatorio_id uuid,
  uploaded_by  uuid REFERENCES app_users(id),
  url          text NOT NULL,
  storage_path text,
  tamanho_kb   int,
  tipo_mime    text,
  file_hash    text,
  capture_lat  float8,
  capture_lng  float8,
  captured_at  timestamptz,
  created_at   timestamptz DEFAULT now()
);

-- 8. RELATÓRIOS
CREATE TABLE relatorios (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  denuncia_id              uuid NOT NULL REFERENCES denuncias(id) ON DELETE CASCADE,
  fiscal_id                uuid NOT NULL REFERENCES app_users(id),
  tenant_id                uuid REFERENCES tenants(id),
  check_in_lat             float8,
  check_in_lng             float8,
  check_in_at              timestamptz,
  descricao_tecnica        text,
  irregularidade_confirmada boolean,
  assinatura_url           text,
  assinatura_hash          text,
  status                   text DEFAULT 'rascunho' CHECK (status IN ('rascunho','enviado','aprovado','devolvido')),
  aprovado_por             uuid REFERENCES app_users(id),
  aprovado_em              timestamptz,
  motivo_devolucao         text,
  pontos_creditados        float4,
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now()
);

ALTER TABLE fotos
  ADD CONSTRAINT fk_foto_relatorio
  FOREIGN KEY (relatorio_id) REFERENCES relatorios(id) ON DELETE SET NULL;

-- 9. AUTOS
CREATE TABLE autos_infracao (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relatorio_id   uuid NOT NULL REFERENCES relatorios(id),
  denuncia_id    uuid NOT NULL REFERENCES denuncias(id),
  fiscal_id      uuid NOT NULL REFERENCES app_users(id),
  numero_auto    text UNIQUE NOT NULL,
  valor_multa    numeric(10,2) NOT NULL,
  infrator_nome  text,
  infrator_doc   text,
  descricao      text,
  recurso_prazo  date,
  recurso_status text DEFAULT 'sem_recurso' CHECK (recurso_status IN ('sem_recurso','em_recurso','deferido','indeferido')),
  pago_em        timestamptz,
  valor_pago     numeric(10,2),
  created_at     timestamptz DEFAULT now()
);

-- 10. MENSAGENS
CREATE TABLE mensagens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  denuncia_id     uuid REFERENCES denuncias(id) ON DELETE CASCADE,
  remetente_id    uuid NOT NULL REFERENCES app_users(id),
  destinatario_id uuid REFERENCES app_users(id),
  conteudo        text NOT NULL,
  tipo            text DEFAULT 'texto' CHECK (tipo IN ('texto','sistema','alerta')),
  lida            boolean DEFAULT false,
  lida_em         timestamptz,
  created_at      timestamptz DEFAULT now()
);

-- 11. HISTÓRICO
CREATE TABLE historico_atividades (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  denuncia_id uuid REFERENCES denuncias(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES app_users(id),
  acao        text NOT NULL,
  descricao   text,
  status_de   text,
  status_para text,
  metadados   jsonb,
  created_at  timestamptz DEFAULT now()
);

-- 12. AVALIAÇÕES
CREATE TABLE avaliacoes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  denuncia_id uuid NOT NULL REFERENCES denuncias(id) ON DELETE CASCADE,
  cidadao_id  uuid NOT NULL REFERENCES app_users(id),
  nota        smallint NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario  text,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (denuncia_id, cidadao_id)
);

-- 13. EVIDÊNCIAS HASH
CREATE TABLE evidencias_hash (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  foto_id      uuid NOT NULL REFERENCES fotos(id) ON DELETE CASCADE,
  denuncia_id  uuid REFERENCES denuncias(id),
  relatorio_id uuid REFERENCES relatorios(id),
  file_hash    text NOT NULL,
  algoritmo    text DEFAULT 'SHA-256',
  capture_lat  float8,
  capture_lng  float8,
  captured_at  timestamptz,
  uploaded_by  uuid REFERENCES app_users(id),
  created_at   timestamptz DEFAULT now()
);

-- 14. MÉTRICAS
CREATE TABLE metricas_diarias (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid REFERENCES tenants(id),
  data_ref             date NOT NULL,
  total_denuncias      int DEFAULT 0,
  denuncias_abertas    int DEFAULT 0,
  denuncias_concluidas int DEFAULT 0,
  tempo_medio_horas    float4,
  nota_media           float4,
  total_multas         int DEFAULT 0,
  valor_multas         numeric(12,2) DEFAULT 0,
  top_categoria        text,
  created_at           timestamptz DEFAULT now(),
  UNIQUE (tenant_id, data_ref)
);

-- 15. AUDIT LOG
CREATE TABLE audit_log (
  id           bigserial PRIMARY KEY,
  tabela       text NOT NULL,
  registro_id  uuid,
  acao         text NOT NULL,
  valor_antes  jsonb,
  valor_depois jsonb,
  user_id      uuid,
  ip_address   text,
  created_at   timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION fn_audit() RETURNS trigger AS $$
BEGIN
  INSERT INTO audit_log(tabela, registro_id, acao, valor_antes, valor_depois)
  VALUES(TG_TABLE_NAME, COALESCE(NEW.id, OLD.id), TG_OP, to_jsonb(OLD), to_jsonb(NEW));
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_denuncias
AFTER INSERT OR UPDATE OR DELETE ON denuncias
FOR EACH ROW EXECUTE FUNCTION fn_audit();

CREATE TRIGGER audit_relatorios
AFTER INSERT OR UPDATE OR DELETE ON relatorios
FOR EACH ROW EXECUTE FUNCTION fn_audit();

-- 16. ÍNDICES
CREATE INDEX idx_denuncias_status      ON denuncias(status, created_at DESC);
CREATE INDEX idx_denuncias_fiscal      ON denuncias(fiscal_id, status);
CREATE INDEX idx_denuncias_cidadao     ON denuncias(cidadao_id, created_at DESC);
CREATE INDEX idx_denuncias_tipo        ON denuncias(tipo_infracao_id, created_at DESC);
CREATE INDEX idx_denuncias_bairro      ON denuncias(bairro, status);
CREATE INDEX idx_denuncias_geo         ON denuncias(latitude, longitude) WHERE latitude IS NOT NULL;
CREATE INDEX idx_mensagens_denuncia    ON mensagens(denuncia_id, created_at DESC);
CREATE INDEX idx_historico_denuncia    ON historico_atividades(denuncia_id, created_at DESC);
CREATE INDEX idx_fotos_denuncia        ON fotos(denuncia_id);
CREATE INDEX idx_avaliacoes_nota       ON avaliacoes(nota, created_at);
CREATE INDEX idx_audit_registro        ON audit_log(tabela, registro_id);
CREATE INDEX idx_upvotes_denuncia      ON upvotes_denuncias(denuncia_id);
CREATE INDEX idx_profiles_pontuacao    ON profiles(pontuacao_mes DESC);

SELECT 'Schema SIFAU v2 criado com sucesso!' AS status;
