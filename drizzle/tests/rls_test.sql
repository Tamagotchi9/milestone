begin;

create extension if not exists pgtap;

-- Rolled back with the test; lets the owner run as the app role below.
grant authenticated to current_user with inherit false, set true;

select plan(23);

insert into neon_auth."user" (id, name, email, "emailVerified")
values
  ('00000000-0000-0000-0000-000000000301', 'One', 'rls-one@example.com', true),
  ('00000000-0000-0000-0000-000000000302', 'Two', 'rls-two@example.com', true);

set local role authenticated;

-- No identity
set local "request.jwt.claims" = '';

select is(auth.uid(), null, 'auth.uid() is null without claims');

select throws_ok(
  $$ insert into public.tasks (title) values ('No owner') $$,
  'Not authenticated',
  'tasks cannot be created without an identity'
);

-- First user
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000301"}';

select is(
  auth.uid(),
  '00000000-0000-0000-0000-000000000301'::uuid,
  'auth.uid() reads the sub claim'
);

insert into public.tasks (id, title, user_id)
values (
  '10000000-0000-0000-0000-000000000301',
  'Owner comes from the JWT',
  '00000000-0000-0000-0000-000000000302'
);

select is(
  (select user_id from public.tasks where id = '10000000-0000-0000-0000-000000000301'),
  '00000000-0000-0000-0000-000000000301'::uuid,
  'a client supplied user_id is ignored on insert'
);

update public.tasks
set user_id = '00000000-0000-0000-0000-000000000302'
where id = '10000000-0000-0000-0000-000000000301';

select is(
  (select user_id from public.tasks where id = '10000000-0000-0000-0000-000000000301'),
  '00000000-0000-0000-0000-000000000301'::uuid,
  'task ownership cannot be changed'
);

insert into public.habits (id, name, starts_on)
values ('20000000-0000-0000-0000-000000000301', 'Read', '2026-09-01');

insert into public.habit_checkins (habit_id, completed_on)
values ('20000000-0000-0000-0000-000000000301', '2026-09-02');

insert into public.pomodoro_sessions (id, task_id)
values (
  '30000000-0000-0000-0000-000000000301',
  '10000000-0000-0000-0000-000000000301'
);

insert into public.tasks (id, title)
values ('10000000-0000-0000-0000-000000000302', 'Removed task');

insert into public.pomodoro_sessions (id, task_id)
values (
  '30000000-0000-0000-0000-000000000302',
  '10000000-0000-0000-0000-000000000302'
);

delete from public.tasks where id = '10000000-0000-0000-0000-000000000302';

select is(
  (select task_id from public.pomodoro_sessions where id = '30000000-0000-0000-0000-000000000302'),
  null,
  'deleting a task keeps its session and clears the link'
);

-- Second user
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000302"}';

select is_empty($$ select * from public.tasks $$, 'other users tasks are hidden');
select is_empty($$ select * from public.habits $$, 'other users habits are hidden');
select is_empty($$ select * from public.habit_checkins $$, 'other users check-ins are hidden');
select is_empty($$ select * from public.pomodoro_sessions $$, 'other users sessions are hidden');

select is_empty(
  $$
    update public.tasks set title = 'Hacked'
    where id = '10000000-0000-0000-0000-000000000301'
    returning id
  $$,
  'other users tasks cannot be updated'
);

select is_empty(
  $$
    delete from public.tasks
    where id = '10000000-0000-0000-0000-000000000301'
    returning id
  $$,
  'other users tasks cannot be deleted'
);

select throws_ok(
  $$
    insert into public.habit_checkins (habit_id, completed_on)
    values ('20000000-0000-0000-0000-000000000301', '2026-09-03')
  $$,
  '42501',
  null,
  'check-ins cannot be added to another users habit'
);

select is_empty(
  $$
    delete from public.habit_checkins
    where habit_id = '20000000-0000-0000-0000-000000000301'
    returning habit_id
  $$,
  'other users check-ins cannot be deleted'
);

select is_empty(
  $$
    update public.habits set name = 'Hacked'
    where id = '20000000-0000-0000-0000-000000000301'
    returning id
  $$,
  'other users habits cannot be updated'
);

select throws_ok(
  $$
    insert into public.habits (name, starts_on, user_id)
    values ('Spoofed', '2026-09-01', '00000000-0000-0000-0000-000000000301')
  $$,
  '42501',
  null,
  'habits cannot be created for another user'
);

select is_empty(
  $$
    update public.pomodoro_sessions set duration_minutes = 1
    where id = '30000000-0000-0000-0000-000000000301'
    returning id
  $$,
  'other users sessions cannot be updated'
);

select is_empty(
  $$
    delete from public.pomodoro_sessions
    where id = '30000000-0000-0000-0000-000000000301'
    returning id
  $$,
  'other users sessions cannot be deleted'
);

select throws_ok(
  $$
    insert into public.tasks (title, parent_task_id)
    values ('Linked', '10000000-0000-0000-0000-000000000301')
  $$,
  '23503',
  null,
  'subtasks cannot be attached to another users task'
);

select throws_ok(
  $$
    insert into public.pomodoro_sessions (task_id)
    values ('10000000-0000-0000-0000-000000000301')
  $$,
  '23503',
  null,
  'sessions cannot be linked to another users task'
);

reset role;

select ok(
  pg_has_role('authenticated_backend', 'authenticated', 'member'),
  'the app login role is a member of authenticated'
);

select ok(
  not (select rolbypassrls from pg_roles where rolname = 'authenticated_backend'),
  'the app login role does not bypass RLS'
);

-- Deleting the auth user removes everything they own
delete from neon_auth."user" where id = '00000000-0000-0000-0000-000000000301';

select results_eq(
  $$
    select
      (select count(*) from public.tasks where user_id = '00000000-0000-0000-0000-000000000301'),
      (select count(*) from public.habits where user_id = '00000000-0000-0000-0000-000000000301'),
      (select count(*) from public.habit_checkins where user_id = '00000000-0000-0000-0000-000000000301'),
      (select count(*) from public.pomodoro_sessions where user_id = '00000000-0000-0000-0000-000000000301')
  $$,
  $$ values (0::bigint, 0::bigint, 0::bigint, 0::bigint) $$,
  'deleting a user cascades to their data'
);

select * from finish();

rollback;
