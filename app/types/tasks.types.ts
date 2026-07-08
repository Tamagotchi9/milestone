export type TaskPriority = 'low' | 'medium' | 'high'

/** Matches `public.tasks_status` in Postgres */
export type TaskStatus =
  | 'created'
  | 'in_progress'
  | 'completed'
  | 'on_hold'
  | 'blocked'
  | 'abandoned'

export type TaskSubtask = Pick<TaskItem, 'id' | 'title' | 'status'>

export type TaskItem = {
  id: string
  title: string
  description: string
  priority: TaskPriority
  deadline: string | null
  createdAt: string
  status: TaskStatus
  subtasks: TaskSubtask[]
}

export type CreateTaskDTO = {
  title: string
  description?: string
  priority?: TaskPriority
  deadline?: string | null
  parentTaskId?: string | null
}
