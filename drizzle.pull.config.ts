import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'
import { withVerifiedTls } from './src/db/connection-string'

// Generates TypeScript from the live schema. SQL migrations in drizzle/ stay the source of truth.
export default defineConfig({
  dialect: 'postgresql',
  out: './.drizzle-pull',
  schemaFilter: ['public', 'neon_auth'],
  tablesFilter: [
    'tasks',
    'habits',
    'habit_checkins',
    'pomodoro_sessions',
    'user',
  ],
  dbCredentials: { url: withVerifiedTls(process.env.DATABASE_URL_UNPOOLED!) },
})
