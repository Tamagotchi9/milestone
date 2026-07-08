<script setup lang="ts">
import { parseDate, type DateValue } from '@internationalized/date'

interface Props {
  modelValue: string | null
  minDate?: DateValue | string | null
  maxDate?: DateValue | string | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const inputDate = useTemplateRef('inputDate')

const toDateValue = (value?: DateValue | string | null): DateValue | undefined => {
  if (!value) return undefined
  if (typeof value !== 'string') return value

  try {
    const datePart = value.split('T')[0] ?? value
    return parseDate(datePart)
  } catch {
    return undefined
  }
}

const dateValue = computed({
  get: (): DateValue | undefined => toDateValue(props.modelValue),
  set: (value: DateValue | undefined) => {
    emit('update:modelValue', value ? value.toString() : null)
  },
})

const minDateValue = computed(() => toDateValue(props.minDate))
const maxDateValue = computed(() => toDateValue(props.maxDate))
</script>

<template>
  <UInputDate
    ref="inputDate"
    v-model="dateValue"
    :min-value="minDateValue"
    :max-value="maxDateValue"
  >
    <template #trailing>
      <UPopover :reference="inputDate?.inputsRef[3]?.$el">
        <UButton
          color="neutral"
          variant="link"
          size="sm"
          icon="i-lucide-calendar"
          aria-label="Select a date"
          class="px-0"
        />

        <template #content>
          <UCalendar
            v-model="dateValue"
            :min-value="minDateValue"
            :max-value="maxDateValue"
            class="p-2"
          />
        </template>
      </UPopover>
    </template>
  </UInputDate>
</template>
