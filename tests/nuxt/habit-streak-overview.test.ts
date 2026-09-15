import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HabitStreakOverview from '~/components/dashboard/habits/HabitStreakOverview.vue'
import type { Habit, HabitStreakStat } from '~/types/habits.types'

const { habitState } = await vi.hoisted(async () => {
  const { ref } = await import('vue')

  return {
    habitState: {
      activeHabits: ref<Habit[]>([]),
      activeHabitStreaks: ref<HabitStreakStat[]>([]),
      isLoading: ref(false),
      isStreaksLoading: ref(false),
      streaksError: ref<string | null>(null),
    },
  }
})

mockNuxtImport('useHabits', () => () => habitState)

const makeHabit = (id: string, name: string): Habit => ({
  id,
  name,
  startsOn: '2026-09-01',
  archivedOn: null,
  createdAt: '2026-09-01T08:00:00Z',
  updatedAt: '2026-09-01T08:00:00Z',
})

const makeStreak = (
  habitId: string,
  currentStreak: number,
  longestStreak: number,
): HabitStreakStat => ({
  habitId,
  currentStreak,
  longestStreak,
  daysToBeatLongest: Math.max(longestStreak - currentStreak + 1, 1),
})

beforeEach(() => {
  habitState.activeHabits.value = []
  habitState.activeHabitStreaks.value = []
  habitState.isLoading.value = false
  habitState.isStreaksLoading.value = false
  habitState.streaksError.value = null
})

describe('habit streak overview', () => {
  it('shows the longest, current, and closest personal record on dashboard', async () => {
    habitState.activeHabits.value = [
      makeHabit('reading', 'Reading'),
      makeHabit('walking', 'Walking'),
    ]
    habitState.activeHabitStreaks.value = [
      makeStreak('reading', 3, 10),
      makeStreak('walking', 5, 6),
    ]
    const wrapper = await mountSuspended(HabitStreakOverview, {
      props: { compact: true },
    })

    expect(wrapper.get('[data-testid="longest-streak"]').text()).toContain('10')
    expect(wrapper.get('[data-testid="longest-streak"]').text()).toContain(
      'Reading',
    )
    expect(wrapper.get('[data-testid="current-streak"]').text()).toContain('5')
    expect(wrapper.get('[data-testid="days-to-beat"]').text()).toContain('2')
    expect(wrapper.get('[data-testid="days-to-beat"]').text()).toContain(
      'Walking',
    )
    wrapper.unmount()
  })

  it('shows streak details for every active habit', async () => {
    habitState.activeHabits.value = [
      makeHabit('reading', 'Reading'),
      makeHabit('new-habit', 'New habit'),
    ]
    habitState.activeHabitStreaks.value = [makeStreak('reading', 3, 7)]
    const wrapper = await mountSuspended(HabitStreakOverview)
    const reading = wrapper.get('[data-habit-streak-id="reading"]')
    const newHabit = wrapper.get('[data-habit-streak-id="new-habit"]')

    expect(reading.text()).toContain('Reading')
    expect(reading.text()).toContain('3')
    expect(reading.text()).toContain('7')
    expect(reading.text()).toContain('5')
    expect(newHabit.text()).toContain('New habit')
    expect(newHabit.text()).toContain('0')
    expect(newHabit.text()).toContain('1')
    wrapper.unmount()
  })

  it('shows loading, error, and empty states', async () => {
    habitState.isStreaksLoading.value = true
    const loadingWrapper = await mountSuspended(HabitStreakOverview)
    expect(
      loadingWrapper.findAllComponents({ name: 'USkeleton' }),
    ).toHaveLength(3)
    loadingWrapper.unmount()

    habitState.isStreaksLoading.value = false
    habitState.streaksError.value = 'Denied'
    const errorWrapper = await mountSuspended(HabitStreakOverview)
    expect(errorWrapper.get('[role="alert"]').text()).toContain(
      'Couldn’t load habit streaks.',
    )
    errorWrapper.unmount()

    habitState.streaksError.value = null
    const emptyWrapper = await mountSuspended(HabitStreakOverview)
    expect(emptyWrapper.text()).toContain('No active habits')
    expect(emptyWrapper.get('a').attributes('href')).toBe('/dashboard/habits')
    emptyWrapper.unmount()
  })
})
