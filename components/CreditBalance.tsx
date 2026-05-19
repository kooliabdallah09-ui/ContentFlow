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
        if (!supabase) return

        const { data: sessionData } = await supabase.auth.getSession()
        if (!sessionData.session?.access_token) return

        const response = await fetch('/api/credits/balance', {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setBalance(data.balance)
          setPlan(data.plan)
        }
      } catch (error) {
        console.error('Failed to fetch credits:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCredits()
  }, [])

  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-4 flex items-center gap-3">
        <div className="animate-pulse h-8 w-20 bg-white/10 rounded"></div>
      </div>
    )
  }

  if (balance === null) return null

  return (
    <div className="glass-card rounded-2xl p-4 flex items-center gap-3 border border-white/10">
      <div className="bg-green-400/20 p-2 rounded-lg">
        <Zap className="w-5 h-5 text-green-400" />
      </div>
      <div>
        <div className="text-xs text-white/60 uppercase tracking-wider font-600">Credits</div>
        <div className="text-lg font-black text-white">{balance.toLocaleString()}</div>
        <div className="text-xs text-white/50 capitalize">{plan} plan</div>
      </div>
    </div>
  )
}
