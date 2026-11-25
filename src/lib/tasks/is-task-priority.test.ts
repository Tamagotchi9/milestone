import { describe, it, expect } from 'vitest'
import { isTaskPriority } from '@/lib/tasks/is-task-priority'

describe('isTaskPriority', () => {
  it.each(['low', 'medium', 'high'])('accepts %s', (value) => {
    expect(isTaskPriority(value)).toBe(true)
  })
  it.each([
    ['an unknown priority', 'urgent'],
    ['an uppercase priority', 'HIGH'],
    ['a priority with surrounding whitespace', ' high '],
    ['an empty string', ''],
    ['a number', 42],
    ['null', null],
    ['undefined', undefined],
    ['an array with a priority', ['high']],
    ['toString', 'toString'],
  ])('rejects %s', (_, value) => {
    expect(isTaskPriority(value)).toBe(false)
  })
})
