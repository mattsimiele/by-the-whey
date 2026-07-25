create or replace function public.cheese_rating_summary()
returns table (
  cheese_id uuid,
  average_rating numeric,
  rating_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    tastings.cheese_id,
    round(avg(tastings.rating), 1) as average_rating,
    count(*) as rating_count
  from public.tastings
  group by tastings.cheese_id;
$$;

revoke all on function public.cheese_rating_summary() from public;
grant execute on function public.cheese_rating_summary() to anon, authenticated;
