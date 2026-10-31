'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth/client'

const GoogleSignInButton = () => {
  const [error, setError] = useState<string | null>(null)

  const signInWithGoogle = async () => {
    const { error } = await authClient.signIn.social({
      provider: 'google',
      callbackURL: '/dashboard',
    })

    setError(error ? error.message || 'Failed to sign in with Google' : null)
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={signInWithGoogle}>
        Continue with Google
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </>
  )
}

export default GoogleSignInButton
