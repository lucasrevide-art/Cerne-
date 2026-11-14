-- Apply after migration_board_columns.sql. Existing records keep their IDs.
begin;

alter table public.areas add column if not exists description text not null default '',
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz;
alter table public.projects add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz;
alter table public.tasks add column if not exists inbox boolean;
update public.tasks set inbox = area_id is null and project_id is null and when_kind is null
  and deadline is null and not is_focus and status in ('open', 'waiting') where inbox is null;
alter table public.tasks alter column inbox set default true, alter column inbox set not null;
alter table public.notes add column if not exists project_id uuid references public.projects(id) on delete restrict,
  add column if not exists title text not null default '';

alter table public.board_columns add column if not exists area_id uuid references public.areas(id) on delete restrict,
  add column if not exists legacy_id uuid;
drop index if exists public.board_columns_one_done_per_user;
create unique index if not exists board_columns_one_done_personal on public.board_columns(user_id) where is_done and area_id is null;
create unique index if not exists board_columns_one_done_area on public.board_columns(area_id) where is_done;
create unique index if not exists board_columns_area_legacy on public.board_columns(area_id, legacy_id);
create index if not exists board_columns_scope on public.board_columns(user_id, area_id, sort_order);
create index if not exists tasks_column on public.tasks(column_id);
create index if not exists tasks_area on public.tasks(area_id);
create index if not exists tasks_project on public.tasks(project_id);
create index if not exists projects_area on public.projects(area_id);
create index if not exists notes_project on public.notes(project_id);

create or replace function public.cerne_seed_area_columns() returns trigger
language plpgsql set search_path = '' as $$
begin
  insert into public.board_columns(user_id, area_id, name, is_done, sort_order)
    values (new.user_id, new.id, 'A fazer', false, 1), (new.user_id, new.id, 'Em produção', false, 2),
      (new.user_id, new.id, 'Aguardando aprovação', false, 3), (new.user_id, new.id, 'Concluído', true, 4);
  return new;
end $$;
revoke execute on function public.cerne_seed_area_columns() from public, anon, authenticated;

insert into public.board_columns(user_id, area_id, legacy_id, name, is_done, sort_order)
select a.user_id, a.id, c.id, c.name, c.is_done, c.sort_order
from public.areas a join public.board_columns c on c.user_id = a.user_id and c.area_id is null
where not exists (select 1 from public.board_columns existing where existing.area_id = a.id)
on conflict do nothing;

insert into public.board_columns(user_id, area_id, name, is_done, sort_order)
select a.user_id, a.id, v.name, v.is_done, v.ord from public.areas a
cross join (values ('A fazer', false, 1), ('Em produção', false, 2), ('Aguardando aprovação', false, 3), ('Concluído', true, 4)) v(name, is_done, ord)
where not exists (select 1 from public.board_columns c where c.area_id = a.id);

update public.tasks t set area_id = p.area_id
from public.projects p where t.project_id = p.id and t.user_id = p.user_id and t.area_id is distinct from p.area_id;
update public.tasks t set column_id = c.id from public.board_columns c
where c.area_id = t.area_id and c.legacy_id = t.column_id;
update public.tasks t set column_id = (
  select c.id from public.board_columns c where c.user_id = t.user_id and c.area_id is not distinct from t.area_id
    and c.is_done = (t.status = 'completed')
  order by (c.id = t.column_id) desc nulls last, c.sort_order, c.id limit 1
)
where t.status <> 'canceled' and not exists (
  select 1 from public.board_columns c where c.id = t.column_id and c.user_id = t.user_id
    and c.area_id is not distinct from t.area_id and c.is_done = (t.status = 'completed')
);

drop trigger if exists cerne_seed_columns on public.areas;
create trigger cerne_seed_columns after insert on public.areas
for each row execute function public.cerne_seed_area_columns();

create or replace function public.cerne_check_location() returns trigger
language plpgsql set search_path = '' as $$
declare project_area uuid;
begin
  if new.project_id is not null then
    select area_id into project_area from public.projects where id = new.project_id and user_id = new.user_id;
    if not found then raise exception 'Projeto indisponível.'; end if;
    new.area_id := project_area;
  end if;
  if new.area_id is not null and not exists (select 1 from public.areas where id = new.area_id and user_id = new.user_id) then
    raise exception 'Área indisponível.';
  end if;
  return new;
end $$;
revoke execute on function public.cerne_check_location() from public, anon, authenticated;
drop trigger if exists cerne_10_location on public.tasks;
create trigger cerne_10_location before insert or update of area_id, project_id on public.tasks
for each row execute function public.cerne_check_location();
drop trigger if exists cerne_10_location on public.notes;
create trigger cerne_10_location before insert or update of area_id, project_id on public.notes
for each row execute function public.cerne_check_location();

