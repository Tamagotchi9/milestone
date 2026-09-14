import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TasksPage from '~/pages/dashboard/tasks.vue'
import { TASK_STATUS } from '~/types/tasks.types'

const { updateTaskStatus, updateTaskPriority, setFocusedTask } = vi.hoisted(
  () => ({
    updateTaskStatus: vi.fn(),
    updateTaskPriority: vi.fn(),
    setFocusedTask: vi.fn(),
  }),
)

mockNuxtImport('useTasks', () => () => ({
  tasks: [],
  isLoading: false,
  updatingStatusIds: [],
  updatingPriorityIds: [],
  updateTaskPriority,
  focusedTaskId: null,
  getTasks: vi.fn(),
  addTask: vi.fn(),
  removeTask: vi.fn(),
  toggleSubtask: vi.fn(),
  updateTaskStatus,
  setFocusedTask,
}))

const mountPage = () =>
  mountSuspended(TasksPage, {
    global: {
      stubs: {
        TaskList: {
          name: 'TaskList',
          template:
            "<button @click=\"$emit('focus', 'task-1')\">Start focus</button>",
        },
        AppDialog: true,
      },
    },
  })

describe('tasks page focus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('persists the priority selected in the task list', async () => {
    const wrapper = await mountPage()
    wrapper
      .findComponent({ name: 'TaskList' })
      .vm.$emit('changePriority', 'task-1', 'low')
    expect(updateTaskPriority).toHaveBeenCalledWith('task-1', 'low')
    wrapper.unmount()
  })

  it('saves in_progress before selecting the task and opening the timer', async () => {
    let resolveRequest: (value: boolean) => void = () => {}
    updateTaskStatus.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveRequest = resolve
      }),
    )
    const wrapper = await mountPage()
    const push = vi.spyOn(useNuxtApp().$router, 'push').mockResolvedValue()
    await wrapper
      .findComponent({ name: 'TaskList' })
      .find('button')
      .trigger('click')

    expect(updateTaskStatus).toHaveBeenCalledWith(
      'task-1',
      TASK_STATUS.IN_PROGRESS,
    )
    expect(setFocusedTask).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()

    resolveRequest(true)
    await nextTick()
    expect(setFocusedTask).toHaveBeenCalledWith('task-1')
    expect(push).toHaveBeenCalledWith('/dashboard/pomidoro')
    wrapper.unmount()
    push.mockRestore()
  })

  it('stays on tasks and keeps the previous focus when saving fails', async () => {
    updateTaskStatus.mockResolvedValue(false)
    const wrapper = await mountPage()
    const push = vi.spyOn(useNuxtApp().$router, 'push').mockResolvedValue()
    await wrapper
      .findComponent({ name: 'TaskList' })
      .find('button')
      .trigger('click')
    await nextTick()

    expect(setFocusedTask).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
    wrapper.unmount()
    push.mockRestore()
  })
})
