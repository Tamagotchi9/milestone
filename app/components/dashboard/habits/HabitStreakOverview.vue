<script setup lang="ts">
import type { HabitStreakStat } from '~/types/habits.types'

withDefaults(
  defineProps<{
    compact?: boolean
  }>(),
  {
    compact: false,
  },
)

const {
  activeHabits,
  activeHabitStreaks,
  isLoading,
  isStreaksLoading,
  streaksError,
} = useHabits()

type HabitStreakDisplayItem = HabitStreakStat & {
  name: string
}

const emptyStreak = (habitId: string): HabitStreakStat => ({
  habitId,
  currentStreak: 0,
  longestStreak: 0,
  daysToBeatLongest: 1,
})

const streakItems = computed<HabitStreakDisplayItem[]>(() => {
  const streakByHabitId = new Map(
    activeHabitStreaks.value.map((streak) => [streak.habitId, streak]),
  )

  return activeHabits.value.map((habit) => ({
    ...(streakByHabitId.get(habit.id) ?? emptyStreak(habit.id)),
    name: habit.name,
  }))
})

const findHighest = (
  key: 'currentStreak' | 'longestStreak',
): HabitStreakDisplayItem | null =>
  streakItems.value.reduce<HabitStreakDisplayItem | null>(
    (highest, item) => (!highest || item[key] > highest[key] ? item : highest),
    null,
  )

const longestStreakHabit = computed(() => findHighest('longestStreak'))
const currentStreakHabit = computed(() => findHighest('currentStreak'))

const closestRecordHabit = computed(() =>
  streakItems.value.reduce<HabitStreakDisplayItem | null>(
    (closest, item) =>
      !closest || item.daysToBeatLongest < closest.daysToBeatLongest
        ? item
        : closest,
    null,
  ),
)

const loading = computed(() => isLoading.value || isStreaksLoading.value)
const daysLabel = (days: number) => (days === 1 ? 'day' : 'days')
</script>

<template>
  <section
    :class="
      compact
        ? 'rounded-xl border border-default bg-default p-5 shadow-sm sm:p-6'
        : 'mb-6 rounded-xl border border-default bg-elevated/35 p-4 sm:p-5'
    "
    aria-labelledby="habit-streaks-title"
  >
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2
          id="habit-streaks-title"
          class="font-semibold text-highlighted"
          :class="compact ? 'text-lg' : 'text-base'"
        >
          Habit streaks
        </h2>
        <p class="mt-1 text-sm text-muted">
          Keep today’s momentum and move closer to a new personal best.
        </p>
      </div>
      <UButton
        v-if="compact"
        to="/dashboard/habits"
        color="neutral"
        variant="link"
        trailing-icon="i-lucide-arrow-right"
      >
        View details
      </UButton>
    </header>

    <div v-if="loading" class="mt-5 grid gap-3 sm:grid-cols-3">
      <USkeleton v-for="index in 3" :key="index" class="h-24 w-full" />
    </div>

    <p
      v-else-if="streaksError"
      role="alert"
      class="mt-5 rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error"
    >
      Couldn’t load habit streaks.
    </p>

    <div
      v-else-if="streakItems.length === 0"
      class="mt-5 rounded-lg border border-dashed border-default px-4 py-7 text-center"
    >
      <p class="text-sm font-medium text-highlighted">No active habits</p>
      <UButton
        to="/dashboard/habits"
        color="neutral"
        variant="link"
        class="mt-1"
      >
        Create a habit
      </UButton>
    </div>

    <div v-else-if="compact" class="mt-5 grid gap-3 sm:grid-cols-3">
      <div class="rounded-xl bg-elevated/65 p-4" data-testid="longest-streak">
        <div class="flex items-center gap-2 text-sm text-muted">
          <UIcon name="i-lucide-trophy" class="size-4 text-warning" />
          Longest streak
        </div>
        <p class="mt-2 text-2xl font-semibold text-highlighted">
          {{ longestStreakHabit?.longestStreak ?? 0 }}
          <span class="text-xs font-normal text-muted">days</span>
        </p>
        <p class="mt-1 truncate text-xs text-muted">
          {{ longestStreakHabit?.name }}
        </p>
      </div>

      <div class="rounded-xl bg-elevated/65 p-4" data-testid="current-streak">
        <div class="flex items-center gap-2 text-sm text-muted">
          <UIcon name="i-lucide-flame" class="size-4 text-error" />
          Best current streak
        </div>
        <p class="mt-2 text-2xl font-semibold text-highlighted">
          {{ currentStreakHabit?.currentStreak ?? 0 }}
          <span class="text-xs font-normal text-muted">days</span>
        </p>
        <p class="mt-1 truncate text-xs text-muted">
          {{ currentStreakHabit?.name }}
        </p>
      </div>

      <div class="rounded-xl bg-elevated/65 p-4" data-testid="days-to-beat">
        <div class="flex items-center gap-2 text-sm text-muted">
          <UIcon name="i-lucide-goal" class="size-4 text-primary" />
          Next personal best
        </div>
        <p class="mt-2 text-2xl font-semibold text-highlighted">
          {{ closestRecordHabit?.daysToBeatLongest ?? 1 }}
          <span class="text-xs font-normal text-muted">
            {{ daysLabel(closestRecordHabit?.daysToBeatLongest ?? 1) }}
          </span>
        </p>
        <p class="mt-1 truncate text-xs text-muted">
          {{ closestRecordHabit?.name }}
        </p>
      </div>
    </div>

    <div v-else class="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="item in streakItems"
        :key="item.habitId"
        class="rounded-xl border border-default bg-default p-4"
        :data-habit-streak-id="item.habitId"
      >
        <div class="flex min-w-0 items-center gap-2">
          <span
            class="grid size-8 shrink-0 place-items-center rounded-full bg-error/10"
          >
            <UIcon name="i-lucide-flame" class="size-4 text-error" />
          </span>
          <h3 class="truncate text-sm font-semibold text-highlighted">
            {{ item.name }}
          </h3>
        </div>

        <dl class="mt-4 grid grid-cols-3 gap-2 text-center">
          <div class="rounded-lg bg-elevated/60 px-2 py-3">
            <dt class="text-[11px] text-muted">Current</dt>
            <dd class="mt-1 text-lg font-semibold text-highlighted">
              {{ item.currentStreak }}
            </dd>
          </div>
          <div class="rounded-lg bg-elevated/60 px-2 py-3">
            <dt class="text-[11px] text-muted">Longest</dt>
            <dd class="mt-1 text-lg font-semibold text-highlighted">
              {{ item.longestStreak }}
            </dd>
          </div>
          <div class="rounded-lg bg-elevated/60 px-2 py-3">
            <dt class="text-[11px] text-muted">To beat</dt>
            <dd class="mt-1 text-lg font-semibold text-highlighted">
              {{ item.daysToBeatLongest }}
            </dd>
          </div>
        </dl>
      </article>
    </div>
  </section>
</template>
