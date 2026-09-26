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

const mountBoard = (tasks = [makeTask()], updatingStatusIds: string[] = []) =>
  mountSuspended(TaskList, {
    props: { tasks, focusedTaskId: null, updatingStatusIds },
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

describe('task status sections', () => {
  it('groups tasks, sorts by priority, and keeps empty sections available', async () => {
    const wrapper = await mountBoard([
      makeTask({
        id: 'low',
        title: 'Low',
        priority: 'low',
        deadline: '2026-09-01',
      }),
      makeTask({
        id: 'high-later',
        title: 'High later',
        priority: 'high',
        deadline: '2026-09-20',
      }),
      makeTask({
        id: 'high-earlier',
        title: 'High earlier',
        priority: 'high',
        deadline: '2026-09-08',
      }),
      makeTask({
        id: 'progress',
        title: 'Doing',
        status: 'in_progress',
      }),
    ])
    expect(wrapper.findAll('[data-status]')).toHaveLength(5)
    expect(
      wrapper
        .find('[data-status="created"]')
        .findAll('[data-task-id]')
        .map((item) => item.attributes('data-task-id')),
    ).toEqual(['high-earlier', 'high-later', 'low'])
    expect(
      wrapper
        .find('[data-status="in_progress"] [data-task-id="progress"]')
        .exists(),
    ).toBe(true)
    expect(wrapper.find('[data-status="blocked"]').text()).toContain(
      'Drop a task here',
    )
    wrapper.unmount()
  })

  it('hides completed tasks until the toggle is opened', async () => {
    const wrapper = await mountBoard([
      makeTask(),
      makeTask({ id: 'done', title: 'Done', status: 'completed' }),
    ])
    expect(wrapper.find('[data-task-id="done"]').exists()).toBe(false)
    expect(
      wrapper.find('[data-status="created"] [data-task-id="done"]').exists(),
    ).toBe(false)
    expect(wrapper.get('[data-completed-toggle]').text()).toContain('1')
    await wrapper.get('[data-completed-toggle]').trigger('click')
    expect(wrapper.find('[data-task-id="done"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('emits a status change from the accessible menu without mutating props', async () => {
    const task = reactive(makeTask())
    const wrapper = await mountBoard([task])
    const button = wrapper
      .findAll('button')
      .find((item) => item.text() === 'In progress')!
    await button.trigger('click')
    expect(wrapper.emitted('changeStatus')).toEqual([['task-1', 'in_progress']])
    expect(task.status).toBe('created')
    task.status = 'in_progress'
    await nextTick()
    expect(
      wrapper
        .find('[data-status="in_progress"] [data-task-id="task-1"]')
        .exists(),
    ).toBe(true)
    wrapper.unmount()
  })

  it.each(['mouse', 'touch'])(
    'moves a task into an empty section with %s pointer events',
    async (pointerType) => {
      const wrapper = await mountBoard()
      const blocked = wrapper.find('[data-status="blocked"]').element
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(blocked)
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
      expect(wrapper.emitted('changeStatus')).toEqual([['task-1', 'blocked']])
      wrapper.unmount()
    },
  )

  it.each(['pointercancel', 'lostpointercapture', 'escape', 'outside', 'same'])(
    'does not change status on %s',
    async (action) => {
      const wrapper = await mountBoard()
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(
        action === 'outside'
          ? null
          : wrapper.find(
              `[data-status="${action === 'same' ? 'created' : 'blocked'}"]`,
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
      expect(wrapper.emitted('changeStatus')).toBeUndefined()
      wrapper.unmount()
    },
  )

  it('disables movement while a status update is pending', async () => {
    const wrapper = await mountBoard([makeTask()], ['task-1'])
    expect(
      wrapper
        .find('button[aria-describedby="task-move-help"]')
        .attributes('disabled'),
    ).toBeDefined()
    const button = wrapper
      .findAll('button')
      .find((item) => item.text() === 'In progress')!
    expect(button.attributes('disabled')).toBeDefined()
    await button.trigger('click')
    expect(wrapper.emitted('changeStatus')).toBeUndefined()
    wrapper.unmount()
  })
})
