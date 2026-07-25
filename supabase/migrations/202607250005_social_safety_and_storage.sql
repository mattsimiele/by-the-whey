create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('follow', 'like', 'comment', 'cheese_approved', 'cheese_rejected')),
  target_type text not null check (target_type in ('profile', 'tasting', 'comment', 'cheese')),
  target_id uuid not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.blocks (
  blocker_id uuid references public.profiles(id) on delete cascade,
  blocked_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.notifications enable row level security;
alter table public.blocks enable row level security;

create policy "users read own notifications" on public.notifications for select
using (user_id = auth.uid());
create policy "users update own notifications" on public.notifications for update
using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "users read own blocks" on public.blocks for select
using (blocker_id = auth.uid());
create policy "users create own blocks" on public.blocks for insert
with check (blocker_id = auth.uid());
create policy "users remove own blocks" on public.blocks for delete
using (blocker_id = auth.uid());

create or replace function public.create_social_notification()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  recipient uuid;
  notification_kind text;
  notification_target_type text;
  notification_target_id uuid;
begin
  if tg_table_name = 'follows' then
    recipient := new.following_id;
    notification_kind := 'follow';
    notification_target_type := 'profile';
    notification_target_id := new.follower_id;
  elsif tg_table_name = 'likes' then
    select user_id into recipient from public.tastings where id = new.tasting_id;
    notification_kind := 'like';
    notification_target_type := 'tasting';
    notification_target_id := new.tasting_id;
  elsif tg_table_name = 'comments' then
    select user_id into recipient from public.tastings where id = new.tasting_id;
    notification_kind := 'comment';
    notification_target_type := 'tasting';
    notification_target_id := new.tasting_id;
  end if;

  if recipient is not null and recipient <> auth.uid() then
    insert into public.notifications (user_id, actor_id, kind, target_type, target_id)
    values (recipient, auth.uid(), notification_kind, notification_target_type, notification_target_id);
  end if;
  return new;
end;
$$;

create trigger notify_on_follow
after insert on public.follows
for each row execute procedure public.create_social_notification();
create trigger notify_on_like
after insert on public.likes
for each row execute procedure public.create_social_notification();
create trigger notify_on_comment
after insert on public.comments
for each row execute procedure public.create_social_notification();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tasting-photos',
  'tasting-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

create policy "users upload tasting photos to own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'tasting-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users manage tasting photos in own folder"
on storage.objects for update to authenticated
using (bucket_id = 'tasting-photos' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'tasting-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users delete tasting photos in own folder"
on storage.objects for delete to authenticated
using (bucket_id = 'tasting-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "authenticated users read tasting photos"
on storage.objects for select to authenticated
using (bucket_id = 'tasting-photos');

create or replace function public.delete_my_account()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index blocks_blocked_idx on public.blocks (blocked_id);
