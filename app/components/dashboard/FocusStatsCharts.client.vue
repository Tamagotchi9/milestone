<script setup lang="ts">
import type { BulletLegendItemInterface } from 'nuxt-charts/types'
import type { PomodoroDailyStat } from '~/types/pomodoro.types'
import { formatFocusDuration } from '~/utils/formatFocusDuration'

const props = defineProps<{
  stats: PomodoroDailyStat[]
  focusedTaskTitle?: string | null
  loading?: boolean
  error?: string | null
}>()

type FocusChartDatum = {
  date: string
  label: string
  totalMinutes: number
  focusedMinutes: number
  totalPomodoros: number
  focusedPomodoros: number
}

type FocusPomodoroSeries = 'totalPomodoros' | 'focusedPomodoros'

const CHART_HEIGHT = 260

const formatDate = (
  date: string,
  options: Intl.DateTimeFormatOptions,
): string =>
  new Intl.DateTimeFormat(undefined, options).format(
    new Date(`${date}T12:00:00`),
  )

const chartData = computed<FocusChartDatum[]>(() =>
  props.stats.map((stat) => ({
    date: stat.date,
    label: formatDate(stat.date, { month: 'short', day: 'numeric' }),
    totalMinutes: Number((stat.secondsTotal / 60).toFixed(1)),
    focusedMinutes: Number((stat.secondsForTask / 60).toFixed(1)),
    totalPomodoros: stat.completedTotal,
    focusedPomodoros: stat.completedForTask,
  })),
)

const hasFocusedTask = computed(() => Boolean(props.focusedTaskTitle))

const minuteCategories = computed<Record<string, BulletLegendItemInterface>>(
  () => ({
    totalMinutes: { name: 'All focus time' },
    ...(hasFocusedTask.value
      ? { focusedMinutes: { name: 'Focused task' } }
      : {}),
  }),
)

const pomodoroCategories = computed<Record<string, BulletLegendItemInterface>>(
  () => ({
    totalPomodoros: { name: 'All pomodoros' },
    ...(hasFocusedTask.value
      ? { focusedPomodoros: { name: 'Focused task' } }
      : {}),
  }),
)

const pomodoroSeries = computed<FocusPomodoroSeries[]>(() =>
  hasFocusedTask.value
    ? ['totalPomodoros', 'focusedPomodoros']
    : ['totalPomodoros'],
)

const totalSeconds = computed(() =>
  props.stats.reduce((total, stat) => total + stat.secondsTotal, 0),
)

const totalPomodoros = computed(() =>
  props.stats.reduce((total, stat) => total + stat.completedTotal, 0),
)

const hasData = computed(() => totalPomodoros.value > 0)

const tooltipTitleFormatter = (datum: FocusChartDatum) =>
  formatDate(datum.date, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

const minutesFormatter = (value: number) => `${value}m`
const pomodorosFormatter = (value: number) => `${value}`
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold text-highlighted">Focus stats</h2>
          <p class="mt-1 text-sm text-muted">
            Daily focus activity for the last 14 days.
          </p>
        </div>
        <UBadge
          v-if="focusedTaskTitle"
          color="primary"
          variant="soft"
          class="max-w-full"
        >
          <span class="truncate">{{ focusedTaskTitle }}</span>
        </UBadge>
      </div>
    </template>

    <p
      v-if="error"
      role="alert"
      class="rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error"
    >
      Couldn’t load focus analytics.
    </p>

    <div
      v-else-if="!loading && !hasData"
      class="rounded-xl border border-dashed border-default px-5 py-10 text-center"
    >
      <UIcon
        name="i-lucide-chart-no-axes-column"
        class="mx-auto size-9 text-muted"
      />
      <p class="mt-3 text-sm font-medium text-highlighted">
        No completed focus sessions yet
      </p>
      <p class="mt-1 text-sm text-muted">
        Your daily focus trends will appear here after the first pomodoro.
      </p>
    </div>

    <div v-else class="grid gap-6 xl:grid-cols-2">
      <section class="min-w-0 rounded-xl bg-elevated/45 p-4 sm:p-5">
        <div class="mb-4">
          <p class="text-sm font-medium text-muted">Focus time</p>
          <p class="mt-1 text-2xl font-semibold text-highlighted">
            {{ formatFocusDuration(totalSeconds) }}
          </p>
        </div>
        <AreaChart
          :data="chartData"
          :height="CHART_HEIGHT"
          :categories="minuteCategories"
          x-axis="label"
          y-label="Minutes"
          :x-num-ticks="7"
          :y-num-ticks="4"
          :y-grid-line="true"
          :loading="loading"
          loading-label="Loading focus time"
          sync-id="focus-stats"
          :tooltip-title-formatter="tooltipTitleFormatter"
          :y-formatter="minutesFormatter"
          aria-label="Focus minutes by day"
          aria-description="Daily focus minutes for all tasks and the selected focused task over the last 14 days."
          variant="gradient"
        />
      </section>

      <section class="min-w-0 rounded-xl bg-elevated/45 p-4 sm:p-5">
        <div class="mb-4">
          <p class="text-sm font-medium text-muted">Completed pomodoros</p>
          <p class="mt-1 text-2xl font-semibold text-highlighted">
            {{ totalPomodoros }}
          </p>
        </div>
        <BarChart
          :data="chartData"
          :height="CHART_HEIGHT"
          :categories="pomodoroCategories"
          :y-axis="pomodoroSeries"
          x-axis="label"
          y-label="Pomodoros"
          :x-num-ticks="7"
          :y-num-ticks="4"
          :y-grid-line="true"
          :radius="5"
          :loading="loading"
          loading-label="Loading pomodoros"
          sync-id="focus-stats"
          :tooltip-title-formatter="tooltipTitleFormatter"
          :y-formatter="pomodorosFormatter"
          aria-label="Completed pomodoros by day"
          aria-description="Daily completed pomodoros for all tasks and the selected focused task over the last 14 days."
          variant="gradient"
        />
      </section>
    </div>
  </UCard>
</template>
