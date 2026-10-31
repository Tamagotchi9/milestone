import Link from 'next/link'
import GoogleSignInButton from '@/components/auth/GoogleSignInButton'
import SignUpForm from '@/components/auth/SignUpForm'

const SignUpPage = () => (
  <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 p-8">
    <h1 className="font-heading text-2xl font-semibold">Create your account</h1>
    <SignUpForm />
    <GoogleSignInButton />
    <p className="text-sm text-muted-foreground">
      Already registered? <Link href="/auth/sign-in">Sign in</Link>
    </p>
  </main>
)

export default SignUpPage
