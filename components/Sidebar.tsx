'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/auth'
import { FileText, Share2, Mail, Calendar, BarChart3, Settings, LogOut, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

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
    <div className={`fixed left-0 top-0 h-screen bg-black border-r border-white/10 z-40 transition-all duration-300 ${collapsed ? 'w-20' : 'w-64'}`}>
      <style>{`
        .nav-item {
          position: relative;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          margin: 0 8px;
          border-radius: 8px;
          color: rgba(255, 255, 255, 0.6);
          transition: all 0.3s cubic-bezier(0.23, 1, 0.320, 1);
          cursor: pointer;
        }

        .nav-item:hover {
          color: #00ff00;
          background: rgba(0, 255, 0, 0.1);
        }

        .nav-item.active {
          color: #00ff00;
          background: rgba(0, 255, 0, 0.15);
          font-weight: 600;
          box-shadow: 0 0 20px rgba(0, 255, 0, 0.2);
        }

        .nav-item.active::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          background: #00ff00;
          border-radius: 0 3px 3px 0;
        }

        .sidebar-brand {
          font-weight: 800;
          font-size: 24px;
          color: #00ff00;
          text-shadow: 0 0 10px rgba(0, 255, 0, 0.3);
        }

        .divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(0, 255, 0, 0.2), transparent);
          margin: 16px 0;
        }

        .toggle-btn {
          position: absolute;
          right: -12px;
          top: 24px;
          background: #00ff00;
          color: #000;
          border: none;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .toggle-btn:hover {
          box-shadow: 0 0 15px rgba(0, 255, 0, 0.5);
        }
      `}</style>

      <div className="h-full flex flex-col p-6 overflow-y-auto relative">
        {/* Toggle Button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="toggle-btn"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        {/* Brand */}
        <Link href="/dashboard" className="mb-8 block">
          <div className="sidebar-brand">{collapsed ? 'C' : 'CF'}</div>
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
                title={collapsed ? item.label : ''}
                className={`nav-item ${active ? 'active' : ''}`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span className="text-sm font-500">{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Divider */}
        <div className="divider" />

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          title={collapsed ? 'Logout' : ''}
          className="nav-item group w-full justify-start"
        >
          <LogOut className="w-5 h-5 flex-shrink-0 group-hover:rotate-180 transition-transform duration-300" />
          {!collapsed && <span className="text-sm font-500">Logout</span>}
        </button>
      </div>
    </div>
  )
}
