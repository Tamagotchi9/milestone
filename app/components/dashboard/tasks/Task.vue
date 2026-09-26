<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import {
  TASK_PRIORITY_LABEL,
  TASK_STATUS,
  type CreateTaskDTO,
  type TaskItem,
  type TaskPriority,
} from '~/types/tasks.types'

const props = defineProps<{
  task: TaskItem
  focusedTaskId: string | null
  updatingStatus?: boolean
  updatingPriority?: boolean
  draggable?: boolean
}>()

const emit = defineEmits<{
  focus: [taskId: string]
  remove: [taskId: string]
  addSubtask: [payload: CreateTaskDTO]
  toggleSubtask: [subtaskId: string]
  changePriority: [taskId: string, priority: TaskPriority]
}>()

const newSubtaskTitle = defineModel<string>('subtaskDraft', { default: '' })

const priorityBadgeColor = {
  high: 'error',
  medium: 'warning',
  low: 'success',
} as const

const priorityItems = computed<DropdownMenuItem[]>(() =>
  (['high', 'medium', 'low'] as const).map((priority) => ({
    label: TASK_PRIORITY_LABEL[priority],
    color: priorityBadgeColor[priority],
    icon: props.task.priority === priority ? 'i-lucide-check' : undefined,
    disabled: props.updatingPriority || props.task.priority === priority,
    onSelect: () => emit('changePriority', props.task.id, priority),
  })),
)

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
  <UCard
    :data-task-card-id="task.id"
    class="overflow-hidden rounded-xl transition-shadow duration-200 hover:shadow-md"
    :class="[
      focusedTaskId === task.id ? 'ring-2 ring-primary/40' : '',
      draggable ? 'cursor-grab touch-none active:cursor-grabbing' : '',
    ]"
    :ui="{ body: 'p-4 sm:p-4' }"
  >
    <article class="space-y-4">
      <header class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex flex-wrap items-center gap-2">
          <UDropdownMenu :items="priorityItems">
            <UButton
              data-no-task-drag
              data-task-focus="priority"
              :color="priorityBadgeColor[task.priority]"
              variant="soft"
              size="xs"
              class="rounded-full"
              trailing-icon="i-lucide-chevron-down"
              :disabled="updatingPriority"
              :aria-label="`Change priority for ${task.title}: ${TASK_PRIORITY_LABEL[task.priority]}`"
            >
              {{ TASK_PRIORITY_LABEL[task.priority] }}
            </UButton>
          </UDropdownMenu>
        </div>
        <slot name="move" />
      </header>

      <div class="min-w-0 space-y-2">
        <h4
          class="text-base font-semibold leading-6 text-highlighted [overflow-wrap:anywhere]"
        >
          {{ task.title }}
        </h4>
        <p
          v-if="task.description"
          class="text-sm leading-relaxed text-muted [overflow-wrap:anywhere]"
        >
          {{ task.description }}
        </p>
        <div
          v-if="task.deadline || focusedTaskId === task.id"
          class="flex flex-wrap items-center gap-x-3 gap-y-2 pt-1 text-xs"
        >
          <span
            v-if="task.deadline"
            class="inline-flex items-center gap-1.5 text-muted"
          >
            <UIcon name="i-lucide-calendar" class="size-3.5 shrink-0" />
            <time :datetime="task.deadline">{{ formattedDeadline }}</time>
          </span>
          <span
            v-if="focusedTaskId === task.id"
            class="inline-flex items-center gap-1.5 font-medium text-primary"
          >
            <UIcon name="i-lucide-focus" class="size-3.5 shrink-0" />
            Focusing
          </span>
        </div>
      </div>

      <div
        data-no-task-drag
        class="cursor-auto space-y-3 rounded-lg bg-elevated/50 p-3"
      >
        <div
          v-if="task.subtasks.length"
          class="flex items-center justify-between text-xs"
        >
          <span class="font-medium text-muted">Subtasks</span>
          <span class="tabular-nums text-dimmed">{{ subtaskCompletion }}</span>
        </div>
        <div v-if="task.subtasks.length" class="space-y-1">
          <label
            v-for="subtask in task.subtasks"
            :key="subtask.id"
            class="flex cursor-pointer items-start gap-2.5 rounded-md py-1.5 text-sm"
          >
            <input
              type="checkbox"
              :checked="subtask.status === TASK_STATUS.COMPLETED"
              class="mt-0.5 size-4 shrink-0 rounded border-default accent-primary"
              :data-task-focus="`subtask-${subtask.id}`"
              @change="emit('toggleSubtask', subtask.id)"
            />
            <span
              class="min-w-0 leading-5 [overflow-wrap:anywhere]"
              :class="
                subtask.status === TASK_STATUS.COMPLETED
                  ? 'line-through text-muted'
                  : 'text-default'
              "
            >
              {{ subtask.title }}
            </span>
          </label>
        </div>

        <form
          class="flex items-center gap-2"
          @submit.prevent="addSubtaskToTask"
        >
          <UInput
            v-model="newSubtaskTitle"
            data-task-focus="subtask-input"
            placeholder="Add a subtask…"
            :aria-label="`New subtask for ${task.title}`"
            size="sm"
            class="min-w-0 flex-1"
          />
          <UButton
            data-task-focus="add-subtask"
            type="submit"
            color="neutral"
            variant="soft"
            size="sm"
            icon="i-lucide-plus"
            class="shrink-0"
            aria-label="Add subtask"
            title="Add subtask"
            :disabled="!newSubtaskTitle.trim()"
          />
        </form>
      </div>

      <footer
        data-no-task-drag
        class="flex cursor-auto items-center gap-2 border-t border-default pt-3"
      >
        <UButton
          data-task-focus="start-focus"
          size="sm"
          color="primary"
          variant="soft"
          icon="i-lucide-play"
          class="min-w-0 flex-1 justify-center"
          :disabled="updatingStatus"
          @click="emit('focus', task.id)"
        >
          Start focus
        </UButton>
        <UButton
          data-task-focus="delete"
          size="sm"
          color="neutral"
          variant="ghost"
          icon="i-lucide-trash-2"
          class="shrink-0 hover:text-error"
          :aria-label="`Delete ${task.title}`"
          title="Delete task"
          @click="emit('remove', task.id)"
        />
      </footer>
    </article>
  </UCard>
</template>
