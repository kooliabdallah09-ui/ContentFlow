'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { getSupabase } from '@/lib/auth'
import { Geist, Geist_Mono } from "next/font/google";
import Sidebar from '@/components/Sidebar'
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
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) {
      setLoading(false)
      return
    }

    const { data } = supabase.auth.onAuthStateChange((event: any, session: any) => {
      setUser(session?.user)
      setLoading(false)

      if (!session?.user && !pathname.includes('/auth')) {
        router.push('/auth/login')
      }
    })

    return () => data.subscription.unsubscribe()
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
  const showSidebar = user && !isAuthPage && !isLandingPage && !isOnboarding

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
      <body className="min-h-full flex flex-col">
        {showSidebar && <Sidebar />}
        <div className={showSidebar ? 'ml-64' : ''}>
          {!loading && children}
        </div>
      </body>
    </html>
  );
}
