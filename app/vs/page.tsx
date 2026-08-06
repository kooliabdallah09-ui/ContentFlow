import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'ContentFlow vs Competitors — AI Content Tool Comparisons',
  description: 'See how ContentFlow compares to Higgsfield, Arcads, HeyGen, and Runway. Honest feature-by-feature breakdowns for brands choosing an AI content tool.',
}

const COMPARISONS = [
  {
    slug: 'higgsfield',
    name: 'Higgsfield',
    description: 'Higgsfield is a multi-model video aggregator with 22M users. Great for video generation. No product studio, no written content, no brand persistence.',
    tag: 'Most compared',
  },
  {
    slug: 'arcads',
    name: 'Arcads',
    description: 'Arcads uses motion-capture actors for realistic UGC. Best-in-class realism for talking heads, but shared actor library and video-only.',
    tag: 'UGC specialist',
  },
  {
    slug: 'heygen',
    name: 'HeyGen',
    description: 'HeyGen is polished for presentations and spokesperson videos. Strong translation. No product workflow, no brand content stack.',
    tag: 'Enterprise comms',
  },
  {
    slug: 'runway',
    name: 'Runway',
    description: 'Runway is a creative filmmaker\'s tool with cinematic video quality. Requires creative skill. Not built for product ads or brand marketing.',
    tag: 'Creative / cinematic',
  },
]

export default function VsIndexPage() {
  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '60px 24px 120px', color: 'var(--ink)' }}>
      <div style={{ marginBottom: 40 }}>
        <Link href="/" style={{ fontSize: 13, color: 'var(--ink-dim)', textDecoration: 'none', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
          ← Back to ContentFlow
        </Link>
      </div>

      <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 44, lineHeight: 1.1, letterSpacing: '-0.01em', margin: '0 0 12px' }}>
        Content<em>flow</em> vs the alternatives
      </h1>
      <p style={{ fontSize: 16, color: 'var(--ink-dim)', margin: '0 0 56px', lineHeight: 1.7 }}>
        Honest, feature-by-feature comparisons to help you pick the right tool for your brand.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {COMPARISONS.map(({ slug, name, description, tag }) => (
          <Link key={slug} href={`/vs/${slug}`} style={{ display: 'block', textDecoration: 'none', border: '1px solid var(--border)', borderRadius: 14, padding: '24px 28px', background: 'var(--surface)', transition: 'box-shadow 150ms' }}
            className="vs-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>ContentFlow vs {name}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-dim)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px' }}>{tag}</span>
            </div>
            <p style={{ fontSize: 14, color: 'var(--ink-dim)', margin: '0 0 12px', lineHeight: 1.6 }}>{description}</p>
            <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>Read comparison →</span>
          </Link>
        ))}
      </div>

      <style>{`
        .vs-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.07); }
      `}</style>
    </main>
  )
}
