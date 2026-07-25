-- Allow trusted database operators to manage roles while continuing to block
-- mobile clients from changing their own role.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

  if (new.role, new.role_approved) is distinct from (old.role, old.role_approved)
     and not public.is_admin() then
    raise exception 'Only administrators may change account roles';
  end if;
  return new;
end;
$$;

-- Bootstrap the verified project owner as the initial administrator.
update public.profiles
set role = 'admin',
    role_approved = true,
    updated_at = now()
where id = '296fb853-d174-46c7-8e94-e19b1ce61fd2'
  and handle = 'msimiele';
