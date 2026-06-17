'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@/components/Icons'
import Link from 'next/link'
import { getSupabase } from '@/lib/auth'
import { useRouter } from 'next/navigation'

interface SidebarProps {
  currentPath: string
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export function Sidebar({ currentPath, mobileOpen, onMobileClose }: SidebarProps) {
  const isActive = (path: string) => currentPath === path || currentPath.startsWith(path + '/')
  const handleNavClick = () => onMobileClose?.()
  const [creditBalance, setCreditBalance] = useState(0)
  const [userName, setUserName] = useState('Creator')
  const [userEmail, setUserEmail] = useState('')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const router = useRouter()

  useEffect(() => {
    loadUserData()
  }, [])

  const loadUserData = async () => {
    try {
      const supabase = getSupabase()
      if (!supabase) {
        console.log('Supabase not available')
        return
      }

      const { data: userData } = await supabase.auth.getUser()
      if (userData.user) {
        setUserName(userData.user.user_metadata?.full_name || userData.user.email?.split('@')[0] || 'Creator')
        setUserEmail(userData.user.email || '')

        // Fetch credit balance
        const { data: sessionData } = await supabase.auth.getSession()
        if (sessionData?.session?.access_token) {
          try {
            let response = await fetch('/api/credits/balance', {
              headers: {
                Authorization: `Bearer ${sessionData.session.access_token}`,
              },
            })

            // If credits not initialized (404), initialize them
            if (response.status === 404) {
              console.log('Credits not initialized, initializing...')
              const initResponse = await fetch('/api/credits/init', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${sessionData.session.access_token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ plan: 'free' }),
              })

              console.log('Init response status:', initResponse.status)

              if (!initResponse.ok) {
                const initErrorText = await initResponse.text()
                console.error('Init failed:', initResponse.status, initErrorText)
                // Set default credits if init failed
                setCreditBalance(200)
              } else {
                const initData = await initResponse.json()
                console.log('Credits initialized successfully:', initData)
                setCreditBalance(initData.data?.balance || 200)
              }
            } else if (response.ok) {
              const data = await response.json()
              console.log('Credits fetched:', data.balance)
              setCreditBalance(data.balance || 0)
            } else {
              console.error('Failed to fetch credits:', response.status)
              // Set default balance on error
              setCreditBalance(200)
            }
          } catch (fetchError) {
            console.error('Error fetching credits:', fetchError)
            // Set default balance on error
            setCreditBalance(200)
          }
        } else {
          console.log('No access token available')
          setCreditBalance(200)
        }
      } else {
        console.log('No user found')
      }
    } catch (error) {
      console.error('Failed to load user data:', error)
    }
  }

  const handleLogout = async () => {
    try {
      const supabase = getSupabase()
      if (supabase) {
        await supabase.auth.signOut()
        router.push('/auth/login')
      }
    } catch (error) {
      console.error('Failed to logout:', error)
    }
  }

  const creditPercentage = Math.min((creditBalance / 500) * 100, 100)

  return (
    <aside className={`rail${mobileOpen ? ' mobile-open' : ''}`}>
      <Link href="/" className="brand">
        <img src="/logo-icon.png" alt="" style={{ width: '34px', height: '34px', borderRadius: '6px' }} />
        <div className="brand-name">Content<em>flow</em></div>
      </Link>

      <div className="rail-section">
        <div className="rail-label">Workspace</div>
        <Link href="/dashboard" className={`nav-item ${isActive('/dashboard') ? 'active' : ''}`} onClick={handleNavClick}>
          <Icon.Dashboard />
          <span>Dashboard</span>
          <span className="kbd">D</span>
        </Link>
        <Link href="/library" className={`nav-item ${isActive('/library') ? 'active' : ''}`} onClick={handleNavClick}>
          <Icon.Library />
          <span>Library</span>
          <span className="kbd">L</span>
        </Link>
        <Link href="/settings/brand" className={`nav-item ${isActive('/settings/brand') ? 'active' : ''}`} onClick={handleNavClick}>
          <Icon.Brand />
          <span>Brand</span>
          <span className="kbd">B</span>
        </Link>
        <Link href="/ask" className={`nav-item ${isActive('/ask') ? 'active' : ''}`} onClick={handleNavClick}>
          <Icon.Ask />
          <span>Ask AI</span>
          <span className="kbd">A</span>
        </Link>
        <Link href="/calendar" className={`nav-item ${isActive('/calendar') ? 'active' : ''}`} onClick={handleNavClick}>
          <Icon.Calendar />
          <span>Calendar</span>
          <span className="soon-badge">Soon</span>
        </Link>
      </div>

      <div className="rail-section">
        <div className="rail-label">Create</div>
        <Link href="/generate/ugc" className={`nav-item ${isActive('/generate/ugc') ? 'active' : ''}`} onClick={handleNavClick}>
          <Icon.Video />
          <span>UGC Package</span>
        </Link>
        <Link href="/generate/image" className={`nav-item ${isActive('/generate/image') ? 'active' : ''}`} onClick={handleNavClick}>
          <Icon.Image />
          <span>Image</span>
        </Link>
        <Link href="/generate/video" className={`nav-item ${isActive('/generate/video') ? 'active' : ''}`} onClick={handleNavClick}>
          <Icon.Video />
          <span>Video</span>
        </Link>
        <Link href="/generate/blog" className={`nav-item ${isActive('/generate/blog') ? 'active' : ''}`} onClick={handleNavClick}>
          <Icon.Blog />
          <span>Blog post</span>
          <span className="soon-badge">Soon</span>
        </Link>
        <Link href="/generate/social" className={`nav-item ${isActive('/generate/social') ? 'active' : ''}`} onClick={handleNavClick}>
          <Icon.Social />
          <span>Social</span>
          <span className="soon-badge">Soon</span>
        </Link>
        <Link href="/generate/email" className={`nav-item ${isActive('/generate/email') ? 'active' : ''}`} onClick={handleNavClick}>
          <Icon.Email />
          <span>Email</span>
          <span className="soon-badge">Soon</span>
        </Link>
        <Link href="/generate/voice" className={`nav-item ${isActive('/generate/voice') ? 'active' : ''}`} onClick={handleNavClick}>
          <Icon.Voice />
          <span>Voiceover</span>
          <span className="soon-badge">Soon</span>
        </Link>
      </div>

      <div className="rail-section">
        <div className="rail-label">Insights</div>
        <Link href="/scheduler" className={`nav-item ${isActive('/scheduler') ? 'active' : ''}`} onClick={handleNavClick}>
          <Icon.Calendar />
          <span>Scheduler</span>
          <span className="soon-badge">Soon</span>
        </Link>
        <Link href="/analytics" className={`nav-item ${isActive('/analytics') ? 'active' : ''}`} onClick={handleNavClick}>
          <Icon.TrendUp />
          <span>Analytics</span>
          <span className="soon-badge">Soon</span>
        </Link>
      </div>

      <div className="rail-footer">
        <div className="credits-card">
          <div className="credits-row">
            <div className="credits-num">{Math.floor(creditBalance / 100)}<em>{(creditBalance % 100).toString().padStart(2, '0')}</em></div>
            <div className="credits-label">Credits</div>
          </div>
          <div className="credits-bar"><div style={{ width: `${creditPercentage}%` }} /></div>
          <div className="credits-upgrade">Free plan · <u style={{ cursor: 'pointer' }} onClick={() => router.push('/settings/billing')}>Upgrade</u></div>
        </div>
        <div className="user-row" style={{ position: 'relative' }}>
          <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', flex: 1, padding: '8px', borderRadius: 'var(--r-sm)', transition: 'background-color 0.2s', backgroundColor: showUserMenu ? 'var(--surface)' : 'transparent' }} onClick={() => setShowUserMenu(!showUserMenu)}>
            <div className="avatar">{userName.charAt(0).toUpperCase()}</div>
            <div style={{ flex: 1 }}>
              <div className="user-name">{userName}</div>
              <div className="user-meta">{userEmail}</div>
            </div>
          </div>
          {showUserMenu && (
            <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: '8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', zIndex: 1000 }}>
              <button onClick={() => router.push('/settings/account')} style={{ width: '100%', padding: '10px 12px', border: 'none', background: 'none', color: 'var(--ink)', fontSize: '13px', cursor: 'pointer', textAlign: 'left', transition: 'background-color 0.2s' }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg)')} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}>
                Account settings
              </button>
              <div style={{ height: '1px', background: 'var(--border)' }} />
              <button onClick={handleLogout} style={{ width: '100%', padding: '10px 12px', border: 'none', background: 'none', color: 'var(--danger)', fontSize: '13px', cursor: 'pointer', textAlign: 'left', transition: 'background-color 0.2s' }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg)')} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
