import { sql } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { signOutUser } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import { db } from '@/db'
import { auth } from '@/lib/auth/server'

const DashboardContent = async () => {
  await connection()

  const { data: session } = await auth.getSession()

  if (!session?.user) {
    redirect('/auth/sign-in')
  }

  const { rows } = await db.execute<{ name: string }>(
    sql`select current_database() as name`,
  )

  return (
    <>
      <p>Signed in as {session.user.email}</p>
      <p className="text-sm text-muted-foreground">
        Connected to database: {rows[0].name}
      </p>
      <form action={signOutUser}>
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
    </>
  )
}

const DashboardPage = () => (
  <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
    <h1 className="font-heading text-2xl font-semibold">Dashboard</h1>
    <Suspense fallback={<p className="text-muted-foreground">Loading...</p>}>
      <DashboardContent />
    </Suspense>
  </main>
)

export default DashboardPage
