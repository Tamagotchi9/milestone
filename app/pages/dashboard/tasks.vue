<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

import type { CreateTaskPayload } from '~/types/tasks.types'
import TaskForm from '~/components/dashboard/tasks/TaskForm.vue'
import TaskList from '~/components/dashboard/tasks/TaskList.vue'

const router = useRouter()

const {
  tasks,
  addTask,
  removeTask,
  setTaskPriority,
  setTaskDeadline,
  addSubtask,
  toggleSubtask,
  focusedTaskId,
  setFocusedTask,
} = useTasks()

const createTask = (payload: CreateTaskPayload) => {
  addTask(payload)
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
      :focused-task-id="focusedTaskId"
      @focus="startFocus"
      @remove="removeTask"
      @set-priority="setTaskPriority"
      @set-deadline="setTaskDeadline"
      @add-subtask="addSubtask"
      @toggle-subtask="toggleSubtask"
    />
  </div>
</template>
