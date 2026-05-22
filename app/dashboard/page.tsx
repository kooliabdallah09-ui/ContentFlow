'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/auth'
import Link from 'next/link'
import { FileText, Share2, Mail, Calendar, BarChart3, Sparkles, Film } from 'lucide-react'
import CreditBalance from '@/components/CreditBalance'

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
    <div className="min-h-screen bg-black text-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        * {
          font-family: 'Inter', sans-serif;
        }

        .glass-card {
          background: rgba(255, 255, 255, 0.04);
          border: 1.5px solid rgba(6, 182, 212, 0.15);
          border-radius: 18px;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          transition: all 0.3s ease;
        }

        .glass-card:hover {
          background: rgba(6, 182, 212, 0.05);
          border-color: rgba(6, 182, 212, 0.3);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(6, 182, 212, 0.15);
        }

        .btn-primary {
          background: linear-gradient(135deg, #06B6D4, #0891B2);
          color: #ffffff;
          transition: all 0.3s cubic-bezier(0.23, 1, 0.320, 1);
          font-weight: 600;
          border: none;
          border-radius: 12px;
          box-shadow: 0 6px 20px rgba(6, 182, 212, 0.25);
          letter-spacing: -0.3px;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 28px rgba(6, 182, 212, 0.35);
        }

        .btn-primary:active {
          transform: translateY(0);
          box-shadow: 0 4px 12px rgba(6, 182, 212, 0.25);
        }

        .feature-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          background: rgba(255, 255, 255, 0.05);
        }

        .stat-card {
          transition: all 0.3s ease;
        }

        .stat-card:hover {
          transform: translateY(-4px);
        }

        .cta-button {
          background: #ffffff;
          color: #000000;
          font-weight: 600;
          transition: all 0.3s ease;
        }

        .cta-button:hover {
          background: #f0f0f0;
        }
      `}</style>

      {/* Header */}
      <div className="border-b border-white/10 bg-black/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-4xl font-black mb-2">
                Welcome back, {userName}
              </h1>
              <p className="text-white/60">Keep the creative flow going. Pick a generator below.</p>
            </div>
            <div className="flex items-center gap-6">
              <CreditBalance />
              <div>
                <div className="text-3xl font-black text-white">{stats.total}</div>
                <div className="text-white/60 text-sm">pieces created</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-12">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="stat-card glass-card p-8 rounded-xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-white/60 text-sm mb-2 font-500">Blog Posts</p>
                <div className="text-4xl font-black text-white">{stats.blogs}</div>
              </div>
              <div className="feature-icon"><FileText className="w-6 h-6 text-white/70" /></div>
            </div>
            <p className="text-xs text-white/50">SEO-optimized articles</p>
          </div>

          <div className="stat-card glass-card p-8 rounded-xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-white/60 text-sm mb-2 font-500">Social Posts</p>
                <div className="text-4xl font-black text-white">{stats.social}</div>
              </div>
              <div className="feature-icon"><Share2 className="w-6 h-6 text-white/70" /></div>
            </div>
            <p className="text-xs text-white/50">Across all platforms</p>
          </div>

          <div className="stat-card glass-card p-8 rounded-xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-white/60 text-sm mb-2 font-500">Email Sequences</p>
                <div className="text-4xl font-black text-white">{stats.emails}</div>
              </div>
              <div className="feature-icon"><Mail className="w-6 h-6 text-white/70" /></div>
            </div>
            <p className="text-xs text-white/50">Ready to send</p>
          </div>
        </div>

        {/* Quick Access Generators */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-8">
            <h2 className="text-3xl font-black text-white">Create Content</h2>
            <span className="text-sm bg-white/10 text-white/70 px-4 py-2 rounded-full font-600 border border-white/20">
              Pick a type
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {/* Blog Generator */}
            <Link
              href="/generate/blog"
              className="glass-card p-8 rounded-xl group cursor-pointer"
            >
              <div className="feature-icon mb-6 group-hover:scale-110 transition"><FileText className="w-6 h-6 text-white/70" /></div>
              <h3 className="text-xl font-black text-white mb-2">Blog Post</h3>
              <p className="text-xs text-white/60 mb-4 font-600">SEO articles</p>
              <p className="text-sm text-white/70 group-hover:text-white/90 transition">
                Generate long-form, optimized content.
              </p>
              <div className="mt-6 text-white/60 text-sm font-600 group-hover:translate-x-1 transition">
                Create →
              </div>
            </Link>

            {/* Social Generator */}
            <Link
              href="/generate/social"
              className="glass-card p-8 rounded-xl group cursor-pointer"
            >
              <div className="feature-icon mb-6 group-hover:scale-110 transition"><Share2 className="w-6 h-6 text-white/70" /></div>
              <h3 className="text-xl font-black text-white mb-2">Social Posts</h3>
              <p className="text-xs text-white/60 mb-4 font-600">Multi-platform</p>
              <p className="text-sm text-white/70 group-hover:text-white/90 transition">
                Create platform-optimized posts.
              </p>
              <div className="mt-6 text-white/60 text-sm font-600 group-hover:translate-x-1 transition">
                Create →
              </div>
            </Link>

            {/* Email Generator */}
            <Link
              href="/generate/email"
              className="glass-card p-8 rounded-xl group cursor-pointer"
            >
              <div className="feature-icon mb-6 group-hover:scale-110 transition"><Mail className="w-6 h-6 text-white/70" /></div>
              <h3 className="text-xl font-black text-white mb-2">Email Sequence</h3>
              <p className="text-xs text-white/60 mb-4 font-600">Automated flows</p>
              <p className="text-sm text-white/70 group-hover:text-white/90 transition">
                Build complete email sequences.
              </p>
              <div className="mt-6 text-white/60 text-sm font-600 group-hover:translate-x-1 transition">
                Create →
              </div>
            </Link>

            {/* UGC Videos - NEW */}
            <Link
              href="/generate/ugc"
              className="glass-card p-8 rounded-xl group cursor-pointer"
            >
              <div className="feature-icon mb-6 group-hover:scale-110 transition"><Film className="w-6 h-6 text-white/70" /></div>
              <h3 className="text-xl font-black text-white mb-2">UGC Videos</h3>
              <p className="text-xs text-white/60 mb-4 font-600">AI Avatars</p>
              <p className="text-sm text-white/70 group-hover:text-white/90 transition">
                Generate professional UGC videos.
              </p>
              <div className="mt-6 text-white/60 text-sm font-600 group-hover:translate-x-1 transition">
                Create →
              </div>
            </Link>

            {/* Calendar */}
            <Link
              href="/calendar"
              className="glass-card p-8 rounded-xl group cursor-pointer"
            >
              <div className="feature-icon mb-6 group-hover:scale-110 transition"><Calendar className="w-6 h-6 text-white/70" /></div>
              <h3 className="text-xl font-black text-white mb-2">Content Calendar</h3>
              <p className="text-xs text-white/60 mb-4 font-600">Scheduling</p>
              <p className="text-sm text-white/70 group-hover:text-white/90 transition">
                Schedule and manage posts for future publishing.
              </p>
              <div className="mt-6 text-white/60 text-sm font-600 group-hover:translate-x-1 transition">
                View →
              </div>
            </Link>

            {/* Analytics */}
            <Link
              href="/analytics"
              className="glass-card p-8 rounded-xl group cursor-pointer"
            >
              <div className="feature-icon mb-6 group-hover:scale-110 transition"><BarChart3 className="w-6 h-6 text-white/70" /></div>
              <h3 className="text-xl font-black text-white mb-2">Analytics</h3>
              <p className="text-xs text-white/60 mb-4 font-600">Performance</p>
              <p className="text-sm text-white/70 group-hover:text-white/90 transition">
                Track engagement and content performance metrics.
              </p>
              <div className="mt-6 text-white/60 text-sm font-600 group-hover:translate-x-1 transition">
                View →
              </div>
            </Link>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="glass-card rounded-2xl p-8">
          <h2 className="text-2xl font-black text-white mb-6">Recent Activity</h2>
          <div className="space-y-4">
            {stats.total === 0 ? (
              <div className="text-center py-16">
                <div className="flex justify-center mb-4">
                  <Sparkles className="w-12 h-12 text-white/40" />
                </div>
                <p className="text-white mb-2 text-lg font-500">No content created yet</p>
                <p className="text-sm text-white/60 mb-8">Start by generating your first blog post, social post, or email sequence</p>
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
                  <FileText className="w-6 h-6 text-white/70 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <p className="font-600 text-white">Generated {stats.blogs} blog post{stats.blogs !== 1 ? 's' : ''}</p>
                    <p className="text-sm text-white/60">SEO-optimized content ready to publish</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 py-4 border-b border-white/20">
                  <Share2 className="w-6 h-6 text-white/70 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <p className="font-600 text-white">Generated {stats.social} social post{stats.social !== 1 ? 's' : ''}</p>
                    <p className="text-sm text-white/60">Multi-platform social content</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 py-4">
                  <Mail className="w-6 h-6 text-white/70 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <p className="font-600 text-white">Generated {stats.emails} email sequence{stats.emails !== 1 ? 's' : ''}</p>
                    <p className="text-sm text-white/60">Automated email campaigns</p>
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
