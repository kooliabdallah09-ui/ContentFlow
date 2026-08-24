'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@/components/Icons'
import Link from 'next/link'
import { useCredits } from '@/lib/CreditsContext'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/auth'
import { canAccessInfluencerStudio, canAccessBrandLaunch, canAccessStudio } from '@/lib/pov-access'
import { Logo } from '@/components/Logo'

interface SidebarProps {
  currentPath: string
  mobileOpen?: boolean
  onMobileClose?: () => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}

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
  const [screenshotMode, setScreenshotMode] = useState(false)
  useEffect(() => {
    (async () => {
      const supabase = getSupabase()
      if (!supabase) return
      const { data: sess } = await supabase.auth.getSession()
      const email = sess?.session?.user?.email
      setInfluencerAccess(canAccessInfluencerStudio(email))
      setBrandLaunchAccess(canAccessBrandLaunch(email))
      setStudioAccess(canAccessStudio(email))
    })()
  }, [])

  const toggleScreenshotMode = () => {
    const next = !screenshotMode
    setScreenshotMode(next)
    if (next) document.documentElement.setAttribute('data-screenshot', 'true')
    else document.documentElement.removeAttribute('data-screenshot')
  }

  return (
    <aside className={`rail${mobileOpen ? ' mobile-open' : ''}${collapsed ? ' rail-collapsed' : ''}`}>
      {collapsed ? (
        /* Collapsed: logo + expand button, each centered like nav items */
        <div style={{ width: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0 6px', gap: 4 }}>
          <Link href="/" style={{ width: 56, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="brand-mark" style={{ width: 28, height: 28, flexShrink: 0 }}><Logo size={28} /></span>
          </Link>
          {!mobileOpen && (
            <button
              onClick={onToggleCollapse}
              title="Expand sidebar"
              style={{ width: 32, height: 18, borderRadius: 5, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-dim)', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--ink)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-dim)' }}
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          )}
        </div>
      ) : (
        /* Expanded: logo + name + collapse chevron in one row */
        <div style={{ display: 'flex', alignItems: 'center', padding: '20px 18px 12px', gap: 10 }}>
          <Link href="/" className="brand" style={{ padding: 0, flex: 1 }}>
            <span className="brand-mark"><Logo size={28} /></span>
            <div className="brand-name">Content<em>flow</em></div>
          </Link>
          {!mobileOpen && (
            <button
              onClick={onToggleCollapse}
              title="Collapse sidebar"
              style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-dim)', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--ink)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg)'; e.currentTarget.style.color = 'var(--ink-dim)' }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
          )}
        </div>
      )}

      <div className="rail-section">
        <div className="rail-label">Workspace</div>
        <Link href="/dashboard" className={`nav-item ${isActive('/dashboard') ? 'active' : ''}`} onClick={handleNavClick}>
          <Icon.Dashboard />
          <span style={{ flex: 1 }}>Dashboard</span>
          <span className="kbd">D</span>
        </Link>
        <Link href="/library" className={`nav-item ${isActive('/library') ? 'active' : ''}`} onClick={handleNavClick}>
          <Icon.Library />
          <span style={{ flex: 1 }}>Library</span>
          <span className="kbd">L</span>
        </Link>
        <Link href="/settings/brand" className={`nav-item ${isActive('/settings/brand') ? 'active' : ''}`} onClick={handleNavClick}>
          <Icon.Brand />
          <span style={{ flex: 1 }}>Brand</span>
          <span className="kbd">B</span>
        </Link>
        <Link href="/ask" className={`nav-item ${isActive('/ask') ? 'active' : ''}`} onClick={handleNavClick}>
          <Icon.Ask />
          <span style={{ flex: 1 }}>Chat</span>
          <span className="kbd">A</span>
        </Link>
        <Link href="/analytics" className={`nav-item ${isActive('/analytics') ? 'active' : ''}`} onClick={handleNavClick}>
          <Icon.TrendUp />
          <span style={{ flex: 1 }}>Analytics</span>
        </Link>
      </div>

      <div className="rail-section">
        <div className="rail-label">Create</div>
        {studioAccess && (
          <Link href="/studio" className={`nav-item ${isActive('/studio') ? 'active' : ''}`} onClick={handleNavClick}>
            <Icon.Sparkle />
            <span style={{ flex: 1 }}>Studio</span>
            <span className="admin-beta-label" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#1e3a5f', background: '#dbeafe', border: '1px solid #bfdbfe', borderRadius: 4, padding: '1px 5px', lineHeight: 1.6, flexShrink: 0 }}>Alpha</span>
          </Link>
        )}
        {brandLaunchAccess && (
          <Link href="/brand-launch" className={`nav-item ${isActive('/brand-launch') ? 'active' : ''}`} onClick={handleNavClick}>
            <Icon.Sparkle />
            <span style={{ flex: 1 }}>Brand Launch</span>
            <span className="flagship-badge">New</span>
          </Link>
        )}
        <Link href="/campaigns" className={`nav-item ${isActive('/campaigns') ? 'active' : ''}`} onClick={handleNavClick}>
          <Icon.Calendar />
          <span style={{ flex: 1 }}>Campaigns</span>
          <span className="flagship-badge">New</span>
        </Link>
        {/* Fused Video Studio — 3 tabs at the top of the destination page:
            UGC Package · Video · Screen Demo. Sidebar links to the default
            UGC tab; the tab bar switches between them. Format Library also
            lives inside the UGC tab (inline picker). */}
        <Link
          href="/generate/ugc"
          className={`nav-item ${(isActive('/generate/ugc') || isActive('/generate/video') || isActive('/generate/screen-demo')) ? 'active' : ''}`}
          onClick={handleNavClick}
        >
          <Icon.Video />
          <span style={{ flex: 1 }}>Video Studio</span>
          <span className="flagship-badge">Flagship</span>
        </Link>
        {/* Fused Studios — 3 tabs: Influencers · Products · Scenes.
            Sidebar links to Influencers as default. */}
        {influencerAccess && (
          <Link
            href="/influencers"
            className={`nav-item ${(isActive('/influencers') || isActive('/generate/products') || isActive('/scenes')) ? 'active' : ''}`}
            onClick={handleNavClick}
          >
            <Icon.Package />
            <span style={{ flex: 1 }}>Studios</span>
            <span className="flagship-badge">Beta</span>
          </Link>
        )}
        <Link href="/generate/image" className={`nav-item ${isActive('/generate/image') ? 'active' : ''}`} onClick={handleNavClick}>
          <Icon.Image />
          <span style={{ flex: 1 }}>Image</span>
        </Link>
        <Link href="/generate/voice" className={`nav-item ${isActive('/generate/voice') ? 'active' : ''}`} onClick={handleNavClick}>
          <Icon.Voice />
          <span style={{ flex: 1 }}>Voiceover</span>
        </Link>
        <Link href="/generate/social" className={`nav-item ${isActive('/generate/social') ? 'active' : ''}`} onClick={handleNavClick}>
          <Icon.Social />
          <span style={{ flex: 1 }}>Social</span>
        </Link>
        <Link href="/generate/business-card" className={`nav-item ${isActive('/generate/business-card') ? 'active' : ''}`} onClick={handleNavClick}>
          <Icon.Card />
          <span style={{ flex: 1 }}>Business Card</span>
        </Link>
        <Link href="/editor" className={`nav-item ${isActive('/editor') ? 'active' : ''}`} onClick={handleNavClick}>
          <Icon.Scissors />
          <span style={{ flex: 1 }}>Video Editor</span>
          <span className="admin-beta-label" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#b45309', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 4, padding: '1px 5px', lineHeight: 1.6, flexShrink: 0 }}>Beta</span>
        </Link>
      </div>

      <div className="rail-footer">
        <div className="credits-card-dark" onClick={() => router.push('/settings/billing')} style={{ cursor: 'pointer' }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#B8A97A', marginBottom: 5 }}>Credit balance</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, letterSpacing: '-0.02em', color: '#fff', lineHeight: 1, marginBottom: 8 }}>{displayBalance.toLocaleString()}</div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.14)', borderRadius: 99, marginBottom: 10 }}>
            <div style={{ height: '100%', width: `${creditPercentage}%`, background: '#D8B978', borderRadius: 99 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#B5B29E' }}>
            <span>{planLabel}</span>
            {!isPaidPlan && <span style={{ color: '#fff', fontWeight: 600 }}>Upgrade →</span>}
          </div>
        </div>
        <button
          onClick={() => {
            localStorage.setItem('cf-new-user', '1')
            window.location.reload()
          }}
          style={{ width: '100%', marginTop: 8, padding: '6px 0', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11.5, color: 'var(--ink-mute)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, letterSpacing: '0.01em', transition: 'color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink-dim)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-mute)')}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4"/>
          </svg>
          Restart guide
        </button>
        {studioAccess && (
          <button
            onClick={toggleScreenshotMode}
            title={screenshotMode ? 'Exit screenshot mode' : 'Screenshot mode — hides admin labels'}
            style={{ width: '100%', marginTop: 4, padding: '6px 0', background: screenshotMode ? 'rgba(185,28,28,0.12)' : 'none', border: screenshotMode ? '1px solid rgba(185,28,28,0.3)' : 'none', borderRadius: 8, cursor: 'pointer', fontSize: 11.5, color: screenshotMode ? '#b91c1c' : 'var(--ink-mute)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, letterSpacing: '0.01em', transition: 'all 0.15s' }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
            </svg>
            {screenshotMode ? 'Exit screenshot mode' : 'Screenshot mode'}
          </button>
        )}
      </div>
    </aside>
  )
}
