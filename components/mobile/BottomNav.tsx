'use client'

// Instagram/Linear-style 4-tab bottom nav. Sticky to the bottom of the
// viewport, thumb-reachable. Active tab has a filled icon + label. Uses
// env(safe-area-inset-bottom) so it doesn't sit under the iOS home
// indicator.

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Sparkles, Library, User } from 'lucide-react'

interface Tab {
  href: string
  label: string
  icon: typeof Home
  match: (path: string) => boolean
}

const TABS: Tab[] = [
  {
    href: '/dashboard',
    label: 'Home',
    icon: Home,
    match: p => p === '/dashboard' || p === '/',
  },
  {
    href: '/generate/ugc',
    label: 'Generate',
    icon: Sparkles,
    match: p => p.startsWith('/generate') || p.startsWith('/campaigns') || p.startsWith('/influencers') || p.startsWith('/scenes'),
  },
  {
    href: '/library',
    label: 'Library',
    icon: Library,
    match: p => p.startsWith('/library'),
  },
  {
    href: '/settings/account',
    label: 'Me',
    icon: User,
    match: p => p.startsWith('/settings') || p.startsWith('/brand'),
  },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      role="navigation"
      aria-label="Primary"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 90,
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        display: 'grid',
        gridTemplateColumns: `repeat(${TABS.length}, 1fr)`,
        paddingBottom: 'env(safe-area-inset-bottom, 0)',
      }}
    >
      {TABS.map(tab => {
        const active = tab.match(pathname ?? '')
        const Icon = tab.icon
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              padding: '10px 0 8px',
              textDecoration: 'none',
              color: active ? 'var(--ink)' : 'var(--ink-mute)',
              transition: 'color 120ms',
              minHeight: 56,
            }}
          >
            <Icon size={22} strokeWidth={active ? 2.2 : 1.75} />
            <span style={{ fontSize: 10.5, fontWeight: active ? 700 : 500, letterSpacing: 0.2 }}>
              {tab.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
