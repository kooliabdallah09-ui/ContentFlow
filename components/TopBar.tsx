'use client'

import { Icon } from '@/components/Icons'

interface TopBarProps {
  currentPath: string
}

const TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/calendar': 'Calendar',
  '/library': 'Library',
  '/settings/brand': 'Brand Profile',
  '/generate/blog': 'Create / Blog',
  '/generate/social': 'Create / Social',
  '/generate/email': 'Create / Email',
  '/generate/image': 'Create / Image',
  '/generate/voice': 'Create / Voiceover',
  '/generate/video': 'Create / Video',
  '/scheduler': 'Insights / Scheduler',
  '/analytics': 'Insights / Analytics',
}

export function TopBar({ currentPath }: TopBarProps) {
  const title = TITLES[currentPath] || 'Dashboard'

  return (
    <header className="topbar">
      <div className="crumb">
        <span>Studio</span>
        <span className="sep">/</span>
        <span className="cur">{title}</span>
      </div>
      <div className="search">
        <Icon.Search style={{ width: 14, height: 14 }} />
        <input placeholder="Search posts, calendar, library…" />
        <span className="kbd">⌘K</span>
      </div>
      <button className="icon-btn" title="Notifications">
        <Icon.Bell />
      </button>
    </header>
  )
}
