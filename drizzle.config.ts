import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './drizzle/schema.ts',
  out: './drizzle',
  schemaFilter: ['public'],
  entities: { roles: { provider: 'neon' } },
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED! },
})
