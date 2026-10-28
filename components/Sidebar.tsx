'use client'

import { Fragment, useEffect, useState } from 'react'
import { Icon } from '@/components/Icons'
import Link from 'next/link'
import { useCredits } from '@/lib/CreditsContext'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/auth'
import { canAccessInfluencerStudio, canAccessBrandLaunch, canAccessStudio, canAccessBusinessCard, canAccessMotionAds } from '@/lib/pov-access'
import { Logo } from '@/components/Logo'

interface SidebarProps {
  currentPath: string
  mobileOpen?: boolean
  onMobileClose?: () => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}

// Small inline icons for the few nav items the shared icon set doesn't cover.
const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
)
const ImageIconSmall = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 15l5-5 4 4 3-3 6 6"/></svg>
)
const PaletteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="11.5" r="1.5"/><circle cx="7.5" cy="10.5" r="1.5"/><path d="M12 22a10 10 0 1 1 10-10c0 2.2-1.6 3.5-3.5 3.5H16a2 2 0 0 0-1.4 3.4A2 2 0 0 1 12 22z"/></svg>
)
const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
)
const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
)

export function Sidebar({ currentPath, mobileOpen, onMobileClose, collapsed, onToggleCollapse }: SidebarProps) {
  const isActive = (path: string) => currentPath === path || currentPath.startsWith(path + '/')
  const handleNavClick = () => onMobileClose?.()
  const router = useRouter()
  const { balance: creditBalance, plan: creditPlan } = useCredits()
  const displayBalance = creditBalance ?? 0
  const planLabel = creditPlan ? creditPlan.charAt(0).toUpperCase() + creditPlan.slice(1) + ' plan' : 'Free plan'
  const isPaidPlan = creditPlan && creditPlan !== 'free'
  const creditPercentage = Math.min((displayBalance / 500) * 100, 100)

  const [influencerAccess, setInfluencerAccess] = useState(false)
  const [brandLaunchAccess, setBrandLaunchAccess] = useState(false)
  const [studioAccess, setStudioAccess] = useState(false)
  const [businessCardAccess, setBusinessCardAccess] = useState(false)
  const [motionAdsAccess, setMotionAdsAccess] = useState(false)
  const [screenshotMode, setScreenshotMode] = useState(false)
  const [userName, setUserName] = useState('')
  const [toolsOpen, setToolsOpen] = useState(() => {
    try { return typeof window !== 'undefined' && localStorage.getItem('cf-sidebar-tools') === '1' } catch { return false }
  })

  useEffect(() => {
    (async () => {
      const supabase = getSupabase()
      if (!supabase) return
      const { data: sess } = await supabase.auth.getSession()
      const user = sess?.session?.user
      const email = user?.email
      const full = (user?.user_metadata as { full_name?: string } | undefined)?.full_name
      setUserName(full || email?.split('@')[0] || '')
      setInfluencerAccess(canAccessInfluencerStudio(email))
      setBrandLaunchAccess(canAccessBrandLaunch(email))
      setStudioAccess(canAccessStudio(email))
      setBusinessCardAccess(canAccessBusinessCard(email))
      setMotionAdsAccess(canAccessMotionAds(email))
    })()
  }, [])

  // The "More tools" section remembers whether it was open (see the initial state above).
  const toggleTools = () => {
    setToolsOpen(o => {
      const next = !o
      try { localStorage.setItem('cf-sidebar-tools', next ? '1' : '0') } catch { /* private mode */ }
      return next
    })
  }

  // N opens a new ad from anywhere (not while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.key.toLowerCase() !== 'n') return
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
      e.preventDefault()
      router.push('/generate/ugc')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router])

  const toggleScreenshotMode = () => {
    const next = !screenshotMode
    setScreenshotMode(next)
    if (next) document.documentElement.setAttribute('data-screenshot', 'true')
    else document.documentElement.removeAttribute('data-screenshot')
  }

  const toolItems: { href: string; label: string; icon: React.ReactNode; show: boolean; match?: string[] }[] = [
    { href: '/generate/ugc', label: 'Video studio', icon: <Icon.Video />, show: true, match: ['/generate/ugc', '/generate/video', '/generate/screen-demo'] },
    { href: '/generate/image', label: 'Image', icon: <Icon.Image />, show: true },
    { href: '/generate/voice', label: 'Voiceover', icon: <Icon.Voice />, show: true },
    { href: '/generate/social', label: 'Captions & social', icon: <Icon.Social />, show: true },
    { href: '/editor', label: 'Video editor', icon: <Icon.Scissors />, show: true },
    { href: '/generate/motion', label: 'Motion ads', icon: <Icon.Sparkle />, show: motionAdsAccess },
    { href: '/ask', label: 'Chat', icon: <Icon.Ask />, show: true },
    { href: '/studio', label: 'Studio', icon: <Icon.Sparkle />, show: studioAccess },
    { href: '/brand-launch', label: 'Brand launch', icon: <Icon.Sparkle />, show: brandLaunchAccess },
    { href: '/generate/business-card', label: 'Business card', icon: <Icon.Card />, show: businessCardAccess },
  ]
  const toolActive = (t: { href: string; match?: string[] }) => (t.match ?? [t.href]).some(isActive)
  const anyToolActive = toolItems.some(t => t.show && toolActive(t))
  const showTools = collapsed || toolsOpen || anyToolActive

  const link = (href: string, label: string, icon: React.ReactNode, active: boolean) => (
    <Link href={href} className={`nav-item ${active ? 'active' : ''}`} onClick={handleNavClick} title={collapsed ? label : undefined}>
      {icon}
      <span style={{ flex: 1 }}>{label}</span>
    </Link>
  )

  return (
    <aside className={`rail${mobileOpen ? ' mobile-open' : ''}${collapsed ? ' rail-collapsed' : ''}`}>
      {collapsed ? (
        <div style={{ width: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0 6px', gap: 4 }}>
          <Link href="/" style={{ width: 56, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="brand-mark" style={{ width: 28, height: 28, flexShrink: 0 }}><Logo size={28} /></span>
          </Link>
          {!mobileOpen && (
            <button
              onClick={onToggleCollapse}
              title="Expand sidebar"
              style={{ width: 32, height: 18, borderRadius: 5, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-dim)' }}
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 14px 12px', gap: 10 }}>
          <Link href="/" className="brand" style={{ padding: 0, flex: 1, gap: 9 }}>
            <span className="brand-mark" style={{ width: 26, height: 26 }}><Logo size={26} /></span>
            <div className="brand-name">Content<em>flow</em></div>
          </Link>
          {!mobileOpen && (
            <button
              onClick={onToggleCollapse}
              title="Collapse sidebar"
              style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-dim)' }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
          )}
        </div>
      )}

      <div className="rail-section" style={{ paddingTop: 2 }}>
        <Link href="/generate/ugc" className="new-ad" onClick={handleNavClick} title="New ad (N)">
          <PlusIcon />
          <span style={{ flex: 1 }}>New ad</span>
          <span className="kbd">N</span>
        </Link>
      </div>

      <nav className="rail-section" style={{ marginTop: 10 }}>
        {link('/dashboard', 'Home', <Icon.Dashboard />, isActive('/dashboard'))}
        {link('/library', 'Library', <Icon.Library />, isActive('/library'))}
        {link('/campaigns', 'Campaigns', <Icon.Calendar />, isActive('/campaigns'))}
        {link('/generate/hooks', 'Hook batch', <Icon.Grid />, isActive('/generate/hooks'))}
      </nav>

      <div className="rail-section">
        <div className="rail-label">Assets</div>
        {influencerAccess && link('/influencers', 'Creators', <UserIcon />, isActive('/influencers'))}
        {influencerAccess && link('/generate/products', 'Products', <Icon.Package />, isActive('/generate/products'))}
        {influencerAccess && link('/scenes', 'Scenes', <ImageIconSmall />, isActive('/scenes'))}
        {link('/settings/brand', 'Brand kit', <PaletteIcon />, isActive('/settings/brand'))}
      </div>

      <div className="rail-section">
        <div className="rail-label">Research</div>
        {link('/generate/teardown', 'Ad teardown', <Icon.Search />, isActive('/generate/teardown'))}
        {link('/watchlist', 'Watchlist', <EyeIcon />, isActive('/watchlist'))}
        {link('/analytics', 'Analytics', <Icon.TrendUp />, isActive('/analytics'))}
      </div>

      <div className="rail-section">
        <button type="button" className="rail-label rail-toggle" onClick={toggleTools} aria-expanded={showTools}>
          <span>More tools</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showTools ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        {showTools && toolItems.filter(t => t.show).map(t => (
          <Fragment key={t.href}>{link(t.href, t.label, t.icon, toolActive(t))}</Fragment>
        ))}
      </div>

      <div className="rail-footer">
        <div className="rail-credits" onClick={() => router.push('/settings/billing')} role="link" tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter') router.push('/settings/billing') }}>
          <div className="rail-credits-row"><span>Credits</span><b>{displayBalance.toLocaleString()}</b></div>
          <div className="rail-meter"><i style={{ width: `${creditPercentage}%` }} /></div>
          <div className="rail-credits-row">
            <span>{planLabel}</span>
            {!isPaidPlan && <span className="rail-upgrade">Upgrade</span>}
          </div>
        </div>
        <Link href="/settings/account" className="rail-user" onClick={handleNavClick}>
          <span className="rail-avatar">{(userName || 'A').charAt(0).toUpperCase()}</span>
          <span className="rail-user-name">{userName ? userName.charAt(0).toUpperCase() + userName.slice(1) : 'Account'}</span>
        </Link>
        {studioAccess && (
          <button
            onClick={toggleScreenshotMode}
            title={screenshotMode ? 'Exit screenshot mode' : 'Screenshot mode: hides admin labels'}
            className="rail-ghost"
            style={screenshotMode ? { color: 'var(--danger)' } : undefined}
          >
            {screenshotMode ? 'Exit screenshot mode' : 'Screenshot mode'}
          </button>
        )}
        <button
          onClick={() => { localStorage.setItem('cf-new-user', '1'); window.location.reload() }}
          className="rail-ghost"
        >
          Restart guide
        </button>
      </div>
    </aside>
  )
}
