import { ParseResult } from '@/types/tasks'
import { getString } from '@/lib/tasks/get-string'

export const parseTaskForm = (formData: FormData): ParseResult => {
  const title = getString(formData.get('title')).trim()

  if (!title)
    return {
      ok: false,
      errors: {
        title: 'Title is required',
      },
    }

  const description = getString(formData.get('description')).trim()

  return {
    ok: true,
    data: {
      title,
      description: description || null,
    },
  }
}
