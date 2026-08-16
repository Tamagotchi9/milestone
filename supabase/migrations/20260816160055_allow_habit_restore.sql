-- Allow owners to return archived habits to their active list.

create or replace function public.habits_guard_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'Habit owner cannot be changed';
  end if;

  if new.starts_on is distinct from old.starts_on then
    raise exception 'Habit start date cannot be changed';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.habits_guard_update() from public;
