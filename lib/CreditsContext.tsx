'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { getSupabase } from './auth'

interface CreditsCtx {
  balance: number | null   // null = still loading
  refresh: () => void
}

const Ctx = createContext<CreditsCtx>({ balance: null, refresh: () => {} })

export function CreditsProvider({ children }: { children: React.ReactNode }) {
  const [balance, setBalance] = useState<number | null>(null)
  const fetchingRef = useRef(false)

  const fetchBalance = useCallback(async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    try {
      const supabase = getSupabase()
      if (!supabase) return

      const { data: userData } = await supabase.auth.getUser()
      if (!userData?.user) return

      const { data: sessData } = await supabase.auth.getSession()
      const token = sessData?.session?.access_token
      if (!token) return

      const res = await fetch('/api/credits/balance', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json().catch(() => ({}))
      if (typeof data?.balance === 'number') setBalance(data.balance)
    } catch {
      // non-fatal
    } finally {
      fetchingRef.current = false
    }
  }, [])

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) return

    // Fetch on auth-confirmed session. onAuthStateChange fires INITIAL_SESSION
    // immediately after subscribing — the layout's own listener already ran, so
    // by the time this provider mounts the session is always ready.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: unknown, session: { user?: unknown } | null) => {
      if (session?.user) fetchBalance()
    })

    return () => subscription.unsubscribe()
  }, [fetchBalance])

  return <Ctx.Provider value={{ balance, refresh: fetchBalance }}>{children}</Ctx.Provider>
}

export function useCredits() {
  return useContext(Ctx)
}
