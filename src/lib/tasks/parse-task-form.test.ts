import { describe, it, expect } from 'vitest'
import { parseTaskForm } from '@/lib/tasks/parse-task-form'

const buildFormData = (fields: Record<string, string | File>) => {
  const formData = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value)
  }
  return formData
}

const titleError = { ok: false, errors: { title: expect.any(String) } }

describe('parseTaskForm', () => {
  describe('title', () => {
    it('returns a title error if title is missing', () => {
      const result = parseTaskForm(buildFormData({}))

      expect(result).toEqual(titleError)
    })
    it.each([
      ['an empty string', ''],
      ['only whitespace', '   '],
      ['a File', new File(['x'], 'evil.txt')],
    ])('returns a title error if title is %s', (_, title) => {
      const result = parseTaskForm(buildFormData({ title }))

      expect(result).toEqual(titleError)
    })
    it('trims surrounding whitespace from title', () => {
      const result = parseTaskForm(buildFormData({ title: '  New Task  ' }))

      expect(result).toEqual({
        ok: true,
        data: { title: 'New Task', description: null },
      })
    })
  })

  describe('description', () => {
    it('returns description null if it is missing', () => {
      const result = parseTaskForm(buildFormData({ title: 'New Task' }))

      expect(result).toEqual({
        ok: true,
        data: { title: 'New Task', description: null },
      })
    })
    it.each([
      ['an empty string', ''],
      ['only whitespace', '   '],
      ['a File', new File(['x'], 'evil.txt')],
    ])('returns description null if it is %s', (_, description) => {
      const result = parseTaskForm(
        buildFormData({ title: 'New Task', description }),
      )

      expect(result).toEqual({
        ok: true,
        data: { title: 'New Task', description: null },
      })
    })
    it('trims surrounding whitespace from description', () => {
      const result = parseTaskForm(
        buildFormData({ title: 'New Task', description: '  Some details  ' }),
      )

      expect(result).toEqual({
        ok: true,
        data: { title: 'New Task', description: 'Some details' },
      })
    })
  })

  it('returns task data with title and description', () => {
    const result = parseTaskForm(
      buildFormData({ title: 'New Task', description: 'New Task description' }),
    )

    expect(result).toEqual({
      ok: true,
      data: { title: 'New Task', description: 'New Task description' },
    })
  })
})
