import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DashboardPage from '~/pages/dashboard/index.vue'

const { focusedTask, fetchDailyStats, getTasks } = await vi.hoisted(
  async () => {
    const { ref } = await import('vue')

    return {
      focusedTask: ref<{ id: string; title: string } | null>(null),
      fetchDailyStats: vi.fn(),
      getTasks: vi.fn(),
    }
  },
)

mockNuxtImport('useCurrentUserStore', () => () => ({
  user: { email: 'person@example.com', user_metadata: {} },
}))

mockNuxtImport('useTasks', () => () => ({ focusedTask, getTasks }))

mockNuxtImport('usePomodoroSessions', () => () => ({
  dailyStats: [],
  isDailyStatsLoading: false,
  dailyStatsError: null,
  fetchDailyStats,
}))

const mountPage = () =>
  mountSuspended(DashboardPage, {
    global: {
      stubs: {
        HabitTodayStepper: true,
        HabitStreakOverview: true,
        FocusStatsCharts: true,
      },
    },
  })

describe('dashboard analytics', () => {
  beforeEach(() => {
    focusedTask.value = {
      id: 'task-1',
      title: 'Write tests',
    }
    getTasks.mockReset().mockResolvedValue(undefined)
    fetchDailyStats.mockReset().mockResolvedValue(undefined)
  })

  it('loads local daily stats and refreshes them when focus changes', async () => {
    const wrapper = await mountPage()

    expect(getTasks).toHaveBeenCalledOnce()
    expect(fetchDailyStats).toHaveBeenCalledWith({
      today: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      timeZone: expect.any(String),
      taskId: 'task-1',
    })

    focusedTask.value = { id: 'task-2', title: 'Ship feature' }
    await nextTick()

    expect(fetchDailyStats).toHaveBeenLastCalledWith(
      expect.objectContaining({ taskId: 'task-2' }),
    )
    wrapper.unmount()
  })
})
