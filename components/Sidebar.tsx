'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@/components/Icons'
import Link from 'next/link'
import { useCredits } from '@/lib/CreditsContext'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/auth'
import { canAccessPovStudio, canAccessScheduling } from '@/lib/pov-access'

interface SidebarProps {
  currentPath: string
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export function Sidebar({ currentPath, mobileOpen, onMobileClose }: SidebarProps) {
  const isActive = (path: string) => currentPath === path || currentPath.startsWith(path + '/')
  const handleNavClick = () => onMobileClose?.()
  const router = useRouter()
  const { balance: creditBalance } = useCredits()
  const displayBalance = creditBalance ?? 0

  const creditPercentage = Math.min((displayBalance / 500) * 100, 100)

  const [povAccess, setPovAccess] = useState(false)
  const [schedAccess, setSchedAccess] = useState(false)
  useEffect(() => {
    (async () => {
      const supabase = getSupabase()
      if (!supabase) return
      const { data: sess } = await supabase.auth.getSession()
      const email = sess?.session?.user?.email
      setPovAccess(canAccessPovStudio(email))
      setSchedAccess(canAccessScheduling(email))
    })()
  }, [])

  return (
    <aside className={`rail${mobileOpen ? ' mobile-open' : ''}`}>
      <Link href="/" className="brand">
        <span className="brand-mark"><img src="/logo-icon.png" alt="ContentFlow" /></span>
        <div className="brand-name">Content<em>flow</em></div>
      </Link>

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
          <span style={{ flex: 1 }}>Ask AI</span>
          <span className="kbd">A</span>
        </Link>
        <Link href="/calendar" className={`nav-item ${isActive('/calendar') ? 'active' : ''}`} onClick={handleNavClick}>
          <Icon.Calendar />
          <span style={{ flex: 1 }}>Calendar</span>
          <span className="kbd">C</span>
        </Link>
      </div>

      <div className="rail-section">
        <div className="rail-label">Create</div>
        <Link href="/generate/ugc" className={`nav-item ${isActive('/generate/ugc') ? 'active' : ''}`} onClick={handleNavClick}>
          <Icon.Video />
          <span style={{ flex: 1 }}>UGC Package</span>
          <span className="flagship-badge">Flagship</span>
        </Link>
        <Link href="/generate/pov" className={`nav-item ${isActive('/generate/pov') ? 'active' : ''}`} onClick={handleNavClick}>
          <Icon.Video />
          <span style={{ flex: 1 }}>POV Studio</span>
          <span className={povAccess ? 'flagship-badge' : 'soon-badge'}>{povAccess ? 'New' : 'Soon'}</span>
        </Link>
        <Link href="/generate/image" className={`nav-item ${isActive('/generate/image') ? 'active' : ''}`} onClick={handleNavClick}>
          <Icon.Image />
          <span style={{ flex: 1 }}>Image</span>
        </Link>
        <Link href="/generate/video" className={`nav-item ${isActive('/generate/video') ? 'active' : ''}`} onClick={handleNavClick}>
          <Icon.Video />
          <span style={{ flex: 1 }}>Video</span>
        </Link>
        <Link href="/generate/voice" className={`nav-item ${isActive('/generate/voice') ? 'active' : ''}`} onClick={handleNavClick}>
          <Icon.Voice />
          <span style={{ flex: 1 }}>Voiceover</span>
        </Link>
        <Link href="/generate/screen-demo" className={`nav-item ${isActive('/generate/screen-demo') ? 'active' : ''}`} onClick={handleNavClick}>
          <Icon.Monitor />
          <span style={{ flex: 1 }}>Screen Demo</span>
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
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#b45309', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 4, padding: '1px 5px', lineHeight: 1.6, flexShrink: 0 }}>Beta</span>
        </Link>
      </div>

      <div className="rail-section">
        <div className="rail-label">Publish</div>
        <Link href="/scheduler" className={`nav-item ${isActive('/scheduler') ? 'active' : ''}`} onClick={handleNavClick}>
          <Icon.Calendar />
          <span style={{ flex: 1 }}>Scheduler</span>
          {!schedAccess && <span className="soon-badge">Soon</span>}
        </Link>
        <Link href="/analytics" className={`nav-item ${isActive('/analytics') ? 'active' : ''}`} onClick={handleNavClick}>
          <Icon.TrendUp />
          <span style={{ flex: 1 }}>Analytics</span>
        </Link>
      </div>

      <div className="rail-section">
        <div className="rail-label">Coming soon</div>
        <div className="nav-item nav-soon">
          <Icon.Blog />
          <span style={{ flex: 1 }}>Blog · Email</span>
          <span className="soon-badge">Soon</span>
        </div>
      </div>

      <div className="rail-footer">
        <div className="credits-card">
          <div className="credits-row">
            <div className="credits-num">{displayBalance}</div>
            <div className="credits-label">Credits</div>
          </div>
          <div className="credits-bar"><div style={{ width: `${creditPercentage}%` }} /></div>
          <div className="credits-upgrade">
            <span>Free plan</span>
            <u onClick={() => router.push('/settings/billing')}>Upgrade</u>
          </div>
        </div>
      </div>
    </aside>
  )
}
