import { randomUUID } from 'node:crypto'
import { like } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { withVerifiedTls } from '@/db/connection-string'
import { userInNeonAuth } from '@/db/schema'

// Integration tests only. The app role cannot write neon_auth."user", so test
// users are created by the owner. Tasks are not: the insert trigger needs claims,
// so tests create them through withClaims, the same way the app does.
const ownerPool = new Pool({
  connectionString: withVerifiedTls(process.env.DATABASE_URL_UNPOOLED!),
})
const ownerDb = drizzle({ client: ownerPool })

const TEST_EMAIL_DOMAIN = '@integration.test'

export const createTestUser = async () => {
  const id = randomUUID()
  await ownerDb.insert(userInNeonAuth).values({
    id,
    name: 'Integration Test',
    email: `${id}${TEST_EMAIL_DOMAIN}`,
    emailVerified: true,
  })
  return id
}

// Matching on the domain also removes users left behind by a crashed run.
// Their tasks go with them through on delete cascade.
export const deleteTestUsers = () =>
  ownerDb
    .delete(userInNeonAuth)
    .where(like(userInNeonAuth.email, `%${TEST_EMAIL_DOMAIN}`))

export const closeOwnerDb = () => ownerPool.end()
