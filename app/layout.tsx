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
  const [isDark, setIsDark] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  // Restore saved theme preference on first mount
  useEffect(() => {
    const saved = localStorage.getItem('cf-theme')
    if (saved === 'dark') {
      setIsDark(true)
      document.documentElement.setAttribute('data-theme', 'dark')
    }
  }, [])

  useEffect(() => {
    const titles: Record<string, string> = {
      '/': 'Contentflow Web — AI Content Studio',
      '/dashboard': 'Dashboard — Contentflow Web',
      '/campaigns': 'Campaigns — Contentflow Web',
      '/library': 'Library — Contentflow Web',
      '/analytics': 'Analytics — Contentflow Web',
      '/generate/blog': 'Blog Post — Contentflow Web',
      '/generate/social': 'Social Post — Contentflow Web',
      '/generate/email': 'Email — Contentflow Web',
      '/generate/image': 'Image — Contentflow Web',
      '/generate/voice': 'Voiceover — Contentflow Web',
      '/generate/video': 'Video — Contentflow Web',
      '/ask': 'Ask AI — Contentflow Web',
      '/generate/ugc': 'UGC Package — Contentflow Web',
      '/generate/business-card': 'Business Card — Contentflow Web',
      '/editor': 'Video Editor — Contentflow Web',
      '/settings': 'Settings — Contentflow Web',
      '/settings/brand': 'Brand Settings — Contentflow Web',
      '/settings/account': 'Account — Contentflow Web',
      '/settings/billing': 'Billing — Contentflow Web',
      '/settings/integrations': 'Integrations — Contentflow Web',
      '/onboarding': 'Get Started — Contentflow Web',
      '/onboarding/brand': 'Brand Setup — Contentflow Web',
      '/onboarding/plan': 'Content Plan — Contentflow Web',
      '/auth/login': 'Log In — Contentflow Web',
      '/auth/signup': 'Sign Up — Contentflow Web',
      '/pricing': 'Pricing — Contentflow Web',
      '/privacy': 'Privacy Policy — Contentflow Web',
      '/help': 'Help — Contentflow Web',
    }
    document.title = titles[pathname] ?? 'Contentflow Web'
  }, [pathname])

  const toggleTheme = () => {
    const next = !isDark
    setIsDark(next)
    if (next) {
      document.documentElement.setAttribute('data-theme', 'dark')
      localStorage.setItem('cf-theme', 'dark')
    } else {
      document.documentElement.removeAttribute('data-theme')
      localStorage.setItem('cf-theme', 'light')
    }
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

      const publicPages = ['/', '/privacy', '/terms', '/refunds', '/cookies', '/about', '/blog', '/contact', '/help', '/pricing', '/auth', '/presentation', '/landing']
      const isPublicPage = publicPages.some(page => pathname === page || pathname.startsWith(page + '/'))

      if (!session?.user && !isPublicPage) router.push('/auth/login')
      setLoading(false)
    })

    return () => { clearTimeout(timeout); data?.subscription?.unsubscribe() }
  }, [pathname, router])

  const isAuthPage = pathname.includes('/auth')
  const isLandingPage = pathname === '/landing' || pathname === '/'
  const isOnboarding = pathname.includes('/onboarding')
  const isPresentationPage = pathname === '/presentation'
  // Marketing / legal pages render bare — no app sidebar even when signed in.
  const isStandalonePage = ['/privacy', '/terms', '/refunds', '/cookies', '/about', '/blog', '/contact', '/help'].some(p => pathname === p || pathname.startsWith(p + '/'))
  const showLayout = user && !isAuthPage && !isLandingPage && !isOnboarding && !isPresentationPage && !isStandalonePage

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
        <meta name="description" content="Turn one product photo into UGC ads, editorial product shots, social captions, blog posts and emails — all from one brand profile. No creator needed." />
        <meta name="keywords" content="AI UGC ads, AI influencer for brands, product studio AI, Higgsfield alternative, Arcads alternative, HeyGen alternative, AI content creation, talking head video, social copy generator, DTC content" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="ContentFlow" />
        <meta property="og:title" content="ContentFlow — AI Content Studio for Brands" />
        <meta property="og:description" content="Turn one product photo into UGC ads, product shots, captions, blog posts and emails — all from one brand profile. No creator needed." />
        <meta property="og:image" content="https://contentflow-web.com/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content="https://contentflow-web.com" />

        {/* Twitter / X */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="ContentFlow — AI Content Studio for Brands" />
        <meta name="twitter:description" content="Turn one product photo into UGC ads, product shots, captions, blog posts and emails — all from one brand profile. No creator needed." />
        <meta name="twitter:image" content="https://contentflow-web.com/og-image.png" />
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
