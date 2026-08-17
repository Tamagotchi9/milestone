<script setup lang="ts">
import type { Habit } from '~/types/habits.types'

const props = defineProps<{
  activeHabits: Habit[]
  archivedHabits: Habit[]
  selectedHabitId: string | null
  todayDate: string
  loading?: boolean
  restoringHabitId?: string | null
  isDateCompleted: (habitId: string, date: string) => boolean
  isTogglePending: (habitId: string, date: string) => boolean
}>()

const emit = defineEmits<{
  select: [habitId: string]
  toggle: [habitId: string, date: string]
  edit: [habit: Habit]
  archive: [habit: Habit]
  restore: [habit: Habit]
}>()

const isCompletedToday = (habitId: string) =>
  props.isDateCompleted(habitId, props.todayDate)
</script>

<template>
  <div class="space-y-4">
    <div v-if="loading" class="space-y-2">
      <USkeleton v-for="index in 3" :key="index" class="h-12 w-full" />
    </div>

    <div v-else-if="activeHabits.length === 0" class="py-8 text-center">
      <UIcon name="i-lucide-sprout" class="mx-auto size-8 text-muted" />
      <p class="mt-3 text-sm font-medium text-highlighted">No active habits</p>
      <p class="mt-1 text-sm text-muted">Add one small action to begin.</p>
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="habit in activeHabits"
        :key="habit.id"
        class="group flex items-center gap-2 rounded-lg border p-2 transition-colors"
        :class="
          selectedHabitId === habit.id
            ? 'border-primary bg-primary/5'
            : 'border-default hover:bg-elevated/60'
        "
      >
        <UButton
          :color="isCompletedToday(habit.id) ? 'primary' : 'neutral'"
          :variant="isCompletedToday(habit.id) ? 'solid' : 'outline'"
          :icon="isCompletedToday(habit.id) ? 'i-lucide-check' : undefined"
          square
          size="sm"
          :loading="isTogglePending(habit.id, todayDate)"
          :aria-label="
            isCompletedToday(habit.id)
              ? `Mark ${habit.name} incomplete today`
              : `Mark ${habit.name} complete today`
          "
          @click="emit('toggle', habit.id, todayDate)"
        />

        <button
          type="button"
          class="min-w-0 flex-1 px-1 text-left"
          @click="emit('select', habit.id)"
        >
          <span class="block truncate text-sm font-medium text-highlighted">
            {{ habit.name }}
          </span>
          <span class="block text-xs text-muted">Daily</span>
        </button>

        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          square
          icon="i-lucide-pencil"
          :aria-label="`Rename ${habit.name}`"
          @click="emit('edit', habit)"
        />
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          square
          icon="i-lucide-archive"
          :aria-label="`Archive ${habit.name}`"
          @click="emit('archive', habit)"
        />
      </div>
    </div>

    <UCollapsible
      v-if="archivedHabits.length > 0"
      class="border-t border-default pt-3"
    >
      <UButton
        color="neutral"
        variant="ghost"
        block
        trailing-icon="i-lucide-chevron-down"
        class="group justify-between"
        :ui="{
          trailingIcon:
            'group-data-[state=open]:rotate-180 transition-transform duration-200',
        }"
      >
        Archived ({{ archivedHabits.length }})
      </UButton>

      <template #content>
        <div class="mt-2 space-y-1">
          <div
            v-for="habit in archivedHabits"
            :key="habit.id"
            class="flex items-center gap-2 rounded-lg px-2 py-1.5"
            :class="selectedHabitId === habit.id ? 'bg-elevated' : undefined"
          >
            <button
              type="button"
              class="min-w-0 flex-1 text-left"
              @click="emit('select', habit.id)"
            >
              <span class="block truncate text-sm text-muted">
                {{ habit.name }}
              </span>
            </button>
            <UButton
              color="neutral"
              variant="ghost"
              size="xs"
              square
              icon="i-lucide-archive-restore"
              :loading="restoringHabitId === habit.id"
              :aria-label="`Restore ${habit.name}`"
              @click="emit('restore', habit)"
            />
            <UButton
              color="neutral"
              variant="ghost"
              size="xs"
              square
              icon="i-lucide-pencil"
              :aria-label="`Rename ${habit.name}`"
              @click="emit('edit', habit)"
            />
          </div>
        </div>
      </template>
    </UCollapsible>
  </div>
</template>
