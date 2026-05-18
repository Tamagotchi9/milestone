export type TaskPriority = 'low' | 'medium' | 'high'

/** Matches `public.tasks_status` in Postgres */
export type TaskStatus =
  | 'created'
  | 'in_progress'
  | 'completed'
  | 'on_hold'
  | 'blocked'
  | 'abandoned'

export type TaskSubtask = {
  id: string
  title: string
  completed: boolean
}

export type TaskItem = {
  id: string
  title: string
  description: string
  priority: TaskPriority
  deadline: string | null
  createdAt: string
  subtasks: TaskSubtask[]
}

export type CreateTaskPayload = {
  title: string
  description?: string
  priority: TaskPriority
  deadline?: string | null
}
