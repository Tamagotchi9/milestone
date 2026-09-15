import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Habit } from '~/types/habits.types'

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}))

mockNuxtImport('useSupabaseClient', () => () => ({ rpc: rpcMock }))

const makeHabit = (): Habit => ({
  id: 'habit-1',
  name: 'Reading',
  startsOn: '2026-09-01',
  archivedOn: null,
  createdAt: '2026-09-01T08:00:00Z',
  updatedAt: '2026-09-01T08:00:00Z',
})

describe('useHabits active streaks', () => {
  beforeEach(async () => {
    clearNuxtState()
    await nextTick()
    vi.clearAllMocks()
  })

  it('maps streak values and calculates the days needed for a new record', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          habit_id: 'habit-1',
          current_streak: '4',
          longest_streak: '7',
        },
      ],
      error: null,
    })
    const {
      habits,
      localToday,
      activeHabitStreaks,
      refreshActiveHabitStreaks,
    } = useHabits()
    habits.value = [makeHabit()]
    localToday.value = '2026-09-14'

    await refreshActiveHabitStreaks()

    expect(rpcMock).toHaveBeenCalledWith('active_habit_streaks', {
      p_today: '2026-09-14',
    })
    expect(activeHabitStreaks.value).toEqual([
      {
        habitId: 'habit-1',
        currentStreak: 4,
        longestStreak: 7,
        daysToBeatLongest: 4,
      },
    ])
  })

  it('needs one more day when the current streak equals the record', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          habit_id: 'habit-1',
          current_streak: 7,
          longest_streak: 7,
        },
      ],
      error: null,
    })
    const {
      habits,
      localToday,
      activeHabitStreaks,
      refreshActiveHabitStreaks,
    } = useHabits()
    habits.value = [makeHabit()]
    localToday.value = '2026-09-14'

    await refreshActiveHabitStreaks()

    expect(activeHabitStreaks.value[0]?.daysToBeatLongest).toBe(1)
  })

  it('skips the RPC without active habits and exposes request errors', async () => {
    const first = useHabits()
    first.localToday.value = '2026-09-14'
    await first.refreshActiveHabitStreaks()
    expect(rpcMock).not.toHaveBeenCalled()

    rpcMock.mockResolvedValue({ data: null, error: { message: 'Denied' } })
    first.habits.value = [makeHabit()]
    first.activeHabitStreaks.value = [
      {
        habitId: 'stale',
        currentStreak: 1,
        longestStreak: 1,
        daysToBeatLongest: 1,
      },
    ]
    await first.refreshActiveHabitStreaks()

    expect(first.activeHabitStreaks.value).toEqual([])
    expect(first.streaksError.value).toBe('Denied')
  })
})
