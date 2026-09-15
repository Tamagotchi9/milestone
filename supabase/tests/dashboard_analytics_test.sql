begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-000000000101', 'analytics-one@example.com'),
  ('00000000-0000-0000-0000-000000000102', 'analytics-two@example.com');

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000101';

insert into public.tasks (id, title)
values
  ('10000000-0000-0000-0000-000000000101', 'Focused task'),
  ('10000000-0000-0000-0000-000000000102', 'Other task');

insert into public.pomodoro_sessions (
  task_id,
  started_at,
  completed_at,
  status,
  was_completed,
  actual_seconds
)
values
  (
    '10000000-0000-0000-0000-000000000101',
    '2026-09-14 03:30:00+00',
    '2026-09-14 03:40:00+00',
    'completed',
    true,
    600
  ),
  (
    '10000000-0000-0000-0000-000000000101',
    '2026-09-14 04:30:00+00',
    '2026-09-14 04:55:00+00',
    'completed',
    true,
    1500
  ),
  (
    '10000000-0000-0000-0000-000000000102',
    '2026-09-14 12:00:00+00',
    '2026-09-14 12:15:00+00',
    'completed',
    true,
    900
  ),
  (
    '10000000-0000-0000-0000-000000000102',
    '2026-09-14 14:00:00+00',
    '2026-09-14 14:05:00+00',
    'abandoned',
    false,
    300
  );

insert into public.habits (id, name, starts_on, created_at)
values
  (
    '20000000-0000-0000-0000-000000000101',
    'Read',
    '2026-09-08',
    '2026-09-08 08:00:00+00'
  ),
  (
    '20000000-0000-0000-0000-000000000102',
    'Meditate',
    '2026-09-14',
    '2026-09-14 08:00:00+00'
  ),
  (
    '20000000-0000-0000-0000-000000000103',
    'Exercise',
    '2026-09-12',
    '2026-09-12 08:00:00+00'
  ),
  (
    '20000000-0000-0000-0000-000000000104',
    'Archived habit',
    '2026-09-01',
    '2026-09-01 08:00:00+00'
  );

update public.habits
set archived_on = '2026-09-10'
where id = '20000000-0000-0000-0000-000000000104';

insert into public.habit_checkins (habit_id, completed_on)
values
  ('20000000-0000-0000-0000-000000000101', '2026-09-08'),
  ('20000000-0000-0000-0000-000000000101', '2026-09-09'),
  ('20000000-0000-0000-0000-000000000101', '2026-09-10'),
  ('20000000-0000-0000-0000-000000000101', '2026-09-12'),
  ('20000000-0000-0000-0000-000000000101', '2026-09-13'),
  ('20000000-0000-0000-0000-000000000103', '2026-09-12'),
  ('20000000-0000-0000-0000-000000000103', '2026-09-13'),
  ('20000000-0000-0000-0000-000000000103', '2026-09-14');

reset role;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000102';
set local role authenticated;

insert into public.pomodoro_sessions (
  started_at,
  completed_at,
  status,
  was_completed,
  actual_seconds
)
values (
  '2026-09-14 12:00:00+00',
  '2026-09-14 12:25:00+00',
  'completed',
  true,
  1500
);

insert into public.habits (id, name, starts_on)
values (
  '20000000-0000-0000-0000-000000000201',
  'Another user habit',
  '2026-09-01'
);

reset role;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000101';
set local role authenticated;

select results_eq(
  $$
    select count(*)
    from public.pomodoro_daily_stats(
      '2026-09-14',
      'America/New_York',
      '10000000-0000-0000-0000-000000000101'
    )
  $$,
  $$ values (14::bigint) $$,
  'daily focus stats always return fourteen days'
);

select results_eq(
  $$
    select completed_total, seconds_total
    from public.pomodoro_daily_stats(
      '2026-09-14',
      'America/New_York',
      '10000000-0000-0000-0000-000000000101'
    )
    where stat_date = '2026-09-01'
  $$,
  $$ values (0::bigint, 0::bigint) $$,
  'days without sessions are zero filled'
);

select results_eq(
  $$
    select completed_total, seconds_total
    from public.pomodoro_daily_stats(
      '2026-09-14',
      'America/New_York',
      '10000000-0000-0000-0000-000000000101'
    )
    where stat_date = '2026-09-13'
  $$,
  $$ values (1::bigint, 600::bigint) $$,
  'sessions are grouped by the requested local time zone'
);

select results_eq(
  $$
    select
      completed_total,
      seconds_total,
      completed_for_task,
      seconds_for_task
    from public.pomodoro_daily_stats(
      '2026-09-14',
      'America/New_York',
      '10000000-0000-0000-0000-000000000101'
    )
    where stat_date = '2026-09-14'
  $$,
  $$ values (2::bigint, 2400::bigint, 1::bigint, 1500::bigint) $$,
  'daily totals are owner scoped and include the focused task breakdown'
);

select results_eq(
  $$
    select count(*)
    from public.active_habit_streaks('2026-09-14')
  $$,
  $$ values (3::bigint) $$,
  'active streaks exclude archived habits and other users'
);

select results_eq(
  $$
    select current_streak, longest_streak
    from public.active_habit_streaks('2026-09-14')
    where habit_id = '20000000-0000-0000-0000-000000000101'
  $$,
  $$ values (2::bigint, 3::bigint) $$,
  'an incomplete current day preserves the streak through yesterday'
);

select results_eq(
  $$
    select current_streak, longest_streak
    from public.active_habit_streaks('2026-09-14')
    where habit_id = '20000000-0000-0000-0000-000000000103'
  $$,
  $$ values (3::bigint, 3::bigint) $$,
  'a current-day check-in extends the current streak'
);

select results_eq(
  $$
    select current_streak, longest_streak
    from public.active_habit_streaks('2026-09-14')
    where habit_id = '20000000-0000-0000-0000-000000000102'
  $$,
  $$ values (0::bigint, 0::bigint) $$,
  'a new habit without check-ins has zero streaks'
);

select results_eq(
  $$
    select current_streak
    from public.habit_stats(
      '20000000-0000-0000-0000-000000000101',
      '2026-09-01',
      '2026-09-30',
      '2026-09-14'
    )
  $$,
  $$ values (2::bigint) $$,
  'calendar stats use the same current-day grace period'
);

select * from finish();
rollback;
