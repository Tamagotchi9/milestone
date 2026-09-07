<script setup lang="ts">
import type {
  CreateTaskDTO,
  TaskItem,
  TaskSort,
  TaskStatus,
} from '~/types/tasks.types'
import DashboardTask from '~/components/dashboard/tasks/Task.vue'

const props = defineProps<{
  tasks: TaskItem[]
  focusedTaskId: string | null
  loading?: boolean
  updatingStatusIds?: string[]
}>()

const emit = defineEmits<{
  focus: [taskId: string]
  remove: [taskId: string]
  addSubtask: [payload: CreateTaskDTO]
  toggleSubtask: [subtaskId: string]
  changeStatus: [taskId: string, status: TaskStatus]
}>()

const sortItems = [
  { label: 'Due date', value: 'deadline' },
  { label: 'Priority', value: 'priority' },
] as const

const sortBy = ref<TaskSort>('deadline')

const priorityOrder = {
  high: 0,
  medium: 1,
  low: 2,
} as const

const compareDeadline = (a: TaskItem, b: TaskItem) => {
  if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline)
  if (a.deadline) return -1
  if (b.deadline) return 1
  return 0
}

const comparePriority = (a: TaskItem, b: TaskItem) =>
  priorityOrder[a.priority] - priorityOrder[b.priority]

const sortedTasks = computed(() => {
  return [...props.tasks].sort((a, b) => {
    const primaryDiff =
      sortBy.value === 'deadline'
        ? compareDeadline(a, b)
        : comparePriority(a, b)
    if (primaryDiff !== 0) return primaryDiff

    const secondaryDiff =
      sortBy.value === 'deadline'
        ? comparePriority(a, b)
        : compareDeadline(a, b)
    if (secondaryDiff !== 0) return secondaryDiff

    return b.createdAt.localeCompare(a.createdAt)
  })
})
</script>

<template>
  <section class="space-y-4" aria-labelledby="task-list-heading">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 id="task-list-heading" class="font-medium text-highlighted">
          Your tasks
        </h2>
        <p class="text-xs text-muted">
          {{ tasks.length }} {{ tasks.length === 1 ? 'task' : 'tasks' }}
        </p>
      </div>

      <div class="flex items-center gap-2">
        <span class="text-sm text-muted">Sort by</span>
        <USelect
          v-model="sortBy"
          :items="sortItems"
          aria-label="Sort tasks"
          class="w-36"
        />
      </div>
    </div>

    <UCard v-if="loading">
      <p class="text-sm text-muted">Loading tasks…</p>
    </UCard>

    <UCard v-else-if="sortedTasks.length === 0">
      <div class="py-6 text-center">
        <UIcon
          name="i-lucide-list-checks"
          class="mx-auto mb-3 size-8 text-dimmed"
        />
        <p class="font-medium text-highlighted">No tasks yet</p>
        <p class="mt-1 text-sm text-muted">
          Add your first task and start focusing.
        </p>
      </div>
    </UCard>

    <div v-else class="space-y-3">
      <DashboardTask
        v-for="task in sortedTasks"
        :key="task.id"
        :task="task"
        :focused-task-id="focusedTaskId"
        :updating-status="updatingStatusIds?.includes(task.id)"
        @change-status="
          (taskId, status) => emit('changeStatus', taskId, status)
        "
        @focus="(taskId) => emit('focus', taskId)"
        @remove="(taskId) => emit('remove', taskId)"
        @add-subtask="(payload) => emit('addSubtask', payload)"
        @toggle-subtask="(subtaskId) => emit('toggleSubtask', subtaskId)"
      />
    </div>
  </section>
</template>
