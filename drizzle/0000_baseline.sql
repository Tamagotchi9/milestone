-- Baseline for Neon: the final state of the Supabase migrations from `develop`.
-- public.tasks was created outside migrations on Supabase; its definition is
-- reconstructed from the generated types and the app code.

-- Roles. Policies target `authenticated`; the app logs in as
-- `authenticated_backend`, whose password is set outside migrations.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'authenticated_backend') then
    create role authenticated_backend nologin;
  end if;
end $$;

grant authenticated to authenticated_backend;

-- Request identity. The backend sets `request.jwt.claims` inside a transaction
-- after verifying the Neon Auth JWT.
create schema if not exists auth;

create or replace function auth.uid()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(
    nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
    ''
  )::uuid;
$$;

grant usage on schema auth to authenticated;
grant usage on schema public to authenticated;
grant execute on function auth.uid() to authenticated;

-- Tasks
create type public.tasks_priority as enum ('low', 'medium', 'high');

create type public.tasks_status as enum (
  'created',
  'in_progress',
  'completed',
  'on_hold',
  'blocked',
  'abandoned'
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references neon_auth."user" (id) on delete cascade,
  parent_task_id uuid,
  title text not null,
  description text,
  priority public.tasks_priority not null default 'medium',
  status public.tasks_status not null default 'created',
  deadline date,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint tasks_parent_task_id_fkey
    foreign key (parent_task_id)
    references public.tasks (id)
    on delete cascade
);

create index tasks_user_created_idx on public.tasks (user_id, created_at desc);

create index tasks_parent_task_id_idx on public.tasks (parent_task_id)
  where parent_task_id is not null;

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

create trigger tasks_prevent_user_id_change
  before update on public.tasks
  for each row
  execute function public.tasks_prevent_user_id_change();

alter table public.tasks enable row level security;

create policy "Users see own tasks"
  on public.tasks
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.tasks to authenticated;

-- Pomodoro sessions
create type public.pomodoro_session_status as enum (
  'running',
  'paused',
  'completed',
  'abandoned'
);

create table public.pomodoro_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references neon_auth."user" (id) on delete cascade,
  task_id uuid,
  duration_minutes integer not null default 25,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  actual_seconds integer,
  status public.pomodoro_session_status not null default 'running',
  was_completed boolean not null default false,
  constraint pomodoro_sessions_task_id_fkey
    foreign key (task_id)
    references public.tasks (id)
    on delete set null,
  constraint pomodoro_sessions_actual_seconds_check
    check (actual_seconds is null or actual_seconds >= 0),
  constraint pomodoro_sessions_completion_consistency_check
    check (
      (status in ('completed', 'abandoned') and completed_at is not null)
      or (status in ('running', 'paused') and completed_at is null)
    ),
  constraint pomodoro_sessions_legacy_completed_sync_check
    check (was_completed = (status = 'completed'))
);

create index pomodoro_sessions_user_completed_at_idx
  on public.pomodoro_sessions (user_id, completed_at desc)
  where status = 'completed';

create index pomodoro_sessions_user_running_idx
  on public.pomodoro_sessions (user_id)
  where status = 'running';

create index pomodoro_sessions_user_started_at_idx
  on public.pomodoro_sessions (user_id, started_at desc);

create index pomodoro_sessions_user_task_id_idx
  on public.pomodoro_sessions (user_id, task_id)
  where task_id is not null;

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

create trigger pomodoro_sessions_prevent_user_id_change
  before update on public.pomodoro_sessions
  for each row
  execute function public.pomodoro_sessions_prevent_user_id_change();

alter table public.pomodoro_sessions enable row level security;

create policy "Users manage own pomodoro sessions"
  on public.pomodoro_sessions
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

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

-- Habits
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references neon_auth."user" (id) on delete cascade,
  name text not null,
  starts_on date not null,
  archived_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint habits_id_user_id_key unique (id, user_id),
  constraint habits_name_check check (
    name = btrim(name)
    and char_length(name) between 1 and 80
  ),
  constraint habits_archive_date_check check (
    archived_on is null or archived_on >= starts_on
  )
);

