'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { Logo } from '@/components/Logo'

// The ONE header for every public page. It mirrors the nav on the static
// landing (public/lp/index.html), which can't import React: if you change a
// label, link or style here, change `nav.top` in that file too. Both use the
// same links, in the same order, with the same pill look.
//
// Section links use "/#id" so they work from any page; on the landing itself
// the browser just scrolls.
export const MARKETING_NAV: Array<{ label: string; href: string }> = [
  { label: 'How it works', href: '/#how' },
  { label: 'Features', href: '/#features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Free ad teardown', href: '/teardown' },
  { label: 'Docs', href: '/help' },
]

export function MarketingHeader() {
  const pathname = usePathname() ?? '/'
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => { setMenuOpen(false) }, [pathname])

  const isCurrent = (href: string) =>
    !href.includes('#') && (pathname === href || pathname.startsWith(href + '/'))

  return (
    <header className="mh">
      <style>{MH_CSS}</style>
      <nav className="mh-bar" aria-label="Main">
        <Link href="/" className="mh-logo" aria-label="ContentFlow home">
          <Logo size={26} />
          <span>Content<em>flow</em></span>
        </Link>

        <div className="mh-links">
          {MARKETING_NAV.map(item => (
            <Link key={item.href} href={item.href} className={isCurrent(item.href) ? 'on' : undefined}>
              {item.label}
            </Link>
          ))}
        </div>

        <div className="mh-cta">
          <Link href="/auth/login" className="mh-signin">Sign in</Link>
          <Link href="/auth/signup" className="mh-btn">
            Start free
            <span className="mh-arr" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </span>
          </Link>
          <button
            className="mh-burger"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(o => !o)}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="mh-panel">
          {MARKETING_NAV.map(item => (
            <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>{item.label}</Link>
          ))}
          <Link href="/auth/login" onClick={() => setMenuOpen(false)}>Sign in</Link>
          <Link href="/auth/signup" className="mh-panel-cta" onClick={() => setMenuOpen(false)}>Start free</Link>
        </div>
      )}
    </header>
  )
}

// Public pages are always the Quiet Studio palette (the same one /pricing and
// the landing use). The :root block re-points the global theme vars while any
// public header is mounted, so every public page and shared component picks it
// up; it disappears with the header when you move into the app.
const MH_CSS = `
:root,:root[data-theme="dark"]{--bg:#F5F2EC;--surface:#FBFAF7;--border:#E2DCD1;--border-soft:#ECE7DE;--ink:#1A1714;--ink-2:#4A443D;--ink-dim:#4A443D;--ink-mute:#857D72;--ink-fade:#857D72;--on-ink:#fff;color-scheme:light}
html,body{background:#F5F2EC!important}
.mh{position:relative;z-index:50;font-family:"Geist",system-ui,sans-serif;color:#1A1714}
.mh a{text-decoration:none;color:inherit}
.mh-bar{display:flex;align-items:center;justify-content:space-between;gap:16px;max-width:1240px;margin:0 auto;padding:22px 24px}
.mh-logo{display:flex;align-items:center;gap:10px;font-weight:600;font-size:18px;letter-spacing:-.02em;flex-shrink:0}
.mh-logo em{font-family:"Instrument Serif",Georgia,serif;font-style:italic;font-weight:400;font-size:21px;color:#857D72;margin-left:1px}
.mh-links{display:flex;gap:4px;padding:5px;border-radius:999px;background:rgba(26,23,20,.05);border:1px solid #E2DCD1}
.mh-links a{font-size:14px;padding:8px 16px;border-radius:999px;color:#4A443D;white-space:nowrap;transition:background .3s}
.mh-links a:hover{background:rgba(255,255,255,.8)}
.mh-links a.on{background:#fff;color:#1A1714;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.mh-cta{display:flex;align-items:center;gap:14px;flex-shrink:0}
.mh-signin{font-size:14px;color:#4A443D}
.mh .mh-btn{display:inline-flex;align-items:center;gap:10px;height:42px;padding:0 6px 0 18px;border-radius:999px;background:#1A1714;color:#fff;font-size:14px;font-weight:500;white-space:nowrap;transition:transform .4s cubic-bezier(.22,1,.36,1)}
.mh-btn:hover{transform:translateY(-2px)}
.mh-arr{width:30px;height:30px;border-radius:50%;background:#fff;color:#1A1714;display:grid;place-items:center;transition:transform .4s cubic-bezier(.22,1,.36,1)}
.mh-btn:hover .mh-arr{transform:rotate(-45deg)}
.mh-burger{display:none;width:42px;height:42px;border-radius:50%;background:rgba(26,23,20,.05);border:1px solid #E2DCD1;color:#1A1714;cursor:pointer;place-items:center}
.mh-panel{display:flex;flex-direction:column;margin:0 12px;padding:8px;border-radius:20px;background:#FBFAF7;border:1px solid #E2DCD1;box-shadow:0 12px 32px rgba(26,23,20,.12)}
.mh-panel a{padding:14px 16px;font-size:16px;border-radius:12px;color:#1A1714}
.mh-panel a:hover{background:rgba(26,23,20,.05)}
.mh .mh-panel .mh-panel-cta{margin-top:6px;background:#1A1714;color:#fff;text-align:center}
@media (max-width:1080px){
  .mh-links{display:none}
  .mh-signin{display:none}
  .mh-burger{display:grid}
}
@media (max-width:560px){
  .mh-bar{padding:16px}
  .mh .mh-btn{display:none}
}
`
