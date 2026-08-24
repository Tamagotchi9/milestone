<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    description?: string
    dismissible?: boolean
  }>(),
  {
    description: undefined,
    dismissible: true,
  },
)

const emit = defineEmits<{
  'update:open': [open: boolean]
}>()

const isOpen = computed({
  get: () => props.open,
  set: (open: boolean) => emit('update:open', open),
})
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="title"
    :description="description"
    :dismissible="dismissible"
  >
    <template #body="{ close }">
      <slot :close="close" />
    </template>

    <template v-if="$slots.footer" #footer="{ close }">
      <slot name="footer" :close="close" />
    </template>
  </UModal>
</template>
