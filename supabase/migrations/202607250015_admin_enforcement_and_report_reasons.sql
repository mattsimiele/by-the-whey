alter table public.reports
add column if not exists reason_code text;

alter table public.profiles
add column if not exists account_status text not null default 'active'
check (account_status in ('active', 'warned', 'suspended'));

alter table public.profiles
add column if not exists warning_count integer not null default 0
check (warning_count >= 0);

alter table public.profiles
add column if not exists moderation_note text;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
check (kind in ('follow', 'like', 'comment', 'cheese_approved', 'cheese_rejected', 'warn_account', 'suspend_account', 'restore_account'));

drop function if exists public.admin_report_queue();
create function public.admin_report_queue()
returns table (
  id uuid,
  target_type text,
  target_id uuid,
  reason text,
  reason_code text,
  status text,
  created_at timestamptz,
  reporter_handle text,
  target_preview text,
  target_user_id uuid
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
    reports.reason_code,
    reports.status,
    reports.created_at,
    profiles.handle,
    case reports.target_type
      when 'profile' then (select 'Account @' || target.handle || ' · ' || target.display_name from public.profiles target where target.id = reports.target_id)
      when 'tasting' then (select 'Rating ' || tastings.rating::text || ' · ' || left(tastings.notes, 240) from public.tastings where tastings.id = reports.target_id)
      when 'comment' then (select left(comments.body, 240) from public.comments where comments.id = reports.target_id)
      when 'cheese' then (select cheeses.name || ' · ' || cheeses.creamery_name from public.cheeses where cheeses.id = reports.target_id)
    end,
    case reports.target_type
      when 'profile' then reports.target_id
      when 'tasting' then (select tastings.user_id from public.tastings where tastings.id = reports.target_id)
      when 'comment' then (select comments.user_id from public.comments where comments.id = reports.target_id)
      when 'cheese' then (select cheeses.submitted_by from public.cheeses where cheeses.id = reports.target_id)
    end
  from public.reports reports
  join public.profiles profiles on profiles.id = reports.reporter_id
  where reports.status = 'open' and public.is_admin()
  order by reports.created_at;
$$;

revoke all on function public.admin_report_queue() from public;
grant execute on function public.admin_report_queue() to authenticated;

create or replace function public.admin_enforce_report(
  report_id uuid,
  enforcement_action text,
  admin_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  report_row public.reports%rowtype;
  affected_user uuid;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  select * into report_row from public.reports where id = report_id and status = 'open' for update;
  if not found then raise exception 'Open report not found'; end if;

  if enforcement_action = 'dismiss' then
    update public.reports set status = 'dismissed', reviewed_by = auth.uid() where id = report_id;
    return;
  end if;

  if enforcement_action = 'remove_content' then
    if report_row.target_type = 'tasting' then
      select user_id into affected_user from public.tastings where id = report_row.target_id;
      delete from public.tastings where id = report_row.target_id;
    elsif report_row.target_type = 'comment' then
      select user_id into affected_user from public.comments where id = report_row.target_id;
      delete from public.comments where id = report_row.target_id;
    elsif report_row.target_type = 'cheese' then
      update public.cheeses set status = 'rejected', approved_by = null where id = report_row.target_id;
    else
      raise exception 'This report type does not contain removable content';
    end if;
  elsif enforcement_action in ('warn_account', 'suspend_account', 'restore_account') then
    affected_user := case report_row.target_type
      when 'profile' then report_row.target_id
      when 'tasting' then (select user_id from public.tastings where id = report_row.target_id)
      when 'comment' then (select user_id from public.comments where id = report_row.target_id)
      when 'cheese' then (select submitted_by from public.cheeses where id = report_row.target_id)
    end;
    if affected_user is null or affected_user = auth.uid() then raise exception 'Account cannot be actioned'; end if;
    update public.profiles
    set account_status = case enforcement_action when 'suspend_account' then 'suspended' when 'restore_account' then 'active' else 'warned' end,
        warning_count = warning_count + case when enforcement_action = 'warn_account' then 1 else 0 end,
        moderation_note = nullif(left(coalesce(admin_note, ''), 500), '')
    where id = affected_user and role <> 'admin';
    insert into public.notifications (user_id, actor_id, kind, target_type, target_id)
    values (affected_user, auth.uid(), enforcement_action, 'profile', affected_user);
  else
    raise exception 'Unsupported enforcement action';
  end if;

  update public.reports set status = 'actioned', reviewed_by = auth.uid() where id = report_id;
end;
$$;

revoke all on function public.admin_enforce_report(uuid, text, text) from public;
grant execute on function public.admin_enforce_report(uuid, text, text) to authenticated;

create or replace function public.admin_set_account_status(
  target_user_id uuid,
  next_status text,
  admin_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if target_user_id = auth.uid() then raise exception 'You cannot moderate your own account'; end if;
  if next_status not in ('active', 'warned', 'suspended') then raise exception 'Invalid account status'; end if;

  update public.profiles
  set account_status = next_status,
      warning_count = warning_count + case when next_status = 'warned' then 1 else 0 end,
      moderation_note = nullif(left(coalesce(admin_note, ''), 500), '')
  where id = target_user_id and role <> 'admin';

  if not found then raise exception 'Account not found or protected'; end if;
  insert into public.notifications (user_id, actor_id, kind, target_type, target_id)
  values (target_user_id, auth.uid(), case next_status when 'active' then 'restore_account' when 'warned' then 'warn_account' else 'suspend_account' end, 'profile', target_user_id);
end;
$$;

revoke all on function public.admin_set_account_status(uuid, text, text) from public;
grant execute on function public.admin_set_account_status(uuid, text, text) to authenticated;

create or replace function public.admin_remove_account(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if target_user_id = auth.uid() then raise exception 'You cannot remove your own administrator account'; end if;
  if exists (select 1 from public.profiles where id = target_user_id and role = 'admin') then
    raise exception 'Administrator accounts are protected';
  end if;
  delete from auth.users where id = target_user_id;
  if not found then raise exception 'Account not found'; end if;
end;
$$;

revoke all on function public.admin_remove_account(uuid) from public;
grant execute on function public.admin_remove_account(uuid) to authenticated;

create policy "admins delete profile avatar objects"
on storage.objects for delete
using (bucket_id = 'profile-avatars' and public.is_admin());

create or replace function public.require_active_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.profiles
    where id = auth.uid() and account_status = 'suspended'
  ) then
    raise exception 'ACCOUNT_SUSPENDED';
  end if;
  return new;
end;
$$;

drop trigger if exists require_active_tastings on public.tastings;
create trigger require_active_tastings before insert or update on public.tastings
for each row execute procedure public.require_active_account();
drop trigger if exists require_active_comments on public.comments;
create trigger require_active_comments before insert or update on public.comments
for each row execute procedure public.require_active_account();
drop trigger if exists require_active_likes on public.likes;
create trigger require_active_likes before insert or update on public.likes
for each row execute procedure public.require_active_account();
drop trigger if exists require_active_follows on public.follows;
create trigger require_active_follows before insert or update on public.follows
for each row execute procedure public.require_active_account();
drop trigger if exists require_active_cheeses on public.cheeses;
create trigger require_active_cheeses before insert or update on public.cheeses
for each row execute procedure public.require_active_account();
drop trigger if exists require_active_tasting_photos on public.tasting_photos;
create trigger require_active_tasting_photos before insert or update on public.tasting_photos
for each row execute procedure public.require_active_account();

drop policy if exists "visible tastings are readable" on public.tastings;
create policy "visible tastings are readable" on public.tastings for select
using (
  (
    visibility = 'public'
    or user_id = auth.uid()
    or public.is_admin()
    or (
      visibility = 'followers'
      and exists (
        select 1 from public.follows
        where follower_id = auth.uid() and following_id = tastings.user_id
      )
    )
  )
  and (
    user_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.profiles where id = tastings.user_id and account_status <> 'suspended')
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
  and (
    user_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.profiles where id = comments.user_id and account_status <> 'suspended')
  )
  and not exists (
    select 1 from public.blocks
    where
      (blocker_id = auth.uid() and blocked_id = comments.user_id)
      or (blocker_id = comments.user_id and blocked_id = auth.uid())
  )
);
