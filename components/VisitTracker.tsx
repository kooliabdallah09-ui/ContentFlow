'use client'

// Fires a beacon to /api/track/visit on every route change. Skips /admin,
// /api, /_next, and auth pages so admin activity doesn't clutter the panel.
// Duplicates within the same pathname are deduped in-session so React
// re-renders don't spam the endpoint.

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

const SKIP_PREFIXES = ['/admin', '/api', '/_next', '/auth']

export function VisitTracker() {
  const pathname = usePathname()
  const lastLogged = useRef<string>('')

  useEffect(() => {
    if (!pathname) return
    if (SKIP_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) return
    if (lastLogged.current === pathname) return
    lastLogged.current = pathname

    // sendBeacon is best-effort and non-blocking; fetch fallback for browsers
    // that don't support it. Errors are swallowed — tracking must never
    // interfere with the actual page.
    try {
      const payload = JSON.stringify({
        path: pathname,
        referrer: document.referrer || null,
      })
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' })
        navigator.sendBeacon('/api/track/visit', blob)
      } else {
        fetch('/api/track/visit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => {})
      }
    } catch { /* ignore */ }
  }, [pathname])

  return null
}
