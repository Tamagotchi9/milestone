import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'
import { withVerifiedTls } from './src/db/connection-string'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: withVerifiedTls(process.env.DATABASE_URL_UNPOOLED!) },
})
