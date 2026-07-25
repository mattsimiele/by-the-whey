drop policy if exists "users read own blocks" on public.blocks;
create policy "users read blocks involving them" on public.blocks for select
using (blocker_id = auth.uid() or blocked_id = auth.uid());

alter table public.cheeses alter column submitted_by drop not null;
alter table public.cheeses drop constraint if exists cheeses_submitted_by_fkey;
alter table public.cheeses add constraint cheeses_submitted_by_fkey
foreign key (submitted_by) references public.profiles(id) on delete set null;
alter table public.cheeses drop constraint if exists cheeses_approved_by_fkey;
alter table public.cheeses add constraint cheeses_approved_by_fkey
foreign key (approved_by) references public.profiles(id) on delete set null;

alter table public.reports drop constraint if exists reports_reporter_id_fkey;
alter table public.reports add constraint reports_reporter_id_fkey
foreign key (reporter_id) references public.profiles(id) on delete cascade;
alter table public.reports drop constraint if exists reports_reviewed_by_fkey;
alter table public.reports add constraint reports_reviewed_by_fkey
foreign key (reviewed_by) references public.profiles(id) on delete set null;

drop policy if exists "published cheeses are readable" on public.cheeses;
create policy "published cheeses are readable" on public.cheeses for select
using (status = 'published' or submitted_by = auth.uid() or public.is_admin());

drop policy if exists "visible tastings are readable" on public.tastings;
create policy "visible tastings are readable" on public.tastings for select
using (
  (
    visibility = 'public'
    or user_id = auth.uid()
    or (
      visibility = 'followers'
      and exists (
        select 1 from public.follows
        where follower_id = auth.uid() and following_id = tastings.user_id
      )
    )
  )
  and not exists (
    select 1 from public.blocks
    where
      (blocker_id = auth.uid() and blocked_id = tastings.user_id)
      or (blocker_id = tastings.user_id and blocked_id = auth.uid())
  )
);

drop policy if exists "comments on visible tastings are readable" on public.comments;
create policy "comments on visible tastings are readable" on public.comments for select
using (
  exists (select 1 from public.tastings where id = tasting_id)
  and not exists (
    select 1 from public.blocks
    where
      (blocker_id = auth.uid() and blocked_id = comments.user_id)
      or (blocker_id = comments.user_id and blocked_id = auth.uid())
  )
);

drop policy if exists "follows are readable" on public.follows;
create policy "follows are readable" on public.follows for select
using (
  not exists (
    select 1 from public.blocks
    where
      (blocker_id = auth.uid() and blocked_id in (follows.follower_id, follows.following_id))
      or (blocked_id = auth.uid() and blocker_id in (follows.follower_id, follows.following_id))
  )
);

create or replace function public.admin_report_queue()
returns table (
  id uuid,
  target_type text,
  target_id uuid,
  reason text,
  status text,
  created_at timestamptz,
  reporter_handle text,
  target_preview text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    reports.id,
    reports.target_type,
    reports.target_id,
    reports.reason,
    reports.status,
    reports.created_at,
    profiles.handle,
    case reports.target_type
      when 'profile' then (select 'Account @' || target.handle || ' · ' || target.display_name from public.profiles target where target.id = reports.target_id)
      when 'tasting' then (select 'Rating ' || tastings.rating::text || ' · ' || left(tastings.notes, 240) from public.tastings where tastings.id = reports.target_id)
      when 'comment' then (select left(comments.body, 240) from public.comments where comments.id = reports.target_id)
      when 'cheese' then (select cheeses.name || ' · ' || cheeses.creamery_name from public.cheeses where cheeses.id = reports.target_id)
    end
  from public.reports reports
  join public.profiles profiles on profiles.id = reports.reporter_id
  where reports.status = 'open' and public.is_admin()
  order by reports.created_at;
$$;

revoke all on function public.admin_report_queue() from public;
grant execute on function public.admin_report_queue() to authenticated;
