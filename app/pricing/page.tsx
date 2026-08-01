'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PricingPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/settings/billing') }, [router])
  return null
}
