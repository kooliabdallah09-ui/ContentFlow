'use client'

import { useEffect, useState } from 'react'
import { subscribeToToasts, type Toast } from '@/lib/notifications'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'

export default function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const unsubscribe = subscribeToToasts((toast) => {
      if (toast.message === '' && toast.duration === 0) {
        // This is a remove signal
        setToasts((prev) => prev.filter((t) => t.id !== toast.id))
      } else {
        setToasts((prev) => {
          const exists = prev.find((t) => t.id === toast.id)
          if (exists) return prev
          return [...prev, toast]
        })
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const getIcon = (type: Toast['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-400" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />
      case 'info':
      default:
        return <Info className="w-5 h-5 text-blue-400" />
    }
  }

  const getBackgroundColor = (type: Toast['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-900/30 border-green-700/50'
      case 'error':
        return 'bg-red-900/30 border-red-700/50'
      case 'warning':
        return 'bg-yellow-900/30 border-yellow-700/50'
      case 'info':
      default:
        return 'bg-blue-900/30 border-blue-700/50'
    }
  }

  return (
    <div className="fixed bottom-8 right-8 z-50 space-y-3 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex gap-3 p-4 rounded-lg border backdrop-blur-sm max-w-md ${getBackgroundColor(toast.type)}`}
        >
          {getIcon(toast.type)}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">{toast.message}</p>
            {toast.description && (
              <p className="text-sm text-white/70 mt-1">{toast.description}</p>
            )}
          </div>
          <button
            onClick={() => {
              setToasts((prev) => prev.filter((t) => t.id !== toast.id))
            }}
            className="flex-shrink-0 text-white/50 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
