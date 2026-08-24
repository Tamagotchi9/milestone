<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

import type { CreateTaskDTO } from '~/types/tasks.types'
import AppDialog from '~/components/dialogs/AppDialog.vue'
import TaskForm from '~/components/dashboard/tasks/TaskForm.vue'
import TaskList from '~/components/dashboard/tasks/TaskList.vue'

const router = useRouter()

const {
  tasks,
  isLoading,
  getTasks,
  addTask,
  removeTask,
  toggleSubtask,
  focusedTaskId,
  setFocusedTask,
} = useTasks()

const isTaskDialogOpen = ref(false)
const isCreatingTask = ref(false)

onMounted(() => {
  getTasks()
})

const createTask = async (payload: CreateTaskDTO) => {
  isCreatingTask.value = true
  try {
    const created = await addTask(payload)
    if (created) isTaskDialogOpen.value = false
  } finally {
    isCreatingTask.value = false
  }
}

const createSubtask = async (payload: CreateTaskDTO) => {
  await addTask(payload)
}

const startFocus = async (taskId: string) => {
  setFocusedTask(taskId)
  await router.push('/dashboard/pomidoro')
}
</script>

<template>
  <main class="mx-auto w-full max-w-4xl space-y-6 p-6 md:p-10">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div class="max-w-2xl space-y-1">
        <h1 class="text-2xl font-semibold text-highlighted">Tasks</h1>
        <p class="text-sm text-muted">
          Plan your work, break it into clear steps, and start a focused session
          when you are ready.
        </p>
      </div>

      <UButton
        color="primary"
        icon="i-lucide-plus"
        @click="isTaskDialogOpen = true"
      >
        Add task
      </UButton>
    </header>

    <TaskList
      :tasks="tasks"
      :loading="isLoading"
      :focused-task-id="focusedTaskId"
      @focus="startFocus"
      @remove="removeTask"
      @add-subtask="createSubtask"
      @toggle-subtask="toggleSubtask"
    />

    <AppDialog
      v-model:open="isTaskDialogOpen"
      title="Create a task"
      description="Add the details now; subtasks can be added from the task list later."
      :dismissible="!isCreatingTask"
    >
      <TaskForm
        v-if="isTaskDialogOpen"
        :loading="isCreatingTask"
        @create="createTask"
      />
    </AppDialog>
  </main>
</template>
