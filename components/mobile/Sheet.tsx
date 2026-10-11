'use client'

// Bottom-sheet modal primitive. Slides up from the bottom of the viewport,
// darkens the background, respects safe-area-inset. Closes on backdrop tap
// and on the built-in close button. Locks body scroll while open.

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  // Height as a viewport-height percentage. Default 88vh. Use 'auto' for
  // content-sized sheets.
  height?: string
}

export function Sheet({ open, onClose, title, children, height = '88vh' }: SheetProps) {
  useEffect(() => {
    if (!open || typeof document === 'undefined') return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (typeof document === 'undefined') return null
  if (!open) return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(15, 15, 15, 0.55)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          animation: 'cf-sheet-fade 220ms ease-out',
        }}
      />
      {/* Panel */}
      <div
        style={{
          position: 'relative',
          background: 'var(--surface)',
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14,
          borderTop: '1px solid var(--border-strong)',
          maxHeight: height,
          height,
          display: 'flex', flexDirection: 'column',
          paddingBottom: 'env(safe-area-inset-bottom, 0)',
          animation: 'cf-sheet-up 260ms cubic-bezier(0.32, 0.72, 0, 1)',
          boxShadow: '0 -4px 0 var(--border-strong)',
        }}
      >
        {/* Grabber */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 0' }}>
          <span style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--ink-mute)', opacity: 0.5 }} />
        </div>
        {/* Header — always render the close button so tapping it works even
           when there's no title. */}
        {(
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 18px 8px', minHeight: 48,
          }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 19, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)' }}>{title}</div>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 32, height: 32, borderRadius: 5, border: '1px solid var(--border-strong)',
                background: 'var(--surface-2, rgba(0,0,0,0.05))', color: 'var(--ink)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', padding: 0,
              }}
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {children}
        </div>
      </div>
      <style>{`
        @keyframes cf-sheet-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cf-sheet-up   { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>,
    document.body,
  )
}
