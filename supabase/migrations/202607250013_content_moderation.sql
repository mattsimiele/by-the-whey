alter table public.tasting_photos
add column if not exists moderation_status text not null default 'pending'
check (moderation_status in ('pending', 'approved', 'rejected'));

alter table public.tasting_photos
add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;

alter table public.tasting_photos
add column if not exists reviewed_at timestamptz;

create index if not exists tasting_photos_moderation_idx
on public.tasting_photos (moderation_status, created_at);

drop policy if exists "photos follow tasting visibility" on public.tasting_photos;
create policy "reviewed photos follow tasting visibility"
on public.tasting_photos for select
using (
  public.is_admin()
  or exists (
    select 1 from public.tastings
    where tastings.id = tasting_photos.tasting_id
      and tastings.user_id = auth.uid()
  )
  or (
    moderation_status = 'approved'
    and exists (select 1 from public.tastings where tastings.id = tasting_photos.tasting_id)
  )
);

create policy "admins review tasting photos"
on public.tasting_photos for update
using (public.is_admin())
with check (public.is_admin());

create policy "admins remove rejected tasting photos"
on public.tasting_photos for delete
using (
  public.is_admin()
  or exists (
    select 1 from public.tastings
    where tastings.id = tasting_photos.tasting_id
      and tastings.user_id = auth.uid()
  )
);

create policy "admins delete moderated photo objects"
on storage.objects for delete to authenticated
using (bucket_id = 'tasting-photos' and public.is_admin());

create or replace function public.contains_blocked_content(input text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    lower(input) ~
      '(^|[^a-z])(porn|nazi|kill yourself|rape|racial slur|hate speech|buy followers|crypto giveaway)([^a-z]|$)'
    or lower(input) ~ '(https?://|www\.)[^ ]{0,40}(adult|casino|betting|crypto)',
    false
  );
$$;

create or replace function public.filter_user_content()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  candidate text := '';
begin
  if tg_table_name = 'profiles' then
    candidate := concat_ws(' ', new.display_name, new.handle, new.bio, new.location);
  elsif tg_table_name = 'tastings' then
    candidate := concat_ws(' ', new.notes, new.location_name);
  elsif tg_table_name = 'comments' then
    candidate := new.body;
  elsif tg_table_name = 'cheeses' and new.status <> 'published' then
    candidate := concat_ws(' ', new.name, new.creamery_name, new.story_notes, array_to_string(new.flavor_profile, ' '), array_to_string(new.pairings, ' '));
  end if;

  if public.contains_blocked_content(candidate) then
    raise exception using
      errcode = 'P0001',
      message = 'CONTENT_REVIEW_REQUIRED';
  end if;
  return new;
end;
$$;

drop trigger if exists filter_profile_content on public.profiles;
create trigger filter_profile_content
before insert or update on public.profiles
for each row execute procedure public.filter_user_content();

drop trigger if exists filter_tasting_content on public.tastings;
create trigger filter_tasting_content
before insert or update on public.tastings
for each row execute procedure public.filter_user_content();

drop trigger if exists filter_comment_content on public.comments;
create trigger filter_comment_content
before insert or update on public.comments
for each row execute procedure public.filter_user_content();

drop trigger if exists filter_cheese_submission_content on public.cheeses;
create trigger filter_cheese_submission_content
before insert or update on public.cheeses
for each row execute procedure public.filter_user_content();
