create table if not exists public.app_data (
  user_id uuid references auth.users (id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.app_data enable row level security;

create policy "Users can view their data"
  on public.app_data
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their data"
  on public.app_data
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their data"
  on public.app_data
  for update
  using (auth.uid() = user_id);
