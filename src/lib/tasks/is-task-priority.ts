import type { Task } from '@/db/types'
import { TASK_PRIORITY_LABEL } from '@/lib/tasks/labels'

export const isTaskPriority = (value: unknown): value is Task['priority'] =>
  Object.keys(TASK_PRIORITY_LABEL).some((priority) => priority === value)
