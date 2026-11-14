-- Apply after migration_workspaces.sql. All existing content starts internal.
begin;

alter table public.projects add column if not exists shared boolean not null default false;
alter table public.tasks add column if not exists shared boolean not null default false,
  add column if not exists content_version integer not null default 1;
alter table public.notes add column if not exists shared boolean not null default false;

create schema if not exists cerne_private;
revoke all on schema cerne_private from public, anon, authenticated;
grant usage on schema cerne_private to authenticated;

create table if not exists cerne_private.access (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.areas(id) on delete cascade,
  email text not null,
  permission text not null check (permission in ('view','review','edit')),
  token uuid not null unique default gen_random_uuid(),
  member_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (area_id, email)
);
create index if not exists access_member on cerne_private.access(member_id, area_id);

create table if not exists cerne_private.activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid not null,
  kind text not null check (kind in ('comment','requested','approved','changes')),
  body text not null default '',
  internal boolean not null default false,
  version integer not null,
  snapshot jsonb,
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists activity_task on cerne_private.activity(task_id, created_at, id);

create table if not exists cerne_private.files (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade,
  note_id uuid references public.notes(id) on delete cascade,
  owner_id uuid not null,
  name text not null check (length(name) between 1 and 255),
  mime text not null,
  ready boolean not null default false,
  created_at timestamptz not null default now(),
  check (num_nonnulls(task_id, note_id) = 1)
);
create index if not exists files_task on cerne_private.files(task_id);
create index if not exists files_note on cerne_private.files(note_id);
alter table cerne_private.access enable row level security;
alter table cerne_private.activity enable row level security;
alter table cerne_private.files enable row level security;

create or replace function cerne_private.area_permission(area uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case when a.user_id = auth.uid() then 'owner'
    else (select x.permission from cerne_private.access x where x.area_id = a.id and x.member_id = auth.uid()) end
  from public.areas a where a.id = area and a.deleted_at is null and a.archived_at is null
$$;

create or replace function cerne_private.item_visible(owner_id uuid, area uuid, project uuid, shared boolean) returns boolean
language sql stable security definer set search_path = '' as $$
  select shared and exists (
    select 1 from public.areas a where a.id = area and a.user_id = owner_id
      and a.archived_at is null and a.deleted_at is null
  ) and (project is null or exists (
    select 1 from public.projects p where p.id = project and p.user_id = owner_id and p.area_id = area
      and p.shared and p.archived_at is null and p.deleted_at is null and p.status <> 'archived'
  ))
$$;

create or replace function cerne_private.access_action(area uuid, action text, value text, level text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare entry cerne_private.access%rowtype;
begin
  if auth.uid() is null then raise exception 'Entre para continuar.'; end if;
  if action = 'accept' then
    select x.* into entry from cerne_private.access x join public.areas a on a.id = x.area_id
    join auth.users u on u.id = auth.uid()
    where x.token::text = value and lower(u.email) = x.email and u.email_confirmed_at is not null
      and a.deleted_at is null and a.archived_at is null and a.user_id <> u.id for update of x;
    if not found or (entry.member_id is not null and entry.member_id <> auth.uid()) then
      raise exception 'Convite indisponível para esta conta. Confirme o e-mail usado no convite.';
    end if;
    update cerne_private.access set member_id = auth.uid() where id = entry.id;
    return to_jsonb(entry.area_id);
  end if;
  if cerne_private.area_permission(area) is distinct from 'owner' then raise exception 'Área indisponível.'; end if;
  if action = 'invite' then
    if value is null or length(value) > 254 or value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      or level is null or level not in ('view','review','edit') then raise exception 'Informe um e-mail e uma permissão válidos.'; end if;
    insert into cerne_private.access(area_id, email, permission) values (area, lower(value), level)
      on conflict (area_id, email) do update set permission = excluded.permission returning * into entry;
    return to_jsonb(entry);
  elsif action = 'revoke' then
    delete from cerne_private.access where area_id = area and id::text = value;
  elsif action <> 'list' then raise exception 'Ação inválida.';
  end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.email) from cerne_private.access x where x.area_id = area), '[]'::jsonb);
end $$;

