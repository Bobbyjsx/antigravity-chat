'use client'

import { Component, ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Log error to monitoring service
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center min-h-[100dvh] h-full w-full bg-gray-900 text-white p-6 text-center">
          <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
          <p className="text-gray-400 mb-6 max-w-md">
            An unexpected error occurred. Please try refreshing the page.
          </p>
          <div className="flex gap-4">
            <Button 
              onClick={() => this.setState({ hasError: false })}
              className="bg-blue-600 hover:bg-blue-700 text-white border-none"
            >
              Try again
            </Button>
            <Button 
              onClick={() => window.location.reload()}
              variant="outline"
              className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
            >
              Reload Page
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
