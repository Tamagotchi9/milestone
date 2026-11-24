import { TaskFormState } from '@/types/tasks'

interface InitialValues {
  title?: string
  description?: string | null
}

export const initialCreateTaskState = ({
  title = '',
  description = '',
}: InitialValues): TaskFormState => ({
  status: 'idle',
  errors: {},
  values: { title, description: description ?? '' },
})
