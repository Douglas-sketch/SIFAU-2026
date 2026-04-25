-- Adiciona campos de classificação por IA na tabela denuncias
-- Seguro para rodar múltiplas vezes

alter table if exists denuncias
  add column if not exists ia_tipo_sugerido text;

alter table if exists denuncias
  add column if not exists ia_urgencia_sugerida text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'denuncias_ia_urgencia_sugerida_check'
  ) then
    alter table denuncias
      add constraint denuncias_ia_urgencia_sugerida_check
      check (ia_urgencia_sugerida in ('baixa','media','alta'));
  end if;
end $$;
