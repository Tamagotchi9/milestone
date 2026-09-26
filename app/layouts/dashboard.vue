<script setup lang="ts">
import { storeToRefs } from 'pinia'

import DashboardSidebar from '~/components/dashboard/Sidebar.vue'

const pomodoroRuntimeStore = usePomodoroRuntimeStore()
const { isRunning, runningTabTitle } = storeToRefs(pomodoroRuntimeStore)
const isSidebarMini = ref(false)

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
      <DashboardSidebar v-model:mini="isSidebarMini" />
      <main
        class="h-screen min-w-0 overflow-y-auto overscroll-contain scroll-smooth transition-[margin-left] duration-200"
        :class="isSidebarMini ? 'ml-16' : 'ml-64'"
      >
        <slot />
      </main>
    </div>
  </UApp>
</template>
