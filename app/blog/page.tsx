import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Blog — Contentflow Web',
  description: 'Guides and updates from Contentflow Web.',
}

export default function BlogPage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '60px 32px 100px', color: 'var(--ink)', lineHeight: 1.7 }}>
      <div style={{ marginBottom: 48 }}>
        <Link href="/" style={{ fontSize: 13, color: 'var(--ink-dim)', textDecoration: 'none', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
          ← Back to Contentflow Web
        </Link>
      </div>

      <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 42, lineHeight: 1.1, letterSpacing: '-0.01em', margin: '0 0 24px' }}>
        Blog
      </h1>

      <div style={{
        border: '1px dashed var(--border)', borderRadius: 14, padding: '36px 32px',
        textAlign: 'center', color: 'var(--ink-dim)', fontSize: 14.5,
      }}>
        <p style={{ margin: '0 0 10px', fontSize: 22, fontFamily: 'var(--font-serif)', color: 'var(--ink)' }}>
          First posts are on the way
        </p>
        <p style={{ margin: 0, lineHeight: 1.7 }}>
          Guides on AI UGC ads, product photography without a studio, and building AI influencers.
          Meanwhile, the <Link href="/help" style={{ color: 'var(--ink)', textUnderlineOffset: 3 }}>docs</Link> cover
          everything the platform can do today.
        </p>
      </div>
    </main>
  )
}
