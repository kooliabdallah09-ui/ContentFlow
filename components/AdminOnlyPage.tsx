'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/auth'
import { isAdminEmail } from '@/lib/pov-access'

// Client-side gate for surfaces we've pulled from the public product but keep
// available to admins (business cards, blog/email writers, screen demo).
// Non-admins are redirected to the dashboard; admins see the wrapped page.
export function AdminOnlyPage({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [status, setStatus] = useState<'checking' | 'allowed'>('checking')

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) { router.replace('/dashboard'); return }
    supabase.auth.getSession().then(({ data }: { data: { session: { user?: { email?: string | null } | null } | null } }) => {
      const email = data?.session?.user?.email
      if (isAdminEmail(email)) setStatus('allowed')
      else router.replace('/dashboard')
    })
  }, [router])

  if (status !== 'allowed') return null
  return <>{children}</>
}
