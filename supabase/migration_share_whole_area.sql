-- Cerne: compartilhar uma pasta (área) dá acesso a TUDO dentro dela:
-- projetos, tarefas, notas, arquivos e calendários de conteúdo.
-- Só ficam de fora pastas/projetos arquivados ou na lixeira.
-- Rode DEPOIS de migration_client_portal.sql. Seguro para rodar mais de uma vez.
begin;

create or replace function cerne_private.item_visible(owner_id uuid, area uuid, project uuid, shared boolean) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.areas a where a.id = area and a.user_id = owner_id
      and a.archived_at is null and a.deleted_at is null
  ) and (project is null or exists (
    select 1 from public.projects p where p.id = project and p.user_id = owner_id and p.area_id = area
      and p.archived_at is null and p.deleted_at is null and p.status <> 'archived'
  ))
$$;

commit;
