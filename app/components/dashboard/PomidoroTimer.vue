<script setup lang="ts">
import { storeToRefs } from 'pinia'

import PomodoroStatsSummary from '~/components/dashboard/PomodoroStatsSummary.vue'
import type { PomodoroPhase } from '~/types/pomodoro.types'
import {
  POMODORO_PHASE,
  usePomodoroRuntimeStore,
} from '~/stores/pomodoroRuntime'

const pomodoroRuntimeStore = usePomodoroRuntimeStore()
const {
  phase,
  isRunning,
  isCompleting,
  isTransitioning,
  stats,
  timeLabel,
  focusedTaskTitle,
} = storeToRefs(pomodoroRuntimeStore)
const { focusedTask, setFocusedTask } = useTasks()

const selectedPhase = computed<PomodoroPhase>({
  get: () => phase.value,
  set: (nextPhase) => {
    void pomodoroRuntimeStore.selectPhase(nextPhase)
  },
})

const tabItems = [
  { value: POMODORO_PHASE.work, label: 'Focus', icon: 'i-lucide-focus' },
  {
    value: POMODORO_PHASE.shortBreak,
    label: 'Short break',
    icon: 'i-lucide-coffee',
  },
  {
    value: POMODORO_PHASE.longBreak,
    label: 'Long break',
    icon: 'i-lucide-armchair',
  },
] satisfies Array<{
  value: PomodoroPhase
  label: string
  icon: string
}>

const { toggleRunning, resetSession } = pomodoroRuntimeStore

const clearFocusTask = () => {
  setFocusedTask(null)
}
</script>

<template>
  <UCard class="w-full max-w-lg">
    <template #header>
      <div class="space-y-1 text-center">
        <h1 class="text-2xl font-semibold text-highlighted">Pomidoro</h1>
        <p class="text-sm text-muted">25 / 5 / 15 classic Pomodoro</p>
        <p v-if="focusedTaskTitle" class="text-sm text-default">
          Focusing on:
          <span class="font-medium text-highlighted">{{
            focusedTaskTitle
          }}</span>
        </p>
      </div>
    </template>

    <div class="space-y-8">
      <UTabs
        v-model="selectedPhase"
        :items="tabItems"
        :content="false"
        color="primary"
        variant="pill"
        size="md"
        class="w-full max-w-md mx-auto"
      />

      <div class="flex justify-center">
        <div class="flex size-64 md:size-72 items-center justify-center">
          <span
            class="font-mono text-5xl md:text-7xl font-semibold tabular-nums tracking-tight text-highlighted"
          >
            {{ timeLabel }}
          </span>
        </div>
      </div>

      <div
        class="mx-auto flex w-full max-w-md flex-col gap-3 sm:flex-row sm:items-stretch"
      >
        <UButton
          color="primary"
          variant="soft"
          size="lg"
          leading
          class="h-14 min-h-14 min-w-0 flex-1 justify-center text-base font-semibold transition-transform active:scale-[0.98]"
          :ui="{ base: 'rounded-full' }"
          :icon="isRunning ? 'i-lucide-pause' : 'i-lucide-play'"
          :disabled="isCompleting || isTransitioning"
          @click="toggleRunning"
        >
          {{ isRunning ? 'Pause' : 'Start' }}
        </UButton>
        <UButton
          color="neutral"
          variant="outline"
          size="lg"
          leading
          class="h-14 min-h-14 min-w-0 flex-1 justify-center font-medium"
          :ui="{ base: 'rounded-full' }"
          :icon="'i-lucide-rotate-ccw'"
          :disabled="isCompleting || isTransitioning"
          @click="resetSession"
        >
          Reset
        </UButton>
      </div>

      <PomodoroStatsSummary
        :stats="stats"
        :focused-task-title="focusedTask?.title ?? null"
        compact
      />

      <div v-if="focusedTask" class="text-center">
        <UButton
          size="sm"
          color="neutral"
          variant="ghost"
          icon="i-lucide-x"
          @click="clearFocusTask"
        >
          Clear focused task
        </UButton>
      </div>
    </div>
  </UCard>
</template>
