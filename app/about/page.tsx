import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'About — Contentflow Web',
  description: 'Why Contentflow Web exists: premium AI marketing content at indie prices.',
}

export default function AboutPage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '60px 32px 100px', color: 'var(--ink)', lineHeight: 1.7 }}>
      <div style={{ marginBottom: 48 }}>
        <Link href="/" style={{ fontSize: 13, color: 'var(--ink-dim)', textDecoration: 'none', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
          ← Back to Contentflow Web
        </Link>
      </div>

      <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 42, lineHeight: 1.1, letterSpacing: '-0.01em', margin: '0 0 24px' }}>
        About Content<em>flow</em>
      </h1>

      <div style={{ fontSize: 15.5, lineHeight: 1.8, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <p>
          Great product ads used to require creators, studios, and four-figure budgets per video.
          ContentFlow compresses that entire pipeline into one tool: upload a product photo, and minutes
          later you have a finished UGC-style ad — script, character, voice, captions and b-roll included.
        </p>
        <p>
          We build for indie founders and small brands. That means honest credit pricing instead of
          agency retainers, AI influencers you own and can reuse forever, a Product Studio that shoots
          editorial photos from a handful of phone pictures, and CineMotion ads that look like they cost
          a production crew.
        </p>
        <p>
          Everything you generate is yours. Videos back up automatically to your own Google Drive, and
          you can take them anywhere.
        </p>
        <p>
          Questions, ideas, or partnership requests — we read everything:{' '}
          <a href="mailto:contentflow.web@gmail.com" style={{ color: 'var(--ink)', textUnderlineOffset: 3 }}>contentflow.web@gmail.com</a>
        </p>
      </div>
    </main>
  )
}