create or replace function cerne_private.portal(area uuid, task uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare role text;
begin
  if auth.uid() is null then raise exception 'Entre para continuar.'; end if;
  if area is null then
    return coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name) order by a.name, a.id)
      from public.areas a join cerne_private.access x on x.area_id = a.id and x.member_id = auth.uid()
      where a.archived_at is null and a.deleted_at is null), '[]'::jsonb);
  end if;
  role := cerne_private.area_permission(area);
  if role is null then raise exception 'Área indisponível.'; end if;
  return (select jsonb_build_object('id', a.id, 'name', a.name, 'description', a.description, 'permission', role,
    'projects', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name) order by p.sort_order, p.id)
      from public.projects p where p.area_id = a.id and cerne_private.item_visible(p.user_id, a.id, p.id, p.shared)), '[]'::jsonb),
    'tasks', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'notes', t.notes,
      'status', t.status, 'deadline', t.deadline, 'project_id', t.project_id, 'completed_at', t.completed_at,
      'content_version', t.content_version, 'stage', c.name,
      'latest_activity', (select jsonb_build_object('kind', e.kind, 'created_at', e.created_at)
        from cerne_private.activity e where e.task_id = t.id and not e.internal
        order by e.created_at desc, e.id desc limit 1),
      'review', (select jsonb_build_object('kind', e.kind, 'version', e.version)
        from cerne_private.activity e where e.task_id = t.id and e.kind <> 'comment'
        order by e.created_at desc, e.id desc limit 1)) order by t.deadline nulls last, t.sort_order, t.id)
      from public.tasks t left join public.board_columns c on c.id = t.column_id
      where t.area_id = a.id and (task is null or t.id = task) and t.status <> 'canceled'
        and cerne_private.item_visible(t.user_id, t.area_id, t.project_id, t.shared)), '[]'::jsonb),
    'notes', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'title', n.title, 'body', n.body, 'project_id', n.project_id)
      order by n.updated_at desc, n.id)
      from public.notes n where n.area_id = a.id and cerne_private.item_visible(n.user_id, n.area_id, n.project_id, n.shared)), '[]'::jsonb)
  ) from public.areas a where a.id = area);
end $$;

create or replace function public.cerne_task_version() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.title is distinct from old.title or new.notes is distinct from old.notes then
    new.content_version := old.content_version + 1;
  elsif pg_trigger_depth() = 1 then
    new.content_version := old.content_version;
  end if;
  if (new.area_id, new.project_id) is distinct from (old.area_id, old.project_id) then
    new.shared := false;
  end if;
  return new;
end $$;
drop trigger if exists cerne_30_version on public.tasks;
create trigger cerne_30_version before update on public.tasks for each row execute function public.cerne_task_version();
revoke execute on function public.cerne_task_version() from public, anon, authenticated;

create or replace function public.cerne_note_visibility() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.area_id, new.project_id) is distinct from (old.area_id, old.project_id) then new.shared := false; end if;
  return new;
end $$;
drop trigger if exists cerne_30_visibility on public.notes;
create trigger cerne_30_visibility before update on public.notes for each row execute function public.cerne_note_visibility();
revoke execute on function public.cerne_note_visibility() from public, anon, authenticated;

