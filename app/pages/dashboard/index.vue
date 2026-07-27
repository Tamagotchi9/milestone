<script setup lang="ts">
import PomodoroStatsSummary from '~/components/dashboard/PomodoroStatsSummary.vue'

definePageMeta({ layout: 'dashboard' })

const currentUserStore = useCurrentUserStore()
const { focusedTask, getTasks } = useTasks()
const { stats, fetchStats, isStatsLoading, statsError } = usePomodoroSessions()

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
  await getTasks()
})

watch(
  () => focusedTask.value?.id ?? null,
  (taskId) => {
    void fetchStats(taskId)
  },
  { immediate: true },
)
</script>

<template>
  <div class="p-6 md:p-10 max-w-3xl space-y-4">
    <UCard>
      <template #header>
        <div class="space-y-1">
          <h1 class="text-2xl font-semibold text-highlighted">
            Welcome back, {{ displayName }}
          </h1>
          <p class="text-sm text-muted">
            Pick a section from the sidebar to get started.
          </p>
        </div>
      </template>

      <p class="text-muted">
        Plan your
        <NuxtLink
          to="/dashboard/tasks"
          class="font-medium text-primary hover:underline"
        >
          Tasks
        </NuxtLink>
        and then start
        <NuxtLink
          to="/dashboard/pomidoro"
          class="font-medium text-primary hover:underline"
        >
          Pomidoro
        </NuxtLink>
        for a focused work session.
      </p>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold text-highlighted">Focus stats</h2>
      </template>
      <p v-if="isStatsLoading" class="text-sm text-muted">Loading stats…</p>
      <p v-else-if="statsError" class="text-sm text-muted">
        Couldn’t load stats.
      </p>
      <PomodoroStatsSummary
        v-else
        :stats="stats"
        :focused-task-title="focusedTask?.title ?? null"
      />
    </UCard>
  </div>
</template>
