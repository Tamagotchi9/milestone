<script setup lang="ts">
import PomodoroStatsSummary from '~/components/dashboard/PomodoroStatsSummary.vue'

const PHASE = {
  work: 'work',
  shortBreak: 'shortBreak',
  longBreak: 'longBreak',
} as const

type Phase = (typeof PHASE)[keyof typeof PHASE]

const WORK_SEC = 25 * 60
const SHORT_SEC = 5 * 60
const LONG_SEC = 15 * 60

const POMODOROS_BEFORE_LONG_BREAK = 4
const TICK_MS = 1000
const TIME_PAD = 2

const durationFor = (p: Phase): number => {
  switch (p) {
    case PHASE.work:
      return WORK_SEC
    case PHASE.shortBreak:
      return SHORT_SEC
    case PHASE.longBreak:
      return LONG_SEC
  }
}

const phase = ref<Phase>(PHASE.work)
const secondsLeft = ref(WORK_SEC)
const isRunning = ref(false)
const completedPomodoros = ref(0)
const { focusedTask, setFocusedTask, getTasks } = useTasks()
const {
  currentSessionId,
  stats,
  startSession,
  pauseSession,
  resumeSession,
  completeSession,
  abandonSession,
  fetchStats,
} = usePomodoroSessions()

const abandonActiveSession = () => {
  void abandonSession()
}

onMounted(() => {
  getTasks()
  fetchStats(focusedTask.value?.id ?? null)
  window.addEventListener('pagehide', abandonActiveSession)
})

/** Skip watch side-effects when phase changes from auto-cycle */
const suppressPhaseWatch = ref(false)

const tabItems = [
  { value: PHASE.work, label: 'Focus', icon: 'i-lucide-focus' },
  {
    value: PHASE.shortBreak,
    label: 'Short break',
    icon: 'i-lucide-coffee',
  },
  {
    value: PHASE.longBreak,
    label: 'Long break',
    icon: 'i-lucide-armchair',
  },
]

let tick: ReturnType<typeof setInterval> | null = null

const timeLabel = computed(() => {
  const m = Math.floor(secondsLeft.value / 60)
  const s = secondsLeft.value % 60
  return `${String(m).padStart(TIME_PAD, '0')}:${String(s).padStart(TIME_PAD, '0')}`
})

const phaseLabel = computed(
  () => tabItems.find((item) => item.value === phase.value)?.label ?? 'Focus',
)

const runningTabTitle = computed(
  () => `${timeLabel.value} · ${phaseLabel.value}`,
)

useHead(() => ({
  title: isRunning.value ? runningTabTitle.value : undefined,
}))

const clearTick = () => {
  if (tick !== null) {
    clearInterval(tick)
    tick = null
  }
}

const maybeNotify = () => {
  if (typeof Notification === 'undefined') return
  if (Notification.permission !== 'granted') return
  const p = phase.value
  const body =
    p === PHASE.work
      ? 'Focus session finished. Time for a break.'
      : 'Break finished. Back to focus.'
  new Notification('Pomidoro', { body })
}

const onPhaseComplete = async () => {
  maybeNotify()

  suppressPhaseWatch.value = true
  try {
    if (phase.value === PHASE.work) {
      await completeSession()
      await fetchStats(focusedTask.value?.id ?? null)
      completedPomodoros.value++
      const next: Phase =
        completedPomodoros.value % POMODOROS_BEFORE_LONG_BREAK === 0
          ? PHASE.longBreak
          : PHASE.shortBreak
      phase.value = next
      secondsLeft.value = durationFor(next)
    } else {
      phase.value = PHASE.work
      secondsLeft.value = WORK_SEC
    }
  } finally {
    suppressPhaseWatch.value = false
  }
}

const startTick = () => {
  clearTick()
  tick = setInterval(() => {
    if (!isRunning.value) return
    if (secondsLeft.value <= 0) return
    secondsLeft.value -= 1
    if (secondsLeft.value <= 0) {
      void onPhaseComplete()
    }
  }, TICK_MS)
}

watch(phase, (nextPhase, previousPhase) => {
  if (suppressPhaseWatch.value) return
  if (
    previousPhase === PHASE.work &&
    nextPhase !== PHASE.work
  ) {
    abandonActiveSession()
  }
  secondsLeft.value = durationFor(phase.value)
  isRunning.value = false
  clearTick()
})

watch(
  () => focusedTask.value?.id ?? null,
  (taskId) => {
    fetchStats(taskId)
  },
)

const toggleRunning = () => {
  if (secondsLeft.value <= 0) {
    secondsLeft.value = durationFor(phase.value)
  }
  isRunning.value = !isRunning.value
  if (isRunning.value) {
    if (phase.value === PHASE.work) {
      if (currentSessionId.value) {
        void resumeSession()
      } else {
        void startSession(focusedTask.value?.id ?? null)
      }
    }
    startTick()
  } else {
    clearTick()
    if (phase.value === PHASE.work && currentSessionId.value) {
      void pauseSession()
    }
  }
}

const resetSession = () => {
  abandonActiveSession()
  isRunning.value = false
  clearTick()
  suppressPhaseWatch.value = true
  try {
    phase.value = PHASE.work
    secondsLeft.value = WORK_SEC
    completedPomodoros.value = 0
  } finally {
    suppressPhaseWatch.value = false
  }
}

const clearFocusTask = () => {
  setFocusedTask(null)
}

onBeforeUnmount(() => {
  clearTick()
  window.removeEventListener('pagehide', abandonActiveSession)
  abandonActiveSession()
})
</script>

<template>
  <UCard class="w-full max-w-lg">
    <template #header>
      <div class="space-y-1 text-center">
        <h1 class="text-2xl font-semibold text-highlighted">Pomidoro</h1>
        <p class="text-sm text-muted">25 / 5 / 15 classic Pomodoro</p>
        <p v-if="focusedTask" class="text-sm text-default">
          Focusing on:
          <span class="font-medium text-highlighted">{{
            focusedTask.title
          }}</span>
        </p>
      </div>
    </template>

    <div class="space-y-8">
      <UTabs
        v-model="phase"
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
