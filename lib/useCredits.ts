'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from './auth'

// Reliably loads credit balance. The sidebar pattern that works:
//   1. getUser() — server roundtrip that refreshes a stale token (critical step)
//   2. getSession() — now returns a valid, fresh token
//   3. fetch /api/credits/balance with the token
// Skipping getUser() causes getSession() to return a null/stale session on
// fresh page loads, which is why plain getSession() → fetch showed Balance: 0.
export function useCredits(): { balance: number; refresh: () => void } {
  const [balance, setBalance] = useState<number | null>(null)
  const [tick, setTick] = useState(0)

  const refresh = () => setTick(t => t + 1)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const supabase = getSupabase()
        if (!supabase) return

        // Step 1: getUser() makes a server call that refreshes the token if stale.
        const { data: userData } = await supabase.auth.getUser()
        if (!userData?.user || cancelled) return

        // Step 2: now getSession() has a valid, refreshed token.
        const { data: sessData } = await supabase.auth.getSession()
        const token = sessData?.session?.access_token
        if (!token || cancelled) return

        // Step 3: fetch balance.
        const res = await fetch('/api/credits/balance', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok || cancelled) return
        const data = await res.json().catch(() => ({}))
        if (!cancelled && typeof data?.balance === 'number') setBalance(data.balance)
      } catch {
        // Non-fatal — balance stays null (no stale 0 shown)
      }
    })()

    return () => { cancelled = true }
  }, [tick])

  // Return null as 0 only after first successful load.
  // Before that, show null so the UI can distinguish "loading" from "0 credits".
  return { balance: balance ?? 0, refresh }
}
