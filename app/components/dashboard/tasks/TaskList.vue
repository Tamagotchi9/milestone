<script setup lang="ts">
import type { CreateTaskDTO, TaskItem, TaskPriority } from '~/types/tasks.types'
import DashboardTask from '~/components/dashboard/tasks/Task.vue'

const props = defineProps<{
  tasks: TaskItem[]
  focusedTaskId: string | null
  loading?: boolean
}>()

const emit = defineEmits<{
  focus: [taskId: string]
  remove: [taskId: string]
  setPriority: [taskId: string, priority: TaskPriority]
  setDeadline: [taskId: string, deadline: string | null]
  addSubtask: [payload: CreateTaskDTO]
  toggleSubtask: [subtaskId: string]
}>()

const priorityOrder = {
  high: 0,
  medium: 1,
  low: 2,
} as const

const sortedTasks = computed(() => {
  return [...props.tasks].sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
    if (priorityDiff !== 0) return priorityDiff

    if (a.deadline && b.deadline) {
      return a.deadline.localeCompare(b.deadline)
    }

    if (a.deadline && !b.deadline) return -1
    if (!a.deadline && b.deadline) return 1

    return b.createdAt.localeCompare(a.createdAt)
  })
})
</script>

<template>
  <div v-if="loading">
    <UCard>
      <p class="text-sm text-muted">Loading tasks…</p>
    </UCard>
  </div>

  <div v-else-if="sortedTasks.length === 0">
    <UCard>
      <p class="text-sm text-muted">
        No tasks yet. Add your first task above and start focusing.
      </p>
    </UCard>
  </div>

  <div v-else class="space-y-4">
    <DashboardTask
      v-for="task in sortedTasks"
      :key="task.id"
      :task="task"
      :focused-task-id="focusedTaskId"
      @focus="(taskId) => emit('focus', taskId)"
      @remove="(taskId) => emit('remove', taskId)"
      @set-priority="
        (taskId, priority) => emit('setPriority', taskId, priority)
      "
      @set-deadline="
        (taskId, deadline) => emit('setDeadline', taskId, deadline)
      "
      @add-subtask="(payload) => emit('addSubtask', payload)"
      @toggle-subtask="
        (subtaskId) => emit('toggleSubtask', subtaskId)
      "
    />
  </div>
</template>
