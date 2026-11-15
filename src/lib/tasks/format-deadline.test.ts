import { describe, it, expect } from 'vitest'
import { formatDeadline } from '@/lib/tasks/format-deadline'

describe('formatDeadline', () => {
  it('formats a date as DD.MM.YYYY', () => {
    expect(formatDeadline('2026-11-20')).toBe('20.11.2026')
  })
  it('keeps the first day of the month on that day', () => {
    expect(formatDeadline('2026-12-01')).toBe('01.12.2026')
  })
  it('returns the value unchanged if it is not a date', () => {
    expect(formatDeadline('soon')).toBe('soon')
  })
})
