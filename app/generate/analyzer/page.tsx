'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// The Reel Analyzer became the Ad Teardown tool: /generate/teardown in-app,
// /teardown as the public version.
// Kept as a redirect so existing links and bookmarks still land somewhere.
export default function AnalyzerRedirectPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/generate/teardown') }, [router])
  return null
}
