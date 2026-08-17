<script setup lang="ts">
import type { Ref } from 'vue'
import HabitCalendar from '~/components/dashboard/habits/HabitCalendar.vue'
import HabitEditorModal from '~/components/dashboard/habits/HabitEditorModal.vue'
import HabitList from '~/components/dashboard/habits/HabitList.vue'
import type { CreateHabitInput, Habit } from '~/types/habits.types'

const {
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
} = useHabits()

const editorOpen = ref(false)
const editingHabit = ref<Habit | null>(null)
const archiveCandidate = ref<Habit | null>(null)
const isSaving = ref(false)
const isArchiving = ref(false)
const restoringHabitId = ref<string | null>(null)

const withPendingValue = async <TValue, TResult>(
  state: Ref<TValue>,
  pendingValue: TValue,
  idleValue: TValue,
  operation: () => Promise<TResult>,
): Promise<TResult> => {
  state.value = pendingValue
  try {
    return await operation()
  } finally {
    state.value = idleValue
  }
}

const archiveModalOpen = computed({
  get: () => Boolean(archiveCandidate.value),
  set: (open: boolean) => {
    if (!open) archiveCandidate.value = null
  },
})

const openCreate = () => {
  editingHabit.value = null
  editorOpen.value = true
}

const openEdit = (habit: Habit) => {
  editingHabit.value = habit
  editorOpen.value = true
}

const saveHabit = async (input: CreateHabitInput) => {
  const succeeded = await withPendingValue(isSaving, true, false, () =>
    editingHabit.value
      ? renameHabit({ id: editingHabit.value.id, name: input.name })
      : createHabit(input),
  )

  if (succeeded) editorOpen.value = false
}

const confirmArchive = async () => {
  if (!archiveCandidate.value) return
  const habitId = archiveCandidate.value.id
  const succeeded = await withPendingValue(isArchiving, true, false, () =>
    archiveHabit(habitId),
  )
  if (succeeded) archiveCandidate.value = null
}

const restoreArchivedHabit = async (habit: Habit) => {
  await withPendingValue(restoringHabitId, habit.id, null, () =>
    restoreHabit(habit.id),
  )
}

onMounted(() => {
  void getHabits()
})
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1">
          <h2 class="text-lg font-semibold text-highlighted">Habits</h2>
          <p class="text-sm text-muted">
            Check in today and make your progress visible over time.
          </p>
        </div>
        <UButton color="primary" icon="i-lucide-plus" @click="openCreate">
          Add habit
        </UButton>
      </div>
    </template>

    <p
      v-if="errorMessage"
      role="alert"
      class="mb-4 rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error"
    >
      {{ errorMessage }}
    </p>

    <div
      class="grid gap-6 lg:grid-cols-[minmax(15rem,0.75fr)_minmax(25rem,1.5fr)]"
    >
      <HabitList
        :active-habits="activeHabits"
        :archived-habits="archivedHabits"
        :selected-habit-id="selectedHabitId"
        :today-date="localToday"
        :loading="isLoading"
        :restoring-habit-id="restoringHabitId"
        :is-date-completed="isDateCompleted"
        :is-toggle-pending="isTogglePending"
        @select="(habitId) => void selectHabit(habitId)"
        @toggle="(habitId, date) => void toggleCheckin(habitId, date)"
        @edit="openEdit"
        @archive="(habit) => (archiveCandidate = habit)"
        @restore="(habit) => void restoreArchivedHabit(habit)"
      />

      <div
        class="border-t border-default pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"
      >
        <HabitCalendar
          :habit="selectedHabit"
          :visible-month="visibleMonth"
          :today-date="localToday"
          :checkin-dates="monthCheckinDates"
          :stats="stats"
          :loading="isMonthLoading"
          :can-go-previous="canGoToPreviousMonth"
          :can-go-next="canGoToNextMonth"
          :is-toggle-pending="isTogglePending"
          @toggle="
            (date) =>
              selectedHabit && void toggleCheckin(selectedHabit.id, date)
          "
          @previous="void shiftMonth(-1)"
          @next="void shiftMonth(1)"
        />
      </div>
    </div>
  </UCard>

  <HabitEditorModal
    v-model:open="editorOpen"
    :habit="editingHabit"
    :today-date="localToday"
    :saving="isSaving"
    @submit="saveHabit"
  />

  <UModal
    v-model:open="archiveModalOpen"
    title="Archive habit?"
    description="This moves the habit out of your active list while keeping its progress history."
  >
    <template #body>
      <p class="text-sm text-muted">
        You can restore
        <span class="font-medium text-highlighted">
          {{ archiveCandidate?.name }}
        </span>
        later from the archived list.
      </p>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="soft"
          @click="archiveModalOpen = false"
        >
          Cancel
        </UButton>
        <UButton color="error" :loading="isArchiving" @click="confirmArchive">
          Archive habit
        </UButton>
      </div>
    </template>
  </UModal>
</template>