create table public.habit_checkins (
  habit_id uuid not null,
  user_id uuid not null default auth.uid(),
  completed_on date not null,
  created_at timestamptz not null default now(),
  primary key (habit_id, completed_on),
  constraint habit_checkins_habit_owner_fkey
    foreign key (habit_id, user_id)
    references public.habits (id, user_id)
    on delete cascade
);

create index habits_user_archived_created_idx
  on public.habits (user_id, archived_on, created_at desc);

create index habit_checkins_user_completed_idx
  on public.habit_checkins (user_id, completed_on desc);

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

create trigger habits_guard_update
  before update on public.habits
  for each row
  execute function public.habits_guard_update();

alter table public.habits enable row level security;
alter table public.habit_checkins enable row level security;

create policy "Users read own habits"
  on public.habits
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users create own habits"
  on public.habits
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users update own habits"
  on public.habits
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users read own habit check-ins"
  on public.habit_checkins
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users create valid habit check-ins"
  on public.habit_checkins
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.habits h
      where h.id = habit_checkins.habit_id
        and h.user_id = habit_checkins.user_id
        and h.archived_on is null
        and habit_checkins.completed_on >= h.starts_on
    )
  );

create policy "Users delete own habit check-ins"
  on public.habit_checkins
  for delete
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.habits h
      where h.id = habit_checkins.habit_id
        and h.user_id = habit_checkins.user_id
        and h.archived_on is null
    )
  );

grant select, insert, update on public.habits to authenticated;
grant select, insert, delete on public.habit_checkins to authenticated;

