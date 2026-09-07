import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Database } from '~/types/database.types'
import { TASK_STATUS, type TaskItem } from '~/types/tasks.types'

const FOCUS_STORAGE_KEY = 'milestone.tasks.focus.v1'
const TASK_SELECT =
  'id, title, description, priority, deadline, created_at, parent_task_id, status'
const NOW = '2026-09-01T10:00:00.000Z'

type TaskRow = Pick<
  Database['public']['Tables']['tasks']['Row'],
  | 'id'
  | 'title'
  | 'description'
  | 'priority'
  | 'deadline'
  | 'created_at'
  | 'parent_task_id'
  | 'status'
>

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}))

mockNuxtImport('useSupabaseClient', () => {
  return () => ({ from: fromMock })
})

const makeTaskRow = (overrides: Partial<TaskRow> = {}): TaskRow => ({
  id: 'task-1',
  title: 'Task',
  description: 'Description',
  priority: 'medium',
  deadline: null,
  created_at: '2026-08-31T10:00:00.000Z',
  parent_task_id: null,
  status: TASK_STATUS.CREATED,
  ...overrides,
})

const makeTaskItem = (overrides: Partial<TaskItem> = {}): TaskItem => ({
  id: 'task-1',
  title: 'Task',
  description: 'Description',
  priority: 'medium',
  deadline: null,
  createdAt: '2026-08-31T10:00:00.000Z',
  status: TASK_STATUS.CREATED,
  subtasks: [],
  ...overrides,
})

const createQueryBuilder = () => {
  const queryBuilder = {
    select: vi.fn(),
    order: vi.fn(),
    insert: vi.fn(),
    single: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    update: vi.fn(),
  }

  queryBuilder.select.mockReturnValue(queryBuilder)
  queryBuilder.insert.mockReturnValue(queryBuilder)
  queryBuilder.delete.mockReturnValue(queryBuilder)
  queryBuilder.eq.mockReturnValue(queryBuilder)
  queryBuilder.update.mockReturnValue(queryBuilder)

  return queryBuilder
}

type QueryBuilder = ReturnType<typeof createQueryBuilder>

let queryBuilder: QueryBuilder

