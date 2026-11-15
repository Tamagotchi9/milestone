import type { Task } from '@/db/types'

export const TASK_PRIORITY_LABEL: Record<Task['priority'], string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export const TASK_STATUS_LABEL: Record<Task['status'], string> = {
  created: 'To do',
  in_progress: 'In progress',
  completed: 'Completed',
  on_hold: 'On hold',
  blocked: 'Blocked',
  abandoned: 'Abandoned',
}
