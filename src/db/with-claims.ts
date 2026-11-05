import { db } from '@/db/index'
import { sql } from 'drizzle-orm'

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

export const withClaims = async <T>(
  userId: string,
  fn: (tx: Transaction) => Promise<T>,
) => {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId })}, true)`,
    )
    return fn(tx)
  })
}
