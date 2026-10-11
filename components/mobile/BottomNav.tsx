'use client'

// Press Proof tab bar: Home · Library · [Create] · Plan · You.
// Create is a raised key in the middle that opens a bottom sheet, so the
// primary action is one thumb tap away from anywhere in the app.
// Styles live in globals.css under .mx-*.

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { House, Library, Plus, CalendarDays, User } from 'lucide-react'
import { Sheet } from './Sheet'
import { Icon } from '@/components/Icons'
import { CREATE_OPTIONS } from '@/lib/create-options'

interface Tab {
  href: string
  label: string
  Glyph: typeof House
  match: (path: string) => boolean
}

const LEFT_TABS: Tab[] = [
  { href: '/dashboard', label: 'Home',    Glyph: House,        match: p => p === '/dashboard' || p === '/' },
  { href: '/library',   label: 'Library', Glyph: Library,      match: p => p.startsWith('/library') },
]

const RIGHT_TABS: Tab[] = [
  { href: '/campaigns', label: 'Plan', Glyph: CalendarDays, match: p => p.startsWith('/campaigns') },
  { href: '/you',       label: 'You',  Glyph: User,         match: p => p.startsWith('/you') || p.startsWith('/settings') },
]

export function BottomNav() {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <>
      <nav role="navigation" aria-label="Primary" className="mx-nav">
        {LEFT_TABS.map(t => <TabItem key={t.href} tab={t} active={t.match(pathname)} />)}

        <div className="mx-nav-mid">
          <button onClick={() => setSheetOpen(v => !v)} data-press aria-label="Create" className="mx-fab">
            <Plus size={24} strokeWidth={2.6} aria-hidden />
          </button>
        </div>

        {RIGHT_TABS.map(t => <TabItem key={t.href} tab={t} active={t.match(pathname)} />)}
      </nav>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="What are we making?" height="auto">
        <div className="mx-sheet-list">
          {CREATE_OPTIONS.map(o => (
            <button
              key={o.href}
              onClick={() => { setSheetOpen(false); router.push(o.href) }}
              data-press
              className="mx-row"
            >
              <OptionIcon name={o.icon} tint={o.tint} size={38} />
              <span className="mx-row-text">
                <b>{o.label}</b>
                <small>{o.sub}</small>
              </span>
              <span className="mx-row-cost">{o.cost}</span>
            </button>
          ))}
        </div>
      </Sheet>
    </>
  )
}

function TabItem({ tab, active }: { tab: Tab; active: boolean }) {
  const { Glyph } = tab
  return (
    <Link href={tab.href} data-press className={`mx-tab${active ? ' on' : ''}`} aria-current={active ? 'page' : undefined}>
      <Glyph size={20} strokeWidth={active ? 2.2 : 1.8} aria-hidden />
      <span>{tab.label}</span>
    </Link>
  )
}

export function OptionIcon({ name, tint, size = 34 }: { name: keyof typeof Icon; tint: string; size?: number }) {
  const Glyph = Icon[name]
  return (
    <span className="mx-ico" style={{ width: size, height: size, background: tint }}>
      <Glyph width={size * 0.5} height={size * 0.5} aria-hidden />
    </span>
  )
}
