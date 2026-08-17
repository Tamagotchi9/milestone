import {
  endOfMonth,
  getLocalTimeZone,
  parseDate,
  startOfMonth,
  today,
} from '@internationalized/date'
import type { Database } from '~/types/database.types'
import {
  EMPTY_HABIT_STATS,
  type CreateHabitInput,
  type Habit,
  type HabitStats,
  type RenameHabitInput,
} from '~/types/habits.types'
import { toFiniteNumber } from '~/utils/toFiniteNumber'

const HABIT_SELECT =
  'id, name, starts_on, archived_on, created_at, updated_at' as const

type HabitRow = Pick<
  Database['public']['Tables']['habits']['Row'],
  'id' | 'name' | 'starts_on' | 'archived_on' | 'created_at' | 'updated_at'
>

type HabitStatsRow =
  Database['public']['Functions']['habit_stats']['Returns'][number]

const mapHabitRow = (row: HabitRow): Habit => ({
  id: row.id,
  name: row.name,
  startsOn: row.starts_on,
  archivedOn: row.archived_on,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const mapStatsRow = (row?: HabitStatsRow | null): HabitStats =>
  row
    ? {
        currentStreak: toFiniteNumber(row.current_streak),
        completedInMonth: toFiniteNumber(row.completed_in_month),
        eligibleDaysInMonth: toFiniteNumber(row.eligible_days_in_month),
      }
    : { ...EMPTY_HABIT_STATS }

const getLocalToday = () => today(getLocalTimeZone()).toString()

const getMonthStart = (date: string) => startOfMonth(parseDate(date)).toString()

const getMonthEnd = (date: string) => endOfMonth(parseDate(date)).toString()

const replaceStringValue = (
  values: string[],
  value: string,
  shouldInclude: boolean,
): string[] => {
  if (shouldInclude) return values.includes(value) ? values : [...values, value]
  return values.filter((item) => item !== value)
}

export const useHabits = () => {
  const supabase = useSupabaseClient<Database>()

  const habits = useState<Habit[]>('habits.items', () => [])
  const selectedHabitId = useState<string | null>(
    'habits.selectedHabitId',
    () => null,
  )
  const visibleMonth = useState<string>('habits.visibleMonth', () => '')
  const localToday = useState<string>('habits.localToday', () => '')
  const todayCompletedHabitIds = useState<string[]>(
    'habits.todayCompletedIds',
    () => [],
  )
  const monthCheckinDates = useState<string[]>(
    'habits.monthCheckinDates',
    () => [],
  )
  const stats = useState<HabitStats>('habits.stats', () => ({
    ...EMPTY_HABIT_STATS,
  }))
  const pendingToggleKeys = useState<string[]>(
    'habits.pendingToggleKeys',
    () => [],
  )
  const isLoading = useState<boolean>('habits.loading', () => false)
  const isMonthLoading = useState<boolean>('habits.monthLoading', () => false)
  const errorMessage = useState<string | null>('habits.error', () => null)

  const replaceHabit = (updatedHabit: Habit) => {
    habits.value = habits.value.map((habit) =>
      habit.id === updatedHabit.id ? updatedHabit : habit,
    )
  }

  const setLocalCheckinState = (
    habitId: string,
    date: string,
    isCompleted: boolean,
  ) => {
    if (date === localToday.value) {
      todayCompletedHabitIds.value = replaceStringValue(
        todayCompletedHabitIds.value,
        habitId,
        isCompleted,
      )
    }
    if (selectedHabitId.value === habitId) {
      monthCheckinDates.value = replaceStringValue(
        monthCheckinDates.value,
        date,
        isCompleted,
      )
    }
  }

  const activeHabits = computed(() =>
    habits.value.filter((habit) => !habit.archivedOn),
  )
  const archivedHabits = computed(() =>
    habits.value.filter((habit) => habit.archivedOn),
  )
  const selectedHabit = computed(
    () =>
      habits.value.find((habit) => habit.id === selectedHabitId.value) ?? null,
  )

  const selectedStartMonth = computed(() =>
    selectedHabit.value ? getMonthStart(selectedHabit.value.startsOn) : '',
  )
  const selectedEndMonth = computed(() => {
    if (!selectedHabit.value || !localToday.value) return ''
    return getMonthStart(selectedHabit.value.archivedOn ?? localToday.value)
  })
  const canGoToPreviousMonth = computed(
    () =>
      Boolean(visibleMonth.value && selectedStartMonth.value) &&
      visibleMonth.value > selectedStartMonth.value,
  )
  const canGoToNextMonth = computed(
    () =>
      Boolean(visibleMonth.value && selectedEndMonth.value) &&
      visibleMonth.value < selectedEndMonth.value,
  )

  const setError = (message: string | null) => {
    errorMessage.value = message
  }

  const refreshTodayCheckins = async () => {
    if (!localToday.value) return

    const { data, error } = await supabase
      .from('habit_checkins')
      .select('habit_id')
      .eq('completed_on', localToday.value)

    if (error) {
      setError(error.message)
      return
    }

    todayCompletedHabitIds.value = (data ?? []).map((row) => row.habit_id)
  }

  const refreshSelectedMonth = async () => {
    const habit = selectedHabit.value
    if (!habit || !visibleMonth.value || !localToday.value) {
      monthCheckinDates.value = []
      stats.value = { ...EMPTY_HABIT_STATS }
      return
    }

    isMonthLoading.value = true
    const monthStart = getMonthStart(visibleMonth.value)
    const monthEnd = getMonthEnd(visibleMonth.value)

    const [checkinsResult, statsResult] = await Promise.all([
      supabase
        .from('habit_checkins')
        .select('completed_on')
        .eq('habit_id', habit.id)
        .gte('completed_on', monthStart)
        .lte('completed_on', monthEnd)
        .order('completed_on'),
      supabase.rpc('habit_stats', {
        p_habit_id: habit.id,
        p_month_start: monthStart,
        p_month_end: monthEnd,
        p_today: localToday.value,
      }),
    ])

    isMonthLoading.value = false

    const requestError = checkinsResult.error ?? statsResult.error
    if (requestError) {
      setError(requestError.message)
      return
    }

    monthCheckinDates.value = (checkinsResult.data ?? []).map(
      (row) => row.completed_on,
    )
    const statsRow = Array.isArray(statsResult.data)
      ? statsResult.data[0]
      : statsResult.data
    stats.value = mapStatsRow(statsRow)
  }

  const getHabits = async () => {
    isLoading.value = true
    setError(null)
    localToday.value = getLocalToday()

    const { data, error } = await supabase
      .from('habits')
      .select(HABIT_SELECT)
      .order('created_at', { ascending: false })

    if (error) {
      isLoading.value = false
      setError(error.message)
      return
    }

    habits.value = (data ?? []).map(mapHabitRow)

    const currentSelection = habits.value.find(
      (habit) => habit.id === selectedHabitId.value,
    )
    const initialHabit =
      currentSelection ??
      activeHabits.value[0] ??
      archivedHabits.value[0] ??
      null

    selectedHabitId.value = initialHabit?.id ?? null
    visibleMonth.value = initialHabit
      ? getMonthStart(initialHabit.archivedOn ?? localToday.value)
      : getMonthStart(localToday.value)

    await Promise.all([refreshTodayCheckins(), refreshSelectedMonth()])
    isLoading.value = false
  }

  const selectHabit = async (habitId: string) => {
    const habit = habits.value.find((item) => item.id === habitId)
    if (!habit) return

    selectedHabitId.value = habit.id
    visibleMonth.value = getMonthStart(habit.archivedOn ?? localToday.value)
    setError(null)
    await refreshSelectedMonth()
  }

  const createHabit = async (input: CreateHabitInput): Promise<boolean> => {
    const name = input.name.trim()
    if (!name || name.length > 80 || input.startsOn > localToday.value) {
      setError('Enter a habit name and a valid start date.')
      return false
    }

    setError(null)
    const { data, error } = await supabase
      .from('habits')
      .insert({ name, starts_on: input.startsOn })
      .select(HABIT_SELECT)
      .single()

    if (error) {
      setError(error.message)
      return false
    }

    const habit = mapHabitRow(data)
    habits.value = [habit, ...habits.value]
    selectedHabitId.value = habit.id
    visibleMonth.value = getMonthStart(localToday.value)
    await refreshSelectedMonth()
    return true
  }

  const renameHabit = async (input: RenameHabitInput): Promise<boolean> => {
    const name = input.name.trim()
    if (!name || name.length > 80) {
      setError('Habit names must be between 1 and 80 characters.')
      return false
    }

    setError(null)
    const { data, error } = await supabase
      .from('habits')
      .update({ name })
      .eq('id', input.id)
      .select(HABIT_SELECT)
      .single()

    if (error) {
      setError(error.message)
      return false
    }

    const updatedHabit = mapHabitRow(data)
    replaceHabit(updatedHabit)
    return true
  }

  const archiveHabit = async (habitId: string): Promise<boolean> => {
    const habit = habits.value.find((item) => item.id === habitId)
    if (!habit || habit.archivedOn || !localToday.value) return false

    setError(null)
    const { data, error } = await supabase
      .from('habits')
      .update({ archived_on: localToday.value })
      .eq('id', habitId)
      .select(HABIT_SELECT)
      .single()

    if (error) {
      setError(error.message)
      return false
    }

    const archivedHabit = mapHabitRow(data)
    replaceHabit(archivedHabit)
    selectedHabitId.value = archivedHabit.id
    visibleMonth.value = getMonthStart(
      archivedHabit.archivedOn ?? localToday.value,
    )
    await Promise.all([refreshTodayCheckins(), refreshSelectedMonth()])
    return true
  }

  const restoreHabit = async (habitId: string): Promise<boolean> => {
    const habit = habits.value.find((item) => item.id === habitId)
    if (!habit?.archivedOn) return false

    localToday.value = getLocalToday()
    setError(null)
    const { data, error } = await supabase
      .from('habits')
      .update({ archived_on: null })
      .eq('id', habitId)
      .select(HABIT_SELECT)
      .single()

    if (error) {
      setError(error.message)
      return false
    }

    const restoredHabit = mapHabitRow(data)
    replaceHabit(restoredHabit)
    selectedHabitId.value = restoredHabit.id
    visibleMonth.value = getMonthStart(localToday.value)
    await Promise.all([refreshTodayCheckins(), refreshSelectedMonth()])
    return true
  }

  const isDateCompleted = (habitId: string, date: string): boolean =>
    date === localToday.value
      ? todayCompletedHabitIds.value.includes(habitId)
      : selectedHabitId.value === habitId &&
        monthCheckinDates.value.includes(date)

  const isTogglePending = (habitId: string, date: string): boolean =>
    pendingToggleKeys.value.includes(`${habitId}:${date}`)

  const toggleCheckin = async (habitId: string, date: string) => {
    const habit = habits.value.find((item) => item.id === habitId)
    const key = `${habitId}:${date}`
    if (
      !habit ||
      habit.archivedOn ||
      date < habit.startsOn ||
      date > localToday.value ||
      pendingToggleKeys.value.includes(key)
    ) {
      return
    }

    const wasCompleted = isDateCompleted(habitId, date)
    pendingToggleKeys.value = [...pendingToggleKeys.value, key]
    setError(null)
    setLocalCheckinState(habitId, date, !wasCompleted)

    const result = wasCompleted
      ? await supabase
          .from('habit_checkins')
          .delete()
          .eq('habit_id', habitId)
          .eq('completed_on', date)
      : await supabase
          .from('habit_checkins')
          .insert({ habit_id: habitId, completed_on: date })

    pendingToggleKeys.value = pendingToggleKeys.value.filter(
      (item) => item !== key,
    )

    if (result.error) {
      setLocalCheckinState(habitId, date, wasCompleted)
      setError(result.error.message)
      return
    }

    if (selectedHabitId.value === habitId) {
      await refreshSelectedMonth()
    }
  }

  const shiftMonth = async (monthOffset: -1 | 1) => {
    if (!visibleMonth.value) return
    if (monthOffset === -1 && !canGoToPreviousMonth.value) return
    if (monthOffset === 1 && !canGoToNextMonth.value) return

    visibleMonth.value = startOfMonth(
      parseDate(visibleMonth.value).add({ months: monthOffset }),
    ).toString()
    setError(null)
    await refreshSelectedMonth()
  }

  return {
    habits,
    activeHabits,
    archivedHabits,
    selectedHabit,
    selectedHabitId,
    visibleMonth,
    localToday,
    monthCheckinDates,
    stats,
    isLoading,
    isMonthLoading,
    errorMessage,
    canGoToPreviousMonth,
    canGoToNextMonth,
    getHabits,
    selectHabit,
    createHabit,
    renameHabit,
    archiveHabit,
    restoreHabit,
    isDateCompleted,
    isTogglePending,
    toggleCheckin,
    shiftMonth,
  }
}