create or replace function cerne_private.task_action(item uuid, action text, message text, internal_only boolean,
  expected_version integer, new_title text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t public.tasks%rowtype;
declare role text;
declare last_event cerne_private.activity%rowtype;
begin
  if auth.uid() is null then raise exception 'Entre para continuar.'; end if;
  if action = 'list' then
    select * into t from public.tasks where id = item;
  else
    select * into t from public.tasks where id = item for update;
  end if;
  if not found then raise exception 'Tarefa indisponível.'; end if;
  role := case when t.user_id = auth.uid() then 'owner'
    when t.status <> 'canceled' and cerne_private.item_visible(t.user_id, t.area_id, t.project_id, t.shared)
    then cerne_private.area_permission(t.area_id) end;
  if role is null then raise exception 'Tarefa indisponível.'; end if;

  if action = 'edit' then
    if role <> 'edit' or expected_version is distinct from t.content_version then
      raise exception 'A tarefa mudou ou você perdeu o acesso de edição. Abra a versão atual.';
    end if;
    if nullif(btrim(new_title), '') is null then raise exception 'Informe o título.'; end if;
    update public.tasks set title = btrim(new_title), notes = coalesce(message, '') where id = item;
    return 'null'::jsonb;
  elsif action = 'comment' then
    if role not in ('owner','review','edit') or (coalesce(internal_only, false) and role <> 'owner') then raise exception 'Sem acesso para comentar.'; end if;
    if nullif(btrim(message), '') is null then raise exception 'Escreva um comentário.'; end if;
  elsif action in ('requested','approved','changes') then
    if expected_version is distinct from t.content_version then raise exception 'O conteúdo mudou. Abra a versão atual.'; end if;
    if action = 'requested' then
      if role <> 'owner' or t.status = 'canceled' or not cerne_private.item_visible(t.user_id, t.area_id, t.project_id, t.shared) then
        raise exception 'Compartilhe a tarefa e o projeto, se houver, antes de solicitar aprovação.';
      end if;
    elsif role not in ('review','edit') then
      raise exception 'Sem acesso para avaliar.';
    end if;
    select * into last_event from cerne_private.activity where task_id = item and kind <> 'comment'
      order by created_at desc, id desc limit 1;
    if action <> 'requested' and (last_event.kind is distinct from 'requested' or last_event.version is distinct from t.content_version) then
      raise exception 'Esta versão não está aguardando aprovação.';
    end if;
    if action = 'requested' and last_event.version = t.content_version and last_event.kind in ('requested','approved') then
      raise exception 'Esta versão já foi enviada para aprovação.';
    end if;
    if action = 'changes' and nullif(btrim(message), '') is null then raise exception 'Descreva os ajustes solicitados.'; end if;
  elsif action <> 'list' then raise exception 'Ação inválida.';
  end if;

  if action <> 'list' then
    insert into cerne_private.activity(task_id, author_id, kind, body, internal, version, snapshot)
    values (item, auth.uid(), action, coalesce(btrim(message), ''), action = 'comment' and (coalesce(internal_only, false) or (role = 'owner' and not cerne_private.item_visible(t.user_id, t.area_id, t.project_id, t.shared))), t.content_version,
      case when action = 'requested' then jsonb_build_object('title', t.title, 'notes', t.notes, 'files',
        coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name) order by f.created_at, f.id)
          from cerne_private.files f where f.task_id = item and f.ready), '[]'::jsonb)) end);
  end if;

  return coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'kind', e.kind, 'body', e.body, 'internal', e.internal,
    'version', e.version, 'created_at', e.created_at, 'author', case when e.author_id = t.user_id then 'Responsável pela área'
      when e.author_id = auth.uid() then 'Você' when role = 'owner' then coalesce(u.email, 'Cliente') else 'Cliente' end,
    'snapshot', e.snapshot) order by e.created_at desc, e.id desc)
    from cerne_private.activity e left join auth.users u on u.id = e.author_id
    where e.task_id = item and (role = 'owner' or not e.internal)), '[]'::jsonb);
end $$;

create or replace function cerne_private.file_action(item uuid, entity text, action text, file_id uuid, file_name text, file_mime text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare owner uuid;
declare area uuid;
declare project uuid;
declare shared boolean;
begin
  if auth.uid() is null then raise exception 'Entre para continuar.'; end if;
  if entity = 'task' then
    select t.user_id, t.area_id, t.project_id, t.shared and t.status <> 'canceled'
      into owner, area, project, shared from public.tasks t where t.id = item;
  elsif entity = 'note' then
    select n.user_id, n.area_id, n.project_id, n.shared into owner, area, project, shared from public.notes n where n.id = item;
  else raise exception 'Tipo de item inválido.';
  end if;
  if owner is null or (owner <> auth.uid() and (action <> 'list' or not cerne_private.item_visible(owner, area, project, shared)
    or cerne_private.area_permission(area) is null)) then raise exception 'Item indisponível.'; end if;

  if action = 'reserve' then
    insert into cerne_private.files(id, task_id, note_id, owner_id, name, mime)
    values (file_id, case when entity = 'task' then item end, case when entity = 'note' then item end, owner, file_name, file_mime)
    on conflict (id) do nothing;
  elsif action = 'finish' then
    -- Order locks the same way as an approval request so its snapshot is consistent.
    if entity = 'task' then perform 1 from public.tasks where id = item for update; end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'cerne-files' and o.name = file_id::text) then
      raise exception 'O envio do arquivo ainda não foi concluído.';
    end if;
    update cerne_private.files set ready = true where id = file_id and owner_id = owner and not ready
      and (task_id = item or note_id = item);
  elsif action <> 'list' then raise exception 'Ação inválida.';
  end if;

  return coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'mime', x.mime)
    order by x.created_at, x.id) from cerne_private.files x
    where (x.task_id = item or x.note_id = item) and x.ready), '[]'::jsonb);
end $$;

