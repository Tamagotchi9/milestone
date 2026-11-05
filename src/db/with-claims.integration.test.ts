import { describe, it, afterAll, beforeEach, expect } from 'vitest'
import {
  createTestUser,
  closeOwnerDb,
  deleteTestUsers,
} from '@/db/integration-fixtures'
import { withClaims } from '@/db/with-claims'
import { tasks } from '@/db/schema'
import { db } from '@/db'
import { sql } from 'drizzle-orm'

let alice: string
let bob: string

beforeEach(async () => {
  alice = await createTestUser()
  bob = await createTestUser()
})

afterAll(async () => {
  await deleteTestUsers()
  await closeOwnerDb()
})

describe('withClaims', () => {
  it('isolates users with RLS', async () => {
    await withClaims(alice, (tx) =>
      tx.insert(tasks).values({ title: 'Alice task' }),
    )
    const aliceTasks = await withClaims(alice, (tx) => tx.select().from(tasks))
    const bobTasks = await withClaims(bob, (tx) => tx.select().from(tasks))

    expect(aliceTasks).toHaveLength(1)
    expect(bobTasks).toHaveLength(0)
  })

  it('does not leak claims outside the transaction', async () => {
    await withClaims(alice, async () => {})
    const { rows } = await db.execute(sql`select auth.uid() as uid`)

    expect(rows).toEqual([{ uid: null }])
  })

  it('rolls the transaction back when fn throws', async () => {
    await expect(
      withClaims(alice, async (tx) => {
        await tx.insert(tasks).values({ title: 'Alice task' })
        throw new Error('Something went wrong')
      }),
    ).rejects.toThrow('Something went wrong')
    const aliceTasks = await withClaims(alice, (tx) => tx.select().from(tasks))

    expect(aliceTasks).toHaveLength(0)
  })

  it('lets users create tasks only for themselves', async () => {
    const [task] = await withClaims(alice, (tx) =>
      tx
        .insert(tasks)
        .values({ title: 'Alice task', userId: bob })
        .returning({ userId: tasks.userId }),
    )

    expect(task.userId).toBe(alice)
  })
})
