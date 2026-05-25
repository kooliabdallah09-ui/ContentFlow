'use client'

import { Icon } from '@/components/Icons'

interface TopBarProps {
  currentPath: string
  onMenuToggle: () => void
  isDark: boolean
  onToggleTheme: () => void
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

export function TopBar({ currentPath, onMenuToggle, isDark, onToggleTheme }: TopBarProps) {
  const title = TITLES[currentPath] || 'Dashboard'

  return (
    <header className="topbar">
      <button className="hamburger" onClick={onMenuToggle} aria-label="Menu">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect y="3" width="18" height="2" rx="1" fill="currentColor" />
          <rect y="8" width="18" height="2" rx="1" fill="currentColor" />
          <rect y="13" width="18" height="2" rx="1" fill="currentColor" />
        </svg>
      </button>
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
      <button className="icon-btn" title={isDark ? 'Light mode' : 'Dark mode'} onClick={onToggleTheme}>
        {isDark ? <Icon.Sun /> : <Icon.Moon />}
      </button>
      <button className="icon-btn" title="Notifications">
        <Icon.Bell />
      </button>
    </header>
  )
}
