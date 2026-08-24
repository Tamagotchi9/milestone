<script setup lang="ts">
import type { CreateTaskDTO, TaskPriority } from '~/types/tasks.types'
import InputDateCalendar from '~/components/inputs/input-date-calendar.vue'
import { getLocalTimeZone, today } from '@internationalized/date'

const emit = defineEmits<{
  create: [payload: CreateTaskDTO]
}>()

withDefaults(
  defineProps<{
    loading?: boolean
  }>(),
  {
    loading: false,
  },
)

const priorityItems = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
] as const

const form = reactive({
  title: '',
  description: '',
  priority: 'medium' as TaskPriority,
  deadline: '',
})

const minDeadline = today(getLocalTimeZone())

const createTask = () => {
  emit('create', {
    title: form.title,
    description: form.description,
    priority: form.priority,
    deadline: form.deadline || null,
  })
}

const handleDeadlineUpdate = (value: string | null) => {
  form.deadline = value ?? ''
}
</script>

<template>
  <UForm :state="form" class="space-y-4" @submit.prevent="createTask">
    <UFormField label="Task title" name="title" required>
      <UInput
        v-model="form.title"
        autofocus
        placeholder="Finish landing page copy"
        class="w-full"
      />
    </UFormField>

    <UFormField label="Description" name="description">
      <UTextarea
        v-model="form.description"
        :rows="3"
        placeholder="Optional context about this task"
        class="w-full"
      />
    </UFormField>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <UFormField label="Priority" name="priority">
        <USelect
          v-model="form.priority"
          :items="priorityItems"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Due date" name="deadline">
        <InputDateCalendar
          :model-value="form.deadline"
          :min-date="minDeadline"
          @update:model-value="handleDeadlineUpdate"
        />
      </UFormField>
    </div>

    <div class="flex justify-end">
      <UButton
        type="submit"
        color="primary"
        icon="i-lucide-plus"
        :loading="loading"
        :disabled="!form.title.trim()"
      >
        Create task
      </UButton>
    </div>
  </UForm>
</template>
