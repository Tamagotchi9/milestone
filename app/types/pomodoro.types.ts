/** Matches `public.pomodoro_session_status` in Postgres */
export type PomodoroSessionStatus =
  | 'running'
  | 'paused'
  | 'completed'
  | 'abandoned'

export type PomodoroPhase = 'work' | 'shortBreak' | 'longBreak'

export type PomodoroStats = {
  completedToday: number
  secondsToday: number
  completedWeek: number
  secondsWeek: number
  completedForTask: number
  secondsForTask: number
}

export const EMPTY_POMODORO_STATS: PomodoroStats = {
  completedToday: 0,
  secondsToday: 0,
  completedWeek: 0,
  secondsWeek: 0,
  completedForTask: 0,
  secondsForTask: 0,
}
