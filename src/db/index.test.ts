// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

it('refuses to start without the app role connection string', async () => {
  vi.stubEnv('DATABASE_AUTHENTICATED_URL', '')

  await expect(import('./index')).rejects.toThrow(
    'DATABASE_AUTHENTICATED_URL is not set',
  )
})
