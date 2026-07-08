-- Delete subtasks automatically when a parent task is removed.

alter table public.tasks
  drop constraint tasks_parent_task_id_fkey;

alter table public.tasks
  add constraint tasks_parent_task_id_fkey
  foreign key (parent_task_id)
  references public.tasks (id)
  on delete cascade;
