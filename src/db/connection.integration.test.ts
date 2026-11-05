import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { db } from '@/db'

describe('app database connection', () => {
  it('connects as the app role, which cannot bypass RLS', async () => {
    const { rows } = await db.execute(sql`
      select current_user as role, rolbypassrls as bypasses_rls
      from pg_roles
      where rolname = current_user
    `)

    expect(rows).toEqual([
      { role: 'authenticated_backend', bypasses_rls: false },
    ])
  })

  it('has no user identity until claims are set', async () => {
    const { rows } = await db.execute(sql`select auth.uid() as uid`)

    expect(rows).toEqual([{ uid: null }])
  })
})
