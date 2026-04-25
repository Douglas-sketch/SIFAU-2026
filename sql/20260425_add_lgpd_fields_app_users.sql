-- LGPD: consentimento e solicitação de exclusão de conta
alter table if exists app_users
  add column if not exists lgpd_consent_at timestamptz,
  add column if not exists deletion_requested_at timestamptz;

