import fs from 'node:fs'
import { config, parse } from 'dotenv'
import { vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { error } = config({
  path: '.env.integration',
  override: true,
  quiet: true,
})
if (error) {
  throw new Error('.env.integration is missing, see .env.example')
}

// Guard against a copy-paste mistake that would point the tests at production.
const production = parse(fs.readFileSync('.env'))
for (const key of ['DATABASE_AUTHENTICATED_URL', 'DATABASE_URL_UNPOOLED']) {
  const testHost = new URL(process.env[key]!).hostname
  if (production[key] && new URL(production[key]).hostname === testHost) {
    throw new Error(`${key} in .env.integration points at production`)
  }
}
