<script setup lang="ts">
import PomidoroTimer from '~/components/dashboard/PomidoroTimer.vue'

definePageMeta({ layout: 'dashboard' })
</script>

<template>
  <div class="p-6 md:p-10 flex flex-col items-center justify-center min-h-full">
    <PomidoroTimer />
  </div>
</template>
