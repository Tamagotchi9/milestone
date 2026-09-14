<script setup lang="ts">
import type { StepperItem } from '@nuxt/ui'

const {
  activeHabits,
  localToday,
  isLoading,
  errorMessage,
  getHabits,
  isDateCompleted,
  isTogglePending,
  toggleCheckin,
} = useHabits()

const activeHabitId = ref<string>()

const todayHabits = computed(() =>
  activeHabits.value.filter(
    (habit) => !localToday.value || habit.startsOn <= localToday.value,
  ),
)

const currentHabit = computed(
  () =>
    todayHabits.value.find((habit) => habit.id === activeHabitId.value) ?? null,
)

const currentHabitCompleted = computed(() =>
  currentHabit.value && localToday.value
    ? isDateCompleted(currentHabit.value.id, localToday.value)
    : false,
)

const currentTogglePending = computed(() =>
  currentHabit.value && localToday.value
    ? isTogglePending(currentHabit.value.id, localToday.value)
    : false,
)

const completedCount = computed(() =>
  localToday.value
    ? todayHabits.value.filter((habit) =>
        isDateCompleted(habit.id, localToday.value),
      ).length
    : 0,
)

const allCompleted = computed(
  () =>
    todayHabits.value.length > 0 &&
    completedCount.value === todayHabits.value.length,
)

const stepperItems = computed<StepperItem[]>(() =>
  todayHabits.value.map((habit) => {
    const completed = isDateCompleted(habit.id, localToday.value)
    const active = habit.id === activeHabitId.value

    return {
      value: habit.id,
      title: habit.name,
      icon: completed ? 'i-lucide-check' : undefined,
      ui: {
        trigger: completed
          ? '!bg-success !text-inverted'
          : active
            ? '!bg-primary !text-inverted'
            : '!bg-elevated !text-muted',
        separator: '!bg-accented',
      },
    }
  }),
)

const selectInitialHabit = () => {
  if (
    activeHabitId.value &&
    todayHabits.value.some((habit) => habit.id === activeHabitId.value)
  ) {
    return
  }

  activeHabitId.value =
    todayHabits.value.find(
      (habit) => !isDateCompleted(habit.id, localToday.value),
    )?.id ?? todayHabits.value[0]?.id
}

const findNextIncompleteHabit = (completedHabitId: string) => {
  const completedIndex = todayHabits.value.findIndex(
    (habit) => habit.id === completedHabitId,
  )
  if (completedIndex === -1) return null

  const habitsAfterCurrent = todayHabits.value.slice(completedIndex + 1)
  const habitsBeforeCurrent = todayHabits.value.slice(0, completedIndex)

  return (
    [...habitsAfterCurrent, ...habitsBeforeCurrent].find(
      (habit) => !isDateCompleted(habit.id, localToday.value),
    ) ?? null
  )
}

const toggleCurrentHabit = async () => {
  const habit = currentHabit.value
  const date = localToday.value
  if (!habit || !date || currentTogglePending.value) return

  const wasCompleted = isDateCompleted(habit.id, date)
  const succeeded = await toggleCheckin(habit.id, date)
  if (!succeeded || wasCompleted) return

  const nextHabit = findNextIncompleteHabit(habit.id)
  if (nextHabit) activeHabitId.value = nextHabit.id
}

watch([todayHabits, localToday], selectInitialHabit, { immediate: true })

onMounted(() => {
  void getHabits()
})
</script>

