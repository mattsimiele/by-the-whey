alter table public.cheeses
  add column if not exists in_curd_nerd_case boolean not null default false;

comment on column public.cheeses.in_curd_nerd_case is
  'Whether this cheese is currently available in the case at The Curd Nerd.';

create index if not exists cheeses_case_availability_idx
  on public.cheeses (in_curd_nerd_case desc, name);
