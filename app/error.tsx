'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, RotateCw, Home } from 'lucide-react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [retryCount, setRetryCount] = useState(0)
  const maxRetries = 3

  useEffect(() => {
    console.error('Error occurred:', error)
  }, [error])

  const handleRetry = () => {
    if (retryCount < maxRetries) {
      setRetryCount(retryCount + 1)
      reset()
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-red-900/30 rounded-full border border-red-700/50">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
        </div>

        {/* Error Message */}
        <h1 className="text-3xl font-black text-white mb-3">Something went wrong</h1>
        <p className="text-white/60 mb-6">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>

        {/* Retry Info */}
        {retryCount < maxRetries && (
          <p className="text-sm text-white/40 mb-6">
            Retry attempt {retryCount} of {maxRetries}
          </p>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {retryCount < maxRetries && (
            <button
              onClick={handleRetry}
              className="w-full px-4 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <RotateCw className="w-4 h-4" />
              Try Again
            </button>
          )}

          <Link
            href="/dashboard"
            className="w-full px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            Go to Dashboard
          </Link>
        </div>

        {/* Error Details */}
        {process.env.NODE_ENV === 'development' && error.digest && (
          <div className="mt-8 p-4 rounded-lg bg-white/5 border border-white/10">
            <p className="text-xs text-white/40 mb-2 font-mono">Error ID:</p>
            <p className="text-xs text-white/60 font-mono break-all">{error.digest}</p>
          </div>
        )}
      </div>
    </div>
  )
}
