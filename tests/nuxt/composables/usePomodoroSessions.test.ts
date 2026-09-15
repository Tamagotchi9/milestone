import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}))

mockNuxtImport('useSupabaseClient', () => () => ({ rpc: rpcMock }))

describe('usePomodoroSessions daily stats', () => {
  beforeEach(async () => {
    clearNuxtState()
    await nextTick()
    vi.clearAllMocks()
  })

  it('requests and maps daily totals with a focused task', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          stat_date: '2026-09-14',
          completed_total: '2',
          seconds_total: '2400',
          completed_for_task: '1',
          seconds_for_task: '1500',
        },
      ],
      error: null,
    })
    const { dailyStats, dailyStatsError, fetchDailyStats } =
      usePomodoroSessions()

    await fetchDailyStats({
      today: '2026-09-14',
      timeZone: 'Europe/Kyiv',
      taskId: 'task-1',
    })

    expect(rpcMock).toHaveBeenCalledWith('pomodoro_daily_stats', {
      p_today: '2026-09-14',
      p_timezone: 'Europe/Kyiv',
      p_task_id: 'task-1',
    })
    expect(dailyStats.value).toEqual([
      {
        date: '2026-09-14',
        completedTotal: 2,
        secondsTotal: 2400,
        completedForTask: 1,
        secondsForTask: 1500,
      },
    ])
    expect(dailyStatsError.value).toBeNull()
  })

  it('clears stale values and exposes an RPC error', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'Denied' } })
    const { dailyStats, dailyStatsError, fetchDailyStats } =
      usePomodoroSessions()
    dailyStats.value = [
      {
        date: '2026-09-13',
        completedTotal: 1,
        secondsTotal: 600,
        completedForTask: 0,
        secondsForTask: 0,
      },
    ]

    await fetchDailyStats({
      today: '2026-09-14',
      timeZone: 'Europe/Kyiv',
    })

    expect(dailyStats.value).toEqual([])
    expect(dailyStatsError.value).toBe('Denied')
  })
})
