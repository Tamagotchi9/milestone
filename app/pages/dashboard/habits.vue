<script setup lang="ts">
import HabitsPanel from '~/components/dashboard/habits/HabitsPanel.vue'

definePageMeta({ layout: 'dashboard' })
</script>

<template>
  <main class="mx-auto w-full max-w-screen-2xl space-y-6 p-4 md:p-10">
    <header class="max-w-2xl space-y-1">
      <h1 class="text-2xl font-semibold text-highlighted">Habit tracker</h1>
      <p class="text-sm text-muted">
        Manage your habits, review the calendar, and keep your streak moving.
      </p>
    </header>

    <HabitsPanel />
  </main>
</template>
