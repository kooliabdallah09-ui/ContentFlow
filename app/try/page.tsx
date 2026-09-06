'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { PreviewGenerator } from '@/components/PreviewGenerator'

export default function TryPage() {
  useEffect(() => {
    if (typeof window !== 'undefined') document.documentElement.setAttribute('data-theme', 'dark')
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #0a0a0a)', color: 'var(--ink, #f2f2f2)', fontFamily: 'var(--font-sans, system-ui)' }}>
      <header style={{ padding: '20px 24px', borderBottom: '1px solid var(--border, #222)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'var(--ink)' }}>
          <Logo size={22} />
          <span style={{ fontSize: 15 }}>Content<em>flow</em></span>
        </Link>
        <Link href="/auth/signup" style={{ padding: '8px 16px', fontSize: 13, background: 'var(--ink)', color: 'var(--bg)', borderRadius: 8, textDecoration: 'none', fontWeight: 500 }}>
          Sign up free
        </Link>
      </header>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 96px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-block', padding: '6px 14px', borderRadius: 999, background: 'rgba(96, 165, 250, 0.12)', color: '#93c5fd', fontSize: 12, marginBottom: 20, letterSpacing: 0.3 }}>
            FREE PREVIEW · NO SIGNUP
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 44, lineHeight: 1.1, fontWeight: 400, margin: '0 0 16px' }}>
            See your product as a <em>UGC ad</em> in 60 seconds.
          </h1>
          <p style={{ fontSize: 16, color: 'var(--ink-dim, #999)', maxWidth: 520, margin: '0 auto', lineHeight: 1.55 }}>
            Paste any Shopify, TikTok Shop, Amazon, or product URL. We&apos;ll animate it into a 5-second UGC-style ad — no signup, no card.
          </p>
        </div>

        <PreviewGenerator />
      </main>
    </div>
  )
}
