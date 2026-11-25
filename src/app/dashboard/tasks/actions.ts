'use server'

import { withUserDb } from '@/db/with-user-db'
import { tasks } from '@/db/schema'
import { refresh } from 'next/cache'
import { parseTaskForm } from '@/lib/tasks/parse-task-form'
import { TaskFormState } from '@/types/tasks'
import { getString } from '@/lib/tasks/get-string'
import { initialCreateTaskState } from '@/lib/tasks/initial-create-task-state'
import { eq } from 'drizzle-orm'
import { isUuid } from '@/lib/is-uuid'
import { isTaskPriority } from '@/lib/tasks/is-task-priority'

export const createTask = async (
  _prevState: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> => {
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
    ...initialCreateTaskState({}),
    status: 'success',
  }
}

export const updateTask = async (
  id: unknown,
  _prevState: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> => {
  if (!isUuid(id)) {
    throw new Error('Invalid task id')
  }

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

  await withUserDb((tx) =>
    tx.update(tasks).set(parsedFormData.data).where(eq(tasks.id, id)),
  )
  refresh()
  return {
    ...initialCreateTaskState({
      title: parsedFormData.data.title,
      description: parsedFormData.data.description ?? '',
    }),
    status: 'success',
  }
}

export const deleteTask = async (id: unknown) => {
  if (!isUuid(id)) return
  await withUserDb((tx) => tx.delete(tasks).where(eq(tasks.id, id)))
  refresh()
}

export const updateTaskPriority = async (id: unknown, newPriority: unknown) => {
  if (!isUuid(id)) {
    throw new Error('Invalid task id')
  }
  if (!isTaskPriority(newPriority)) {
    throw new Error('Invalid priority')
  }
  await withUserDb((tx) =>
    tx.update(tasks).set({ priority: newPriority }).where(eq(tasks.id, id)),
  )
  refresh()
}
