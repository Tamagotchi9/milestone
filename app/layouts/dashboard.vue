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
