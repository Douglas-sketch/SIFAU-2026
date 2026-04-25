-- Metadados de integridade para evidências fotográficas
-- Seguro para rodar múltiplas vezes

alter table if exists fotos add column if not exists file_name text;
alter table if exists fotos add column if not exists file_hash text;
alter table if exists fotos add column if not exists captured_at timestamptz;
alter table if exists fotos add column if not exists capture_lat double precision;
alter table if exists fotos add column if not exists capture_lng double precision;
alter table if exists fotos add column if not exists uploaded_by text;
alter table if exists fotos add column if not exists storage_path text;

-- FK opcional para uploaded_by -> profiles(id)
do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_name = 'fotos_uploaded_by_fkey'
      and table_name = 'fotos'
  ) then
    alter table fotos
      add constraint fotos_uploaded_by_fkey
      foreign key (uploaded_by) references profiles(id) on delete set null;
  end if;
end $$;
