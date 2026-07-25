create extension if not exists pgcrypto;

create type public.app_role as enum ('turophile', 'cheesemonger', 'admin');
create type public.review_status as enum ('draft', 'pending', 'published', 'rejected');
create type public.content_visibility as enum ('public', 'followers', 'private');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique not null check (handle ~ '^[a-z0-9_]{3,30}$'),
  display_name text not null check (char_length(display_name) between 1 and 80),
  bio text not null default '' check (char_length(bio) <= 300),
  avatar_path text,
  location text,
  role public.app_role not null default 'turophile',
  role_approved boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cheeses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  creamery_name text not null,
  location_city text not null,
  location_region text not null,
  location_country text not null default 'USA',
  milk_type text not null,
  rennet text not null,
  cheese_style text not null,
  age_description text not null,
  flavor_profile text[] not null check (cardinality(flavor_profile) > 0),
  story_notes text not null check (char_length(story_notes) > 0),
  pairings text[] not null check (cardinality(pairings) > 0),
  image_path text,
  status public.review_status not null default 'pending',
  submitted_by uuid not null references public.profiles(id),
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tastings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  cheese_id uuid not null references public.cheeses(id),
  rating numeric(2,1) not null check (rating >= 0.5 and rating <= 5 and rating * 2 = trunc(rating * 2)),
  notes text not null default '' check (char_length(notes) <= 2000),
  location_name text,
  visibility public.content_visibility not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasting_photos (
  id uuid primary key default gen_random_uuid(),
  tasting_id uuid not null references public.tastings(id) on delete cascade,
  storage_path text not null,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create table public.follows (
  follower_id uuid references public.profiles(id) on delete cascade,
  following_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table public.likes (
  user_id uuid references public.profiles(id) on delete cascade,
  tasting_id uuid references public.tastings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, tasting_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  tasting_id uuid not null references public.tastings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id),
  target_type text not null check (target_type in ('profile', 'tasting', 'comment', 'cheese')),
  target_id uuid not null,
  reason text not null check (char_length(reason) between 1 and 500),
  status text not null default 'open' check (status in ('open', 'reviewed', 'actioned', 'dismissed')),
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and role_approved
  );
$$;

create or replace function public.is_approved_cheesemonger()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('cheesemonger', 'admin') and role_approved
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, handle, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'handle', 'curd_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data ->> 'display_name', 'Cheese lover')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.protect_profile_role()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (new.role, new.role_approved) is distinct from (old.role, old.role_approved)
     and not public.is_admin() then
    raise exception 'Only administrators may change account roles';
  end if;
  return new;
end;
$$;

create trigger protect_profile_role_before_update
before update on public.profiles
for each row execute procedure public.protect_profile_role();

alter table public.profiles enable row level security;
alter table public.cheeses enable row level security;
alter table public.tastings enable row level security;
alter table public.tasting_photos enable row level security;
alter table public.follows enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.reports enable row level security;

create policy "profiles are publicly readable" on public.profiles for select using (true);
create policy "users update own safe profile fields" on public.profiles for update
using (id = auth.uid()) with check (id = auth.uid());

create policy "published cheeses are readable" on public.cheeses for select
using (status = 'published' or submitted_by = auth.uid() or public.is_admin());
create policy "approved cheesemongers submit cheeses" on public.cheeses for insert
with check (public.is_approved_cheesemonger() and submitted_by = auth.uid() and status in ('draft', 'pending'));
create policy "submitters edit unpublished cheeses" on public.cheeses for update
using ((submitted_by = auth.uid() and status in ('draft', 'pending', 'rejected')) or public.is_admin())
with check (
  public.is_admin()
  or (submitted_by = auth.uid() and status in ('draft', 'pending', 'rejected') and approved_by is null)
);

create policy "visible tastings are readable" on public.tastings for select
using (
  visibility = 'public'
  or user_id = auth.uid()
  or (
    visibility = 'followers'
    and exists (
      select 1 from public.follows
      where follower_id = auth.uid() and following_id = tastings.user_id
    )
  )
);
create policy "users create own tastings" on public.tastings for insert
with check (
  user_id = auth.uid()
  and exists (select 1 from public.cheeses where id = cheese_id and status = 'published')
);
create policy "users manage own tastings" on public.tastings for update
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users delete own tastings" on public.tastings for delete using (user_id = auth.uid());

create policy "photos follow tasting visibility" on public.tasting_photos for select
using (exists (select 1 from public.tastings where id = tasting_id));
create policy "users add own tasting photos" on public.tasting_photos for insert
with check (exists (select 1 from public.tastings where id = tasting_id and user_id = auth.uid()));
create policy "users delete own tasting photos" on public.tasting_photos for delete
using (exists (select 1 from public.tastings where id = tasting_id and user_id = auth.uid()));

create policy "follows are readable" on public.follows for select using (true);
create policy "users manage own follows" on public.follows for insert with check (follower_id = auth.uid());
create policy "users delete own follows" on public.follows for delete using (follower_id = auth.uid());

create policy "likes are readable" on public.likes for select using (true);
create policy "users create own likes" on public.likes for insert with check (user_id = auth.uid());
create policy "users delete own likes" on public.likes for delete using (user_id = auth.uid());

create policy "comments on visible tastings are readable" on public.comments for select
using (exists (select 1 from public.tastings where id = tasting_id));
create policy "users create own comments" on public.comments for insert with check (user_id = auth.uid());
create policy "users update own comments" on public.comments for update
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users delete own comments" on public.comments for delete
using (user_id = auth.uid() or public.is_admin());

create policy "users create reports" on public.reports for insert with check (reporter_id = auth.uid());
create policy "reporters and admins read reports" on public.reports for select
using (reporter_id = auth.uid() or public.is_admin());
create policy "admins review reports" on public.reports for update using (public.is_admin());

create index tastings_feed_idx on public.tastings (created_at desc) where visibility = 'public';
create index tastings_user_idx on public.tastings (user_id, created_at desc);
create index comments_tasting_idx on public.comments (tasting_id, created_at);
create index cheeses_status_idx on public.cheeses (status, name);
