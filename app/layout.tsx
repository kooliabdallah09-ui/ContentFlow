'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getSupabase } from '@/lib/auth'
import { Sidebar } from '@/components/Sidebar'
import { TopBar } from '@/components/TopBar'
import ToastContainer from '@/components/ToastContainer'
import AppAssistant from '@/components/AppAssistant'
import { CreditsProvider } from '@/lib/CreditsContext'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import "./globals.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  // Theme: pastel (light) is the default. The TopBar toggle flips between pastel
  // and cocoa (the legacy warm-dark theme) for users who want a dark mode.
  const [isDark, setIsDark] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    document.documentElement.setAttribute('data-tone', 'pastel')
  }, [])

  useEffect(() => {
    const titles: Record<string, string> = {
      '/': 'ContentFlow — AI Content Studio',
      '/dashboard': 'Dashboard — ContentFlow',
      '/calendar': 'Monthly Plan — ContentFlow',
      '/library': 'Library — ContentFlow',
      '/analytics': 'Analytics — ContentFlow',
      '/scheduler': 'Scheduler — ContentFlow',
      '/generate/blog': 'Blog Post — ContentFlow',
      '/generate/social': 'Social Post — ContentFlow',
      '/generate/email': 'Email — ContentFlow',
      '/generate/image': 'Image — ContentFlow',
      '/generate/voice': 'Voiceover — ContentFlow',
      '/generate/video': 'Video — ContentFlow',
      '/ask': 'Ask AI — ContentFlow',
      '/generate/ugc': 'UGC Package — ContentFlow',
      '/generate/business-card': 'Business Card — ContentFlow',
      '/editor': 'Video Editor — ContentFlow',
      '/generate/from-calendar': 'Create Content — ContentFlow',
      '/settings': 'Settings — ContentFlow',
      '/settings/brand': 'Brand Settings — ContentFlow',
      '/settings/account': 'Account — ContentFlow',
      '/settings/billing': 'Billing — ContentFlow',
      '/settings/integrations': 'Integrations — ContentFlow',
      '/onboarding': 'Get Started — ContentFlow',
      '/onboarding/brand': 'Brand Setup — ContentFlow',
      '/onboarding/plan': 'Content Plan — ContentFlow',
      '/auth/login': 'Log In — ContentFlow',
      '/auth/signup': 'Sign Up — ContentFlow',
      '/pricing': 'Pricing — ContentFlow',
      '/privacy': 'Privacy Policy — ContentFlow',
      '/help': 'Help — ContentFlow',
    }
    document.title = titles[pathname] ?? 'ContentFlow'
  }, [pathname])

  const toggleTheme = () => {
    const next = isDark ? 'pastel' : 'cocoa'
    document.documentElement.setAttribute('data-tone', next)
    setIsDark(!isDark)
  }

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  // Lock body scroll while the mobile sidebar drawer is open.
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileMenuOpen])

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
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#FAFAF8" />

        {/* Primary meta */}
        <meta name="description" content="ContentFlow — Generate UGC ads, screen demos, voiceovers, and social copy with AI. From idea to ready-to-publish content in minutes." />
        <meta name="keywords" content="AI content creation, UGC ads, talking head video, AI voiceover, screen demo, social copy generator" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="ContentFlow" />
        <meta property="og:title" content="ContentFlow — AI Content Studio" />
        <meta property="og:description" content="Generate UGC ads, screen demos, voiceovers, and social copy with AI. From idea to ready-to-publish in minutes." />
        <meta property="og:image" content="https://contentflow.app/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content="https://contentflow.app" />

        {/* Twitter / X */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="ContentFlow — AI Content Studio" />
        <meta name="twitter:description" content="Generate UGC ads, screen demos, voiceovers, and social copy with AI. From idea to ready-to-publish in minutes." />
        <meta name="twitter:image" content="https://contentflow.app/og-image.png" />
      </head>
      <body>
        <CreditsProvider>
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
        </CreditsProvider>
        <ToastContainer />
        <AppAssistant />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
