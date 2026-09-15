-- Daily focus trends and active-habit streaks for the dashboard.

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
