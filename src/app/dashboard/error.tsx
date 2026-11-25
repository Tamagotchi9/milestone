'use client'

import { useEffect } from 'react'
import { TriangleAlertIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DashboardErrorProps {
  error: unknown
  retry: () => void
}

// In production a server error reaches the client with a generic message
// and a digest that matches the full error in the server logs.
const getDigest = (error: unknown) =>
  error instanceof Error &&
  'digest' in error &&
  typeof error.digest === 'string'
    ? error.digest
    : null

const DashboardError = ({ error, retry }: DashboardErrorProps) => {
  useEffect(() => {
    console.error(error)
  }, [error])

  const digest = getDigest(error)

  return (
    <div className="p-4 md:p-6">
      <div
        role="alert"
        className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center"
      >
        <TriangleAlertIcon aria-hidden className="size-8 text-destructive" />
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          This page could not be loaded. Try again, and if the problem stays,
          reload the page.
        </p>
        {digest && (
          <p className="text-xs text-muted-foreground">
            Error code: <code>{digest}</code>
          </p>
        )}
        <Button className="mt-2" onClick={() => retry()}>
          Try again
        </Button>
      </div>
    </div>
  )
}

export default DashboardError