-- Dashboard analytics
create or replace function public.pomodoro_daily_stats(
  p_today date,
  p_timezone text,
  p_task_id uuid default null
)
returns table (
  stat_date date,
  completed_total bigint,
  seconds_total bigint,
  completed_for_task bigint,
  seconds_for_task bigint
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_today is null then
    raise exception 'Today is required';
  end if;

  if p_timezone is null
    or not exists (
      select 1
      from pg_catalog.pg_timezone_names
      where name = p_timezone
    ) then
    raise exception 'Invalid time zone';
  end if;

  return query
  with days as (
    select generated_day::date as stat_date
    from generate_series(
      p_today - 13,
      p_today,
      interval '1 day'
    ) as generated_day
  ),
  daily_sessions as (
    select
      timezone(p_timezone, s.started_at)::date as stat_date,
      count(*)::bigint as completed_total,
      coalesce(sum(s.actual_seconds), 0)::bigint as seconds_total,
      count(*) filter (
        where p_task_id is not null
          and s.task_id = p_task_id
      )::bigint as completed_for_task,
      coalesce(
        sum(s.actual_seconds) filter (
          where p_task_id is not null
            and s.task_id = p_task_id
        ),
        0
      )::bigint as seconds_for_task
    from public.pomodoro_sessions s
    where s.user_id = uid
      and s.status = 'completed'
      and s.was_completed
      and s.started_at >= ((p_today - 13)::timestamp at time zone p_timezone)
      and s.started_at < ((p_today + 1)::timestamp at time zone p_timezone)
    group by timezone(p_timezone, s.started_at)::date
  )
  select
    d.stat_date,
    coalesce(ds.completed_total, 0)::bigint,
    coalesce(ds.seconds_total, 0)::bigint,
    coalesce(ds.completed_for_task, 0)::bigint,
    coalesce(ds.seconds_for_task, 0)::bigint
  from days d
  left join daily_sessions ds on ds.stat_date = d.stat_date
  order by d.stat_date;
end;
$$;

revoke all on function public.pomodoro_daily_stats(date, text, uuid) from public;
grant execute on function public.pomodoro_daily_stats(date, text, uuid) to authenticated;

create or replace function public.active_habit_streaks(p_today date)
returns table (
  habit_id uuid,
  current_streak bigint,
  longest_streak bigint
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_today is null then
    raise exception 'Today is required';
  end if;

  return query
  with active_habits as (
    select h.id, h.starts_on, h.created_at
    from public.habits h
    where h.user_id = uid
      and h.archived_on is null
      and h.starts_on <= p_today
  ),
  valid_checkins as (
    select hc.habit_id, hc.completed_on
    from public.habit_checkins hc
    join active_habits h on h.id = hc.habit_id
    where hc.user_id = uid
      and hc.completed_on between h.starts_on and p_today
  ),
  grouped_checkins as (
    select
      vc.habit_id,
      vc.completed_on,
      vc.completed_on
        - row_number() over (
            partition by vc.habit_id
            order by vc.completed_on
          )::integer as streak_group
    from valid_checkins vc
  ),
  streaks as (
    select
      gc.habit_id,
      max(gc.completed_on) as streak_end,
      count(*)::bigint as streak_length
    from grouped_checkins gc
    group by gc.habit_id, gc.streak_group
  ),
  streak_bounds as (
    select
      h.id as habit_id,
      h.created_at,
      case
        when exists (
          select 1
          from valid_checkins vc
          where vc.habit_id = h.id
            and vc.completed_on = p_today
        ) then p_today
        else p_today - 1
      end as current_streak_end
    from active_habits h
  )
  select
    sb.habit_id,
    coalesce(
      max(s.streak_length) filter (
        where s.streak_end = sb.current_streak_end
      ),
      0
    )::bigint as current_streak,
    coalesce(max(s.streak_length), 0)::bigint as longest_streak
  from streak_bounds sb
  left join streaks s on s.habit_id = sb.habit_id
  group by sb.habit_id, sb.created_at, sb.current_streak_end
  order by sb.created_at desc;
end;
$$;

revoke all on function public.active_habit_streaks(date) from public;
grant execute on function public.active_habit_streaks(date) to authenticated;

create or replace function public.habit_stats(
  p_habit_id uuid,
  p_month_start date,
  p_month_end date,
  p_today date
)
returns table (
  current_streak bigint,
  completed_in_month bigint,
  eligible_days_in_month bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with selected_habit as (
    select h.starts_on, h.archived_on
    from public.habits h
    where h.id = p_habit_id
      and h.user_id = (select auth.uid())
  ),
  bounds as (
    select
      sh.starts_on,
      least(p_today, coalesce(sh.archived_on, p_today)) as effective_today,
      greatest(p_month_start, sh.starts_on) as eligible_month_start,
      least(
        p_month_end,
        p_today,
        coalesce(sh.archived_on, p_month_end)
      ) as eligible_month_end
    from selected_habit sh
  ),
  streak_bounds as (
    select
      b.*,
      case
        when exists (
          select 1
          from public.habit_checkins hc
          where hc.habit_id = p_habit_id
            and hc.completed_on = b.effective_today
        ) then b.effective_today
        else b.effective_today - 1
      end as current_streak_end
    from bounds b
  ),
  eligible_streak_days as (
    select sb.starts_on + day_offset as completed_on
    from streak_bounds sb
    cross join lateral generate_series(
      0,
      greatest(sb.current_streak_end - sb.starts_on, -1)
    ) as day_offset
  ),
  streak as (
    select coalesce(
      (
        select greatest(
          sb.current_streak_end
            - coalesce(
                max(esd.completed_on) filter (where hc.habit_id is null),
                sb.starts_on - 1
              ),
          0
        )::bigint
        from eligible_streak_days esd
        left join public.habit_checkins hc
          on hc.habit_id = p_habit_id
         and hc.completed_on = esd.completed_on
      ),
      0
    ) as current_streak
    from streak_bounds sb
  )
  select
    s.current_streak,
    case
      when sb.eligible_month_end < sb.eligible_month_start then 0::bigint
      else (
        select count(*)::bigint
        from public.habit_checkins hc
        where hc.habit_id = p_habit_id
          and hc.completed_on between sb.eligible_month_start and sb.eligible_month_end
      )
    end as completed_in_month,
    case
      when sb.eligible_month_end < sb.eligible_month_start then 0::bigint
      else (sb.eligible_month_end - sb.eligible_month_start + 1)::bigint
    end as eligible_days_in_month
  from streak_bounds sb
  cross join streak s;
$$;

revoke all on function public.habit_stats(uuid, date, date, date) from public;
grant execute on function public.habit_stats(uuid, date, date, date) to authenticated;
