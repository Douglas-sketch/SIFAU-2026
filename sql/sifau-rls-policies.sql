-- ============================================
-- SIFAU — RLS E POLICIES
-- ============================================

ALTER TABLE tenants              ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_accounts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE lgpd_consentimentos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipos_infracao       ENABLE ROW LEVEL SECURITY;
ALTER TABLE denuncias            ENABLE ROW LEVEL SECURITY;
ALTER TABLE upvotes_denuncias    ENABLE ROW LEVEL SECURITY;
ALTER TABLE fotos                ENABLE ROW LEVEL SECURITY;
ALTER TABLE relatorios           ENABLE ROW LEVEL SECURITY;
ALTER TABLE autos_infracao       ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens            ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE avaliacoes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidencias_hash      ENABLE ROW LEVEL SECURITY;
ALTER TABLE metricas_diarias     ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log            ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select ON app_users FOR SELECT USING (true);
CREATE POLICY users_insert ON app_users FOR INSERT WITH CHECK (true);
CREATE POLICY users_update ON app_users FOR UPDATE USING (auth.uid()::text = auth_id::text);

CREATE POLICY denuncias_select ON denuncias FOR SELECT USING (true);
CREATE POLICY denuncias_insert ON denuncias FOR INSERT WITH CHECK (true);
CREATE POLICY denuncias_update ON denuncias FOR UPDATE USING (true);

CREATE POLICY open_profiles      ON profiles             FOR ALL USING (true);
CREATE POLICY open_tipos         ON tipos_infracao       FOR ALL USING (true);
CREATE POLICY open_fotos         ON fotos                FOR ALL USING (true);
CREATE POLICY open_relatorios    ON relatorios           FOR ALL USING (true);
CREATE POLICY open_autos         ON autos_infracao       FOR ALL USING (true);
CREATE POLICY open_mensagens     ON mensagens            FOR ALL USING (true);
CREATE POLICY open_historico     ON historico_atividades FOR ALL USING (true);
CREATE POLICY open_avaliacoes    ON avaliacoes           FOR ALL USING (true);
CREATE POLICY open_upvotes       ON upvotes_denuncias    FOR ALL USING (true);
CREATE POLICY open_evidencias    ON evidencias_hash      FOR ALL USING (true);
CREATE POLICY open_metricas      ON metricas_diarias     FOR ALL USING (true);
CREATE POLICY open_lgpd          ON lgpd_consentimentos  FOR ALL USING (true);
CREATE POLICY open_tenants       ON tenants              FOR ALL USING (true);
CREATE POLICY open_user_accounts ON user_accounts        FOR ALL USING (true);
CREATE POLICY open_audit         ON audit_log            FOR ALL USING (true);

SELECT 'RLS configurado com sucesso!' AS status;