describe('useTasks', () => {
  beforeEach(async () => {
    clearNuxtState()
    await nextTick()
    window.localStorage.clear()
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(NOW)

    queryBuilder = createQueryBuilder()
    fromMock.mockReturnValue(queryBuilder)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('starts with an empty task list and no loading in progress', () => {
    const { tasks, isLoading } = useTasks()

    expect(tasks.value).toEqual([])
    expect(isLoading.value).toBe(false)
  })

  describe('focus persistence', () => {
    it('restores the focused task id from localStorage', () => {
      window.localStorage.setItem(FOCUS_STORAGE_KEY, 'task-2')

      const { focusedTaskId } = useTasks()

      expect(focusedTaskId.value).toBe('task-2')
    })

    it('persists and clears the focused task id', async () => {
      const { setFocusedTask } = useTasks()

      setFocusedTask('task-2')
      await nextTick()
      expect(window.localStorage.getItem(FOCUS_STORAGE_KEY)).toBe('task-2')

      setFocusedTask(null)
      await nextTick()
      expect(window.localStorage.getItem(FOCUS_STORAGE_KEY)).toBeNull()
    })

    it('exposes the focused task from the current task list', () => {
      const { tasks, focusedTask, setFocusedTask } = useTasks()
      tasks.value = [makeTaskItem(), makeTaskItem({ id: 'task-2' })]

      setFocusedTask('task-2')

      expect(focusedTask.value).toEqual(makeTaskItem({ id: 'task-2' }))
    })
  })

  describe('getTasks', () => {
    it('clears existing tasks when a successful response contains null data', async () => {
      queryBuilder.order.mockResolvedValue({ data: null, error: null })
      const { tasks, getTasks } = useTasks()
      tasks.value = [makeTaskItem()]

      await getTasks()

      expect(tasks.value).toEqual([])
    })

    it('requests tasks ordered by creation date', async () => {
      queryBuilder.order.mockResolvedValue({ data: [], error: null })
      const { getTasks } = useTasks()

      await getTasks()

      expect(fromMock).toHaveBeenCalledWith('tasks')
      expect(queryBuilder.select).toHaveBeenCalledWith(TASK_SELECT)
      expect(queryBuilder.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      })
    })

    it('maps parent tasks with their subtasks', async () => {
      const rows = [
        makeTaskRow({
          id: 'subtask-1',
          title: 'Child',
          parent_task_id: 'task-1',
          status: TASK_STATUS.COMPLETED,
        }),
        makeTaskRow(),
      ]
      queryBuilder.order.mockResolvedValue({ data: rows, error: null })
      const { tasks, getTasks } = useTasks()

      await getTasks()

      expect(tasks.value).toEqual([
        {
          id: 'task-1',
          title: 'Task',
          description: 'Description',
          priority: 'medium',
          deadline: null,
          createdAt: '2026-08-31T10:00:00.000Z',
          status: TASK_STATUS.CREATED,
          subtasks: [
            {
              id: 'subtask-1',
              title: 'Child',
              status: TASK_STATUS.COMPLETED,
            },
          ],
        },
      ])
    })

    it('normalizes nullable task fields', async () => {
      queryBuilder.order.mockResolvedValue({
        data: [makeTaskRow({ description: null, created_at: null })],
        error: null,
      })
      const { tasks, getTasks } = useTasks()

      await getTasks()

      expect(tasks.value[0]).toMatchObject({
        description: '',
        createdAt: NOW,
      })
    })

    it('sets loading while the request is pending', async () => {
      let resolveRequest: (result: {
        data: TaskRow[]
        error: null
      }) => void = () => {}
      queryBuilder.order.mockReturnValue(
        new Promise((resolve) => {
          resolveRequest = resolve
        }),
      )
      const { isLoading, getTasks } = useTasks()

      const request = getTasks()

      expect(isLoading.value).toBe(true)

      resolveRequest({ data: [], error: null })
      await request

      expect(isLoading.value).toBe(false)
    })

    it('keeps existing tasks when loading fails', async () => {
      const error = { message: 'Unable to load tasks' }
      vi.spyOn(console, 'error').mockImplementation(() => {})
      queryBuilder.order.mockResolvedValue({ data: null, error })
      const { tasks, isLoading, getTasks } = useTasks()
      tasks.value = [makeTaskItem()]

      await getTasks()

      expect(tasks.value).toEqual([makeTaskItem()])
      expect(isLoading.value).toBe(false)
    })
  })

  describe('addTask', () => {
    const CREATED_TASK_ID = 'task-2'
    const TASK_TITLE = 'New task'
    const TASK_DESCRIPTION = 'Details'
    const TASK_PRIORITY = 'medium' as const

    it('does not query Supabase for a blank title', async () => {
      const { addTask } = useTasks()

      await expect(addTask({ title: '   ' })).resolves.toBeNull()
      expect(fromMock).not.toHaveBeenCalled()
    })

    it('normalizes the payload before inserting', async () => {
      const returnedRow = makeTaskRow({
        id: CREATED_TASK_ID,
        title: TASK_TITLE,
        description: TASK_DESCRIPTION,
      })
      queryBuilder.single.mockResolvedValue({ data: returnedRow, error: null })
      const { addTask } = useTasks()

      await addTask({
        title: `  ${TASK_TITLE}  `,
        description: `  ${TASK_DESCRIPTION}  `,
        priority: TASK_PRIORITY,
        deadline: '',
      })

      expect(queryBuilder.insert).toHaveBeenCalledWith({
        title: TASK_TITLE,
        description: TASK_DESCRIPTION,
        priority: TASK_PRIORITY,
        deadline: null,
      })
    })

    it('returns the row created by Supabase', async () => {
      const returnedRow = makeTaskRow({
        id: CREATED_TASK_ID,
        title: TASK_TITLE,
        description: TASK_DESCRIPTION,
        priority: TASK_PRIORITY,
      })
      queryBuilder.single.mockResolvedValue({ data: returnedRow, error: null })
      const { addTask } = useTasks()

      const result = await addTask({
        title: TASK_TITLE,
        description: TASK_DESCRIPTION,
        priority: TASK_PRIORITY,
      })

      expect(result).toEqual(returnedRow)
    })

    it('prepends the created root task to local state', async () => {
      const existingTask = makeTaskItem()
      const returnedRow = makeTaskRow({
        id: CREATED_TASK_ID,
        title: TASK_TITLE,
        description: TASK_DESCRIPTION,
        priority: TASK_PRIORITY,
      })
      queryBuilder.single.mockResolvedValue({ data: returnedRow, error: null })
      const { tasks, addTask } = useTasks()
      tasks.value = [existingTask]

      await addTask({
        title: TASK_TITLE,
        description: TASK_DESCRIPTION,
        priority: TASK_PRIORITY,
      })

      expect(tasks.value).toEqual([
        {
          id: CREATED_TASK_ID,
          title: TASK_TITLE,
          description: TASK_DESCRIPTION,
          priority: TASK_PRIORITY,
          deadline: null,
          createdAt: '2026-08-31T10:00:00.000Z',
          status: TASK_STATUS.CREATED,
          subtasks: [],
        },
        existingTask,
      ])
    })

    it('replaces an existing task with the same id', async () => {
      const returnedRow = makeTaskRow({
        id: CREATED_TASK_ID,
        title: TASK_TITLE,
        description: TASK_DESCRIPTION,
        priority: TASK_PRIORITY,
      })
      queryBuilder.single.mockResolvedValue({ data: returnedRow, error: null })
      const { tasks, addTask } = useTasks()
      tasks.value = [makeTaskItem({ id: CREATED_TASK_ID, title: 'Stale task' })]

      await addTask({
        title: TASK_TITLE,
        description: TASK_DESCRIPTION,
        priority: TASK_PRIORITY,
      })

      expect(tasks.value).toHaveLength(1)
      expect(tasks.value[0]).toMatchObject({
        id: CREATED_TASK_ID,
        title: TASK_TITLE,
      })
    })

    it('preserves a non-empty deadline when inserting', async () => {
      const deadline = '2026-09-15'
      queryBuilder.single.mockResolvedValue({
        data: makeTaskRow({ deadline }),
        error: null,
      })
      const { addTask } = useTasks()

      await addTask({ title: TASK_TITLE, priority: TASK_PRIORITY, deadline })

      expect(queryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ deadline }),
      )
    })

    it('appends a returned subtask only to its parent', async () => {
      const unrelatedTask = makeTaskItem({ id: 'other-task' })
      const existingSubtask = {
        id: 'existing-subtask',
        title: 'Existing child',
        status: TASK_STATUS.COMPLETED,
      }
      const returnedRow = makeTaskRow({
        id: 'subtask-1',
        title: 'Child',
        parent_task_id: 'task-1',
      })
      queryBuilder.single.mockResolvedValue({ data: returnedRow, error: null })
      const { tasks, addTask } = useTasks()
      tasks.value = [
        unrelatedTask,
        makeTaskItem({ subtasks: [existingSubtask] }),
      ]

      await addTask({
        title: 'Child',
        parentTaskId: 'task-1',
      })

      expect(queryBuilder.insert).toHaveBeenCalledWith({
        title: 'Child',
        description: null,
        priority: undefined,
        deadline: null,
        parent_task_id: 'task-1',
      })
      expect(tasks.value[0]).toEqual(makeTaskItem({ id: 'other-task' }))
      expect(tasks.value[1]?.subtasks).toEqual([
        existingSubtask,
        {
          id: 'subtask-1',
          title: 'Child',
          status: TASK_STATUS.CREATED,
        },
      ])
    })

    it('returns null and keeps existing tasks when creation fails', async () => {
      const error = { message: 'Unable to create task' }
      vi.spyOn(console, 'error').mockImplementation(() => {})
      queryBuilder.single.mockResolvedValue({ data: null, error })
      const { tasks, addTask } = useTasks()
      tasks.value = [makeTaskItem()]

      await expect(addTask({ title: 'New task' })).resolves.toBeNull()

      expect(tasks.value).toEqual([makeTaskItem()])
    })
  })

  describe('removeTask', () => {
    it('preserves focus when a different task is deleted', async () => {
      queryBuilder.eq.mockResolvedValue({ data: null, error: null })
      const { tasks, focusedTaskId, removeTask, setFocusedTask } = useTasks()
      tasks.value = [makeTaskItem(), makeTaskItem({ id: 'task-2' })]
      setFocusedTask('task-1')

      await removeTask('task-2')

      expect(tasks.value).toEqual([makeTaskItem()])
      expect(focusedTaskId.value).toBe('task-1')
    })

    it('removes the task and clears focus after a successful delete', async () => {
      queryBuilder.eq.mockResolvedValue({ data: null, error: null })
      const { tasks, focusedTaskId, removeTask, setFocusedTask } = useTasks()
      tasks.value = [makeTaskItem(), makeTaskItem({ id: 'task-2' })]
      setFocusedTask('task-1')

      await removeTask('task-1')

      expect(queryBuilder.delete).toHaveBeenCalledOnce()
      expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'task-1')
      expect(tasks.value).toEqual([makeTaskItem({ id: 'task-2' })])
      expect(focusedTaskId.value).toBeNull()
    })

    it('keeps the task and focus when deletion fails', async () => {
      const error = { message: 'Unable to delete task' }
      vi.spyOn(console, 'error').mockImplementation(() => {})
      queryBuilder.eq.mockResolvedValue({ data: null, error })
      const { tasks, focusedTaskId, removeTask, setFocusedTask } = useTasks()
      tasks.value = [makeTaskItem()]
      setFocusedTask('task-1')

      await removeTask('task-1')

      expect(tasks.value).toEqual([makeTaskItem()])
      expect(focusedTaskId.value).toBe('task-1')
    })
  })

  describe('toggleSubtask', () => {
    it('toggles the matching subtask when it is not first in the list', async () => {
      queryBuilder.single.mockResolvedValue({
        data: makeTaskRow({
          id: 'subtask-2',
          title: 'Second child',
          parent_task_id: 'task-1',
          status: TASK_STATUS.COMPLETED,
        }),
        error: null,
      })
      const { tasks, toggleSubtask } = useTasks()
      tasks.value = [
        makeTaskItem({
          subtasks: [
            {
              id: 'subtask-1',
              title: 'First child',
              status: TASK_STATUS.CREATED,
            },
            {
              id: 'subtask-2',
              title: 'Second child',
              status: TASK_STATUS.CREATED,
            },
          ],
        }),
      ]

      await toggleSubtask('subtask-2')

      expect(tasks.value[0]?.subtasks).toEqual([
        { id: 'subtask-1', title: 'First child', status: TASK_STATUS.CREATED },
        {
          id: 'subtask-2',
          title: 'Second child',
          status: TASK_STATUS.COMPLETED,
        },
      ])
      expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'subtask-2')
    })

    it('does not query Supabase when the subtask does not exist', async () => {
      const { tasks, toggleSubtask } = useTasks()
      tasks.value = [makeTaskItem()]

      await toggleSubtask('missing-subtask')

      expect(fromMock).not.toHaveBeenCalled()
    })

    it.each([
      {
        previousStatus: TASK_STATUS.CREATED,
        nextStatus: TASK_STATUS.COMPLETED,
      },
      {
        previousStatus: TASK_STATUS.COMPLETED,
        nextStatus: TASK_STATUS.CREATED,
      },
    ])(
      'optimistically changes $previousStatus to $nextStatus',
      async ({ previousStatus, nextStatus }) => {
        let resolveRequest: (value: unknown) => void = () => {}
        queryBuilder.single.mockReturnValue(
          new Promise((resolve) => {
            resolveRequest = resolve
          }),
        )
        const { tasks, toggleSubtask } = useTasks()
        tasks.value = [
          makeTaskItem({
            subtasks: [
              {
                id: 'subtask-1',
                title: 'Child',
                status: previousStatus,
              },
              {
                id: 'subtask-2',
                title: 'Sibling',
                status: previousStatus,
              },
            ],
          }),
        ]

        const request = toggleSubtask('subtask-1')

        const expectedSubtasks = [
          { id: 'subtask-1', title: 'Child', status: nextStatus },
          { id: 'subtask-2', title: 'Sibling', status: previousStatus },
        ]
        expect(tasks.value[0]?.subtasks).toEqual(expectedSubtasks)
        expect(queryBuilder.update).toHaveBeenCalledWith({
          status: nextStatus,
        })
        expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'subtask-1')

        resolveRequest({
          data: makeTaskRow({
            id: 'subtask-1',
            title: 'Child',
            parent_task_id: 'task-1',
            status: nextStatus,
          }),
          error: null,
        })
        await request

        expect(tasks.value[0]?.subtasks).toEqual(expectedSubtasks)
      },
    )

    it.each([
      {
        previousStatus: TASK_STATUS.CREATED,
        nextStatus: TASK_STATUS.COMPLETED,
      },
      {
        previousStatus: TASK_STATUS.COMPLETED,
        nextStatus: TASK_STATUS.CREATED,
      },
    ])(
      'restores $previousStatus after an optimistic change to $nextStatus fails',
      async ({ previousStatus, nextStatus }) => {
        const error = { message: 'Unable to update subtask' }
        vi.spyOn(console, 'error').mockImplementation(() => {})
        let resolveRequest: (value: unknown) => void = () => {}
        queryBuilder.single.mockReturnValue(
          new Promise((resolve) => {
            resolveRequest = resolve
          }),
        )
        const { tasks, toggleSubtask } = useTasks()
        tasks.value = [
          makeTaskItem({
            subtasks: [
              {
                id: 'subtask-1',
                title: 'Child',
                status: previousStatus,
              },
              {
                id: 'subtask-2',
                title: 'Sibling',
                status: previousStatus,
              },
            ],
          }),
        ]

        const request = toggleSubtask('subtask-1')

        expect(tasks.value[0]?.subtasks).toEqual([
          { id: 'subtask-1', title: 'Child', status: nextStatus },
          { id: 'subtask-2', title: 'Sibling', status: previousStatus },
        ])

        resolveRequest({ data: null, error })
        await request

        expect(tasks.value[0]?.subtasks).toEqual([
          { id: 'subtask-1', title: 'Child', status: previousStatus },
          { id: 'subtask-2', title: 'Sibling', status: previousStatus },
        ])
      },
    )
  })
})
