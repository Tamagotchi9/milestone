// pg treats sslmode=require as verify-full today, but pg v9 will weaken it to
// libpq semantics. Neon URLs ship with require, so pin full verification.
export const withVerifiedTls = (connectionString: string) => {
  const url = new URL(connectionString)
  url.searchParams.set('sslmode', 'verify-full')
  return url.toString()
}
