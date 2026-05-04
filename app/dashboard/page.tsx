'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/auth'
import Link from 'next/link'
import { FileText, Share2, Mail, Calendar, BarChart3, Sparkles } from 'lucide-react'

export default function DashboardPage() {
  const [stats, setStats] = useState({ blogs: 0, social: 0, emails: 0, total: 0 })
  const [userName, setUserName] = useState('Creator')

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    const supabase = getSupabase()
    if (!supabase) return

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      setUserName('Creator')
      return
    }

    setUserName(userData.user.user_metadata?.full_name || 'Creator')

    const { data } = await supabase
      .from('content')
      .select('content_type')
      .eq('user_id', userData.user.id)

    const counts = { blogs: 0, social: 0, emails: 0, total: 0 }
    data?.forEach((item: any) => {
      counts.total++
      if (item.content_type === 'blog') counts.blogs++
      else if (item.content_type === 'social') counts.social++
      else if (item.content_type === 'email') counts.emails++
    })
    setStats(counts)
  }

  // Color schemes for different content types
  const colorSchemes = {
    blog: { gradient: 'from-purple-500 to-violet-600', bg: 'bg-purple-50', icon: 'text-purple-600', text: 'text-purple-700' },
    social: { gradient: 'from-rose-500 to-pink-600', bg: 'bg-rose-50', icon: 'text-rose-600', text: 'text-rose-700' },
    email: { gradient: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-50', icon: 'text-emerald-600', text: 'text-emerald-700' },
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-slate-50">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800&family=Inter:wght@300;400;500;600;700&display=swap');

        * {
          font-family: 'Inter', sans-serif;
        }

        .serif-headline {
          font-family: 'Fraunces', serif;
          font-weight: 700;
          letter-spacing: -1.5px;
        }

        .glass-card {
          background: rgba(255, 255, 255, 0.5);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.7);
          transition: all 0.4s cubic-bezier(0.23, 1, 0.320, 1);
        }

        .glass-card:hover {
          background: rgba(255, 255, 255, 0.6);
          border-color: rgba(255, 255, 255, 0.9);
          transform: translateY(-6px);
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.08);
        }

        .text-gradient {
          background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .btn-primary {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
          transition: all 0.3s cubic-bezier(0.23, 1, 0.320, 1);
          box-shadow: 0 10px 25px rgba(59, 130, 246, 0.2);
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 15px 40px rgba(59, 130, 246, 0.35);
        }

        .feature-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          backdrop-filter: blur(8px);
        }

        .stat-card {
          transition: all 0.4s cubic-bezier(0.23, 1, 0.320, 1);
        }

        .stat-card:hover {
          transform: translateY(-4px);
        }
      `}</style>

      {/* Header */}
      <div className="border-b border-white/20 bg-white/30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="serif-headline text-5xl text-slate-900 mb-2">
                Welcome back, <span className="text-gradient">{userName}</span>
              </h1>
              <p className="text-slate-600">Keep the creative flow going. Pick a generator below.</p>
            </div>
            <div className="text-right">
              <div className="serif-headline text-4xl text-blue-600">{stats.total}</div>
              <div className="text-slate-600 text-sm">pieces created</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-12">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="stat-card glass-card p-8 rounded-2xl border-l-4 border-purple-500">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-slate-600 text-sm mb-1 font-500">Blog Posts</p>
                <div className="serif-headline text-4xl text-purple-600">{stats.blogs}</div>
              </div>
              <div className="feature-icon bg-gradient-to-br from-purple-100 to-violet-100"><FileText className="w-6 h-6 text-purple-600" /></div>
            </div>
            <p className="text-xs text-slate-500">SEO-optimized articles</p>
          </div>

          <div className="stat-card glass-card p-8 rounded-2xl border-l-4 border-rose-500">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-slate-600 text-sm mb-1 font-500">Social Posts</p>
                <div className="serif-headline text-4xl text-rose-600">{stats.social}</div>
              </div>
              <div className="feature-icon bg-gradient-to-br from-rose-100 to-pink-100"><Share2 className="w-6 h-6 text-rose-600" /></div>
            </div>
            <p className="text-xs text-slate-500">Across all platforms</p>
          </div>

          <div className="stat-card glass-card p-8 rounded-2xl border-l-4 border-emerald-500">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-slate-600 text-sm mb-1 font-500">Email Sequences</p>
                <div className="serif-headline text-4xl text-emerald-600">{stats.emails}</div>
              </div>
              <div className="feature-icon bg-gradient-to-br from-emerald-100 to-teal-100"><Mail className="w-6 h-6 text-emerald-600" /></div>
            </div>
            <p className="text-xs text-slate-500">Ready to send</p>
          </div>
        </div>

        {/* Quick Access Generators */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="serif-headline text-3xl text-slate-900">Quick Generate</h2>
            <span className="text-sm bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-full font-600 shadow-lg shadow-blue-500/20">
              Start here
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Blog Generator */}
            <Link
              href="/generate/blog"
              className="glass-card p-8 rounded-2xl group cursor-pointer border-t-2 border-purple-400 hover:border-purple-500"
            >
              <div className="feature-icon mb-6 group-hover:scale-110 transition bg-gradient-to-br from-purple-100 to-violet-100"><FileText className="w-6 h-6 text-purple-600" /></div>
              <h3 className="serif-headline text-xl text-slate-900 mb-2">Blog Post</h3>
              <p className="text-xs text-purple-600 mb-4 font-600">SEO articles</p>
              <p className="text-sm text-slate-600 group-hover:text-slate-900 transition">
                Generate long-form, optimized content in minutes.
              </p>
              <div className="mt-6 text-purple-600 text-sm font-600 group-hover:translate-x-1 transition">
                Create →
              </div>
            </Link>

            {/* Social Generator */}
            <Link
              href="/generate/social"
              className="glass-card p-8 rounded-2xl group cursor-pointer border-t-2 border-rose-400 hover:border-rose-500"
            >
              <div className="feature-icon mb-6 group-hover:scale-110 transition bg-gradient-to-br from-rose-100 to-pink-100"><Share2 className="w-6 h-6 text-rose-600" /></div>
              <h3 className="serif-headline text-xl text-slate-900 mb-2">Social Posts</h3>
              <p className="text-xs text-rose-600 mb-4 font-600">Multi-platform</p>
              <p className="text-sm text-slate-600 group-hover:text-slate-900 transition">
                Create platform-optimized posts for all networks.
              </p>
              <div className="mt-6 text-rose-600 text-sm font-600 group-hover:translate-x-1 transition">
                Create →
              </div>
            </Link>

            {/* Email Generator */}
            <Link
              href="/generate/email"
              className="glass-card p-8 rounded-2xl group cursor-pointer border-t-2 border-emerald-400 hover:border-emerald-500"
            >
              <div className="feature-icon mb-6 group-hover:scale-110 transition bg-gradient-to-br from-emerald-100 to-teal-100"><Mail className="w-6 h-6 text-emerald-600" /></div>
              <h3 className="serif-headline text-xl text-slate-900 mb-2">Email Sequence</h3>
              <p className="text-xs text-emerald-600 mb-4 font-600">Automated flows</p>
              <p className="text-sm text-slate-600 group-hover:text-slate-900 transition">
                Build complete email sequences that convert.
              </p>
              <div className="mt-6 text-emerald-600 text-sm font-600 group-hover:translate-x-1 transition">
                Create →
              </div>
            </Link>

            {/* Calendar */}
            <Link
              href="/calendar"
              className="glass-card p-8 rounded-2xl group cursor-pointer border-t-2 border-amber-400 hover:border-amber-500"
            >
              <div className="feature-icon mb-6 group-hover:scale-110 transition bg-gradient-to-br from-amber-100 to-orange-100"><Calendar className="w-6 h-6 text-amber-600" /></div>
              <h3 className="serif-headline text-xl text-slate-900 mb-2">Content Calendar</h3>
              <p className="text-xs text-amber-600 mb-4 font-600">Scheduling</p>
              <p className="text-sm text-slate-600 group-hover:text-slate-900 transition">
                Schedule and manage posts for future publishing.
              </p>
              <div className="mt-6 text-amber-600 text-sm font-600 group-hover:translate-x-1 transition">
                View →
              </div>
            </Link>

            {/* Analytics */}
            <Link
              href="/analytics"
              className="glass-card p-8 rounded-2xl group cursor-pointer border-t-2 border-cyan-400 hover:border-cyan-500"
            >
              <div className="feature-icon mb-6 group-hover:scale-110 transition bg-gradient-to-br from-cyan-100 to-blue-100"><BarChart3 className="w-6 h-6 text-cyan-600" /></div>
              <h3 className="serif-headline text-xl text-slate-900 mb-2">Analytics</h3>
              <p className="text-xs text-cyan-600 mb-4 font-600">Performance</p>
              <p className="text-sm text-slate-600 group-hover:text-slate-900 transition">
                Track engagement and content performance metrics.
              </p>
              <div className="mt-6 text-cyan-600 text-sm font-600 group-hover:translate-x-1 transition">
                View →
              </div>
            </Link>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="glass-card rounded-2xl p-8">
          <h2 className="serif-headline text-2xl text-slate-900 mb-6">Recent Activity</h2>
          <div className="space-y-4">
            {stats.total === 0 ? (
              <div className="text-center py-16">
                <div className="flex justify-center mb-4">
                  <Sparkles className="w-12 h-12 text-slate-300" />
                </div>
                <p className="text-slate-700 mb-2 text-lg font-500">No content created yet</p>
                <p className="text-sm text-slate-500 mb-8">Start by generating your first blog post, social post, or email sequence</p>
                <Link
                  href="/generate/blog"
                  className="inline-block btn-primary px-8 py-3 rounded-lg font-600 text-sm"
                >
                  Create First Post
                </Link>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-4 py-4 border-b border-white/20">
                  <FileText className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <p className="font-600 text-slate-900">Generated {stats.blogs} blog post{stats.blogs !== 1 ? 's' : ''}</p>
                    <p className="text-sm text-slate-500">SEO-optimized content ready to publish</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 py-4 border-b border-white/20">
                  <Share2 className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <p className="font-600 text-slate-900">Generated {stats.social} social post{stats.social !== 1 ? 's' : ''}</p>
                    <p className="text-sm text-slate-500">Multi-platform social content</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 py-4">
                  <Mail className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <p className="font-600 text-slate-900">Generated {stats.emails} email sequence{stats.emails !== 1 ? 's' : ''}</p>
                    <p className="text-sm text-slate-500">Automated email campaigns</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
