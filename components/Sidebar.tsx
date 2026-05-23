'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/auth'
import { FileText, Share2, Mail, Calendar, BarChart3, Settings, LogOut, ChevronLeft, ChevronRight, Image as ImageIcon, Mic2, Film } from 'lucide-react'
import { useState } from 'react'

export default function Sidebar({ isOpen = true, onToggle }: { isOpen?: boolean; onToggle?: () => void }) {
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
    { href: '/generate/image', label: 'Image', icon: ImageIcon },
    { href: '/generate/voice', label: 'Voice', icon: Mic2 },
    { href: '/generate/video', label: 'Video', icon: Film },
    { href: '/calendar', label: 'Calendar', icon: Calendar },
    { href: '/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/settings/brand', label: 'Brand', icon: Settings },
    { href: '/settings/integrations', label: 'Integrations', icon: Settings },
  ]

  const isActive = (href: string) => pathname === href

  return (
    <div className={`fixed left-0 top-0 h-screen bg-black border-r border-white/10 z-40 transition-all duration-300 ${isOpen ? 'w-64' : 'w-20'}`}>
      <style>{`
        .nav-item {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 14px 18px;
          border-radius: 14px;
          color: rgba(255, 255, 255, 0.7);
          transition: all 0.3s cubic-bezier(0.23, 1, 0.320, 1);
          cursor: pointer;
          white-space: nowrap;
          font-weight: 500;
        }

        .nav-item:hover {
          color: #06B6D4;
          background: rgba(6, 182, 212, 0.12);
          transform: translateX(4px);
        }

        .nav-item.active {
          color: #ffffff;
          background: linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(6, 182, 212, 0.1));
          font-weight: 600;
          box-shadow: 0 4px 12px rgba(6, 182, 212, 0.2);
        }

        .nav-item.active::before {
          content: '';
          position: absolute;
          left: 0;
          top: 6px;
          bottom: 6px;
          width: 3px;
          background: #06B6D4;
          border-radius: 0 3px 3px 0;
        }

        .sidebar-header {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
          padding: 0;
          min-height: 36px;
        }

        .sidebar-brand {
          font-weight: 800;
          font-size: 24px;
          color: #06B6D4;
          text-shadow: 0 0 10px rgba(6, 182, 212, 0.3);
        }

        .sidebar-toggle {
          background: rgba(6, 182, 212, 0.15);
          color: #06B6D4;
          border: 1.5px solid rgba(6, 182, 212, 0.3);
          border-radius: 12px;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(6, 182, 212, 0.1);
          flex-shrink: 0;
          margin: 0 auto;
        }

        .sidebar-toggle:hover {
          box-shadow: 0 4px 12px rgba(6, 182, 212, 0.2);
          background: rgba(6, 182, 212, 0.25);
          border-color: rgba(6, 182, 212, 0.5);
          transform: scale(1.05);
        }

        .sidebar-toggle:active {
          transform: scale(0.92);
        }

        .divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(6, 182, 212, 0.15), transparent);
          margin: 20px 8px;
        }

.sidebar-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(6, 182, 212, 0.2) transparent;
        }

        .sidebar-scroll::-webkit-scrollbar {
          width: 6px;
        }

        .sidebar-scroll::-webkit-scrollbar-track {
          background: transparent;
        }

        .sidebar-scroll::-webkit-scrollbar-thumb {
          background: rgba(6, 182, 212, 0.2);
          border-radius: 3px;
        }

        .sidebar-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(6, 182, 212, 0.3);
        }
      `}</style>

      <div className="h-full flex flex-col p-3 overflow-y-auto relative sidebar-scroll">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          {isOpen && (
            <Link href="/dashboard" className="block">
              <div className="sidebar-brand">CF</div>
            </Link>
          )}
          <button
            onClick={onToggle}
            className="sidebar-toggle ml-auto"
            title={isOpen ? 'Hide sidebar' : 'Show sidebar'}
          >
            {isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 flex flex-col items-center gap-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                title={!isOpen ? item.label : ''}
                className={`nav-item ${active ? 'active' : ''}`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {isOpen && <span className="text-sm font-500">{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Divider */}
        <div className="divider" />

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          title={!isOpen ? 'Logout' : ''}
          className="nav-item group"
        >
          <LogOut className="w-5 h-5 flex-shrink-0 group-hover:rotate-180 transition-transform duration-300" />
          {isOpen && <span className="text-sm font-500">Logout</span>}
        </button>
      </div>
    </div>
  )
}
