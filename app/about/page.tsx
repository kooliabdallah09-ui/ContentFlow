import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'About ContentFlow — AI Content Studio for Brands',
  description: 'Most AI video tools let you generate one clip. ContentFlow runs your entire brand content stack — UGC ads, product photos, social copy, blog, email — from one brand profile.',
}

export default function AboutPage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '60px 32px 100px', color: 'var(--ink)', lineHeight: 1.7 }}>
      <div style={{ marginBottom: 48 }}>
        <Link href="/" style={{ fontSize: 13, color: 'var(--ink-dim)', textDecoration: 'none', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
          ← Back to ContentFlow
        </Link>
      </div>

      <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 42, lineHeight: 1.1, letterSpacing: '-0.01em', margin: '0 0 24px' }}>
        About Content<em>flow</em>
      </h1>

      <div style={{ fontSize: 15.5, lineHeight: 1.8, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <p>
          Most AI video tools let you generate one clip. You get a video, then you&apos;re back to square one for the caption, the blog post, the product photo, the email. ContentFlow is built around a different idea: one brand profile that feeds everything.
        </p>
        <p>
          Upload your product, build your brand profile once, and ContentFlow generates your full content stack — UGC-style video ads with AI influencers, editorial product photos, social captions, blog posts, and email copy. Same brand voice. Same AI creator. Every format. The whole pipeline in one place.
        </p>
        <p>
          We built this for indie founders, solo e-com sellers, and small DTC brands. People who can&apos;t afford a content team, can&apos;t wait three weeks for a creator to deliver clips, and don&apos;t want to pay agency retainers. ContentFlow compresses what used to cost thousands of dollars per month into a credit-based tool you can use from your phone.
        </p>
        <p>
          The AI influencers you create here are yours — persistent, reusable, tied to your brand identity. The product photos, videos, and written content back up automatically to your own Google Drive. Nothing is locked in. You own everything you make.
        </p>
        <p>
          Questions, ideas, or partnership requests — we read everything:{' '}
          <a href="mailto:contentflow.web@gmail.com" style={{ color: 'var(--ink)', textUnderlineOffset: 3 }}>contentflow.web@gmail.com</a>
        </p>
      </div>

      <div style={{ marginTop: 56, paddingTop: 32, borderTop: '1px solid var(--border)' }}>
        <p style={{ fontSize: 13, color: 'var(--ink-dim)', margin: '0 0 16px' }}>See how we compare</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'vs Higgsfield', href: '/vs/higgsfield' },
            { label: 'vs Arcads', href: '/vs/arcads' },
            { label: 'vs HeyGen', href: '/vs/heygen' },
            { label: 'vs Runway', href: '/vs/runway' },
          ].map(({ label, href }) => (
            <Link key={href} href={href} style={{ fontSize: 13, color: 'var(--ink)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 14px', textDecoration: 'none' }}>
              {label}
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
