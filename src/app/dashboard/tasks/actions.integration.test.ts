import { describe, it, vi, beforeEach, expect, afterAll } from 'vitest'
import { refresh } from 'next/cache'
import { auth } from '@/lib/auth/server'
import {
  closeOwnerDb,
  createTestUser,
  deleteTestUsers,
} from '@/db/integration-fixtures'
import { withClaims } from '@/db/with-claims'
import { tasks } from '@/db/schema'
import type { NewTask } from '@/db/types'
import { deleteTask } from '@/app/dashboard/tasks/actions'

vi.mock('next/cache', () => ({
  refresh: vi.fn(),
}))

vi.mock('@/lib/auth/server', () => ({
  auth: { getSession: vi.fn() },
}))

type Session = Awaited<ReturnType<typeof auth.getSession>>

const signInAs = (userId: string) =>
  vi
    .mocked(auth.getSession)
    .mockResolvedValue({ data: { user: { id: userId } } } as Session)

const signOut = () =>
  vi.mocked(auth.getSession).mockResolvedValue({ data: null } as Session)

const insertTask = async (userId: string, values: NewTask) => {
  const [task] = await withClaims(userId, (tx) =>
    tx.insert(tasks).values(values).returning({ id: tasks.id }),
  )
  return task
}

const getTaskIds = (userId: string) =>
  withClaims(userId, (tx) => tx.select({ id: tasks.id }).from(tasks))

let alice: string
let bob: string

beforeEach(async () => {
  vi.clearAllMocks()
  signOut()

  alice = await createTestUser()
  bob = await createTestUser()
})

afterAll(async () => {
  await deleteTestUsers()
  await closeOwnerDb()
})

describe('Tasks server actions', () => {
  describe('deleteTask', () => {
    it('deletes own task and refreshes the page', async () => {
      const task = await insertTask(alice, { title: "Alice's task" })

      signInAs(alice)
      await deleteTask(task.id)

      expect(await getTaskIds(alice)).toEqual([])
      expect(refresh).toHaveBeenCalledOnce()
    })

    it('does not delete other user task', async () => {
      const task = await insertTask(alice, { title: "Alice's task" })

      signInAs(bob)
      await deleteTask(task.id)

      expect(await getTaskIds(alice)).toEqual([task])
    })

    it('deletes task and its subtasks', async () => {
      const mainTask = await insertTask(alice, { title: "Alice's main task" })
      await insertTask(alice, {
        title: "Subtask of Alice's main task",
        parentTaskId: mainTask.id,
      })
      expect(await getTaskIds(alice)).toHaveLength(2)

      signInAs(alice)
      await deleteTask(mainTask.id)

      expect(await getTaskIds(alice)).toEqual([])
    })

    it('deletes only subtask, not parent task', async () => {
      const mainTask = await insertTask(alice, { title: "Alice's main task" })
      const subtask = await insertTask(alice, {
        title: "Subtask of Alice's main task",
        parentTaskId: mainTask.id,
      })

      signInAs(alice)
      await deleteTask(subtask.id)

      expect(await getTaskIds(alice)).toEqual([mainTask])
    })

    it.each([
      ['a non-uuid string', 'abc'],
      ['a number', 42],
      ['undefined', undefined],
    ])(
      'ignores %s as id without touching the database',
      async (_, invalidId) => {
        const task = await insertTask(alice, { title: "Alice's task" })

        signInAs(alice)
        await deleteTask(invalidId)

        expect(await getTaskIds(alice)).toEqual([task])
        expect(auth.getSession).not.toHaveBeenCalled()
        expect(refresh).not.toHaveBeenCalled()
      },
    )

    it('throws for a signed out user and keeps the task', async () => {
      const task = await insertTask(alice, { title: "Alice's task" })

      await expect(deleteTask(task.id)).rejects.toThrow(/without a session/)

      expect(await getTaskIds(alice)).toEqual([task])
      expect(refresh).not.toHaveBeenCalled()
    })
  })
})
