'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Sun, Moon, Menu, X } from 'lucide-react'
import { Logo } from '@/components/Logo'

// One header for every public / marketing page. Before this, the landing had
// a full header, /pricing had a near-duplicate with different styling, and
// /about /contact /blog /help had only a "← Back" link — so moving between
// them felt like leaving the site. Anything public should render this.

// "Home" rather than "Features": jumping a visitor from /pricing into the
// middle of the landing page was disorienting. The ad teardown is its own
// page — it's the top-of-funnel entry point, not a landing section.
const NAV: Array<{ label: string; href: string; accent?: boolean }> = [
  { label: 'Home', href: '/' },
  { label: 'Free ad teardown', href: '/teardown', accent: true },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Docs', href: '/help' },
]

export function MarketingHeader() {
  const pathname = usePathname() ?? '/'
  const [isDark, setIsDark] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('cf-theme') : null
    const shouldDark = saved === 'dark'
    setIsDark(shouldDark)
    if (shouldDark) document.documentElement.setAttribute('data-theme', 'dark')
    else document.documentElement.removeAttribute('data-theme')
  }, [])

  useEffect(() => { setMenuOpen(false) }, [pathname])

  const toggleTheme = () => {
    const next = !isDark
    setIsDark(next)
    if (next) {
      document.documentElement.setAttribute('data-theme', 'dark')
      localStorage.setItem('cf-theme', 'dark')
    } else {
      document.documentElement.removeAttribute('data-theme')
      localStorage.setItem('cf-theme', 'light')
    }
  }

  const onLanding = pathname === '/' || pathname === '/landing'

  // Clicking "Home" while already on the landing should ride back to the top
  // instead of being a dead link.
  const handleNav = (href: string) => (e: React.MouseEvent) => {
    if (href === '/' && onLanding) {
      e.preventDefault()
      window.scrollTo({ top: 0, behavior: 'smooth' })
      setMenuOpen(false)
    }
  }

  const isCurrent = (href: string) =>
    href === '/'
      ? onLanding
      : pathname === href || pathname.startsWith(href + '/')

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      background: 'color-mix(in srgb, var(--bg) 82%, transparent)',
      borderBottom: '1px solid var(--border)',
      padding: '14px 20px',
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ink)', textDecoration: 'none', flexShrink: 0 }}>
          <span className="brand-mark" style={{ width: 44, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Logo size={44} />
          </span>
          <span className="brand-name" style={{ fontSize: 15, color: 'var(--ink)' }}>Content<em>flow</em></span>
        </Link>

        <nav className="ls-nav" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleNav(item.href)}
              style={{
                padding: '9px 14px', fontSize: 14, textDecoration: 'none', borderRadius: 8,
                fontWeight: isCurrent(item.href) ? 600 : 500,
                color: item.accent ? '#b91c1c' : isCurrent(item.href) ? 'var(--ink)' : 'var(--ink-mute)',
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ls-actions" style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <button
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              width: 36, height: 36, borderRadius: 9, background: 'transparent',
              border: '1px solid var(--border)', color: 'var(--ink)', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <Link href="/auth/login" className="ls-signin" style={{
            padding: '9px 18px', borderRadius: 9, background: 'var(--surface)',
            color: 'var(--ink)', fontSize: 14, fontWeight: 600,
            border: '1px solid var(--border)', whiteSpace: 'nowrap', textDecoration: 'none',
          }}>Sign in</Link>
          <Link href="/auth/signup" style={{
            padding: '9px 18px', borderRadius: 9, background: '#b91c1c', color: '#fff',
            fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', textDecoration: 'none',
          }}>Get started</Link>
        </div>

        <button
          className="ls-burger"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(o => !o)}
          style={{
            display: 'none', width: 40, height: 40, borderRadius: 10,
            background: 'transparent', border: '1px solid var(--border)',
            color: 'var(--ink)', cursor: 'pointer',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          {menuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {menuOpen && (
        <div className="ls-mobile-panel" style={{
          display: 'none', padding: '10px 20px 20px',
          borderTop: '1px solid var(--border)', flexDirection: 'column', gap: 4,
          background: 'var(--bg)',
        }}>
          {NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={e => { handleNav(item.href)(e); setMenuOpen(false) }}
              style={{
                display: 'block', padding: '13px 4px', fontSize: 16, fontWeight: 600,
                textDecoration: 'none', borderBottom: '1px solid var(--border-soft)',
                color: item.accent ? '#b91c1c' : 'var(--ink)',
              }}
            >
              {item.label}
            </Link>
          ))}
          <Link href="/auth/login" onClick={() => setMenuOpen(false)} style={{
            display: 'block', padding: '13px 4px', fontSize: 16, color: 'var(--ink)',
            fontWeight: 600, textDecoration: 'none', borderBottom: '1px solid var(--border-soft)',
          }}>Sign in</Link>
          <div className="ls-mobile-actions" style={{
            display: 'none', marginTop: 10, paddingTop: 14,
            borderTop: '1px solid var(--border-soft)', gap: 10,
          }}>
            <button
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{
                flex: '0 0 auto', width: 44, height: 44, borderRadius: 10,
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--ink)', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <Link href="/auth/signup" onClick={() => setMenuOpen(false)} style={{
              flex: 1, textAlign: 'center', padding: '12px 16px', borderRadius: 10,
              background: 'var(--ink)', color: 'var(--on-ink)',
              fontSize: 14.5, fontWeight: 600, whiteSpace: 'nowrap', textDecoration: 'none',
            }}>Get started</Link>
          </div>
        </div>
      )}
    </header>
  )
}
