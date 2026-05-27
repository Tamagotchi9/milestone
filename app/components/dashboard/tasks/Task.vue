<script setup lang="ts">
import type { CreateTaskDTO, TaskItem, TaskPriority } from '~/types/tasks.types'

const props = defineProps<{
  task: TaskItem
  focusedTaskId: string | null
}>()

const emit = defineEmits<{
  focus: [taskId: string]
  remove: [taskId: string]
  setPriority: [taskId: string, priority: TaskPriority]
  setDeadline: [taskId: string, deadline: string | null]
  addSubtask: [payload: CreateTaskDTO]
  toggleSubtask: [subtaskId: string]
}>()

const priorityItems = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
]

const priorityBadgeColor = {
  high: 'error',
  medium: 'warning',
  low: 'success',
} as const

const newSubtaskTitle = ref('')

const addSubtaskToTask = () => {
  emit('addSubtask', {
    parentTaskId: props.task.id,
    title: newSubtaskTitle.value,
    priority: 'low',
  })
  newSubtaskTitle.value = ''
}

const subtaskCompletion = computed(() => {
  if (props.task.subtasks.length === 0) return '0/0'
  const completed = props.task.subtasks.filter((item) => item.status === 'completed').length
  return `${completed}/${props.task.subtasks.length}`
})
</script>

<template>
  <UCard>
    <div class="space-y-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <h2 class="text-lg font-semibold text-highlighted">
              {{ task.title }}
            </h2>
            <UBadge :color="priorityBadgeColor[task.priority]" variant="soft">
              {{ task.priority }}
            </UBadge>
            <UBadge
              v-if="focusedTaskId === task.id"
              color="primary"
              variant="soft"
              icon="i-lucide-focus"
            >
              Focusing
            </UBadge>
          </div>
          <p v-if="task.description" class="text-sm text-muted">
            {{ task.description }}
          </p>
          <p class="text-xs text-muted">
            Deadline:
            <span class="text-highlighted">
              {{ task.deadline || 'Not set' }}
            </span>
            · Subtasks {{ subtaskCompletion }}
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <UButton
            size="sm"
            color="primary"
            variant="soft"
            icon="i-lucide-play"
            @click="emit('focus', task.id)"
          >
            Start focus
          </UButton>
          <UButton
            size="sm"
            color="neutral"
            variant="outline"
            icon="i-lucide-trash-2"
            @click="emit('remove', task.id)"
          >
            Delete
          </UButton>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <UFormField label="Priority">
          <USelect
            :model-value="task.priority"
            :items="priorityItems"
            class="w-full"
            @update:model-value="
              (value) =>
                emit(
                  'setPriority',
                  task.id,
                  (value as TaskPriority) ?? 'medium',
                )
            "
          />
        </UFormField>
        <UFormField label="Deadline">
          <UInput
            :model-value="task.deadline ?? ''"
            type="date"
            class="w-full"
            @update:model-value="
              (value) => emit('setDeadline', task.id, String(value || ''))
            "
          />
        </UFormField>
      </div>

      <div class="space-y-2">
        <p class="text-sm font-medium">Subtasks</p>
        <div v-if="task.subtasks.length === 0" class="text-sm text-muted">
          No subtasks yet.
        </div>
        <div v-else class="space-y-2">
          <label
            v-for="subtask in task.subtasks"
            :key="subtask.id"
            class="flex items-center gap-2 text-sm"
          >
            <input
              type="checkbox"
              :checked="subtask.status === 'completed'"
              class="size-4 rounded border-default"
              @change="emit('toggleSubtask', subtask.id)"
            />
            <span
              :class="
                subtask.status === 'completed' ? 'line-through text-muted' : 'text-default'
              "
            >
              {{ subtask.title }}
            </span>
          </label>
        </div>

        <div class="flex flex-col gap-2 sm:flex-row">
          <UInput
            v-model="newSubtaskTitle"
            placeholder="Add a subtask"
            class="flex-1"
          />
          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-list-plus"
            @click="addSubtaskToTask"
          >
            Add subtask
          </UButton>
        </div>
      </div>
    </div>
  </UCard>
</template>
