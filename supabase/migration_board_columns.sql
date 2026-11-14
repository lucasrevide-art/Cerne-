-- Cerne: colunas personalizadas do quadro Kanban.
-- Migração ADITIVA e segura para rodar mais de uma vez. Não apaga nada.

create table if not exists board_columns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  is_done boolean not null default false,
  sort_order double precision not null default 0
);

alter table board_columns enable row level security;
drop policy if exists "own rows" on board_columns;
create policy "own rows" on board_columns
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Só uma coluna de "concluído" por usuário.
create unique index if not exists board_columns_one_done_per_user
  on board_columns(user_id) where is_done;

alter table tasks
  add column if not exists column_id uuid references board_columns(id) on delete set null;

-- Colunas iniciais para quem ainda não tem nenhuma.
insert into board_columns (user_id, name, is_done, sort_order)
select u.id, v.name, v.is_done, v.ord
from auth.users u
cross join (values
  ('A Fazer', false, 1), ('Fazendo', false, 2), ('Aprovação', false, 3), ('Concluído', true, 4)
) as v(name, is_done, ord)
where not exists (select 1 from board_columns c where c.user_id = u.id);

-- Tarefas existentes vão para a coluna equivalente à etapa antiga.
update tasks t
set column_id = c.id
from board_columns c
where t.column_id is null
  and c.user_id = t.user_id
  and c.is_done = false
  and c.name = case t.board_stage
    when 'todo' then 'A Fazer' when 'doing' then 'Fazendo' when 'review' then 'Aprovação' end;

-- Realtime
do $$
begin
  alter publication supabase_realtime add table board_columns;
exception when duplicate_object then null;
end $$;
