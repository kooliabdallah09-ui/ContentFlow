'use client'

import Link from 'next/link'
import { Logo } from '@/components/Logo'

// Shared footer for every public / marketing page — pairs with
// MarketingHeader so the chrome is identical wherever you land.

const COLUMNS: Array<{ heading: string; links: Array<{ label: string; href: string }> }> = [
  {
    heading: 'Product',
    links: [
      { label: 'Features', href: '/#features' },
      { label: 'Free ad teardown', href: '/teardown' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Docs', href: '/help' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Blog', href: '/blog' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    heading: 'Compare',
    links: [
      { label: 'vs Higgsfield', href: '/vs/higgsfield' },
      { label: 'vs Arcads', href: '/vs/arcads' },
      { label: 'vs HeyGen', href: '/vs/heygen' },
      { label: 'vs Runway', href: '/vs/runway' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      { label: 'Refund policy', href: '/refunds' },
      { label: 'Cookies', href: '/cookies' },
    ],
  },
]

export function MarketingFooter() {
  return (
    <footer style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)', padding: '60px 20px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div className="ls-foot-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 40, marginBottom: 48 }}>
          <div>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, textDecoration: 'none', color: 'var(--ink)' }}>
              <span className="brand-mark" style={{ width: 44, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <Logo size={44} />
              </span>
              <span className="brand-name" style={{ fontSize: 15 }}>Content<em>flow</em></span>
            </Link>
            <p style={{ fontSize: 13, color: 'var(--ink-mute)', margin: 0, lineHeight: 1.6 }}>
              Your brand&apos;s entire content team, in one app.
            </p>
          </div>
          {COLUMNS.map(col => (
            <div key={col.heading}>
              <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 12 }}>{col.heading}</div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {col.links.map(l => (
                  <li key={l.href}>
                    <Link href={l.href} style={{ fontSize: 13, color: 'var(--ink-mute)', textDecoration: 'none' }}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div style={{ paddingTop: 32, borderTop: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--ink-fade)' }}>© 2026 ContentFlow. All rights reserved.</div>
          <a href="https://www.instagram.com/contentflow.app/" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--ink-mute)', textDecoration: 'none' }}>
            Instagram
          </a>
        </div>
      </div>
    </footer>
  )
}
