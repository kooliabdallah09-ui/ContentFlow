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

      // 404 = credits not initialized — init them and refetch
      if (res.status === 404) {
        const initRes = await fetch('/api/credits/init', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan: 'free' }),
        })
        if (initRes.ok) {
          const initData = await initRes.json().catch(() => ({}))
          if (typeof initData?.data?.balance === 'number') setBalance(initData.data.balance)
          else setBalance(200)
        } else {
          setBalance(200)
        }
        return
      }

      if (!res.ok) return
      const data = await res.json().catch(() => ({}))
      if (typeof data?.balance === 'number') setBalance(data.balance)
    } catch (err) {
      console.error('[credits] fetch failed:', err)
    } finally {
      fetchingRef.current = false
    }
  }, [])

  useEffect(() => {
    // 1. Immediate fetch on mount — by the time this provider runs, the layout
    //    has already confirmed auth (CreditsProvider is rendered inside showLayout).
    fetchBalance()

    // 2. Re-fetch on auth changes (signin/signout/refresh) as a safety net.
    const supabase = getSupabase()
    if (!supabase) return
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
