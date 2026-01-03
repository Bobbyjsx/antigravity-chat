'use client'

import { Button } from "@/components/ui/button"

export default function GlobalError({
  // error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body className="antialiased min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="flex flex-col items-center p-6 text-center space-y-4 max-w-md">
          <h2 className="text-2xl font-bold">Critical Error</h2>
          <p className="text-muted-foreground">
            A critical error occurred preventing the application from loading.
          </p>
          <Button onClick={() => reset()}>Try again</Button>
        </div>
      </body>
    </html>
  )
}
