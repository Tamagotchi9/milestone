<script setup lang="ts">
const supabase = useSupabaseClient()
const router = useRouter()

const form = reactive({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
})

const error = ref('')
const success = ref('')
const loading = ref(false)

async function register() {
  error.value = ''
  success.value = ''

  if (form.password !== form.confirmPassword) {
    error.value = 'Passwords do not match'
    return
  }

  loading.value = true

  const { error: err } = await supabase.auth.signUp({
    email: form.email,
    password: form.password,
    options: {
      data: {
        full_name: form.name,
      },
      emailRedirectTo: `${window.location.origin}/auth/confirm`,
    },
  })

  if (err) {
    error.value = err.message
  } else {
    success.value = 'Account created. Check your email to confirm your account.'
    await router.push('/auth/login')
  }

  loading.value = false
}
</script>

<template>
  <UCard class="w-full max-w-md">
    <template #header>
      <div class="space-y-1">
        <h1 class="text-2xl font-semibold">Create your account</h1>
        <p class="text-sm text-muted">Sign up with email and password</p>
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

    <UAlert
      v-if="success"
      color="success"
      variant="soft"
      icon="i-lucide-circle-check"
      :title="success"
      class="mb-4"
    />

    <UForm :state="form" class="space-y-4" @submit.prevent="register">
      <UFormField label="Name" name="name">
        <UInput
          v-model="form.name"
          type="text"
          placeholder="Your full name"
          class="w-full"
        />
      </UFormField>

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
          placeholder="Create a password"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Confirm password" name="confirmPassword">
        <UInput
          v-model="form.confirmPassword"
          type="password"
          placeholder="Repeat your password"
          class="w-full"
        />
      </UFormField>

      <UButton type="submit" color="primary" block :loading="loading">
        Create account
      </UButton>
    </UForm>

    <template #footer>
      <p class="text-sm text-muted">
        Already have an account?
        <NuxtLink
          to="/auth/login"
          class="font-medium text-primary hover:underline"
        >
          Sign in
        </NuxtLink>
      </p>
    </template>
  </UCard>
</template>
