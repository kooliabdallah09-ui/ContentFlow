'use client'

import { useEffect, useState } from 'react'
import { subscribeToToasts, type Toast } from '@/lib/notifications'
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react'

export default function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const unsubscribe = subscribeToToasts((toast) => {
      if (toast.message === '' && toast.duration === 0) {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id))
      } else {
        setToasts((prev) => (prev.find((t) => t.id === toast.id) ? prev : [...prev, toast]))
      }
    })
    return () => { unsubscribe() }
  }, [])

  const accent = (type: Toast['type']) => {
    switch (type) {
      case 'success': return 'var(--good, #10b981)'
      case 'error':   return 'var(--danger, #ef4444)'
      case 'warning': return 'var(--warn, #f59e0b)'
      default:        return 'var(--info, #3b82f6)'
    }
  }

  const icon = (type: Toast['type']) => {
    const c = accent(type)
    const props = { size: 18, color: c, style: { flexShrink: 0, marginTop: 1 } }
    switch (type) {
      case 'success': return <CheckCircle2 {...props} />
      case 'error':   return <AlertCircle {...props} />
      case 'warning': return <AlertTriangle {...props} />
      default:        return <Info {...props} />
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        pointerEvents: 'none',
        maxWidth: 380,
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            gap: 12,
            padding: '12px 14px',
            borderRadius: 12,
            border: `1px solid ${accent(t.type)}33`,
            borderLeft: `3px solid ${accent(t.type)}`,
            background: 'var(--surface, #ffffff)',
            color: 'var(--ink, #111827)',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15), 0 4px 10px -3px rgba(0,0,0,0.08)',
            animation: 'cf-toast-in 200ms ease-out',
          }}
        >
          {icon(t.type)}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.35 }}>
              {t.message}
            </div>
            {t.description && (
              <div style={{ fontSize: 12.5, color: 'var(--ink-dim, #64748b)', marginTop: 3, lineHeight: 1.45 }}>
                {t.description}
              </div>
            )}
          </div>
          <button
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            aria-label="Close"
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              padding: 2, color: 'var(--ink-dim, #94a3b8)', flexShrink: 0,
              display: 'inline-flex', alignItems: 'flex-start',
            }}
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <style>{`
        @keyframes cf-toast-in {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}
