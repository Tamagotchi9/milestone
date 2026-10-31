-- Foreign key checks bypass RLS, so links between tasks and sessions must also
-- match on the owner. Otherwise a user could link to, and probe for, another user's task.
alter table public.tasks
  add constraint tasks_id_user_id_key unique (id, user_id);

alter table public.tasks
  drop constraint tasks_parent_task_id_fkey,
  add constraint tasks_parent_task_id_fkey
    foreign key (parent_task_id, user_id)
    references public.tasks (id, user_id)
    on delete cascade;

alter table public.pomodoro_sessions
  drop constraint pomodoro_sessions_task_id_fkey,
  add constraint pomodoro_sessions_task_id_fkey
    foreign key (task_id, user_id)
    references public.tasks (id, user_id)
    on delete set null (task_id);
