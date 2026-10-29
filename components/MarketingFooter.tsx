'use client'

import Link from 'next/link'
import { Logo } from '@/components/Logo'

// Shared footer for every public page — pairs with MarketingHeader so the
// chrome is identical wherever you land. The static landing
// (public/lp/index.html) has its own copy of this slim layout.

const LINKS: Array<{ label: string; href: string }> = [
  { label: 'Free ad teardown', href: '/teardown' },
  { label: 'Docs', href: '/help' },
  { label: 'About', href: '/about' },
  { label: 'Blog', href: '/blog' },
  { label: 'Contact', href: '/contact' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
  { label: 'Refund policy', href: '/refunds' },
  { label: 'Cookies', href: '/cookies' },
]

export function MarketingFooter() {
  return (
    <footer className="mf">
      <style>{MF_CSS}</style>
      <div className="mf-in">
        <Link href="/" className="mf-logo" aria-label="ContentFlow home">
          <Logo size={22} />
          <span>Content<em>flow</em></span>
        </Link>
        <nav aria-label="Footer">
          {LINKS.map(l => <Link key={l.href} href={l.href}>{l.label}</Link>)}
        </nav>
        <span>© 2026 ContentFlow</span>
      </div>
    </footer>
  )
}

const MF_CSS = `
.mf{font-family:"Geist",system-ui,sans-serif;color:#857D72;font-size:14px}
.mf a{text-decoration:none;color:inherit}
.mf-in{display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;max-width:1240px;margin:0 auto;padding:28px 24px 40px}
.mf-logo{display:flex;align-items:center;gap:10px;font-weight:600;font-size:16px;letter-spacing:-.02em;color:#1A1714!important}
.mf-logo em{font-family:"Instrument Serif",Georgia,serif;font-style:italic;font-weight:400;font-size:19px;color:#857D72;margin-left:1px}
.mf nav{display:flex;gap:8px 22px;flex-wrap:wrap}
.mf nav a:hover{color:#1A1714}
`
