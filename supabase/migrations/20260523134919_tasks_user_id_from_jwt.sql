-- Assign task owner from JWT (auth.uid()); clients must not send user_id.

alter table public.tasks
  alter column user_id set default auth.uid();

create or replace function public.tasks_set_user_id_from_jwt()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  new.user_id := auth.uid();
  return new;
end;
$$;

drop trigger if exists tasks_set_user_id_from_jwt on public.tasks;

create trigger tasks_set_user_id_from_jwt
  before insert on public.tasks
  for each row
  execute function public.tasks_set_user_id_from_jwt();

create or replace function public.tasks_prevent_user_id_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.user_id is distinct from old.user_id then
    new.user_id := old.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_prevent_user_id_change on public.tasks;

create trigger tasks_prevent_user_id_change
  before update on public.tasks
  for each row
  execute function public.tasks_prevent_user_id_change();

drop policy if exists "Users see own tasks" on public.tasks;

create policy "Users see own tasks"
  on public.tasks
  for all
  to public
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
