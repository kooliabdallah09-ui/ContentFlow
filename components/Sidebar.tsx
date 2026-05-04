'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/auth'
import { FileText, Share2, Mail, Calendar, BarChart3, Settings, LogOut } from 'lucide-react'

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = getSupabase()
    if (!supabase) return

    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: FileText },
    { href: '/generate/blog', label: 'Blog', icon: FileText },
    { href: '/generate/social', label: 'Social', icon: Share2 },
    { href: '/generate/email', label: 'Email', icon: Mail },
    { href: '/calendar', label: 'Calendar', icon: Calendar },
    { href: '/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/settings/integrations', label: 'Integrations', icon: Settings },
  ]

  const isActive = (href: string) => pathname === href

  return (
    <div className="fixed left-0 top-0 h-screen w-64 z-40">
      <style>{`
        .sidebar-glass {
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-right: 1px solid rgba(255, 255, 255, 0.15);
          background-image: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
        }

        .nav-item {
          position: relative;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          margin: 0 12px;
          border-radius: 10px;
          color: rgba(100, 116, 139, 0.8);
          transition: all 0.3s cubic-bezier(0.23, 1, 0.320, 1);
          cursor: pointer;
        }

        .nav-item:hover {
          color: rgba(30, 41, 59, 1);
          background: rgba(255, 255, 255, 0.1);
        }

        .nav-item.active {
          color: #3b82f6;
          background: rgba(59, 130, 246, 0.15);
          font-weight: 600;
        }

        .nav-item.active::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          background: linear-gradient(180deg, #3b82f6 0%, #2563eb 100%);
          border-radius: 0 3px 3px 0;
        }

        .sidebar-brand {
          font-family: 'Fraunces', serif;
          font-weight: 700;
          font-size: 24px;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
          margin: 16px 0;
        }
      `}</style>

      <div className="sidebar-glass h-full flex flex-col p-6 overflow-y-auto">
        {/* Brand */}
        <Link href="/dashboard" className="mb-8 block">
          <div className="sidebar-brand">CF</div>
        </Link>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${active ? 'active' : ''}`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-500">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Divider */}
        <div className="divider" />

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="nav-item group w-full justify-start"
        >
          <LogOut className="w-5 h-5 flex-shrink-0 group-hover:rotate-180 transition-transform duration-300" />
          <span className="text-sm font-500">Logout</span>
        </button>
      </div>
    </div>
  )
}
