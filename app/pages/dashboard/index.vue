<script setup lang="ts">
import { getLocalTimeZone, today } from '@internationalized/date'
import FocusStatsCharts from '~/components/dashboard/FocusStatsCharts.client.vue'
import HabitStreakOverview from '~/components/dashboard/habits/HabitStreakOverview.vue'
import HabitTodayStepper from '~/components/dashboard/habits/HabitTodayStepper.vue'

definePageMeta({ layout: 'dashboard' })

const currentUserStore = useCurrentUserStore()
const { focusedTask, getTasks } = useTasks()
const { dailyStats, fetchDailyStats, isDailyStatsLoading, dailyStatsError } =
  usePomodoroSessions()
const localToday = ref('')
const localTimeZone = ref('')

const displayName = computed(() => {
  const meta = currentUserStore.user?.user_metadata as
    | { full_name?: string }
    | undefined
  const fromMeta = meta?.full_name?.trim()
  if (fromMeta) return fromMeta
  const email = currentUserStore.user?.email
  if (email) return email.split('@')[0] ?? email
  return 'there'
})

onMounted(async () => {
  localTimeZone.value = getLocalTimeZone()
  localToday.value = today(localTimeZone.value).toString()
  await getTasks()
})

watch(
  [localToday, localTimeZone, () => focusedTask.value?.id ?? null],
  ([currentDate, timeZone, taskId]) => {
    if (!currentDate || !timeZone) return
    void fetchDailyStats({
      today: currentDate,
      timeZone,
      taskId,
    })
  },
  { immediate: true },
)
</script>

<template>
  <div class="max-w-6xl space-y-4 p-6 md:p-10">
    <h1 class="text-2xl font-semibold text-highlighted">
      Welcome back, {{ displayName }}
    </h1>

    <HabitTodayStepper />

    <HabitStreakOverview compact />

    <FocusStatsCharts
      :stats="dailyStats"
      :focused-task-title="focusedTask?.title ?? null"
      :loading="isDailyStatsLoading"
      :error="dailyStatsError"
    />
  </div>
</template>
