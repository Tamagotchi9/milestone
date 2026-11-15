import { describe, it, expect } from 'vitest'
import { getString } from '@/lib/tasks/get-string'

describe('getString', () => {
  it('returns the string as is', () => {
    expect(getString('  New Task  ')).toBe('  New Task  ')
  })
  it.each([
    ['null (missing form field)', null],
    ['undefined', undefined],
    ['a File', new File(['x'], 'evil.txt')],
    ['a number', 42],
  ])('returns an empty string for %s', (_, value) => {
    expect(getString(value)).toBe('')
  })
  it('reads a missing field from FormData as an empty string', () => {
    const formData = new FormData()

    expect(getString(formData.get('title'))).toBe('')
  })
})
