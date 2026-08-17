<script setup lang="ts">
const route = useRoute()
const supabase = useSupabaseClient()
const router = useRouter()
const currentUserStore = useCurrentUserStore()
const pomodoroRuntimeStore = usePomodoroRuntimeStore()

const userEmail = computed(() => currentUserStore.user?.email ?? 'Account')

const nav = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: 'i-lucide-layout-dashboard',
    exact: true,
  },
  {
    to: '/dashboard/tasks',
    label: 'Tasks',
    icon: 'i-lucide-list-todo',
    exact: true,
  },
  {
    to: '/dashboard/pomidoro',
    label: 'Pomidoro',
    icon: 'i-lucide-timer',
    exact: true,
  },
] as const

const isNavActive = (item: (typeof nav)[number]) => {
  const path = route.path
  if (item.exact) return path === item.to
  return path === item.to || path.startsWith(`${item.to}/`)
}

const signOut = async () => {
  await pomodoroRuntimeStore.shutdown()
  await supabase.auth.signOut()
  currentUserStore.clearAuthState()
  await router.push('/auth/login')
}
</script>

<template>
  <USidebar
    collapsible="none"
    class="w-64 h-screen shrink-0 border-r border-default bg-elevated/50"
    :ui="{
      header: 'border-0 p-0',
      body: 'flex flex-1 flex-col min-h-0 p-0',
      footer: 'border-0 p-0',
    }"
  >
    <template #header>
      <div class="p-4 border-b border-default">
        <NuxtLink
          to="/dashboard"
          class="flex items-center gap-2 font-semibold text-highlighted"
        >
          <UIcon name="i-lucide-flag" class="size-8 text-primary" />
          <span>Milestone</span>
        </NuxtLink>
      </div>
    </template>

    <nav class="flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
      <NuxtLink
        v-for="item in nav"
        :key="item.to"
        :to="item.to"
        class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-elevated hover:text-highlighted transition-colors"
        :class="isNavActive(item) ? '!bg-primary/10 !text-primary' : undefined"
      >
        <UIcon :name="item.icon" class="size-5 shrink-0" />
        {{ item.label }}
      </NuxtLink>
    </nav>

    <template #footer>
      <div class="p-3 border-t border-default space-y-2">
        <p class="px-2 text-xs text-muted truncate" :title="userEmail">
          {{ userEmail }}
        </p>
        <UButton
          color="neutral"
          variant="soft"
          block
          icon="i-lucide-log-out"
          @click="signOut"
        >
          Sign out
        </UButton>
      </div>
    </template>
  </USidebar>
</template>
