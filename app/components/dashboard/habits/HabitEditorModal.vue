<script setup lang="ts">
import { getLocalTimeZone, parseDate, today } from '@internationalized/date'
import InputDateCalendar from '~/components/inputs/input-date-calendar.vue'
import type { CreateHabitInput, Habit } from '~/types/habits.types'

const props = defineProps<{
  open: boolean
  habit: Habit | null
  todayDate: string
  saving?: boolean
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
  submit: [input: CreateHabitInput]
}>()

const form = reactive<CreateHabitInput>({
  name: '',
  startsOn: '',
})

const isOpen = computed({
  get: () => props.open,
  set: (open: boolean) => emit('update:open', open),
})

const isEditing = computed(() => Boolean(props.habit))
const title = computed(() => (isEditing.value ? 'Rename habit' : 'New habit'))
const submitLabel = computed(() =>
  isEditing.value ? 'Save name' : 'Create habit',
)
const fallbackToday = () => today(getLocalTimeZone()).toString()

const resetForm = () => {
  form.name = props.habit?.name ?? ''
  form.startsOn = props.habit?.startsOn ?? props.todayDate ?? fallbackToday()
}

const isValid = computed(() => {
  const name = form.name.trim()
  if (!name || name.length > 80) return false
  if (isEditing.value) return true

  try {
    parseDate(form.startsOn)
    return form.startsOn <= props.todayDate
  } catch {
    return false
  }
})

const submit = () => {
  if (!isValid.value) return
  emit('submit', {
    name: form.name.trim(),
    startsOn: form.startsOn,
  })
}

watch(
  () => [props.open, props.habit?.id, props.todayDate] as const,
  ([open]) => {
    if (open) resetForm()
  },
  { immediate: true },
)
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="title"
    :description="
      isEditing
        ? 'Update the name without changing its history.'
        : 'Track one simple action every day.'
    "
  >
    <template #body>
      <UForm :state="form" class="space-y-4" @submit.prevent="submit">
        <UFormField label="Habit name" name="name" required>
          <UInput
            v-model="form.name"
            maxlength="80"
            autofocus
            placeholder="Read for 20 minutes"
            class="w-full"
          />
        </UFormField>

        <UFormField v-if="!isEditing" label="Start date" name="startsOn">
          <InputDateCalendar v-model="form.startsOn" :max-date="todayDate" />
          <template #hint>Past dates can be filled in later.</template>
        </UFormField>

        <button type="submit" class="hidden" aria-hidden="true" />
      </UForm>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="soft" @click="isOpen = false">
          Cancel
        </UButton>
        <UButton
          color="primary"
          :loading="saving"
          :disabled="!isValid"
          @click="submit"
        >
          {{ submitLabel }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
