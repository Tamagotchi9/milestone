import { mountSuspended } from '@nuxt/test-utils/runtime'
import { nextTick, reactive } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

const mountBoard = (tasks = [makeTask()], updatingPriorityIds: string[] = []) =>
  mountSuspended(TaskList, {
    props: { tasks, focusedTaskId: null, updatingPriorityIds },
    global: {
      stubs: {
        DashboardTask: {
          props: ['task', 'subtaskDraft'],
          template:
            '<article :data-task-id="task.id"><slot name="move" />{{ task.title }}</article>',
        },
        UDropdownMenu: {
          props: ['items'],
          template:
            '<div><slot /><button v-for="item in items" :key="item.label" :disabled="item.disabled" @click="item.onSelect()">{{ item.label }}</button></div>',
        },
      },
    },
  })

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('task priority sections', () => {
  it('groups tasks, sorts by deadline, and keeps empty sections available', async () => {
    const wrapper = await mountBoard([
      makeTask(),
      makeTask({ id: 'earlier', title: 'Earlier', deadline: '2026-09-08' }),
    ])
    expect(wrapper.findAll('[data-priority]')).toHaveLength(3)
    expect(
      wrapper
        .find('[data-priority="high"]')
        .findAll('[data-task-id]')
        .map((item) => item.attributes('data-task-id')),
    ).toEqual(['earlier', 'task-1'])
    expect(wrapper.find('[data-priority="low"]').text()).toContain(
      'Drop a task here',
    )
    wrapper.unmount()
  })

  it('emits a priority change from the accessible menu without mutating props', async () => {
    const task = reactive(makeTask())
    const wrapper = await mountBoard([task])
    const button = wrapper
      .findAll('button')
      .find((item) => item.text() === 'Low priority')!
    await button.trigger('click')
    expect(wrapper.emitted('changePriority')).toEqual([['task-1', 'low']])
    expect(task.priority).toBe('high')
    task.priority = 'low'
    await nextTick()
    expect(
      wrapper.find('[data-priority="low"] [data-task-id="task-1"]').exists(),
    ).toBe(true)
    wrapper.unmount()
  })

  it.each(['mouse', 'touch'])(
    'moves a task into an empty section with %s pointer events',
    async (pointerType) => {
      const wrapper = await mountBoard()
      const low = wrapper.find('[data-priority="low"]').element
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(low)
      vi.stubGlobal(
        'requestAnimationFrame',
        vi.fn(() => 1),
      )
      vi.stubGlobal('cancelAnimationFrame', vi.fn())
      const handle = wrapper.find('button[aria-describedby="task-move-help"]')
      Object.assign(handle.element, {
        setPointerCapture: vi.fn(),
        hasPointerCapture: () => false,
      })
      const event = {
        button: 0,
        pointerId: 1,
        pointerType,
        clientX: 100,
        clientY: 200,
      }
      await handle.trigger('pointerdown', event)
      await handle.trigger('pointermove', event)
      await handle.trigger('pointerup', event)
      expect(wrapper.emitted('changePriority')).toEqual([['task-1', 'low']])
      wrapper.unmount()
    },
  )

  it.each(['pointercancel', 'lostpointercapture', 'escape', 'outside', 'same'])(
    'does not change priority on %s',
    async (action) => {
      const wrapper = await mountBoard()
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(
        action === 'outside'
          ? null
          : wrapper.find(
              `[data-priority="${action === 'same' ? 'high' : 'low'}"]`,
            ).element,
      )
      vi.stubGlobal(
        'requestAnimationFrame',
        vi.fn(() => 1),
      )
      vi.stubGlobal('cancelAnimationFrame', vi.fn())
      const handle = wrapper.find('button[aria-describedby="task-move-help"]')
      Object.assign(handle.element, {
        setPointerCapture: vi.fn(),
        hasPointerCapture: () => false,
      })
      const event = { button: 0, pointerId: 1, clientX: 100, clientY: 200 }
      await handle.trigger('pointerdown', event)
      if (action === 'escape')
        await handle.trigger('keydown', { key: 'Escape' })
      else if (action !== 'outside' && action !== 'same')
        await handle.trigger(action, event)
      await handle.trigger('pointerup', event)
      expect(wrapper.emitted('changePriority')).toBeUndefined()
      wrapper.unmount()
    },
  )

  it('disables movement while a priority update is pending', async () => {
    const wrapper = await mountBoard([makeTask()], ['task-1'])
    expect(
      wrapper
        .find('button[aria-describedby="task-move-help"]')
        .attributes('disabled'),
    ).toBeDefined()
    const button = wrapper
      .findAll('button')
      .find((item) => item.text() === 'Low priority')!
    expect(button.attributes('disabled')).toBeDefined()
    await button.trigger('click')
    expect(wrapper.emitted('changePriority')).toBeUndefined()
    wrapper.unmount()
  })
})
