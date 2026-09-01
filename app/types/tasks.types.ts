export type TaskPriority = 'low' | 'medium' | 'high'

export type TaskSort = 'deadline' | 'priority'

/** Matches `public.tasks_status` in Postgres */
export const TASK_STATUS = {
  CREATED: 'created',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  ON_HOLD: 'on_hold',
  BLOCKED: 'blocked',
  ABANDONED: 'abandoned',
} as const

export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS]

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
