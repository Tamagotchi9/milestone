<script setup lang="ts">
import milestoneLogo from '~/assets/images/logo/milestone-logo.png'
import milestoneLogoBlack from '~/assets/images/logo/milestone-logo-black.png'

const route = useRoute()
const colorMode = useColorMode()
const supabase = useSupabaseClient()
const router = useRouter()
const currentUserStore = useCurrentUserStore()
const pomodoroRuntimeStore = usePomodoroRuntimeStore()
const isSigningOut = ref(false)
const mini = defineModel<boolean>('mini', { default: false })

const userEmail = computed(() => currentUserStore.user?.email ?? 'Account')
const userDisplayName = computed(() => {
  const fullName = currentUserStore.user?.user_metadata?.['full_name']
  if (typeof fullName === 'string' && fullName.trim()) return fullName.trim()

  const emailName = currentUserStore.user?.email?.split('@')[0]?.trim()
  return emailName || 'Account'
})
const userInitial = computed(
  () => userDisplayName.value.charAt(0).toUpperCase() || 'A',
)

const logo = computed(() =>
  colorMode.value === 'dark' ? milestoneLogo : milestoneLogoBlack,
)

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
    to: '/dashboard/habits',
    label: 'Habits',
    icon: 'i-lucide-sprout',
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
  if (isSigningOut.value) return

  isSigningOut.value = true
  try {
    await pomodoroRuntimeStore.shutdown()
    await supabase.auth.signOut()
    currentUserStore.clearAuthState()
    await router.push('/auth/login')
  } finally {
    isSigningOut.value = false
  }
}

const profileMenuItems = computed(() => [
  [
    {
      label: 'Sign out',
      icon: 'i-lucide-log-out',
      color: 'error' as const,
      loading: isSigningOut.value,
      disabled: isSigningOut.value,
      onSelect: () => {
        void signOut()
      },
    },
  ],
])
</script>

<template>
  <USidebar
    collapsible="none"
    class="fixed inset-y-0 left-0 z-40 h-screen overflow-hidden border-r border-default bg-elevated/80 shadow-sm backdrop-blur-xl transition-[width] duration-200"
    :style="{ '--sidebar-width': mini ? '4rem' : '16rem' }"
    :ui="{
      header: 'border-0 p-0',
      body: 'flex flex-1 flex-col min-h-0 p-0',
      footer: 'border-0 p-0',
    }"
  >
    <template #header>
      <div
        class="flex w-full items-center py-3"
        :class="mini ? 'justify-center px-2' : 'justify-between px-4'"
      >
        <NuxtLink v-if="!mini" to="/dashboard" aria-label="Milestone dashboard">
          <img :src="logo" alt="Milestone" class="h-auto max-w-[150px]" />
        </NuxtLink>
        <button
          type="button"
          class="grid size-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-elevated hover:text-highlighted focus-visible:outline-2 focus-visible:outline-primary"
          :aria-label="mini ? 'Expand sidebar' : 'Collapse sidebar'"
          :title="mini ? 'Expand sidebar' : 'Collapse sidebar'"
          @click="mini = !mini"
        >
          <UIcon
            :name="
              mini ? 'i-lucide-panel-left-open' : 'i-lucide-panel-left-close'
            "
            class="size-5"
          />
        </button>
      </div>
    </template>

    <nav class="min-h-0 flex-1 space-y-1" :class="mini ? 'p-2' : 'p-3'">
      <NuxtLink
        v-for="item in nav"
        :key="item.to"
        :to="item.to"
        class="flex items-center gap-3 rounded-lg py-2 text-sm font-medium text-muted transition-colors hover:bg-elevated hover:text-highlighted"
        :class="[
          mini ? 'justify-center px-2' : 'px-3',
          isNavActive(item) ? '!bg-primary/10 !text-primary' : undefined,
        ]"
        :aria-label="mini ? item.label : undefined"
        :title="mini ? item.label : undefined"
      >
        <UIcon :name="item.icon" class="size-5 shrink-0" />
        <span v-if="!mini">{{ item.label }}</span>
      </NuxtLink>
    </nav>

    <template #footer>
      <div class="w-full border-t border-default/70 bg-elevated/60">
        <UDropdownMenu
          :items="profileMenuItems"
          :content="{
            side: 'top',
            align: 'start',
            sideOffset: 8,
          }"
          :ui="{ content: 'w-60' }"
        >
          <template #default="{ open }">
            <button
              type="button"
              class="flex w-full items-center gap-3 py-3 text-left outline-none transition-colors hover:bg-elevated focus-visible:bg-elevated"
              :class="mini ? 'justify-center px-2' : 'px-4'"
              aria-label="Open profile menu"
            >
              <div
                class="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary ring-1 ring-primary/20"
              >
                {{ userInitial }}
              </div>

              <div v-if="!mini" class="min-w-0 flex-1">
                <p
                  class="truncate text-sm font-semibold text-highlighted"
                  :title="userDisplayName"
                >
                  {{ userDisplayName }}
                </p>
                <p class="truncate text-xs text-muted" :title="userEmail">
                  {{ userEmail }}
                </p>
              </div>

              <UIcon
                v-if="!mini"
                :name="open ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
                class="size-4 shrink-0 text-muted"
              />
            </button>
          </template>

          <template #content-top>
            <div class="border-b border-default px-3 py-2.5">
              <p class="text-xs text-muted">Signed in as</p>
              <p class="mt-0.5 truncate text-sm font-medium text-highlighted">
                {{ userEmail }}
              </p>
            </div>
          </template>
        </UDropdownMenu>
      </div>
    </template>
  </USidebar>
</template>
