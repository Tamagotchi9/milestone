begin;

create extension if not exists pgtap;

-- Rolled back with the test; lets the owner run as the app role below.
grant authenticated to current_user with inherit false, set true;

select plan(2);

insert into neon_auth."user" (id, name, email, "emailVerified")
values ('00000000-0000-0000-0000-000000000401', 'One', 'updated-at-one@example.com', true);

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000401"}';

-- now() is frozen for the whole transaction, so the task starts with an old
-- updated_at. After an update it must equal now(), the time of this test.
insert into public.tasks (id, title, updated_at)
values ('10000000-0000-0000-0000-000000000401', 'Before', '2000-01-01 00:00:00+00');

update public.tasks
set title = 'After'
where id = '10000000-0000-0000-0000-000000000401';

select is(
  (select updated_at from public.tasks where id = '10000000-0000-0000-0000-000000000401'),
  now(),
  'updating a task refreshes updated_at'
);

update public.tasks
set updated_at = '2000-01-01 00:00:00+00'
where id = '10000000-0000-0000-0000-000000000401';

select is(
  (select updated_at from public.tasks where id = '10000000-0000-0000-0000-000000000401'),
  now(),
  'updated_at cannot be set by the client'
);

select * from finish();

rollback;
