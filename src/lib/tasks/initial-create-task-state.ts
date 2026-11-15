import { CreateTaskState } from '@/types/tasks'

export const initialCreateTaskState: CreateTaskState = {
  status: 'idle',
  errors: {},
  values: { title: '', description: '' },
}
