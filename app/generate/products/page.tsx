'use client'

// Product Studio — standalone page. Persistent products with multi-angle
// reference sheets and AI-directed aesthetic photoshoots.

import ProductStudio from '@/components/ProductStudio'
import { DriveConnectBanner } from '@/components/DriveConnectBanner'
import { SectionTabs, STUDIOS_TABS } from '@/components/SectionTabs'

export default function ProductStudioPage() {
  return (
    <main style={{ maxWidth: 1080, margin: '0 auto', padding: '42px 40px 90px' }}>
      <SectionTabs tabs={STUDIOS_TABS} />
      <DriveConnectBanner />
      <header style={{ marginBottom: 28 }}>
        <h1 style={{
          fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 54,
          lineHeight: 1.05, letterSpacing: '-0.01em', margin: 0,
        }}>
          Product <em>studio</em>
        </h1>
        <p style={{ fontSize: 15.5, color: 'var(--ink-dim)', margin: '14px 0 0', maxWidth: 560, lineHeight: 1.55 }}>
          Add your product once from every angle — then shoot it in endless aesthetic styles. The AI directs every shot and never repeats a format.
        </p>
      </header>
      <ProductStudio />
    </main>
  )
}
