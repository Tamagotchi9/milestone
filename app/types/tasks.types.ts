export type TaskPriority = 'low' | 'medium' | 'high'

export type TaskSort = 'deadline' | 'priority'

export const TASK_PRIORITY_RANK: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

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

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  created: 'To do',
  in_progress: 'In progress',
  completed: 'Completed',
  on_hold: 'On hold',
  blocked: 'Blocked',
  abandoned: 'Abandoned',
}

export const TASK_BOARD_STATUSES = [
  TASK_STATUS.CREATED,
  TASK_STATUS.IN_PROGRESS,
  TASK_STATUS.ON_HOLD,
  TASK_STATUS.BLOCKED,
  TASK_STATUS.ABANDONED,
] as const

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
