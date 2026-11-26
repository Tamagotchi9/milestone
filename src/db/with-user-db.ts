import { auth } from '@/lib/auth/server'
import { type Transaction, withClaims } from '@/db/with-claims'
import { redirect } from 'next/navigation'

export const withUserDb = async <T>(fn: (tx: Transaction) => Promise<T>) => {
  const { data: session } = await auth.getSession()

  if (!session?.user) {
    redirect('/auth/sign-in')
  }

  return withClaims(session.user.id, fn)
}
