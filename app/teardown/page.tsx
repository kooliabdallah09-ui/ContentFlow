'use client'

import { AdTeardown } from '@/components/AdTeardown'
import { MarketingHeader } from '@/components/MarketingHeader'
import { MarketingFooter } from '@/components/MarketingFooter'

// Public, shareable Ad Teardown — the top-of-funnel entry point. Carries the
// marketing chrome (never the app sidebar) so it reads as a free tool anyone
// can land on from search or a share. The in-app version for signed-in users
// lives at /generate/teardown and renders inside the app shell instead.
export default function TeardownPage() {
  return (
    <>
      <MarketingHeader />
      <AdTeardown signupNext="/generate/teardown" />
      <MarketingFooter />
    </>
  )
}
