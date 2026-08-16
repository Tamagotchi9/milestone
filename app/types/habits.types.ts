export type Habit = {
  id: string
  name: string
  startsOn: string
  archivedOn: string | null
  createdAt: string
  updatedAt: string
}

export type HabitStats = {
  currentStreak: number
  completedInMonth: number
  eligibleDaysInMonth: number
}

export type CreateHabitInput = {
  name: string
  startsOn: string
}

export type RenameHabitInput = {
  id: string
  name: string
}

export type HabitCalendarCell = {
  date: string | null
  dayNumber: number | null
}

export const EMPTY_HABIT_STATS: HabitStats = {
  currentStreak: 0,
  completedInMonth: 0,
  eligibleDaysInMonth: 0,
}