-- Bump the version from an attachment trigger, so ordinary row writes cannot forge it.
create or replace function cerne_private.file_version() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.task_id is not null and new.ready and not old.ready then
    update public.tasks set content_version = content_version + 1 where id = new.task_id;
  end if;
  return new;
end $$;
drop trigger if exists cerne_file_version on cerne_private.files;
create trigger cerne_file_version after update of ready on cerne_private.files
for each row execute function cerne_private.file_version();

create or replace function cerne_private.storage_access(path text, writing boolean) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from cerne_private.files f left join public.tasks t on t.id = f.task_id
      left join public.notes n on n.id = f.note_id where f.id::text = path and
      ((f.owner_id = auth.uid() and (not writing or not f.ready)) or (not writing and f.ready
        and cerne_private.area_permission(coalesce(t.area_id, n.area_id)) is not null
        and cerne_private.item_visible(f.owner_id, coalesce(t.area_id, n.area_id), coalesce(t.project_id, n.project_id),
          coalesce(t.shared and t.status <> 'canceled', n.shared, false))))
  )
$$;

insert into storage.buckets(id, name, public, file_size_limit) values ('cerne-files', 'cerne-files', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;
drop policy if exists cerne_file_read on storage.objects;
create policy cerne_file_read on storage.objects for select to authenticated
  using (bucket_id = 'cerne-files' and storage.allow_only_operation('object.get_authenticated')
    and cerne_private.storage_access(name, false));
-- A permissive policy from another bucket must not enable listing or signing here.
drop policy if exists cerne_file_download_only on storage.objects;
create policy cerne_file_download_only on storage.objects as restrictive for select to authenticated
  using (bucket_id <> 'cerne-files' or (storage.allow_only_operation('object.get_authenticated')
    and cerne_private.storage_access(name, false)));
drop policy if exists cerne_file_insert_scope on storage.objects;
create policy cerne_file_insert_scope on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'cerne-files' or cerne_private.storage_access(name, true));
drop policy if exists cerne_file_immutable on storage.objects;
create policy cerne_file_immutable on storage.objects as restrictive for update to authenticated
  using (bucket_id <> 'cerne-files') with check (bucket_id <> 'cerne-files');
drop policy if exists cerne_file_no_delete on storage.objects;
create policy cerne_file_no_delete on storage.objects as restrictive for delete to authenticated
  using (bucket_id <> 'cerne-files');
drop policy if exists cerne_file_write on storage.objects;
create policy cerne_file_write on storage.objects for insert to authenticated
  with check (bucket_id = 'cerne-files' and cerne_private.storage_access(name, true));

-- Public RPCs are invoker wrappers. Privileged implementations live in the unexposed schema.
create or replace function public.cerne_access(area uuid, action text, value text default null, level text default null) returns jsonb
language sql set search_path = '' as $$ select cerne_private.access_action(area, action, value, level) $$;
create or replace function public.cerne_portal(area uuid default null, task uuid default null) returns jsonb
language sql stable set search_path = '' as $$ select cerne_private.portal(area, task) $$;
create or replace function public.cerne_activity(item uuid, action text, message text default null, internal_only boolean default false,
  expected_version integer default null, new_title text default null) returns jsonb
language sql set search_path = '' as $$ select cerne_private.task_action(item, action, message, internal_only, expected_version, new_title) $$;
create or replace function public.cerne_files(item uuid, entity text, action text, file_id uuid default null, file_name text default null,
  file_mime text default null) returns jsonb
language sql set search_path = '' as $$ select cerne_private.file_action(item, entity, action, file_id, file_name, file_mime) $$;

revoke execute on all functions in schema cerne_private from public, anon, authenticated;
revoke execute on function public.cerne_access(uuid,text,text,text), public.cerne_portal(uuid,uuid),
  public.cerne_activity(uuid,text,text,boolean,integer,text), public.cerne_files(uuid,text,text,uuid,text,text) from public, anon;
grant execute on function cerne_private.access_action(uuid,text,text,text), cerne_private.portal(uuid,uuid),
  cerne_private.task_action(uuid,text,text,boolean,integer,text), cerne_private.file_action(uuid,text,text,uuid,text,text),
  cerne_private.storage_access(text,boolean),
  public.cerne_access(uuid,text,text,text), public.cerne_portal(uuid,uuid),
  public.cerne_activity(uuid,text,text,boolean,integer,text), public.cerne_files(uuid,text,text,uuid,text,text) to authenticated;

commit;
