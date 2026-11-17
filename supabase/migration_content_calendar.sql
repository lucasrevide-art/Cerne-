-- Cerne: calendário de conteúdo dentro de cada projeto.
-- Migração ADITIVA e segura para rodar mais de uma vez. Não apaga nada.

create table if not exists content_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  project_id uuid not null references projects(id) on delete cascade,
  publish_date date not null,
  title text not null default '',
  format text not null default 'reels',
  status text not null default 'idea',
  objective text not null default '',
  script text not null default '',
  caption text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_items_project_date
  on content_items(project_id, publish_date);

alter table content_items enable row level security;
drop policy if exists "own rows" on content_items;
create policy "own rows" on content_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Realtime
do $$
begin
  alter publication supabase_realtime add table content_items;
exception when duplicate_object then null;
end $$;
