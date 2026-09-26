import { mountSuspended } from '@nuxt/test-utils/runtime'
import { nextTick, reactive } from 'vue'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
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
  it('drags from the card body but not from actions or subtasks', async () => {
    const wrapper = await mountBoard([makeTask()])
    onTestFinished(() => {
      wrapper.unmount()
      vi.restoreAllMocks()
      vi.unstubAllGlobals()
    })
    const card = wrapper.get('[data-task-card-id="task-1"]')
    const capture = vi.fn()
    Object.assign(card.element, {
      setPointerCapture: capture,
      hasPointerCapture: () => false,
    })
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(
      wrapper.get('[data-status="blocked"]').element,
    )
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    )
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    const startEvent = { button: 0, pointerId: 1, clientX: 100, clientY: 200 }

    await card
      .get('[data-task-focus="priority"]')
      .trigger('pointerdown', startEvent)
    await card
      .get('[data-task-focus="subtask-input"]')
      .trigger('pointerdown', startEvent)
    expect(capture).not.toHaveBeenCalled()

    await card.get('h4').trigger('pointerdown', startEvent)
    expect(capture).toHaveBeenCalledWith(1)
    const moveEvent = { ...startEvent, clientX: 112 }
    await card.trigger('pointermove', moveEvent)
    await card.trigger('pointerup', moveEvent)
    expect(wrapper.emitted('changeStatus')).toEqual([['task-1', 'blocked']])
  })

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
