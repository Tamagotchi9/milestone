<script setup lang="ts">
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
const { focusedTask, setFocusedTask } = useTasks()

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

const minutes = computed({
  get: () => Math.floor(secondsLeft.value / 60),
  set: (value: number) => {
    const safe = Math.min(99, Math.max(0, value))
    const secs = seconds.value
    secondsLeft.value = safe * 60 + secs
  }
})

const onMinutesInput = (e: Event) => {
  if (isLocked.value) return

  const el = e.target as HTMLInputElement

  const cleaned = el.value.replace(/\D/g, '').slice(0, 2)

  const value = Number(cleaned || 0)

  minutes.value = Math.min(99, value)
}

const seconds = computed({
  get: () => secondsLeft.value % 60,
  set: (value: number) => {
    const mins = minutes.value
    const safe = Math.min(59, Math.max(0, value))

    secondsLeft.value = mins * 60 + safe
  }
})

const onSecondsInput = (e: Event) => {
  if (isLocked.value) return

  const el = e.target as HTMLInputElement

  const cleaned = el.value.replace(/\D/g, '').slice(0, 2)

  const value = Number(cleaned || 0)

  seconds.value = Math.min(59, value)
}

const adjustMinutes = (delta: number) => {
  const next = minutes.value + delta
  minutes.value = Math.min(99, Math.max(0, next))
}

const adjustSeconds = (delta: number) => {
  let sec = seconds.value + delta
  let min = minutes.value

  if (sec >= 60) {
    min += 1
    sec = 0
  }

  if (sec < 0) {
    if (min > 0) {
      min -= 1
      sec = 59
    } else {
      sec = 0
    }
  }

  minutes.value = Math.min(99, Math.max(0, min))
  seconds.value = sec
}
const isLocked = computed(() => isRunning.value)

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

const onPhaseComplete = () => {
  maybeNotify()

  suppressPhaseWatch.value = true
  try {
    if (phase.value === PHASE.work) {
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
      onPhaseComplete()
    }
  }, TICK_MS)
}

watch(phase, () => {
  if (suppressPhaseWatch.value) return
  secondsLeft.value = durationFor(phase.value)
  isRunning.value = false
  clearTick()
})

const toggleRunning = () => {
  if (secondsLeft.value <= 0) {
    secondsLeft.value = durationFor(phase.value)
  }
  isRunning.value = !isRunning.value
  if (isRunning.value) {
    startTick()
  } else {
    clearTick()
  }
}

const resetSession = () => {
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
          <span class="font-medium text-highlighted">{{ focusedTask.title }}</span>
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
        class="w-full max-w-md mx-auto [&_[role=tab]]:cursor-pointer"
      />

      <div class="flex justify-center">
        <div class="flex size-64 md:size-72 items-center justify-center group">
          <div class="flex items-center justify-center gap-6">
            <div class="flex flex-col items-center gap-2">
              <UButton
                v-if="!isLocked"
                size="xs"
                icon="i-lucide-plus"
                class="cursor-pointer opacity-0 group-hover:opacity-300 transition-opacity duration-300"
                @click="adjustMinutes(1)"
              />

              <input
                :value="minutes"
                type="text"
                inputmode="numeric"
                maxlength="2"
                :disabled="isLocked"
                class="w-24 bg-transparent text-center font-mono text-5xl md:text-7xl font-semibold outline-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                @input="onMinutesInput"
              />

              <UButton
                v-if="!isLocked"
                size="xs"
                icon="i-lucide-minus"
                class="cursor-pointer opacity-0 group-hover:opacity-300 transition-opacity duration-300"
                @click="adjustMinutes(-1)"
              />
            </div>

            <span class="font-mono text-5xl md:text-7xl font-semibold">:</span>

            <div class="flex flex-col items-center gap-2">
              <UButton
                v-if="!isLocked"
                size="xs"
                icon="i-lucide-plus"
                class="cursor-pointer opacity-0 group-hover:opacity-300 transition-opacity duration-300"
                @click="adjustSeconds(1)"
              />

              <input
                :value="seconds"
                type="text"
                inputmode="numeric"
                maxlength="2"
                :disabled="isLocked"
                class="w-24 bg-transparent text-center font-mono text-5xl md:text-7xl font-semibold outline-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                @input="onSecondsInput"
              />

              <UButton
                v-if="!isLocked"
                size="xs"
                icon="i-lucide-minus"
                class="cursor-pointer opacity-0 group-hover:opacity-300 transition-opacity duration-300"
                @click="adjustSeconds(-1)"
              />
            </div>
          </div>
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
          class="h-14 min-h-14 min-w-0 flex-1 cursor-pointer justify-center text-base font-semibold transition-transform active:scale-[0.98]"
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
          class="h-14 min-h-14 min-w-0 flex-1 cursor-pointer justify-center font-medium"
          :ui="{ base: 'rounded-full' }"
          :icon="'i-lucide-rotate-ccw'"
          @click="resetSession"
        >
          Reset
        </UButton>
      </div>

      <p class="text-center text-sm text-muted">
        Completed pomodoros:
        <span class="font-medium text-highlighted">{{
            completedPomodoros
          }}</span>
      </p>

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
