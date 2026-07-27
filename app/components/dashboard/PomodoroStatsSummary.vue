<script setup lang="ts">
import { formatFocusDuration } from '~/utils/formatFocusDuration'
import type { PomodoroStats } from '~/types/pomodoro.types'

const props = defineProps<{
  stats: PomodoroStats
  focusedTaskTitle?: string | null
  compact?: boolean
}>()

const todayLine = computed(
  () =>
    `${props.stats.completedToday} pomodoros · ${formatFocusDuration(props.stats.secondsToday)}`,
)

const weekLine = computed(
  () =>
    `${props.stats.completedWeek} pomodoros · ${formatFocusDuration(props.stats.secondsWeek)}`,
)

const taskLine = computed(() => {
  if (!props.focusedTaskTitle) return null
  return `${props.focusedTaskTitle}: ${props.stats.completedForTask} · ${formatFocusDuration(props.stats.secondsForTask)} (week)`
})
</script>

<template>
  <div
    class="space-y-1 text-sm"
    :class="compact ? 'text-center text-muted' : 'text-muted'"
  >
    <p>
      <span class="font-medium text-highlighted">Today:</span>
      {{ todayLine }}
    </p>
    <p>
      <span class="font-medium text-highlighted">This week:</span>
      {{ weekLine }}
    </p>
    <p v-if="taskLine">
      <span class="font-medium text-highlighted">Focused task:</span>
      {{ taskLine }}
    </p>
  </div>
</template>
