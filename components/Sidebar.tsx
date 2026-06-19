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


  const creditPercentage = Math.min((creditBalance / 500) * 100, 100)

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
      </div>

      <div className="rail-section">
        <div className="rail-label">Coming soon</div>
        <div className="nav-item nav-soon">
          <Icon.Blog />
          <span style={{ flex: 1 }}>Blog · Social · Email</span>
          <span className="soon-badge">Soon</span>
        </div>
        <div className="nav-item nav-soon">
          <Icon.Calendar />
          <span style={{ flex: 1 }}>Scheduler</span>
          <span className="soon-badge">Soon</span>
        </div>
        <div className="nav-item nav-soon">
          <Icon.TrendUp />
          <span style={{ flex: 1 }}>Analytics</span>
          <span className="soon-badge">Soon</span>
        </div>
      </div>

      <div className="rail-footer">
        <div className="credits-card">
          <div className="credits-row">
            <div className="credits-num">{creditBalance}</div>
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
