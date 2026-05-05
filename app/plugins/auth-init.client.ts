export default defineNuxtPlugin(async () => {
  const supabase = useSupabaseClient()
  const currentUserStore = useCurrentUserStore()

  await currentUserStore.init()

  supabase.auth.onAuthStateChange((_event, nextSession) => {
    currentUserStore.setAuthState(nextSession)
  })
})
