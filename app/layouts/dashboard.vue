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
    <div class="h-screen overflow-hidden bg-default">
      <DashboardSidebar />
      <main
        class="ml-64 h-screen min-w-0 overflow-y-auto overscroll-contain scroll-smooth"
      >
        <slot />
      </main>
    </div>
  </UApp>
</template>
