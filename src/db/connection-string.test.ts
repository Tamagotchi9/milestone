import { expect, it } from 'vitest'
import { withVerifiedTls } from './connection-string'

it('upgrades sslmode=require to verify-full', () => {
  const url = withVerifiedTls(
    'postgresql://user:secret@host.neon.tech/neondb?sslmode=require',
  )

  expect(new URL(url).searchParams.get('sslmode')).toBe('verify-full')
})

it('keeps the other connection parameters', () => {
  const url = new URL(
    withVerifiedTls(
      'postgresql://user:p%40ss@host.neon.tech/neondb?channel_binding=require&sslmode=require',
    ),
  )

  expect(url.searchParams.get('channel_binding')).toBe('require')
  expect(url.password).toBe('p%40ss')
  expect(url.pathname).toBe('/neondb')
})
