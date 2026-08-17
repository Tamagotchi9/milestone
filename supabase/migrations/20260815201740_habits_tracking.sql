-- Daily habits with owner-scoped check-ins and calendar statistics.

create extension if not exists pgcrypto;

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
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

  if old.archived_on is not null
    and new.archived_on is distinct from old.archived_on then
    raise exception 'Archived habits cannot be restored';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger habits_guard_update
  before update on public.habits
  for each row
  execute function public.habits_guard_update();

revoke all on function public.habits_guard_update() from public;

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

revoke all on public.habits, public.habit_checkins from anon;
grant select, insert, update on public.habits to authenticated;
grant select, insert, delete on public.habit_checkins to authenticated;

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
  eligible_streak_days as (
    select b.starts_on + day_offset as completed_on
    from bounds b
    cross join lateral generate_series(
      0,
      greatest(b.effective_today - b.starts_on, -1)
    ) as day_offset
  ),
  streak as (
    select coalesce(
      (
        select (
          b.effective_today
          - coalesce(
              max(esd.completed_on) filter (where hc.habit_id is null),
              b.starts_on - 1
            )
        )::bigint
        from eligible_streak_days esd
        left join public.habit_checkins hc
          on hc.habit_id = p_habit_id
         and hc.completed_on = esd.completed_on
      ),
      0
    ) as current_streak
    from bounds b
  )
  select
    s.current_streak,
    case
      when b.eligible_month_end < b.eligible_month_start then 0::bigint
      else (
        select count(*)::bigint
        from public.habit_checkins hc
        where hc.habit_id = p_habit_id
          and hc.completed_on between b.eligible_month_start and b.eligible_month_end
      )
    end as completed_in_month,
    case
      when b.eligible_month_end < b.eligible_month_start then 0::bigint
      else (b.eligible_month_end - b.eligible_month_start + 1)::bigint
    end as eligible_days_in_month
  from bounds b
  cross join streak s;
$$;

revoke all on function public.habit_stats(uuid, date, date, date) from public;
grant execute on function public.habit_stats(uuid, date, date, date) to authenticated;
