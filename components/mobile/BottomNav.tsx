'use client'

// 5-tab bottom nav with a raised center FAB, matching the Claude design.
// Layout: Home · Library · [Create FAB] · Stats · Plan
// The FAB is a raised black square (46×46, rounded, -9px negative margin)
// that opens the Create sheet — from anywhere in the app the primary
// creative action is one thumb tap away.

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { Sheet } from './Sheet'
import { Icon } from '@/components/Icons'
import { CREATE_OPTIONS } from '@/lib/create-options'

interface Tab {
  href: string
  label: string
  icon: keyof typeof Icon
  match: (path: string) => boolean
}

const LEFT_TABS: Tab[] = [
  { href: '/dashboard',  label: 'Home',    icon: 'Dashboard', match: p => p === '/dashboard' || p === '/' },
  { href: '/library',    label: 'Library', icon: 'Library',   match: p => p.startsWith('/library') },
]

const RIGHT_TABS: Tab[] = [
  { href: '/analytics',       label: 'Stats', icon: 'BarChart', match: p => p.startsWith('/analytics') },
  { href: '/settings/billing', label: 'Plan', icon: 'Card',     match: p => p.startsWith('/settings/billing') || p === '/pricing' },
]

// Options in the create sheet: shared with the mobile home screen, priced
// from the generators' own constants (lib/create-options.ts).

export function BottomNav() {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)

  const isActive = (t: Tab) => t.match(pathname)

  return (
    <>
      <nav
        role="navigation"
        aria-label="Primary"
        style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          zIndex: 45,
          height: 'calc(74px + env(safe-area-inset-bottom, 0))',
          paddingBottom: 'env(safe-area-inset-bottom, 0)',
          background: 'var(--surface, rgba(251, 250, 246, 0.96))',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderTop: '1px solid var(--border, var(--m-border))',
          display: 'flex',
          alignItems: 'flex-start',
          padding: '8px 8px 0',
        }}
      >
        {LEFT_TABS.map(t => (
          <TabItem key={t.href} tab={t} active={isActive(t)} />
        ))}

        {/* Center FAB — opens Create sheet */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '6px 0' }}>
          <button
            onClick={() => setSheetOpen(v => !v)}
            data-press
            aria-label="Create"
            style={{
              width: 46, height: 46, borderRadius: 16,
              background: 'var(--m-ink)',
              color: '#fff',
              fontSize: 26, fontWeight: 300, lineHeight: 1,
              display: 'grid', placeItems: 'center',
              marginTop: -9,
              boxShadow: '0 6px 16px rgba(24,23,15,0.28)',
              border: 'none', cursor: 'pointer', padding: 0,
              fontFamily: 'var(--m-sans)',
            }}
          >
            +
          </button>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--m-ink)' }}>
            Create
          </span>
        </div>

        {RIGHT_TABS.map(t => (
          <TabItem key={t.href} tab={t} active={isActive(t)} />
        ))}
      </nav>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Create" height="auto">
        <div style={{ padding: '4px 18px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {CREATE_OPTIONS.map(o => (
            <button
              key={o.href}
              onClick={() => { setSheetOpen(false); router.push(o.href) }}
              data-press
              style={{
                display: 'flex', alignItems: 'center', gap: 13,
                width: '100%', padding: '13px 14px',
                background: 'var(--m-card)',
                border: '1px solid var(--m-border)',
                borderRadius: 14,
                cursor: 'pointer', textAlign: 'left',
                fontFamily: 'var(--m-sans)', color: 'var(--m-ink)',
              }}
            >
              <OptionIcon name={o.icon} tint={o.tint} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{o.label}</div>
                <div style={{ fontSize: 11.5, color: 'var(--m-mute)', marginTop: 1 }}>{o.sub}</div>
              </div>
              <span style={{
                fontFamily: 'var(--m-mono)', fontSize: 11,
                fontWeight: 600, color: '#8A6420',
                background: '#F6EEDA', borderRadius: 99, padding: '4px 9px',
                whiteSpace: 'nowrap',
              }}>
                {o.cost}
              </span>
            </button>
          ))}
        </div>
      </Sheet>
    </>
  )
}

function TabItem({ tab, active }: { tab: Tab; active: boolean }) {
  return (
    <Link
      href={tab.href}
      data-press
      style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 5, padding: '6px 0',
        textDecoration: 'none',
      }}
    >
      <TabIcon name={tab.icon} active={active} />
      <span style={{
        fontSize: 10,
        fontWeight: active ? 700 : 500,
        color: active ? 'var(--m-ink)' : 'var(--m-mute)',
      }}>
        {tab.label}
      </span>
    </Link>
  )
}

function TabIcon({ name, active }: { name: keyof typeof Icon; active: boolean }) {
  const Glyph = Icon[name]
  return (
    <Glyph
      width={22}
      height={22}
      strokeWidth={active ? 2.1 : 1.7}
      style={{ color: active ? 'var(--m-ink)' : 'var(--m-mute)', display: 'block' }}
      aria-hidden
    />
  )
}

export function OptionIcon({ name, tint, size = 34 }: { name: keyof typeof Icon; tint: string; size?: number }) {
  const Glyph = Icon[name]
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.3, background: tint, flexShrink: 0,
      display: 'grid', placeItems: 'center', color: 'var(--m-ink)',
    }}>
      <Glyph width={size * 0.53} height={size * 0.53} aria-hidden />
    </div>
  )
}
