import { auth } from '@/lib/auth/server'
import { type Transaction, withClaims } from '@/db/with-claims'

export const withUserDb = async <T>(fn: (tx: Transaction) => Promise<T>) => {
  const { data: session } = await auth.getSession()

  if (!session?.user) {
    throw new Error('withUserDb called without a session')
  }

  return withClaims(session.user.id, fn)
}
