-- Applied separately because the initial schema may already be installed.
-- Prevent clients from promoting their own account or publishing a cheese.

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

drop trigger if exists protect_profile_role_before_update on public.profiles;
create trigger protect_profile_role_before_update
before update on public.profiles
for each row execute procedure public.protect_profile_role();

drop policy if exists "submitters edit unpublished cheeses" on public.cheeses;
create policy "submitters edit unpublished cheeses" on public.cheeses for update
using ((submitted_by = auth.uid() and status in ('draft', 'pending', 'rejected')) or public.is_admin())
with check (
  public.is_admin()
  or (submitted_by = auth.uid() and status in ('draft', 'pending', 'rejected') and approved_by is null)
);

create policy "admins update profiles" on public.profiles for update
using (public.is_admin())
with check (public.is_admin());
