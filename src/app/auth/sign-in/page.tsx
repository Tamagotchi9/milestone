import Link from 'next/link'
import GoogleSignInButton from '@/components/auth/GoogleSignInButton'
import SignInForm from '@/components/auth/SignInForm'

const SignInPage = () => (
  <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 p-8">
    <h1 className="font-heading text-2xl font-semibold">
      Sign in to Milestone
    </h1>
    <SignInForm />
    <GoogleSignInButton />
    <p className="text-sm text-muted-foreground">
      No account? <Link href="/auth/sign-up">Create one</Link>
    </p>
  </main>
)

export default SignInPage
