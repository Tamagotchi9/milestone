import { auth } from '@/lib/auth/server'
import { type NextRequest, NextResponse } from 'next/server'

const neonAuth = auth.middleware({
  loginUrl: '/auth/sign-in',
  publicRoutes: ['/', '/logo', '/robots.txt'],
})

// Server Actions skip the auth proxy. The client calls them with fetch,
// and it cannot follow the proxy's 307 to the sign-in page, so it would show
// a generic error. Each action checks the session itself in withUserDb,
// which redirects to sign-in, and RLS limits the rows it can touch.
export function proxy(request: NextRequest) {
  return request.method === 'POST' && request.headers.has('next-action')
    ? NextResponse.next()
    : neonAuth(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
