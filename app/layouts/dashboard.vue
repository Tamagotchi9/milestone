<script setup lang="ts">
import { storeToRefs } from 'pinia'

import DashboardSidebar from '~/components/dashboard/Sidebar.vue'

const pomodoroRuntimeStore = usePomodoroRuntimeStore()
const { isRunning, runningTabTitle } = storeToRefs(pomodoroRuntimeStore)

useHead(() => ({
  title: isRunning.value ? runningTabTitle.value : undefined,
}))

onMounted(() => {
  void pomodoroRuntimeStore.initialize()
})

onBeforeUnmount(() => {
  void pomodoroRuntimeStore.shutdown()
})
</script>

<template>
  <UApp>
    <div class="min-h-screen flex">
      <DashboardSidebar />
      <main class="flex-1 min-h-0 overflow-y-auto">
        <slot />
      </main>
    </div>
  </UApp>
</template>
