<script setup lang="ts">
import {
  endOfMonth,
  getDayOfWeek,
  parseDate,
  startOfMonth,
} from '@internationalized/date'
import type { Habit, HabitCalendarCell, HabitStats } from '~/types/habits.types'

const props = defineProps<{
  habit: Habit | null
  visibleMonth: string
  todayDate: string
  checkinDates: string[]
  stats: HabitStats
  loading?: boolean
  canGoPrevious: boolean
  canGoNext: boolean
  isTogglePending: (habitId: string, date: string) => boolean
}>()

const emit = defineEmits<{
  toggle: [date: string]
  previous: []
  next: []
}>()

const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const calendarCells = computed<HabitCalendarCell[]>(() => {
  if (!props.visibleMonth) return []

  const monthStart = startOfMonth(parseDate(props.visibleMonth))
  const monthEnd = endOfMonth(monthStart)
  const leadingDays = getDayOfWeek(monthStart, 'en-GB', 'mon')
  const cells: HabitCalendarCell[] = Array.from(
    { length: leadingDays },
    () => ({ date: null, dayNumber: null }),
  )

  for (let day = 1; day <= monthEnd.day; day += 1) {
    const date = monthStart.set({ day })
    cells.push({ date: date.toString(), dayNumber: day })
  }

  while (cells.length % 7 !== 0) {
    cells.push({ date: null, dayNumber: null })
  }
  return cells
})

const monthLabel = computed(() => {
  if (!props.visibleMonth) return ''
  const date = parseDate(props.visibleMonth)
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(date.year, date.month - 1, 1))
})

const completionRate = computed(() => {
  if (props.stats.eligibleDaysInMonth === 0) return 0
  return Math.round(
    (props.stats.completedInMonth / props.stats.eligibleDaysInMonth) * 100,
  )
})

const isCompleted = (date: string) => {
  if (date === props.todayDate && props.habit?.archivedOn) return false
  return props.checkinDates.includes(date)
}
const isToday = (date: string) => date === props.todayDate
const isEligible = (date: string) => {
  if (!props.habit) return false
  const eligibilityEnd = props.habit.archivedOn ?? props.todayDate
  return date >= props.habit.startsOn && date <= eligibilityEnd
}
const canToggle = (date: string) =>
  Boolean(props.habit && !props.habit.archivedOn && isEligible(date))

const getDateLabel = (date: string) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00`))

const getDayAriaLabel = (date: string) => {
  const label = getDateLabel(date)
  if (!isEligible(date)) return `${label}, not scheduled`
  if (props.habit?.archivedOn) {
    return `${label}, ${isCompleted(date) ? 'completed' : 'not completed'}, archived habit`
  }
  return isCompleted(date)
    ? `${label}, completed. Remove completion`
    : `${label}, not completed. Mark complete`
}
</script>

<template>
  <div
    v-if="!habit"
    class="flex min-h-80 items-center justify-center text-center"
  >
    <div>
      <UIcon name="i-lucide-calendar-days" class="mx-auto size-9 text-muted" />
      <p class="mt-3 text-sm font-medium text-highlighted">Choose a habit</p>
      <p class="mt-1 text-sm text-muted">
        Its day-by-day history will appear here.
      </p>
    </div>
  </div>

  <div v-else class="space-y-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <h3 class="truncate text-lg font-semibold text-highlighted">
            {{ habit.name }}
          </h3>
          <UBadge v-if="habit.archivedOn" color="neutral" variant="soft">
            Archived
          </UBadge>
        </div>
        <p class="mt-1 text-xs text-muted">Daily since {{ habit.startsOn }}</p>
      </div>

      <div class="flex items-center gap-1">
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          square
          icon="i-lucide-chevron-left"
          aria-label="Previous month"
          :disabled="!canGoPrevious || loading"
          @click="emit('previous')"
        />
        <p class="min-w-32 text-center text-sm font-medium text-highlighted">
          {{ monthLabel }}
        </p>
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          square
          icon="i-lucide-chevron-right"
          aria-label="Next month"
          :disabled="!canGoNext || loading"
          @click="emit('next')"
        />
      </div>
    </div>

    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <div class="rounded-lg bg-elevated/70 p-3">
        <p class="text-xs text-muted">Current streak</p>
        <p class="mt-1 text-xl font-semibold text-highlighted">
          {{ stats.currentStreak }}
          <span class="text-xs font-normal text-muted">days</span>
        </p>
      </div>
      <div class="rounded-lg bg-elevated/70 p-3">
        <p class="text-xs text-muted">This month</p>
        <p class="mt-1 text-xl font-semibold text-highlighted">
          {{ completionRate }}%
        </p>
      </div>
      <div class="col-span-2 rounded-lg bg-elevated/70 p-3 sm:col-span-1">
        <p class="text-xs text-muted">Completed</p>
        <p class="mt-1 text-xl font-semibold text-highlighted">
          {{ stats.completedInMonth }}
          <span class="text-xs font-normal text-muted">
            / {{ stats.eligibleDaysInMonth }}
          </span>
        </p>
      </div>
    </div>

    <div class="relative" :aria-busy="loading">
      <div class="grid grid-cols-7 gap-1.5">
        <div
          v-for="weekday in weekdayLabels"
          :key="weekday"
          class="pb-1 text-center text-[11px] font-medium text-muted"
        >
          {{ weekday }}
        </div>

        <template
          v-for="(cell, index) in calendarCells"
          :key="cell.date ?? `blank-${index}`"
        >
          <div v-if="!cell.date" class="aspect-square" aria-hidden="true" />
          <button
            v-else
            type="button"
            class="relative flex aspect-square min-h-9 items-center justify-center rounded-md border text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            :class="[
              isCompleted(cell.date)
                ? 'border-primary bg-primary text-inverted'
                : isEligible(cell.date)
                  ? 'border-default bg-default text-highlighted hover:bg-elevated'
                  : 'border-transparent bg-elevated/40 text-dimmed',
              isToday(cell.date)
                ? 'ring-2 ring-primary/40 ring-offset-1 ring-offset-default'
                : '',
              !canToggle(cell.date) ? 'cursor-default' : '',
            ]"
            :disabled="
              !canToggle(cell.date) || isTogglePending(habit.id, cell.date)
            "
            :aria-label="getDayAriaLabel(cell.date)"
            :aria-pressed="
              isEligible(cell.date) ? isCompleted(cell.date) : undefined
            "
            @click="emit('toggle', cell.date)"
          >
            <UIcon
              v-if="isCompleted(cell.date)"
              name="i-lucide-check"
              class="size-4"
            />
            <span v-else>{{ cell.dayNumber }}</span>
          </button>
        </template>
      </div>

      <div
        v-if="loading"
        class="absolute inset-0 flex items-center justify-center rounded-lg bg-default/65"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="size-5 animate-spin text-primary"
        />
      </div>
    </div>
  </div>
</template>
