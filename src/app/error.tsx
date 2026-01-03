'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center space-y-4">
      <h2 className="text-2xl font-bold tracking-tight">Something went wrong!</h2>
      <p className="text-muted-foreground max-w-md">
        We apologize for the inconvenience. An unexpected error occurred while loading this page.
      </p>
      <div className="flex gap-4">
        <Button
          onClick={
            // Attempt to recover by trying to re-render the segment
            () => reset()
          }
        >
          Try again
        </Button>
        <Button
          variant="outline"
          onClick={() => window.location.href = '/'}
        >
          Go Home
        </Button>
      </div>
    </div>
  )
}
