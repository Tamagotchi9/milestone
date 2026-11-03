import 'server-only'
import { attachDatabasePool } from '@vercel/functions'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { withVerifiedTls } from '@/db/connection-string'

const connectionString = process.env.DATABASE_AUTHENTICATED_URL

// pg silently falls back to PG* variables, which could bypass RLS.
if (!connectionString) {
  throw new Error('DATABASE_AUTHENTICATED_URL is not set')
}

const pool = new Pool({ connectionString: withVerifiedTls(connectionString) })

pool.on('error', (error) => {
  console.error('Unexpected Postgres pool error', error)
})

attachDatabasePool(pool)

export const db = drizzle({ client: pool })
