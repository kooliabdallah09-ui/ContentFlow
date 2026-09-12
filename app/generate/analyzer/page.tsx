'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// The Reel Analyzer moved to /teardown and became a public free tool.
// Kept as a redirect so existing links and bookmarks still land somewhere.
export default function AnalyzerRedirectPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/teardown') }, [router])
  return null
}
