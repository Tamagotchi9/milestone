import { mountSuspended } from '@nuxt/test-utils/runtime'
import { nextTick, reactive } from 'vue'
import { describe, expect, it, onTestFinished } from 'vitest'
import TaskList from '~/components/dashboard/tasks/TaskList.vue'
import type { TaskItem } from '~/types/tasks.types'

const makeTask = (overrides: Partial<TaskItem> = {}): TaskItem => ({
  id: 'task-1',
  title: 'Write tests',
  description: '',
  priority: 'high',
  deadline: null,
  createdAt: '2026-09-07T12:00:00Z',
  status: 'created',
  subtasks: [],
  ...overrides,
})

const mountBoard = (tasks: TaskItem[]) =>
  mountSuspended(TaskList, {
    attachTo: document.body,
    props: {
      tasks,
      focusedTaskId: null,
      updatingPriorityIds: [],
    },
  })

describe('task status integration', () => {
  it('preserves the subtask draft and keyboard focus during an optimistic move and rollback', async () => {
    const task = reactive(makeTask())
    const wrapper = await mountBoard([task])
    onTestFinished(() => wrapper.unmount())
    const inputSelector = 'input[aria-label="New subtask for Write tests"]'
    const draft = 'Keep this draft'
    const input = wrapper.find<HTMLInputElement>(inputSelector)

    await input.setValue(draft)
    input.element.focus()
    expect(document.activeElement).toBe(input.element)

    task.status = 'in_progress'
    await nextTick()

    const inputAfterOptimisticMove =
      wrapper.find<HTMLInputElement>(inputSelector)
    expect(inputAfterOptimisticMove.element.value).toBe(draft)
    expect(document.activeElement).toBe(inputAfterOptimisticMove.element)

    task.status = 'created'
    await nextTick()

    const inputAfterRollback = wrapper.find<HTMLInputElement>(inputSelector)
    expect(inputAfterRollback.element.value).toBe(draft)
    expect(document.activeElement).toBe(inputAfterRollback.element)
  })
})
