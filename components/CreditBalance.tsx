'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/auth'
import { Zap } from 'lucide-react'

export default function CreditBalance() {
  const [balance, setBalance] = useState<number | null>(null)
  const [plan, setPlan] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCredits = async () => {
      try {
        const supabase = getSupabase()
        if (!supabase) {
          setLoading(false)
          return
        }

        const { data: sessionData } = await supabase.auth.getSession()
        if (!sessionData.session?.access_token) {
          setLoading(false)
          return
        }

        const response = await fetch('/api/credits/balance', {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setBalance(data.balance)
          setPlan(data.plan)
        } else if (response.status === 404) {
          // Credits not initialized yet, initialize them
          const initResponse = await fetch('/api/credits/init', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${sessionData.session.access_token}`,
            },
            body: JSON.stringify({ plan: 'free' }),
          })

          if (initResponse.ok) {
            const data = await initResponse.json()
            setBalance(data.data.balance)
            setPlan(data.data.plan)
          } else {
            console.error('Failed to initialize credits:', initResponse.status)
          }
        } else {
          console.error('Failed to fetch credits:', response.status)
        }
      } catch (error) {
        console.error('Failed to fetch credits:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCredits()
  }, [])

  return (
    <div className="glass-card rounded-2xl p-4 flex items-center gap-3 border border-white/10">
      {loading ? (
        <div className="animate-pulse h-8 w-32 bg-white/10 rounded"></div>
      ) : balance !== null ? (
        <>
          <div className="bg-purple-500/20 p-2 rounded-lg">
            <Zap className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <div className="text-xs text-white/60 uppercase tracking-wider font-600">Credits</div>
            <div className="text-lg font-black text-white">{balance.toLocaleString()}</div>
            <div className="text-xs text-white/50 capitalize">{plan} plan</div>
          </div>
        </>
      ) : (
        <div className="text-xs text-white/60">Loading credits...</div>
      )}
    </div>
  )
}
