'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import BrandLaunchWizard from '@/components/BrandLaunchWizard'
import { getSupabase } from '@/lib/auth'

function WizardLoader() {
  const params = useSearchParams()
  const router = useRouter()
  const brandId = params.get('id')

  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!brandId) {
      router.replace('/brand-launch')
      return
    }
    const supa = getSupabase()
    if (!supa) return
    supa.auth.getSession().then((result: { data: { session: unknown } }) => {
      if (!result.data.session) router.replace('/auth/login')
      else setReady(true)
    })
  }, [brandId, router])

  if (!ready || !brandId) return null

  return <BrandLaunchWizard brandId={brandId} />
}

export default function BrandLaunchNewPage() {
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '28px 20px 80px' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-serif)', letterSpacing: '-0.03em' }}>
          Launch <em>your brand.</em>
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-dim)' }}>
          Answer a few questions. AI does the rest.
        </p>
      </div>

      <Suspense fallback={null}>
        <WizardLoader />
      </Suspense>
    </div>
  )
}
