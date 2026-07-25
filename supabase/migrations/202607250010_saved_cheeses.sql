create table if not exists public.saved_cheeses (
  user_id uuid not null references public.profiles(id) on delete cascade,
  cheese_id uuid not null references public.cheeses(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, cheese_id)
);

alter table public.saved_cheeses enable row level security;

create policy "users read own saved cheeses"
on public.saved_cheeses for select
using (user_id = auth.uid());

create policy "users save cheeses"
on public.saved_cheeses for insert
with check (user_id = auth.uid());

create policy "users remove own saved cheeses"
on public.saved_cheeses for delete
using (user_id = auth.uid());

create index if not exists saved_cheeses_user_created_idx
on public.saved_cheeses (user_id, created_at desc);