create or replace function public.cerne_sync_task_column() returns trigger
language plpgsql set search_path = '' as $$
declare selected public.board_columns%rowtype;
begin
  if new.area_id is not null or new.project_id is not null then new.inbox := false; end if;

  -- Lock the selected column until this write finishes, including during removal.
  select * into selected from public.board_columns
  where id = new.column_id and user_id = new.user_id and area_id is not distinct from new.area_id for key share;

  if new.status <> 'canceled' then
    if found and (tg_op = 'INSERT' or new.column_id is distinct from old.column_id) then
      if selected.is_done then new.status := 'completed';
      elsif new.status = 'completed' and tg_op = 'UPDATE' and old.status = 'completed' then new.status := 'open';
      end if;
    end if;
    if selected.id is null or selected.is_done <> (new.status = 'completed') then
      select * into selected from public.board_columns where user_id = new.user_id
        and area_id is not distinct from new.area_id and is_done = (new.status = 'completed')
      order by sort_order, id limit 1 for key share;
    end if;
    new.column_id := selected.id;
  elsif selected.id is null then
    new.column_id := null;
  end if;

  if new.status = 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
    new.is_focus := false;
  else
    new.completed_at := null;
  end if;
  return new;
end $$;
revoke execute on function public.cerne_sync_task_column() from public, anon, authenticated;
drop trigger if exists cerne_20_workflow on public.tasks;
create trigger cerne_20_workflow before insert or update of status, column_id, area_id, project_id, inbox, completed_at, is_focus on public.tasks
for each row execute function public.cerne_sync_task_column();

alter table public.tasks drop constraint if exists tasks_column_id_fkey;
alter table public.tasks add constraint tasks_column_id_fkey foreign key (column_id)
  references public.board_columns(id) on delete restrict;

create or replace function public.cerne_remove_column(source_id uuid, destination_id uuid) returns void
language plpgsql set search_path = '' as $$
declare source public.board_columns%rowtype;
declare destination public.board_columns%rowtype;
begin
  select * into source from public.board_columns where id = source_id and user_id = auth.uid();
  if not found or source.is_done then raise exception 'Coluna indisponível para exclusão.'; end if;
  -- Lock the entire workflow in a consistent order for concurrent removals.
  perform 1 from public.board_columns where user_id = auth.uid() and area_id is not distinct from source.area_id
    order by id for update;
  if not exists (select 1 from public.board_columns where id = source_id) then raise exception 'Coluna já removida.'; end if;
  select * into destination from public.board_columns where id = destination_id and id <> source_id
    and user_id = auth.uid() and area_id is not distinct from source.area_id and not is_done;
  if not found then raise exception 'Escolha outra coluna aberta deste quadro.'; end if;
  update public.tasks set column_id = destination.id where column_id = source_id and user_id = auth.uid();
  delete from public.board_columns where id = source_id;
end $$;
revoke execute on function public.cerne_remove_column(uuid, uuid) from public, anon;
grant execute on function public.cerne_remove_column(uuid, uuid) to authenticated;

create or replace function public.cerne_order_columns(column_ids uuid[]) returns void
language plpgsql set search_path = '' as $$
declare scope_id uuid;
declare total integer;
begin
  select area_id into scope_id from public.board_columns where id = column_ids[1] and user_id = auth.uid();
  if not found then raise exception 'Quadro indisponível.'; end if;
  perform 1 from public.board_columns where user_id = auth.uid() and area_id is not distinct from scope_id order by id for update;
  select count(*) into total from public.board_columns where user_id = auth.uid() and area_id is not distinct from scope_id;
  if cardinality(column_ids) <> total or total <> (
    select count(*) from public.board_columns where user_id = auth.uid() and area_id is not distinct from scope_id and id = any(column_ids)
  ) then raise exception 'O quadro mudou. Recarregue e tente novamente.'; end if;
  update public.board_columns c set sort_order = v.ord
    from unnest(column_ids) with ordinality v(id, ord) where c.id = v.id and c.user_id = auth.uid();
end $$;
revoke execute on function public.cerne_order_columns(uuid[]) from public, anon;
grant execute on function public.cerne_order_columns(uuid[]) to authenticated;

-- Grouping is recoverable. Prevent raw API deletes from cascading into notes.
drop policy if exists "own rows" on public.areas;
drop policy if exists "own rows" on public.projects;
do $$
declare entity text;
begin
  foreach entity in array array['areas','projects'] loop
    execute format('drop policy if exists "read own" on public.%I', entity);
    execute format('drop policy if exists "insert own" on public.%I', entity);
    execute format('drop policy if exists "update own" on public.%I', entity);
    execute format('create policy "read own" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', entity);
    execute format('create policy "insert own" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', entity);
    execute format('create policy "update own" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', entity);
  end loop;
end $$;

commit;
