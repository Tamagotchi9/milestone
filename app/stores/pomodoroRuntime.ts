import type { PomodoroPhase } from '~/types/pomodoro.types'
import {
  disposePomodoroSounds,
  playPomodoroSound,
  POMODORO_SOUND,
} from '~/utils/pomodoroSounds'

export const POMODORO_PHASE = {
  work: 'work',
  shortBreak: 'shortBreak',
  longBreak: 'longBreak',
} as const satisfies Record<string, PomodoroPhase>

const WORK_SECONDS = 25 * 60
const SHORT_BREAK_SECONDS = 5 * 60
const LONG_BREAK_SECONDS = 15 * 60
const POMODOROS_BEFORE_LONG_BREAK = 4
const TICK_INTERVAL_MS = 1000
const TIME_PAD_LENGTH = 2

const durationFor = (phase: PomodoroPhase): number => {
  switch (phase) {
    case POMODORO_PHASE.work:
      return WORK_SECONDS
    case POMODORO_PHASE.shortBreak:
      return SHORT_BREAK_SECONDS
    case POMODORO_PHASE.longBreak:
      return LONG_BREAK_SECONDS
  }
}

export const usePomodoroRuntimeStore = defineStore('pomodoroRuntime', () => {
  const phase = ref<PomodoroPhase>(POMODORO_PHASE.work)
  const secondsRemaining = ref(WORK_SECONDS)
  const isRunning = ref(false)
  const completedPomodoros = ref(0)
  const deadlineMs = ref<number | null>(null)
  const isCompleting = ref(false)
  const isTransitioning = ref(false)
  const activeTaskId = ref<string | null>(null)
  const activeTaskTitle = ref<string | null>(null)
  const isFocusTaskCaptured = ref(false)

  const { tasks, focusedTask, getTasks } = useTasks()
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

  let tickInterval: ReturnType<typeof setInterval> | null = null
  let stopStatsWatch: (() => void) | null = null
  let isInitialized = false
  let shutdownPromise: Promise<void> | null = null

  const timeLabel = computed(() => {
    const minutes = Math.floor(secondsRemaining.value / 60)
    const seconds = secondsRemaining.value % 60
    return `${String(minutes).padStart(TIME_PAD_LENGTH, '0')}:${String(seconds).padStart(TIME_PAD_LENGTH, '0')}`
  })

  const phaseLabel = computed(() => {
    switch (phase.value) {
      case POMODORO_PHASE.work:
        return 'Focus'
      case POMODORO_PHASE.shortBreak:
        return 'Short break'
      case POMODORO_PHASE.longBreak:
        return 'Long break'
    }
  })

  const runningTabTitle = computed(
    () => `${timeLabel.value} · ${phaseLabel.value}`,
  )

  const focusedTaskTitle = computed(() => {
    if (isFocusTaskCaptured.value) {
      return (
        tasks.value.find((task) => task.id === activeTaskId.value)?.title ??
        activeTaskTitle.value
      )
    }
    return focusedTask.value?.title ?? null
  })

  const clearTick = () => {
    if (tickInterval === null) return
    clearInterval(tickInterval)
    tickInterval = null
  }

  const syncRemainingToDeadline = () => {
    if (!isRunning.value || deadlineMs.value === null) return
    secondsRemaining.value = Math.max(
      0,
      Math.ceil((deadlineMs.value - Date.now()) / 1000),
    )
  }

  const beginDeadline = () => {
    deadlineMs.value = Date.now() + secondsRemaining.value * 1000
  }

  const resetLocalRuntime = () => {
    phase.value = POMODORO_PHASE.work
    secondsRemaining.value = WORK_SECONDS
    isRunning.value = false
    completedPomodoros.value = 0
    deadlineMs.value = null
    isCompleting.value = false
    isTransitioning.value = false
    activeTaskId.value = null
    activeTaskTitle.value = null
    isFocusTaskCaptured.value = false
  }

  const notifyPhaseComplete = (completedPhase: PomodoroPhase) => {
    if (typeof Notification === 'undefined') return
    if (Notification.permission !== 'granted') return

    const body =
      completedPhase === POMODORO_PHASE.work
        ? 'Focus session finished. Time for a break.'
        : 'Break finished. Back to focus.'
    new Notification('Pomidoro', { body })
  }

  const captureFocusedTask = () => {
    activeTaskId.value = focusedTask.value?.id ?? null
    activeTaskTitle.value = focusedTask.value?.title ?? null
    isFocusTaskCaptured.value = true
  }

  const completeCurrentPhase = async () => {
    if (isCompleting.value || !isRunning.value) return

    isCompleting.value = true
    const completedPhase = phase.value
    deadlineMs.value = null
    secondsRemaining.value = 0
    playPomodoroSound(POMODORO_SOUND.complete)

    try {
      if (completedPhase === POMODORO_PHASE.work) {
        await completeSession()
        completedPomodoros.value += 1
        await fetchStats(focusedTask.value?.id ?? null)
      }

      notifyPhaseComplete(completedPhase)
      if (!isInitialized) return

      if (completedPhase === POMODORO_PHASE.work) {
        phase.value =
          completedPomodoros.value % POMODOROS_BEFORE_LONG_BREAK === 0
            ? POMODORO_PHASE.longBreak
            : POMODORO_PHASE.shortBreak
        activeTaskId.value = null
        activeTaskTitle.value = null
        isFocusTaskCaptured.value = false
        playPomodoroSound(POMODORO_SOUND.break)
      } else {
        phase.value = POMODORO_PHASE.work
        captureFocusedTask()
        playPomodoroSound(POMODORO_SOUND.focus)
      }

      secondsRemaining.value = durationFor(phase.value)
      beginDeadline()

      if (phase.value === POMODORO_PHASE.work) {
        await startSession(activeTaskId.value)
      }
    } finally {
      isCompleting.value = false
    }
  }

  const tick = () => {
    if (!isRunning.value || isCompleting.value) return
    syncRemainingToDeadline()
    if (secondsRemaining.value === 0) {
      completeCurrentPhase()
    }
  }

  const startTick = () => {
    if (tickInterval !== null) return
    tickInterval = setInterval(tick, TICK_INTERVAL_MS)
  }

  const start = async () => {
    if (
      !isInitialized ||
      isRunning.value ||
      isCompleting.value ||
      isTransitioning.value
    )
      return

    isTransitioning.value = true
    try {
      if (secondsRemaining.value <= 0) {
        secondsRemaining.value = durationFor(phase.value)
      }

      isRunning.value = true
      beginDeadline()
      playPomodoroSound(POMODORO_SOUND.start)

      if (phase.value !== POMODORO_PHASE.work) return

      if (currentSessionId.value) {
        await resumeSession()
        return
      }

      captureFocusedTask()
      await startSession(activeTaskId.value)
    } finally {
      isTransitioning.value = false
    }
  }

  const pause = async () => {
    if (
      !isInitialized ||
      !isRunning.value ||
      isCompleting.value ||
      isTransitioning.value
    )
      return

    isTransitioning.value = true
    try {
      syncRemainingToDeadline()
      isRunning.value = false
      deadlineMs.value = null

      if (phase.value === POMODORO_PHASE.work) {
        await pauseSession()
      }
    } finally {
      isTransitioning.value = false
    }
  }

  const toggleRunning = async () => {
    if (isRunning.value) {
      await pause()
      return
    }
    await start()
  }

  const selectPhase = async (nextPhase: PomodoroPhase) => {
    if (
      !isInitialized ||
      nextPhase === phase.value ||
      isCompleting.value ||
      isTransitioning.value
    )
      return

    isTransitioning.value = true
    try {
      const shouldAbandonFocus =
        phase.value === POMODORO_PHASE.work &&
        (currentSessionId.value !== null || isRunning.value)

      isRunning.value = false
      deadlineMs.value = null

      if (shouldAbandonFocus) {
        await abandonSession()
      }

      activeTaskId.value = null
      activeTaskTitle.value = null
      isFocusTaskCaptured.value = false
      phase.value = nextPhase
      secondsRemaining.value = durationFor(nextPhase)
    } finally {
      isTransitioning.value = false
    }
  }

  const resetSession = async () => {
    if (!isInitialized || isCompleting.value || isTransitioning.value) return

    isTransitioning.value = true
    try {
      isRunning.value = false
      deadlineMs.value = null
      await abandonSession()
      resetLocalRuntime()
    } finally {
      isTransitioning.value = false
    }
  }

  const shutdown = (): Promise<void> => {
    if (shutdownPromise) return shutdownPromise

    isInitialized = false
    isTransitioning.value = false
    clearTick()
    if (import.meta.client) {
      window.removeEventListener('pagehide', handlePageHide)
    }
    stopStatsWatch?.()
    stopStatsWatch = null
    isRunning.value = false
    deadlineMs.value = null

    const pendingShutdown = (async () => {
      await Promise.all([abandonSession(), disposePomodoroSounds()])
      resetLocalRuntime()
    })()

    shutdownPromise = pendingShutdown
    pendingShutdown.finally(() => {
      if (shutdownPromise === pendingShutdown) {
        shutdownPromise = null
      }
    })
    return pendingShutdown
  }

  const handlePageHide = () => {
    shutdown()
  }

  const initialize = async () => {
    if (isInitialized) return
    if (shutdownPromise) await shutdownPromise

    isInitialized = true
    startTick()
    if (import.meta.client) {
      window.addEventListener('pagehide', handlePageHide)
    }
    stopStatsWatch = watch(
      () => focusedTask.value?.id ?? null,
      (taskId) => {
        fetchStats(taskId)
      },
      { immediate: true },
    )
    await getTasks()
  }

  return {
    phase,
    secondsRemaining,
    isRunning,
    completedPomodoros,
    deadlineMs,
    isCompleting,
    isTransitioning,
    stats,
    timeLabel,
    phaseLabel,
    runningTabTitle,
    focusedTaskTitle,
    initialize,
    toggleRunning,
    selectPhase,
    resetSession,
    shutdown,
  }
})
