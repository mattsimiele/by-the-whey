create or replace function public.create_cheese_review_notification()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('published', 'rejected') then
    insert into public.notifications (user_id, actor_id, kind, target_type, target_id)
    values (
      new.submitted_by,
      auth.uid(),
      case when new.status = 'published' then 'cheese_approved' else 'cheese_rejected' end,
      'cheese',
      new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists notify_on_cheese_review on public.cheeses;
create trigger notify_on_cheese_review
after update of status on public.cheeses
for each row execute procedure public.create_cheese_review_notification();
