'use client'

// Shared horizontal tab bar for pages that are grouped under one sidebar
// entry. Used by:
//   - Studios group: Influencers · Products · Scenes
//   - Video Studio group: UGC Package · Video · Screen Demo

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export interface SectionTab {
  label: string
  href: string
  badge?: string
}

export function SectionTabs({ tabs }: { tabs: SectionTab[] }) {
  const pathname = usePathname() ?? ''
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
      {tabs.map(t => {
        const active = pathname === t.href || pathname.startsWith(t.href + '/')
        return (
          <Link
            key={t.href}
            href={t.href}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 16px',
              marginBottom: -1,
              fontSize: 13.5,
              fontWeight: active ? 700 : 500,
              color: active ? 'var(--ink)' : 'var(--ink-2)',
              textDecoration: 'none',
              borderBottom: `2px solid ${active ? 'var(--ink)' : 'transparent'}`,
              transition: 'color 120ms, border-color 120ms',
            }}
          >
            {t.label}
            {t.badge && (
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--ink-2)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 5px', lineHeight: 1 }}>
                {t.badge}
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}

export const STUDIOS_TABS: SectionTab[] = [
  { label: 'Influencers', href: '/influencers', badge: 'Beta' },
  { label: 'Products', href: '/generate/products', badge: 'Beta' },
  { label: 'Scenes', href: '/scenes' },
]

export const VIDEO_STUDIO_TABS: SectionTab[] = [
  { label: 'UGC Package', href: '/generate/ugc', badge: 'Flagship' },
  { label: 'Video', href: '/generate/video' },
  { label: 'Screen Demo', href: '/generate/screen-demo' },
]
