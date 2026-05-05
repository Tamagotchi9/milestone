<script setup lang="ts">
const supabase = useSupabaseClient()
const router = useRouter()
const currentUserStore = useCurrentUserStore()

const form = reactive({
  email: '',
  password: '',
})

const error = ref('')
const loading = ref(false)

async function login() {
  loading.value = true
  error.value = ''

  const { data, error: err } = await supabase.auth.signInWithPassword(form)

  if (err) {
    error.value = err.message
  } else {
    currentUserStore.setAuthState(data.session)
    await router.push('/dashboard') // todo
  }

  loading.value = false
}

async function loginWithGoogle() {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/confirm` },
  })
}
</script>

<template>
  <UCard class="w-full max-w-md">
    <template #header>
      <div class="space-y-1">
        <h1 class="text-2xl font-semibold">Sign in to Milestone</h1>
        <p class="text-sm text-muted">Continue with your email and password</p>
      </div>
    </template>

    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      icon="i-lucide-triangle-alert"
      :title="error"
      class="mb-4"
    />

    <UForm :state="form" class="space-y-4" @submit.prevent="login">
      <UFormField label="Email" name="email">
        <UInput
          v-model="form.email"
          type="email"
          placeholder="you@example.com"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Password" name="password">
        <UInput
          v-model="form.password"
          type="password"
          placeholder="Enter your password"
          class="w-full"
        />
      </UFormField>

      <div class="space-y-3">
        <UButton type="submit" color="primary" block :loading="loading">
          Sign in
        </UButton>

        <UButton
          type="button"
          color="neutral"
          variant="soft"
          block
          icon="i-simple-icons-google"
          :loading="loading"
          @click="loginWithGoogle"
        >
          Continue with Google
        </UButton>
      </div>
    </UForm>

    <template #footer>
      <p class="text-sm text-muted">
        Don't have an account?
        <NuxtLink
          to="/auth/register"
          class="font-medium text-primary hover:underline"
        >
          Sign up
        </NuxtLink>
      </p>
    </template>
  </UCard>
</template>
