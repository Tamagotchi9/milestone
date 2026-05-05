import type { Session, User } from '@supabase/supabase-js'

export const useCurrentUserStore = defineStore('currentUser', () => {
  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)
  const loading = ref(true)
  const initialized = ref(false)

  const isAuthenticated = computed(
    () => !!session.value?.access_token && !!user.value,
  )
  const accessToken = computed(() => session.value?.access_token ?? null)

  function setAuthState(nextSession: Session | null) {
    session.value = nextSession
    user.value = nextSession?.user ?? null
    loading.value = false
  }

  async function init() {
    if (initialized.value) return

    const supabase = useSupabaseClient()
    const { data } = await supabase.auth.getSession()
    setAuthState(data.session)
    initialized.value = true
  }

  function clearAuthState() {
    setAuthState(null)
  }

  return {
    user,
    session,
    loading,
    initialized,
    isAuthenticated,
    accessToken,
    setAuthState,
    init,
    clearAuthState,
  }
})
