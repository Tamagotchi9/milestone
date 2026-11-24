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
import { deleteTask, updateTask } from '@/app/dashboard/tasks/actions'
import { initialCreateTaskState } from '@/lib/tasks/initial-create-task-state'
import { eq } from 'drizzle-orm'

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

const getTaskFields = async (userId: string, id: string) => {
  const [task] = await withClaims(userId, (tx) =>
    tx
      .select({ title: tasks.title, description: tasks.description })
      .from(tasks)
      .where(eq(tasks.id, id)),
  )
  return task
}

const buildFormData = (fields: Record<string, string>) => {
  const formData = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value)
  }
  return formData
}

const idleState = initialCreateTaskState({})

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

  describe('updateTask', () => {
    const original = { title: "Alice's task", description: 'Old description' }

    it('updates own task, refreshes the page and returns the saved values', async () => {
      const task = await insertTask(alice, original)

      signInAs(alice)
      const result = await updateTask(
        task.id,
        idleState,
        buildFormData({
          title: '  New title  ',
          description: 'New description',
        }),
      )

      expect(await getTaskFields(alice, task.id)).toEqual({
        title: 'New title',
        description: 'New description',
      })
      expect(result).toEqual({
        status: 'success',
        errors: {},
        values: { title: 'New title', description: 'New description' },
      })
      expect(refresh).toHaveBeenCalledOnce()
    })

    it('saves an empty description as null', async () => {
      const task = await insertTask(alice, original)

      signInAs(alice)
      const result = await updateTask(
        task.id,
        idleState,
        buildFormData({ title: "Alice's task", description: '   ' }),
      )

      expect(await getTaskFields(alice, task.id)).toEqual({
        title: "Alice's task",
        description: null,
      })
      expect(result.values.description).toBe('')
    })

    it('updates only the given task', async () => {
      const task = await insertTask(alice, original)
      const otherTask = await insertTask(alice, {
        title: "Alice's other task",
        description: null,
      })

      signInAs(alice)
      await updateTask(
        task.id,
        idleState,
        buildFormData({ title: 'New title' }),
      )

      expect(await getTaskFields(alice, otherTask.id)).toEqual({
        title: "Alice's other task",
        description: null,
      })
    })

    it('does not update other user task', async () => {
      const task = await insertTask(alice, original)

      signInAs(bob)
      await updateTask(
        task.id,
        idleState,
        buildFormData({ title: "Bob's title", description: "Bob's text" }),
      )

      expect(await getTaskFields(alice, task.id)).toEqual(original)
    })

    it('returns a title error with the submitted values and keeps the task', async () => {
      const task = await insertTask(alice, original)

      signInAs(alice)
      const result = await updateTask(
        task.id,
        idleState,
        buildFormData({ title: '   ', description: 'Kept text' }),
      )

      expect(result).toEqual({
        status: 'error',
        errors: { title: expect.any(String) },
        values: { title: '   ', description: 'Kept text' },
      })
      expect(await getTaskFields(alice, task.id)).toEqual(original)
      expect(refresh).not.toHaveBeenCalled()
    })

    it.each([
      ['a non-uuid string', 'abc'],
      ['a number', 42],
      ['undefined', undefined],
    ])('throws for %s as id without touching the database', async (_, id) => {
      signInAs(alice)

      await expect(
        updateTask(id, idleState, buildFormData({ title: 'New title' })),
      ).rejects.toThrow('Invalid task id')

      expect(auth.getSession).not.toHaveBeenCalled()
      expect(refresh).not.toHaveBeenCalled()
    })

    it('throws for a signed out user and keeps the task', async () => {
      const task = await insertTask(alice, original)

      await expect(
        updateTask(task.id, idleState, buildFormData({ title: 'New title' })),
      ).rejects.toThrow(/without a session/)

      expect(await getTaskFields(alice, task.id)).toEqual(original)
      expect(refresh).not.toHaveBeenCalled()
    })
  })
})
