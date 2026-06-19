'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from './auth'

// Reliably loads the user's credit balance. The pattern used in individual pages
// (getSession → fetch) silently returns 0 when Supabase auth hasn't finished
// restoring from storage yet. This hook uses onAuthStateChange so the fetch
// always runs on a confirmed session, never on a stale null session.
export function useCredits(): { balance: number; refresh: () => void } {
  const [balance, setBalance] = useState(0)
  const [tick, setTick] = useState(0)

  const refresh = () => setTick(t => t + 1)

  useEffect(() => {
    let cancelled = false

    async function fetchBalance(token: string) {
      const res = await fetch('/api/credits/balance', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json().catch(() => ({}))
      if (!cancelled && typeof data?.balance === 'number') setBalance(data.balance)
    }

    const supabase = getSupabase()
    if (!supabase) return

    // Try the current session immediately — covers the case where auth is
    // already restored when the component mounts (e.g. navigating between pages).
    supabase.auth.getSession().then((result: { data: { session: { access_token?: string } | null } }) => {
      const token = result.data.session?.access_token
      if (token && !cancelled) fetchBalance(token)
    })

    // Subscribe to auth state changes as a fallback — fires when the session is
    // restored from storage after a fresh page load (avoids the silent 0 bug).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: unknown, session: { access_token?: string } | null) => {
      if (session?.access_token && !cancelled) fetchBalance(session.access_token)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [tick])

  return { balance, refresh }
}
