'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/Icons'
import { getSupabase } from '@/lib/auth'
import { CommandPalette } from '@/components/CommandPalette'
import { NotificationsDropdown } from '@/components/NotificationsDropdown'
import { useCredits } from '@/lib/CreditsContext'

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
  '/settings': 'Settings',
  '/settings/brand': 'Brand',
  '/settings/billing': 'Billing',
  '/settings/account': 'Account',
  '/generate/blog': 'Blog',
  '/generate/social': 'Social',
  '/generate/email': 'Email',
  '/generate/image': 'Image',
  '/generate/voice': 'Voiceover',
  '/generate/video': 'Video',
  '/generate/ugc': 'UGC Package',
  '/analytics': 'Analytics',
  '/ask': 'Chat',
  '/pricing': 'Pricing',
}

export function TopBar({ currentPath, onMenuToggle, isDark, onToggleTheme }: TopBarProps) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [initial, setInitial] = useState('A')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const title = TITLES[currentPath] || 'Dashboard'
  const { balance: creditBalance } = useCredits()
  const displayBalance = creditBalance ?? 0

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) return
    supabase.auth.getUser().then(({ data }: { data: { user: { user_metadata?: { full_name?: string }; email?: string } | null } }) => {
      const name = data.user?.user_metadata?.full_name || data.user?.email
      if (name) setInitial(name.charAt(0).toUpperCase())
    })
  }, [])

  // ⌘K / Ctrl+K opens the palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(o => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const signOut = async () => {
    const supabase = getSupabase()
    if (supabase) {
      await supabase.auth.signOut()
      router.push('/auth/login')
    }
  }

  return (
    <header className="topbar">
      <button className="hamburger" onClick={onMenuToggle} aria-label="Open menu">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
      <div className="crumb crumb-desktop">
        <span>Studio</span>
        <span className="sep">/</span>
        <span className="cur">{title}</span>
      </div>
      <div className="crumb crumb-mobile" style={{ display: 'none' }}>
        <span className="cur" style={{ fontSize: 12.5 }}>{title}</span>
      </div>
      <div style={{ flex: 1 }} />
      <button
        className="search"
        onClick={() => setPaletteOpen(true)}
        style={{ cursor: 'pointer', textAlign: 'left' }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
        <span style={{ flex: 1, color: 'var(--ink-mute)', fontSize: 13 }}>Search…</span>
        <span className="kbd">⌘K</span>
      </button>
      <button
        onClick={() => router.push('/settings/billing')}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: '#F1E6C9', border: '1px solid #E4D2A0',
          borderRadius: 99, padding: '5px 12px 5px 9px',
          cursor: 'pointer', flexShrink: 0,
        }}
      >
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#B8862F', flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: '#6E4E17', whiteSpace: 'nowrap' }}>
          {displayBalance.toLocaleString()} cr
        </span>
      </button>
      <button className="icon-btn" title={isDark ? 'Switch to light' : 'Switch to dark'} onClick={onToggleTheme}>
        {isDark ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.8A8 8 0 1 1 11.2 3a6 6 0 0 0 9.8 9.8z"/>
          </svg>
        )}
      </button>
      <NotificationsDropdown />
      <div style={{ position: 'relative' }}>
        <button
          aria-label="Account"
          onClick={() => setMenuOpen(o => !o)}
          style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'var(--ink)', color: 'var(--on-ink)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 600, border: 0, cursor: 'pointer',
          }}
        >{initial}</button>
        {menuOpen && (
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 8,
            minWidth: 180, background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 13, boxShadow: 'var(--shadow-md)', overflow: 'hidden',
            zIndex: 100,
          }}>
            <button onClick={() => { setMenuOpen(false); router.push('/settings/account') }} style={menuItem}>Account</button>
            <button onClick={() => { setMenuOpen(false); router.push('/settings/billing') }} style={menuItem}>Billing</button>
            <div style={{ height: 1, background: 'var(--border-soft)' }} />
            <button onClick={signOut} style={{ ...menuItem, color: 'var(--danger)' }}>Sign out</button>
          </div>
        )}
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </header>
  )
}

const menuItem: React.CSSProperties = {
  display: 'block', width: '100%', padding: '10px 14px',
  border: 0, background: 'transparent', cursor: 'pointer',
  fontSize: 13, color: 'var(--ink)', textAlign: 'left',
}
