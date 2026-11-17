-- Cerne: o cliente vê o calendário de conteúdo do projeto compartilhado e responde
-- (aprovar, pedir alteração, reprovar, comentar).
-- Rode DEPOIS de migration_content_calendar.sql e migration_client_portal.sql.
-- ADITIVA e segura para rodar mais de uma vez. Não apaga nada.
begin;

alter table public.content_items
  add column if not exists shared boolean not null default false,
  add column if not exists content_version integer not null default 1;

create table if not exists cerne_private.content_review (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content_items(id) on delete cascade,
  author_id uuid not null,
  kind text not null check (kind in ('comment','approved','rejected','changes')),
  body text not null default '',
  version integer not null,
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists content_review_item on cerne_private.content_review(content_id, created_at, id);
alter table cerne_private.content_review enable row level security;

-- A versão sobe quando o conteúdo muda; ninguém consegue forjá-la por escrita comum.
create or replace function public.cerne_content_version() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.title, new.format, new.objective, new.script, new.caption, new.publish_date)
     is distinct from (old.title, old.format, old.objective, old.script, old.caption, old.publish_date) then
    new.content_version := old.content_version + 1;
  elsif pg_trigger_depth() = 1 then
    new.content_version := old.content_version;
  end if;
  if new.project_id is distinct from old.project_id then new.shared := false; end if;
  return new;
end $$;
drop trigger if exists cerne_30_content_version on public.content_items;
create trigger cerne_30_content_version before update on public.content_items
  for each row execute function public.cerne_content_version();
revoke execute on function public.cerne_content_version() from public, anon, authenticated;

-- Ações sobre um conteúdo: list, comment, approved, rejected, changes.
create or replace function cerne_private.content_action(item uuid, action text, message text, expected_version integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.content_items%rowtype;
declare p public.projects%rowtype;
declare role text;
begin
  if auth.uid() is null then raise exception 'Entre para continuar.'; end if;
  if action = 'list' then
    select * into c from public.content_items where id = item;
  else
    select * into c from public.content_items where id = item for update;
  end if;
  if not found then raise exception 'Conteúdo indisponível.'; end if;
  select * into p from public.projects where id = c.project_id;
  role := case when c.user_id = auth.uid() then 'owner'
    when cerne_private.item_visible(c.user_id, p.area_id, c.project_id, c.shared)
    then cerne_private.area_permission(p.area_id) end;
  if role is null then raise exception 'Conteúdo indisponível.'; end if;

  if action = 'comment' then
    if role not in ('owner','review','edit') then raise exception 'Sem acesso para comentar.'; end if;
    if nullif(btrim(message), '') is null then raise exception 'Escreva um comentário.'; end if;
  elsif action in ('approved','rejected','changes') then
    if role not in ('review','edit') then raise exception 'Sem acesso para responder.'; end if;
    if expected_version is distinct from c.content_version then raise exception 'O conteúdo mudou. Abra a versão atual.'; end if;
    if action = 'changes' and nullif(btrim(message), '') is null then raise exception 'Descreva a alteração que você quer.'; end if;
  elsif action <> 'list' then
    raise exception 'Ação inválida.';
  end if;

  if action <> 'list' then
    insert into cerne_private.content_review(content_id, author_id, kind, body, version)
    values (item, auth.uid(), action, coalesce(btrim(message), ''), c.content_version);
  end if;

  return coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'kind', e.kind, 'body', e.body,
    'version', e.version, 'created_at', e.created_at,
    'author', case when e.author_id = c.user_id then 'Responsável pelo projeto'
      when e.author_id = auth.uid() then 'Você' when role = 'owner' then coalesce(u.email, 'Cliente') else 'Cliente' end)
    order by e.created_at desc, e.id desc)
    from cerne_private.content_review e left join auth.users u on u.id = e.author_id
    where e.content_id = item), '[]'::jsonb);
end $$;

-- Para o dono: última resposta do cliente em cada conteúdo.
create or replace function cerne_private.content_summary(project uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id,
    'review', (select jsonb_build_object('kind', e.kind, 'version', e.version, 'created_at', e.created_at)
      from cerne_private.content_review e where e.content_id = c.id and e.kind <> 'comment'
      order by e.created_at desc, e.id desc limit 1),
    'last_by_client', (select e.author_id <> c.user_id from cerne_private.content_review e
      where e.content_id = c.id order by e.created_at desc, e.id desc limit 1))), '[]'::jsonb)
  from public.content_items c
  where c.user_id = auth.uid() and (content_summary.project is null or c.project_id = content_summary.project)
$$;

-- Portal: mesma função de antes, agora também devolvendo os conteúdos compartilhados.
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
      from public.notes n where n.area_id = a.id and cerne_private.item_visible(n.user_id, n.area_id, n.project_id, n.shared)), '[]'::jsonb),
    'contents', coalesce((select jsonb_agg(jsonb_build_object('id', ci.id, 'title', ci.title, 'format', ci.format,
      'publish_date', ci.publish_date, 'objective', ci.objective, 'script', ci.script, 'caption', ci.caption,
      'project_id', ci.project_id, 'content_version', ci.content_version,
      'review', (select jsonb_build_object('kind', e.kind, 'version', e.version)
        from cerne_private.content_review e where e.content_id = ci.id and e.kind <> 'comment'
        order by e.created_at desc, e.id desc limit 1)) order by ci.publish_date, ci.created_at, ci.id)
      from public.content_items ci join public.projects cp on cp.id = ci.project_id
      where cp.area_id = a.id and cerne_private.item_visible(ci.user_id, a.id, ci.project_id, ci.shared)), '[]'::jsonb)
  ) from public.areas a where a.id = area);
end $$;

create or replace function public.cerne_content(item uuid, action text, message text default null, expected_version integer default null) returns jsonb
language sql set search_path = '' as $$ select cerne_private.content_action(item, action, message, expected_version) $$;
create or replace function public.cerne_content_summary(project uuid default null) returns jsonb
language sql stable set search_path = '' as $$ select cerne_private.content_summary(project) $$;

revoke execute on function cerne_private.content_action(uuid,text,text,integer), cerne_private.content_summary(uuid),
  public.cerne_content(uuid,text,text,integer), public.cerne_content_summary(uuid) from public, anon, authenticated;
grant execute on function cerne_private.content_action(uuid,text,text,integer), cerne_private.content_summary(uuid),
  public.cerne_content(uuid,text,text,integer), public.cerne_content_summary(uuid) to authenticated;

commit;
