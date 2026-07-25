create table public.cheese_photos (
  id uuid primary key default gen_random_uuid(),
  cheese_id uuid not null references public.cheeses(id) on delete cascade,
  storage_path text not null unique,
  moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'approved', 'rejected')),
  submitted_by uuid references public.profiles(id) on delete set null default auth.uid(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.cheese_photos enable row level security;
create policy "approved catalog photos are readable" on public.cheese_photos for select
using (moderation_status = 'approved' or submitted_by = auth.uid() or public.is_admin());
create policy "contributors submit catalog photos" on public.cheese_photos for insert
with check (submitted_by = auth.uid() and public.is_approved_cheesemonger());
create policy "admins review catalog photos" on public.cheese_photos for update
using (public.is_admin()) with check (public.is_admin());
create policy "contributors remove pending catalog photos" on public.cheese_photos for delete
using ((submitted_by = auth.uid() and moderation_status <> 'approved') or public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cheese-photos', 'cheese-photos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "catalog photos are public" on storage.objects for select
using (bucket_id = 'cheese-photos');
create policy "contributors upload catalog photos" on storage.objects for insert
with check (bucket_id = 'cheese-photos' and (storage.foldername(name))[1] = auth.uid()::text and public.is_approved_cheesemonger());
create policy "contributors update own catalog photos" on storage.objects for update
using (bucket_id = 'cheese-photos' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'cheese-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "contributors or admins delete catalog photos" on storage.objects for delete
using (bucket_id = 'cheese-photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

create index cheese_photos_cheese_status_idx on public.cheese_photos (cheese_id, moderation_status, created_at desc);

create trigger require_active_cheese_photos before insert or update on public.cheese_photos
for each row execute procedure public.require_active_account();
