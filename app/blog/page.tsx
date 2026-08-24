import type { Metadata } from 'next'
import Link from 'next/link'
import { POSTS } from './posts'

export const metadata: Metadata = {
  title: 'Blog — ContentFlow',
  description: 'Guides on AI UGC ads, product photography without a studio, and building AI influencers.',
}

export default function BlogPage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '60px 32px 100px', color: 'var(--ink)', lineHeight: 1.7 }}>
      <div style={{ marginBottom: 48 }}>
        <Link href="/" style={{ fontSize: 13, color: 'var(--ink-dim)', textDecoration: 'none', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
          ← Back to ContentFlow
        </Link>
      </div>

      <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 42, lineHeight: 1.1, letterSpacing: '-0.01em', margin: '0 0 12px' }}>
        Blog
      </h1>
      <p style={{ margin: '0 0 44px', color: 'var(--ink-dim)', fontSize: 15.5 }}>
        Field notes on AI UGC, product content, and the actual mechanics of what ships.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {POSTS.map(post => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            style={{
              display: 'block',
              padding: '28px 0',
              borderTop: '1px solid var(--border)',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--ink-dim)', letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', marginBottom: 10 }}>
              <span>{post.category}</span>
              <span>·</span>
              <span>{formatDate(post.publishedAt)}</span>
              <span>·</span>
              <span>{post.readingMinutes} min</span>
            </div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 26, lineHeight: 1.2, letterSpacing: '-0.01em', margin: '0 0 10px' }}>
              {post.title}
            </h2>
            <p style={{ margin: 0, color: 'var(--ink-dim)', fontSize: 15, lineHeight: 1.6 }}>
              {post.excerpt}
            </p>
          </Link>
        ))}
      </div>
    </main>
  )
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}
