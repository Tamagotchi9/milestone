import type { Database } from '~/types/database.types'
import {
  EMPTY_POMODORO_STATS,
  type PomodoroStats,
} from '~/types/pomodoro.types'

const DEFAULT_DURATION_MINUTES = 25
type ClosingReason = 'complete' | 'abandon'

const toNumber = (value: number | string | null | undefined): number => {
  if (value == null) return 0
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

const mapStatsRow = (row: {
  completed_today: number | string
  seconds_today: number | string
  completed_week: number | string
  seconds_week: number | string
  completed_for_task: number | string
  seconds_for_task: number | string
}): PomodoroStats => ({
  completedToday: toNumber(row.completed_today),
  secondsToday: toNumber(row.seconds_today),
  completedWeek: toNumber(row.completed_week),
  secondsWeek: toNumber(row.seconds_week),
  completedForTask: toNumber(row.completed_for_task),
  secondsForTask: toNumber(row.seconds_for_task),
})

export const usePomodoroSessions = () => {
  const supabase = useSupabaseClient<Database>()
  let startPromise: Promise<string | null> | null = null
  let terminalPromise: Promise<void> | null = null
  let closingReason: ClosingReason | null = null

  const currentSessionId = useState<string | null>(
    'pomodoro.currentSessionId',
    () => null,
  )
  const stats = useState<PomodoroStats>(
    'pomodoro.stats',
    () => ({ ...EMPTY_POMODORO_STATS }),
  )
  const statsError = useState<string | null>('pomodoro.statsError', () => null)
  const isStatsLoading = useState<boolean>('pomodoro.statsLoading', () => false)

  const accumulatedSeconds = useState<number>(
    'pomodoro.accumulatedSeconds',
    () => 0,
  )
  const runningSinceMs = useState<number | null>(
    'pomodoro.runningSinceMs',
    () => null,
  )

  const flushElapsed = (): number => {
    if (runningSinceMs.value != null) {
      const delta = Math.max(
        0,
        Math.floor((Date.now() - runningSinceMs.value) / 1000),
      )
      accumulatedSeconds.value += delta
      runningSinceMs.value = null
    }
    return accumulatedSeconds.value
  }

  const resetTiming = () => {
    accumulatedSeconds.value = 0
    runningSinceMs.value = null
  }

  const clearSessionLocal = () => {
    currentSessionId.value = null
    resetTiming()
  }

  const startSession = async (taskId: string | null): Promise<string | null> => {
    if (terminalPromise) await terminalPromise
    if (currentSessionId.value) return currentSessionId.value
    if (startPromise) return startPromise

    resetTiming()
    runningSinceMs.value = Date.now()

    const pendingStart = (async () => {
      const { data, error } = await supabase
        .from('pomodoro_sessions')
        .insert({
          task_id: taskId,
          duration_minutes: DEFAULT_DURATION_MINUTES,
          status: 'running',
          was_completed: false,
          actual_seconds: 0,
        })
        .select('id')
        .single()

      if (error) {
        console.error('startSession:', error.message)
        resetTiming()
        return null
      }

      currentSessionId.value = data.id
      return data.id
    })()

    startPromise = pendingStart
    try {
      return await pendingStart
    } finally {
      if (startPromise === pendingStart) {
        startPromise = null
      }
    }
  }

  const pauseSession = async () => {
    if (terminalPromise || closingReason) return
    if (!currentSessionId.value) return
    const sessionId = currentSessionId.value
    const actual = flushElapsed()
    if (terminalPromise || closingReason) return

    const { error } = await supabase
      .from('pomodoro_sessions')
      .update({ status: 'paused', actual_seconds: actual })
      .eq('id', sessionId)
      .eq('status', 'running')

    if (error) console.error('pauseSession:', error.message)
  }

  const resumeSession = async () => {
    if (terminalPromise || closingReason) return
    if (!currentSessionId.value) return
    const sessionId = currentSessionId.value

    const { error } = await supabase
      .from('pomodoro_sessions')
      .update({ status: 'running' })
      .eq('id', sessionId)
      .eq('status', 'paused')

    if (error) {
      console.error('resumeSession:', error.message)
      return
    }
    if (terminalPromise || closingReason) return

    runningSinceMs.value = Date.now()
  }

  const endSession = (reason: ClosingReason): Promise<void> => {
    if (terminalPromise) return terminalPromise

    closingReason = reason
    const pendingTerminal = (async () => {
      const pendingId = startPromise ? await startPromise : null
      const id = currentSessionId.value ?? pendingId
      if (!id) {
        clearSessionLocal()
        return
      }

      const actual = flushElapsed()
      const completedAt = new Date().toISOString()
      const terminalReason = closingReason
      const { error } =
        terminalReason === 'complete'
          ? await supabase
              .from('pomodoro_sessions')
              .update({
                status: 'completed',
                was_completed: true,
                completed_at: completedAt,
                actual_seconds: actual,
              })
              .eq('id', id)
          : await supabase
              .from('pomodoro_sessions')
              .update({
                status: 'abandoned',
                was_completed: false,
                completed_at: completedAt,
                actual_seconds: actual,
              })
              .eq('id', id)

      if (error) {
        console.error(`${terminalReason}Session:`, error.message)
      }
      clearSessionLocal()
    })()

    terminalPromise = pendingTerminal
    void pendingTerminal.then(
      () => {
        if (terminalPromise === pendingTerminal) {
          terminalPromise = null
          closingReason = null
        }
      },
      () => {
        if (terminalPromise === pendingTerminal) {
          terminalPromise = null
          closingReason = null
        }
      },
    )
    return pendingTerminal
  }

  const completeSession = () => endSession('complete')

  const abandonSession = () => endSession('abandon')

  const fetchStats = async (taskId: string | null = null) => {
    isStatsLoading.value = true
    statsError.value = null

    const { data, error } = await supabase.rpc('pomodoro_stats', {
      p_task_id: taskId,
    })

    isStatsLoading.value = false

    if (error) {
      console.error('fetchStats:', error.message)
      statsError.value = error.message
      return
    }

    const row = Array.isArray(data) ? data[0] : data
    stats.value = row ? mapStatsRow(row) : { ...EMPTY_POMODORO_STATS }
  }

  return {
    currentSessionId,
    stats,
    statsError,
    isStatsLoading,
    startSession,
    pauseSession,
    resumeSession,
    completeSession,
    abandonSession,
    fetchStats,
  }
}
