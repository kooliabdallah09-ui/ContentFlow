'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getSupabase } from '@/lib/auth'
import { Sidebar } from '@/components/Sidebar'
import { TopBar } from '@/components/TopBar'
import ToastContainer from '@/components/ToastContainer'
import "./globals.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isDark, setIsDark] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    document.documentElement.setAttribute('data-tone', 'cocoa')
  }, [])

  const toggleTheme = () => {
    const next = isDark ? 'paper' : 'cocoa'
    document.documentElement.setAttribute('data-tone', next)
    setIsDark(!isDark)
  }

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) { setLoading(false); return }

    const timeout = setTimeout(() => setLoading(false), 3000)

    const { data } = supabase.auth.onAuthStateChange((event: any, session: any) => {
      clearTimeout(timeout)
      setUser(session?.user)

      const publicPages = ['/', '/privacy', '/auth', '/presentation', '/landing']
      const isPublicPage = publicPages.some(page => pathname === page || pathname.startsWith(page + '/'))

      if (!session?.user && !isPublicPage) router.push('/auth/login')
      setLoading(false)
    })

    return () => { clearTimeout(timeout); data?.subscription?.unsubscribe() }
  }, [pathname, router])

  const isAuthPage = pathname.includes('/auth')
  const isLandingPage = pathname === '/landing'
  const isOnboarding = pathname.includes('/onboarding')
  const isPresentationPage = pathname === '/presentation'
  const showLayout = user && !isAuthPage && !isLandingPage && !isOnboarding && !isPresentationPage

  if (loading) {
    return (
      <html lang="en">
        <body style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
          <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '4px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
              </div>
              <p style={{ color: 'var(--ink-mute)' }}>Loading ContentFlow...</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          </div>
        </body>
      </html>
    )
  }

  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        {showLayout ? (
          <div className="app">
            {mobileMenuOpen && (
              <div
                className="rail-overlay active"
                onClick={() => setMobileMenuOpen(false)}
              />
            )}
            <Sidebar
              currentPath={pathname}
              mobileOpen={mobileMenuOpen}
              onMobileClose={() => setMobileMenuOpen(false)}
            />
            <div className="main">
              <TopBar
                currentPath={pathname}
                onMenuToggle={() => setMobileMenuOpen(o => !o)}
                isDark={isDark}
                onToggleTheme={toggleTheme}
              />
              {children}
            </div>
          </div>
        ) : (
          children
        )}
        <ToastContainer />
      </body>
    </html>
  )
}
