'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { getSupabase } from '@/lib/auth'
import { Geist, Geist_Mono } from "next/font/google";
import Sidebar from '@/components/Sidebar'
import ToastContainer from '@/components/ToastContainer'
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) {
      setLoading(false)
      return
    }

    // Set a timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      setLoading(false)
    }, 3000)

    const { data } = supabase.auth.onAuthStateChange((event: any, session: any) => {
      clearTimeout(timeout)
      setUser(session?.user)
      setLoading(false)

      // Allow public pages without authentication
      const publicPages = ['/', '/privacy', '/auth', '/presentation']
      const isPublicPage = publicPages.some(page => pathname === page || pathname.startsWith(page + '/'))

      if (!session?.user && !isPublicPage) {
        router.push('/auth/login')
      }
    })

    return () => {
      clearTimeout(timeout)
      data?.subscription?.unsubscribe()
    }
  }, [pathname, router])

  const handleLogout = async () => {
    const supabase = getSupabase()
    if (!supabase) return

    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const isAuthPage = pathname.includes('/auth')
  const isLandingPage = pathname === '/landing'
  const isOnboarding = pathname === '/onboarding'
  const isPresentationPage = pathname === '/presentation'
  const showSidebar = user && !isAuthPage && !isLandingPage && !isOnboarding && !isPresentationPage

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800&family=Inter:wght@300;400;500;600;700&display=swap');
        `}</style>
      </head>
      <body className={`min-h-full flex flex-col bg-black ${showSidebar && sidebarOpen ? 'ml-64' : showSidebar ? 'ml-20' : ''}`}>
        {showSidebar && <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />}
        <div>
          {loading ? (
            <div className="min-h-screen flex items-center justify-center">
              <div className="text-center">
                <div className="mb-4 flex justify-center">
                  <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className="text-white/60">Loading ContentFlow...</p>
              </div>
            </div>
          ) : (
            children
          )}
        </div>
        <ToastContainer />
      </body>
    </html>
  );
}
