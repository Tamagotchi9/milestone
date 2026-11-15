import { NewTask } from '@/db/types'

export type TaskFieldErrors = Partial<Record<'title' | 'description', string>>
export type TaskFieldValues = {
  title: string
  description: string
}

export type ParseResult =
  | { ok: true; data: Pick<NewTask, 'title' | 'description'> }
  | { ok: false; errors: TaskFieldErrors }

export type CreateTaskState = {
  status: 'idle' | 'success' | 'error'
  errors: TaskFieldErrors
  values: TaskFieldValues
}
