import { describe, it, expect } from 'vitest'
import { getUserInitials } from '@/lib/user-initials'

describe('getUserInitials', () => {
  it.each([
    {
      case: 'Whitespace in the middle between name and surname has',
      input: 'Jimmy Neutron',
      expected: 'JN',
    },
    {
      case: '2+ whitespaces in the middle between name and surname have',
      input: 'Jimmy   Neutron',
      expected: 'JN',
    },
    {
      case: 'Whitespaces on both ends have',
      input: ' Jimmy   Neutron ',
      expected: 'JN',
    },
    {
      case: 'Name with middlename has',
      input: 'Jimmy Neutron Junior',
      expected: 'JN',
    },
    {
      case: 'Name without whitespaces has',
      input: 'a,b,,c',
      expected: 'A',
    },
    {
      case: 'Single word name has',
      input: 'Jimmy',
      expected: 'J',
    },
    {
      case: 'Tab between name and surname has',
      input: 'Jimmy\tNeutron',
      expected: 'JN',
    },
    {
      case: 'Lowercase name has',
      input: 'jimmy neutron',
      expected: 'JN',
    },
    {
      case: 'Cyrillic name has',
      input: 'олег ткач',
      expected: 'ОТ',
    },
    {
      case: 'Email used as a fallback has',
      input: 'jimmy@example.com',
      expected: 'J',
    },
    {
      case: 'Empty string has',
      input: '',
      expected: '',
    },
    {
      case: 'Whitespace only has',
      input: '   ',
      expected: '',
    },
  ])('$case to be $expected', ({ input, expected }) => {
    const initials = getUserInitials(input)

    expect(initials).toBe(expected)
  })
})
