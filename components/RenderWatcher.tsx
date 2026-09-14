'use client'

import Link from 'next/link'
import { useRenderWatcher } from '@/lib/useRenderWatcher'

// Mounted once in the app shell. Drives the completion toasts/notifications
// from anywhere in the app, and shows a small pill while renders are running so
// leaving the builder doesn't feel like abandoning the job.
//
// Renders nothing when nothing is in flight.
export function RenderWatcher() {
  const { running } = useRenderWatcher()
  if (running < 1) return null

  return (
    <Link
      href="/library"
      title={`${running} render${running === 1 ? '' : 's'} in progress — they'll finish even if you leave this page`}
      style={{
        position: 'fixed', bottom: 20, left: 20, zIndex: 900,
        display: 'inline-flex', alignItems: 'center', gap: 9,
        padding: '9px 15px 9px 13px', borderRadius: 999,
        background: 'var(--ink)', color: 'var(--on-ink)',
        fontSize: 12.5, fontWeight: 600, textDecoration: 'none',
        boxShadow: '0 6px 24px rgba(0,0,0,0.22)',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 9, height: 9, borderRadius: '50%',
          background: '#b91c1c', flexShrink: 0,
          animation: 'rw-pulse 1.4s ease-in-out infinite',
        }}
      />
      {running} render{running === 1 ? '' : 's'} running
      <style>{`
        @keyframes rw-pulse { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
      `}</style>
    </Link>
  )
}
