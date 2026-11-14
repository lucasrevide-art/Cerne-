-- Cerne: schema de referência. SÓ para projeto NOVO (apaga tudo).
-- Depois de ter dado real, use apenas supabase/migration_<nome>.sql aditivas.
drop table if exists recurrences cascade;
drop table if exists task_tags cascade;
drop table if exists subtasks cascade;
drop table if exists notes cascade;
drop table if exists tasks cascade;
drop table if exists tags cascade;
drop table if exists projects cascade;
drop table if exists areas cascade;

create table areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  color text not null default '#2F6D64',
  icon text not null default 'folder',
  sort_order double precision not null default 0
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  notes text not null default '',
  status text not null default 'active' check (status in ('active','completed','archived')),
  area_id uuid references areas(id) on delete set null,
  deadline date,
  sort_order double precision not null default 0
);

create table tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  color text not null default '#6B7F7B'
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null,
  notes text not null default '',
  when_kind text check (when_kind in ('today','evening','date','someday')),
  when_date date,
  deadline date,
  status text not null default 'open' check (status in ('open','waiting','completed','canceled')),
  priority smallint not null default 0 check (priority between 0 and 3),
  type text not null default 'default' check (type in ('default','financial')),
  amount numeric,
  category text,
  project_id uuid references projects(id) on delete set null,
  area_id uuid references areas(id) on delete set null,
  is_focus boolean not null default false,
  start_time text,
  duration_minutes integer,
  board_stage text not null default 'todo' check (board_stage in ('todo','doing','review')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  sort_order double precision not null default 0
);

create table task_tags (
  task_id uuid not null references tasks(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  primary key (task_id, tag_id)
);

create table subtasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  task_id uuid not null references tasks(id) on delete cascade,
  title text not null,
  status text not null default 'open' check (status in ('open','completed')),
  sort_order double precision not null default 0
);

create table notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  area_id uuid references areas(id) on delete cascade,
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table recurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  task_id uuid not null references tasks(id) on delete cascade,
  type text not null check (type in ('daily','weekly','monthly','custom')),
  interval_count integer not null default 1,
  weekdays smallint[] not null default '{}',
  next_date date
);

-- Um único foco por usuário
create unique index tasks_one_focus_per_user on tasks(user_id) where is_focus and status in ('open','waiting');

create index on tasks(user_id, status);
create index on subtasks(task_id);
create index on notes(area_id);

-- RLS
do $$
declare t text;
begin
  foreach t in array array['areas','projects','tags','tasks','task_tags','subtasks','notes','recurrences'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "own rows" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

-- Realtime
alter publication supabase_realtime add table areas, projects, tags, tasks, task_tags, subtasks, notes, recurrences;
