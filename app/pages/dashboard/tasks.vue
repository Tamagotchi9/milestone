<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

import type { CreateTaskDTO } from '~/types/tasks.types'
import TaskForm from '~/components/dashboard/tasks/TaskForm.vue'
import TaskList from '~/components/dashboard/tasks/TaskList.vue'

const router = useRouter()

const {
  tasks,
  isLoading,
  getTasks,
  addTask,
  removeTask,
  setTaskPriority,
  setTaskDeadline,
  toggleSubtask,
  focusedTaskId,
  setFocusedTask,
} = useTasks()

onMounted(() => {
  getTasks()
})

const createTask = async (payload: CreateTaskDTO) => {
  await addTask(payload)
}

const startFocus = async (taskId: string) => {
  setFocusedTask(taskId)
  await router.push('/dashboard/pomidoro')
}
</script>

<template>
  <div class="p-6 md:p-10 space-y-6 max-w-5xl">
    <TaskForm @create="createTask" />
    <TaskList
      :tasks="tasks"
      :loading="isLoading"
      :focused-task-id="focusedTaskId"
      @focus="startFocus"
      @remove="removeTask"
      @set-priority="setTaskPriority"
      @set-deadline="setTaskDeadline"
      @add-subtask="createTask"
      @toggle-subtask="toggleSubtask"
    />
  </div>
</template>
