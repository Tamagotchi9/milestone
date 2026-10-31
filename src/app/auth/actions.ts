'use server'

import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/server'
import type { AuthFormState } from '@/types/auth'

export const signInWithEmail = async (
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> => {
  const email = String(formData.get('email'))

  const { error } = await auth.signIn.email({
    email,
    password: String(formData.get('password')),
  })

  if (error) {
    return { error: error.message || 'Failed to sign in', email }
  }

  redirect('/dashboard')
}

export const signUpWithEmail = async (
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> => {
  const name = String(formData.get('name'))
  const email = String(formData.get('email'))

  const { error } = await auth.signUp.email({
    name,
    email,
    password: String(formData.get('password')),
  })

  if (error) {
    return { error: error.message || 'Failed to create account', email, name }
  }

  redirect('/dashboard')
}

export const signOutUser = async () => {
  const { error } = await auth.signOut()

  if (error) {
    throw new Error(error.message || 'Failed to sign out')
  }

  redirect('/')
}