<template>
  <UCard
    class="overflow-hidden"
    :ui="{
      body: 'p-0 sm:p-0',
    }"
  >
    <div
      class="relative overflow-hidden bg-gradient-to-br from-primary/10 via-default to-success/10 px-5 py-6 sm:px-8 sm:py-8"
    >
      <div
        class="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-primary/10 blur-3xl"
      />

      <div class="relative space-y-6">
        <header
          class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
        >
          <div class="space-y-1">
            <p
              class="text-xs font-semibold uppercase tracking-widest text-primary"
            >
              Today
            </p>
            <h2 class="text-xl font-semibold text-highlighted sm:text-2xl">
              Build momentum, one habit at a time
            </h2>
            <p class="max-w-2xl text-sm text-muted">
              Move through your daily habits and check them off as you go.
            </p>
          </div>

          <UBadge
            v-if="todayHabits.length > 0"
            :color="allCompleted ? 'success' : 'neutral'"
            variant="soft"
            size="lg"
            class="self-start"
          >
            {{ completedCount }}/{{ todayHabits.length }} complete
          </UBadge>
        </header>

        <p
          v-if="errorMessage"
          role="alert"
          class="rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error"
        >
          {{ errorMessage }}
        </p>

        <div v-if="isLoading" class="space-y-5" aria-label="Loading habits">
          <USkeleton class="h-14 w-full" />
          <USkeleton class="h-40 w-full" />
        </div>

        <div
          v-else-if="todayHabits.length === 0"
          class="rounded-2xl border border-dashed border-default bg-default/70 px-5 py-10 text-center"
        >
          <UIcon name="i-lucide-sprout" class="mx-auto size-10 text-primary" />
          <h3 class="mt-4 text-lg font-semibold text-highlighted">
            No habits for today
          </h3>
          <p class="mx-auto mt-1 max-w-md text-sm text-muted">
            Create your first habit to start building a daily rhythm.
          </p>
          <UButton to="/dashboard/habits" class="mt-5" icon="i-lucide-plus">
            Add a habit
          </UButton>
        </div>

        <template v-else>
          <div class="overflow-x-auto pb-2">
            <UStepper
              v-model="activeHabitId"
              :items="stepperItems"
              value-key="value"
              :linear="false"
              :disabled="currentTogglePending"
              size="sm"
              class="min-w-max sm:min-w-0"
              :ui="{
                header: 'min-w-max sm:min-w-0',
                item: 'w-32 shrink-0 sm:w-full sm:min-w-0',
                title: 'truncate px-1',
                content: 'pt-5',
              }"
            >
              <template #content>
                <div
                  class="rounded-2xl border border-default/80 bg-default/85 p-5 shadow-sm backdrop-blur sm:p-7"
                >
                  <div
                    class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div class="min-w-0 space-y-2">
                      <div class="flex flex-wrap items-center gap-2">
                        <UBadge
                          :color="currentHabitCompleted ? 'success' : 'primary'"
                          variant="soft"
                        >
                          {{ currentHabitCompleted ? 'Completed' : 'Up next' }}
                        </UBadge>
                        <span class="text-xs text-muted">
                          Habit
                          {{
                            todayHabits.findIndex(
                              (habit) => habit.id === currentHabit?.id,
                            ) + 1
                          }}
                          of {{ todayHabits.length }}
                        </span>
                      </div>

                      <h3
                        class="break-words text-2xl font-semibold text-highlighted sm:text-3xl"
                      >
                        {{ currentHabit?.name }}
                      </h3>
                      <p class="text-sm text-muted">
                        {{
                          currentHabitCompleted
                            ? 'Done for today. You can undo this check-in if needed.'
                            : 'Complete this habit and move on to the next one.'
                        }}
                      </p>
                    </div>

                    <UButton
                      size="xl"
                      :color="currentHabitCompleted ? 'neutral' : 'primary'"
                      :variant="currentHabitCompleted ? 'outline' : 'solid'"
                      :icon="
                        currentHabitCompleted
                          ? 'i-lucide-rotate-ccw'
                          : 'i-lucide-check'
                      "
                      :loading="currentTogglePending"
                      class="min-h-16 w-full justify-center px-8 text-base lg:w-auto lg:min-w-72"
                      @click="toggleCurrentHabit"
                    >
                      {{
                        currentHabitCompleted
                          ? `Mark “${currentHabit?.name}” incomplete`
                          : `Complete “${currentHabit?.name}” today`
                      }}
                    </UButton>
                  </div>

                  <div
                    v-if="allCompleted"
                    class="mt-5 flex items-center gap-2 rounded-xl bg-success/10 px-4 py-3 text-sm font-medium text-success"
                    role="status"
                  >
                    <UIcon name="i-lucide-party-popper" class="size-5" />
                    All habits completed today.
                  </div>
                </div>
              </template>
            </UStepper>
          </div>

          <div class="flex justify-end">
            <UButton
              to="/dashboard/habits"
              color="neutral"
              variant="link"
              trailing-icon="i-lucide-arrow-right"
            >
              Open habit tracker
            </UButton>
          </div>
        </template>
      </div>
    </div>
  </UCard>
</template>
