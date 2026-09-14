import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HabitTodayStepper from '~/components/dashboard/habits/HabitTodayStepper.vue'
import type { Habit } from '~/types/habits.types'

const { habitState, getHabits, toggleCheckin } = await vi.hoisted(async () => {
  const { ref } = await import('vue')

  return {
    habitState: {
      activeHabits: ref<Habit[]>([]),
      localToday: ref('2026-09-14'),
      completedIds: ref<string[]>([]),
      pendingIds: ref<string[]>([]),
      isLoading: ref(false),
      errorMessage: ref<string | null>(null),
    },
    getHabits: vi.fn(),
    toggleCheckin: vi.fn(),
  }
})

mockNuxtImport('useHabits', () => () => ({
  activeHabits: habitState.activeHabits,
  localToday: habitState.localToday,
  isLoading: habitState.isLoading,
  errorMessage: habitState.errorMessage,
  getHabits,
  isDateCompleted: (habitId: string, date: string) =>
    date === habitState.localToday.value &&
    habitState.completedIds.value.includes(habitId),
  isTogglePending: (habitId: string, date: string) =>
    date === habitState.localToday.value &&
    habitState.pendingIds.value.includes(habitId),
  toggleCheckin,
}))

const makeHabit = (id: string, name: string): Habit => ({
  id,
  name,
  startsOn: '2026-09-01',
  archivedOn: null,
  createdAt: '2026-09-01T08:00:00Z',
  updatedAt: '2026-09-01T08:00:00Z',
})

const mountStepper = () =>
  mountSuspended(HabitTodayStepper, {
    global: {
      stubs: {
        UStepper: {
          props: ['modelValue', 'items', 'disabled'],
          emits: ['update:modelValue'],
          template: `
            <section>
              <button
                v-for="item in items"
                :key="item.value"
                type="button"
                :disabled="disabled"
                @click="$emit('update:modelValue', item.value)"
              >
                {{ item.title }}
              </button>
              <slot name="content" />
            </section>
          `,
        },
      },
    },
  })

const findButton = (
  wrapper: Awaited<ReturnType<typeof mountStepper>>,
  text: string,
) => wrapper.findAll('button').find((button) => button.text().includes(text))

beforeEach(() => {
  habitState.activeHabits.value = []
  habitState.localToday.value = '2026-09-14'
  habitState.completedIds.value = []
  habitState.pendingIds.value = []
  habitState.isLoading.value = false
  habitState.errorMessage.value = null
  getHabits.mockReset()
  toggleCheckin.mockReset()
  toggleCheckin.mockImplementation(async (habitId: string) => {
    habitState.completedIds.value = habitState.completedIds.value.includes(
      habitId,
    )
      ? habitState.completedIds.value.filter((id) => id !== habitId)
      : [...habitState.completedIds.value, habitId]
    return true
  })
})

describe('today habit stepper', () => {
  it('starts with the first incomplete habit and advances after completing it', async () => {
    habitState.activeHabits.value = [
      makeHabit('habit-1', 'Drink water'),
      makeHabit('habit-2', 'Take a walk'),
      makeHabit('habit-3', 'Write a journal'),
    ]
    habitState.completedIds.value = ['habit-1']

    const wrapper = await mountStepper()

    expect(wrapper.text()).toContain('Complete “Take a walk” today')
    await findButton(wrapper, 'Complete “Take a walk” today')!.trigger('click')
    await nextTick()

    expect(toggleCheckin).toHaveBeenCalledWith('habit-2', '2026-09-14')
    expect(wrapper.text()).toContain('Complete “Write a journal” today')
    wrapper.unmount()
  })

  it('stays on the current habit when the check-in fails', async () => {
    habitState.activeHabits.value = [
      makeHabit('habit-1', 'Drink water'),
      makeHabit('habit-2', 'Take a walk'),
    ]
    toggleCheckin.mockResolvedValue(false)

    const wrapper = await mountStepper()

    await findButton(wrapper, 'Complete “Drink water” today')!.trigger('click')
    await nextTick()

    expect(wrapper.text()).toContain('Complete “Drink water” today')
    wrapper.unmount()
  })

  it('allows undo without changing the selected step', async () => {
    habitState.activeHabits.value = [
      makeHabit('habit-1', 'Drink water'),
      makeHabit('habit-2', 'Take a walk'),
    ]
    habitState.completedIds.value = ['habit-1']

    const wrapper = await mountStepper()

    await findButton(wrapper, 'Drink water')!.trigger('click')
    expect(wrapper.text()).toContain('Mark “Drink water” incomplete')

    await findButton(wrapper, 'Mark “Drink water” incomplete')!.trigger('click')
    await nextTick()

    expect(toggleCheckin).toHaveBeenCalledWith('habit-1', '2026-09-14')
    expect(wrapper.text()).toContain('Complete “Drink water” today')
    wrapper.unmount()
  })

  it('shows completion progress and prevents interaction while pending', async () => {
    habitState.activeHabits.value = [makeHabit('habit-1', 'Drink water')]
    habitState.completedIds.value = ['habit-1']
    habitState.pendingIds.value = ['habit-1']

    const wrapper = await mountStepper()

    expect(wrapper.text()).toContain('1/1 complete')
    expect(wrapper.text()).toContain('All habits completed today.')
    expect(
      findButton(wrapper, 'Drink water')!.attributes('disabled'),
    ).toBeDefined()
    wrapper.unmount()
  })

  it('links to the tracker when there are no habits for today', async () => {
    const wrapper = await mountStepper()

    expect(wrapper.text()).toContain('No habits for today')
    expect(wrapper.get('a[href="/dashboard/habits"]').text()).toContain(
      'Add a habit',
    )
    expect(getHabits).toHaveBeenCalledOnce()
    wrapper.unmount()
  })
})
