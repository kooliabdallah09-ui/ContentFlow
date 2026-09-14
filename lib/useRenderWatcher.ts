'use client'

import { useEffect, useRef, useState } from 'react'
import { getSupabase } from '@/lib/auth'
import { showSuccess, showError } from '@/lib/notifications'

// Watches the user's renders from anywhere in the app, so leaving the builder
// mid-generation no longer means losing track of the result.
//
// The cron reconciler is what actually finishes a render; this only reports on
// it. Completion is detected by diffing statuses between polls rather than
// reading a timestamp column, which keeps it working regardless of whether
// migration 018 has been applied yet.
//
// Polling rather than realtime: a render takes minutes, so a 20s tick is
// plenty, and it avoids holding a websocket open on every page.

const POLL_MS = 20_000

interface Render {
  id: string
  status: string
  productName: string
  creditCost: number
  createdAt: string
}

export function useRenderWatcher(): { running: number } {
  const [running, setRunning] = useState(0)
  // Status per render id as of the previous poll. A render that was
  // `generating` and no longer is has just resolved.
  const previous = useRef<Map<string, string> | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    // Ask once, lazily — only when there's actually something to report, so a
    // user who never generates is never prompted.
    const askPermission = () => {
      if (typeof Notification === 'undefined') return
      if (Notification.permission === 'default') void Notification.requestPermission()
    }

    const notify = (title: string, body: string) => {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
      // Only worth a desktop notification when they're looking elsewhere; an
      // in-app toast already covers the visible case.
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') return
      try { new Notification(title, { body, icon: '/favicon-32.png' }) } catch { /* blocked */ }
    }

    const tick = async () => {
      try {
        const supabase = getSupabase()
        if (!supabase) return
        const { data: sess } = await supabase.auth.getSession()
        const token = sess?.session?.access_token
        if (!token) return

        const res = await fetch('/api/ugc/renders/active', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok || cancelled) return
        const { renders } = await res.json() as { renders: Render[] }

        const current = new Map(renders.map(r => [r.id, r.status]))
        const before = previous.current

        // Skip the first poll — on a fresh page load everything looks "new",
        // and replaying old results as notifications would be noise.
        if (before) {
          for (const r of renders) {
            if (before.get(r.id) !== 'generating' || r.status === 'generating') continue
            if (r.status === 'completed') {
              showSuccess('Your ad is ready', `${r.productName} finished rendering — it's in your Library.`)
              notify('Your ad is ready', `${r.productName} finished rendering.`)
            } else if (r.status === 'failed') {
              const refund = r.creditCost > 0 ? ` ${r.creditCost} credits refunded.` : ''
              showError('Render failed', `${r.productName} didn't finish.${refund}`)
              notify('Render failed', `${r.productName} didn't finish.${refund}`)
            }
          }
        }

        previous.current = current
        const n = renders.filter(r => r.status === 'generating').length
        setRunning(n)
        if (n > 0) askPermission()
      } catch { /* offline or signed out — try again next tick */ }
      finally {
        if (!cancelled) timer = setTimeout(tick, POLL_MS)
      }
    }

    void tick()
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [])

  return { running }
}
