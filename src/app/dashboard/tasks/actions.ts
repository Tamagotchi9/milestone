'use server'

import { withUserDb } from '@/db/with-user-db'
import { tasks } from '@/db/schema'
import { refresh } from 'next/cache'
import { parseTaskForm } from '@/lib/tasks/parse-task-form'
import { CreateTaskState } from '@/types/tasks'
import { getString } from '@/lib/tasks/get-string'
import { initialCreateTaskState } from '@/lib/tasks/initial-create-task-state'
import { eq } from 'drizzle-orm'
import { isUuid } from '@/lib/is-uuid'

export const createTask = async (
  _prevState: CreateTaskState,
  formData: FormData,
): Promise<CreateTaskState> => {
  const parsedFormData = parseTaskForm(formData)

  if (!parsedFormData.ok)
    return {
      status: 'error',
      errors: parsedFormData.errors,
      values: {
        title: getString(formData.get('title')),
        description: getString(formData.get('description')),
      },
    }
  await withUserDb(
    async (tx) => await tx.insert(tasks).values(parsedFormData.data),
  )
  refresh()
  return {
    ...initialCreateTaskState,
    status: 'success',
  }
}

export const deleteTask = async (id: unknown) => {
  if (!isUuid(id)) return
  await withUserDb((tx) => tx.delete(tasks).where(eq(tasks.id, id)))
  refresh()
}
