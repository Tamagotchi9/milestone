<script setup lang="ts">
import type { CreateTaskDTO, TaskItem, TaskStatus } from '~/types/tasks.types'

const props = defineProps<{
  task: TaskItem
  focusedTaskId: string | null
}>()

const emit = defineEmits<{
  focus: [taskId: string]
  remove: [taskId: string]
  addSubtask: [payload: CreateTaskDTO]
  toggleSubtask: [subtaskId: string]
}>()

const priorityBadgeColor = {
  high: 'error',
  medium: 'warning',
  low: 'success',
} as const

const statusBadgeColor = {
  created: 'neutral',
  in_progress: 'primary',
  completed: 'success',
  on_hold: 'warning',
  blocked: 'error',
  abandoned: 'neutral',
} as const

const statusLabel: Record<TaskStatus, string> = {
  created: 'Created',
  in_progress: 'In progress',
  completed: 'Completed',
  on_hold: 'On hold',
  blocked: 'Blocked',
  abandoned: 'Abandoned',
}

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
  const completed = props.task.subtasks.filter(
    (item) => item.status === 'completed',
  ).length
  return `${completed}/${props.task.subtasks.length}`
})

const { formatDateToDotted } = useDateFormat()
const formattedDeadline = computed(() =>
  formatDateToDotted(props.task.deadline),
)
</script>

<template>
  <UCard class="transition-shadow duration-200 hover:shadow-md">
    <article class="space-y-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0 flex-1 space-y-2">
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="text-base font-semibold text-highlighted">
              {{ task.title }}
            </h3>
            <UBadge
              :color="priorityBadgeColor[task.priority]"
              variant="subtle"
              size="sm"
              class="capitalize"
            >
              {{ task.priority }} priority
            </UBadge>
            <UBadge
              :color="statusBadgeColor[task.status]"
              variant="soft"
              size="sm"
            >
              {{ statusLabel[task.status] }}
            </UBadge>
            <UBadge
              v-if="focusedTaskId === task.id"
              color="primary"
              variant="soft"
              size="sm"
              icon="i-lucide-focus"
            >
              Focusing
            </UBadge>
          </div>
          <p v-if="task.description" class="text-sm leading-5 text-muted">
            {{ task.description }}
          </p>
          <div
            class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted"
          >
            <span class="inline-flex items-center gap-1.5">
              <UIcon name="i-lucide-calendar" class="size-3.5" />
              {{ formattedDeadline }}
            </span>
            <span class="inline-flex items-center gap-1.5">
              <UIcon name="i-lucide-list-checks" class="size-3.5" />
              {{ subtaskCompletion }} subtasks
            </span>
          </div>
        </div>

        <div class="flex shrink-0 flex-wrap gap-2">
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

      <div class="space-y-3 border-t border-default pt-4">
        <div v-if="task.subtasks.length > 0" class="space-y-2">
          <label
            v-for="subtask in task.subtasks"
            :key="subtask.id"
            class="flex items-center gap-2.5 text-sm"
          >
            <input
              type="checkbox"
              :checked="subtask.status === 'completed'"
              class="size-4 rounded border-default"
              @change="emit('toggleSubtask', subtask.id)"
            />
            <span
              :class="
                subtask.status === 'completed'
                  ? 'line-through text-muted'
                  : 'text-default'
              "
            >
              {{ subtask.title }}
            </span>
          </label>
        </div>

        <form
          class="flex flex-col gap-2 sm:flex-row"
          @submit.prevent="addSubtaskToTask"
        >
          <UInput
            v-model="newSubtaskTitle"
            placeholder="Add a subtask"
            class="flex-1"
          />
          <UButton
            type="submit"
            color="neutral"
            variant="soft"
            icon="i-lucide-list-plus"
            :disabled="!newSubtaskTitle.trim()"
          >
            Add subtask
          </UButton>
        </form>
      </div>
    </article>
  </UCard>
</template>
