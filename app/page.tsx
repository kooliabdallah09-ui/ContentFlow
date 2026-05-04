'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/auth'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = getSupabase()
      if (!supabase) {
        router.push('/landing')
        return
      }

      const { data } = await supabase.auth.getUser()
      if (data.user) {
        router.push('/dashboard')
      } else {
        router.push('/landing')
      }
    }

    checkAuth()
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">ContentFlow</h1>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  )
}
