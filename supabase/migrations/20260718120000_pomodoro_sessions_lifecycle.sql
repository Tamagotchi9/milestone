-- Pomodoro sessions: lifecycle enum, ownership, RLS, stats RPC.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'pomodoro_session_status' and n.nspname = 'public'
  ) then
    create type public.pomodoro_session_status as enum (
      'running',
      'paused',
      'completed',
      'abandoned'
    );
  end if;
end $$;

create table if not exists public.pomodoro_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  duration_minutes integer not null default 25,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  actual_seconds integer,
  status text not null default 'running',
  was_completed boolean not null default false
);

-- Convert status text → enum when still text
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pomodoro_sessions'
      and column_name = 'status'
      and data_type = 'text'
  ) then
    update public.pomodoro_sessions
    set status = 'running'
    where status is null
       or status not in ('running', 'paused', 'completed', 'abandoned');

    alter table public.pomodoro_sessions
      alter column status drop default;

    alter table public.pomodoro_sessions
      alter column status type public.pomodoro_session_status
      using status::public.pomodoro_session_status;

    alter table public.pomodoro_sessions
      alter column status set default 'running'::public.pomodoro_session_status;
  end if;
end $$;

alter table public.pomodoro_sessions
  alter column user_id set default auth.uid();

-- Ensure task FK is ON DELETE SET NULL
alter table public.pomodoro_sessions
  drop constraint if exists pomodoro_sessions_task_id_fkey;

alter table public.pomodoro_sessions
  add constraint pomodoro_sessions_task_id_fkey
  foreign key (task_id)
  references public.tasks (id)
  on delete set null;

create or replace function public.pomodoro_sessions_set_user_id_from_jwt()
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

drop trigger if exists pomodoro_sessions_set_user_id_from_jwt on public.pomodoro_sessions;

create trigger pomodoro_sessions_set_user_id_from_jwt
  before insert on public.pomodoro_sessions
  for each row
  execute function public.pomodoro_sessions_set_user_id_from_jwt();

create or replace function public.pomodoro_sessions_prevent_user_id_change()
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

drop trigger if exists pomodoro_sessions_prevent_user_id_change on public.pomodoro_sessions;

create trigger pomodoro_sessions_prevent_user_id_change
  before update on public.pomodoro_sessions
  for each row
  execute function public.pomodoro_sessions_prevent_user_id_change();

alter table public.pomodoro_sessions enable row level security;

drop policy if exists "Users manage own pomodoro sessions" on public.pomodoro_sessions;

create policy "Users manage own pomodoro sessions"
  on public.pomodoro_sessions
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index if not exists pomodoro_sessions_user_started_at_idx
  on public.pomodoro_sessions (user_id, started_at desc);

create index if not exists pomodoro_sessions_user_task_id_idx
  on public.pomodoro_sessions (user_id, task_id)
  where task_id is not null;

grant select, insert, update, delete on public.pomodoro_sessions to authenticated;

create or replace function public.pomodoro_stats(p_task_id uuid default null)
returns table (
  completed_today bigint,
  seconds_today bigint,
  completed_week bigint,
  seconds_week bigint,
  completed_for_task bigint,
  seconds_for_task bigint
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  day_start timestamptz;
  week_start timestamptz;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  update public.pomodoro_sessions
  set
    status = 'abandoned',
    was_completed = false,
    completed_at = coalesce(completed_at, now())
  where user_id = uid
    and status in ('running', 'paused')
    and started_at < now() - interval '3 hours';

  day_start := date_trunc('day', timezone('utc', now())) at time zone 'utc';
  week_start := date_trunc('week', timezone('utc', now())) at time zone 'utc';

  return query
  select
    count(*) filter (
      where s.was_completed
        and s.started_at >= day_start
        and s.started_at < day_start + interval '1 day'
    )::bigint as completed_today,
    coalesce(
      sum(s.actual_seconds) filter (
        where s.was_completed
          and s.started_at >= day_start
          and s.started_at < day_start + interval '1 day'
      ),
      0
    )::bigint as seconds_today,
    count(*) filter (
      where s.was_completed
        and s.started_at >= week_start
        and s.started_at < week_start + interval '1 week'
    )::bigint as completed_week,
    coalesce(
      sum(s.actual_seconds) filter (
        where s.was_completed
          and s.started_at >= week_start
          and s.started_at < week_start + interval '1 week'
      ),
      0
    )::bigint as seconds_week,
    count(*) filter (
      where s.was_completed
        and p_task_id is not null
        and s.task_id = p_task_id
        and s.started_at >= week_start
        and s.started_at < week_start + interval '1 week'
    )::bigint as completed_for_task,
    coalesce(
      sum(s.actual_seconds) filter (
        where s.was_completed
          and p_task_id is not null
          and s.task_id = p_task_id
          and s.started_at >= week_start
          and s.started_at < week_start + interval '1 week'
      ),
      0
    )::bigint as seconds_for_task
  from public.pomodoro_sessions s
  where s.user_id = uid;
end;
$$;

grant execute on function public.pomodoro_stats(uuid) to authenticated;
