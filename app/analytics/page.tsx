'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FileText, Eye, Link2, Share2, BarChart3 } from 'lucide-react'

interface Metrics {
  totalPosts: number
  totalViews: number
  totalClicks: number
  totalShares: number
  averageEngagementRate: number
  topPost: any
  platformBreakdown: Record<string, any>
  timeRange: {
    from: string
    to: string
  }
}

const StatCard = ({ icon: Icon, label, value, change }: any) => (
  <div className="glass-card p-6 rounded-2xl">
    <div className="flex items-start justify-between mb-2">
      <div>
        <p className="text-white/60 text-sm font-500 mb-1">{label}</p>
        <div className="text-3xl text-white font-black">{value}</div>
      </div>
      <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
        {Icon && <Icon className="w-5 h-5 text-white/70" />}
      </div>
    </div>
    {change && (
      <p
        className={`text-xs font-600 ${
          change > 0 ? 'text-green-400' : 'text-red-400'
        }`}
      >
        {change > 0 ? '↑' : '↓'} {Math.abs(change)}%
      </p>
    )}
  </div>
)

export default function AnalyticsPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState(30)

  useEffect(() => {
    fetchMetrics()
  }, [timeRange])

  const fetchMetrics = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/analytics/metrics?days=${timeRange}`)
      const data = await response.json()
      setMetrics(data.metrics)
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { font-family: 'Inter', sans-serif; }
        .glass-card { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1); }
        .btn-primary { background: #ffffff; color: #000000; box-shadow: 0 10px 25px rgba(255, 255, 255, 0.1); transition: all 0.3s ease; font-weight: 600; }
        .btn-primary:hover:not(:disabled) { background: #f0f0f0; transform: translateY(-2px); }
      `}</style>

      {/* Header */}
      <div className="border-b border-white/10 bg-black/50 backdrop-blur-md py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/dashboard" className="text-white/60 hover:text-white/80">
              ← Back to Dashboard
            </Link>
          </div>
          <h1 className="text-5xl font-black mb-3">Analytics Dashboard</h1>
          <p className="text-white/60 text-lg">
            Track your content performance and engagement metrics
          </p>
        </div>
      </div>

      <div className="p-8 max-w-7xl mx-auto">
        {/* Time Range Selector */}
        <div className="flex gap-2 mb-8">
          {[7, 30, 90].map((days) => (
            <button
              key={days}
              onClick={() => setTimeRange(days)}
              className={`px-4 py-2 rounded-lg font-600 text-sm transition ${
                timeRange === days
                  ? 'btn-primary'
                  : 'border border-white/20 text-white/60 hover:bg-white/5'
              }`}
            >
              Last {days} days
            </button>
          ))}
        </div>

        {loading ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <div className="inline-block">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-white/20 border-t-white"></div>
            </div>
            <p className="text-white/60 mt-6">Loading analytics...</p>
          </div>
        ) : metrics ? (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatCard
                icon={FileText}
                label="Total Posts"
                value={metrics.totalPosts}
              />
              <StatCard
                icon={Eye}
                label="Total Views"
                value={metrics.totalViews.toLocaleString()}
              />
              <StatCard
                icon={Link2}
                label="Total Clicks"
                value={metrics.totalClicks.toLocaleString()}
              />
              <StatCard
                icon={Share2}
                label="Total Shares"
                value={metrics.totalShares.toLocaleString()}
              />
            </div>

            {/* Engagement Rate */}
            <div className="glass-card rounded-2xl p-8 mb-8">
              <h2 className="text-2xl font-black mb-4">
                Average Engagement
              </h2>
              <div className="text-5xl text-blue-400 font-bold">
                {metrics.averageEngagementRate.toFixed(2)}%
              </div>
              <p className="text-white/60 mt-2">
                How well your content resonates with your audience
              </p>
            </div>

            {/* Platform Breakdown */}
            {Object.keys(metrics.platformBreakdown).length > 0 && (
              <div className="glass-card rounded-2xl p-8 mb-8">
                <h2 className="text-2xl font-black mb-6">
                  Performance by Platform
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Object.entries(metrics.platformBreakdown).map(([platform, data]: any) => (
                    <div
                      key={platform}
                      className="border border-white/10 rounded-lg p-4"
                    >
                      <h3 className="font-600 text-white capitalize mb-3">
                        {platform}
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-white/60">Posts:</span>
                          <span className="font-600 text-white">{data.posts}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Views:</span>
                          <span className="font-600 text-white">{data.views.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Clicks:</span>
                          <span className="font-600 text-white">{data.clicks.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Shares:</span>
                          <span className="font-600 text-white">{data.shares.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between border-t border-white/10 pt-2">
                          <span className="text-white/60">Avg Engagement:</span>
                          <span className="font-600 text-blue-400">
                            {(data.avgEngagement / data.posts).toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Performing Post */}
            {metrics.topPost && (
              <div className="glass-card rounded-2xl p-8">
                <h2 className="text-2xl font-black mb-4">
                  Top Performing Post
                </h2>
                <div className="border border-white/10 rounded-lg p-4 bg-white/5">
                  <h3 className="font-600 text-white mb-2">
                    {metrics.topPost.title || 'Untitled'}
                  </h3>
                  <p className="text-white/60 text-sm mb-4">
                    on {metrics.topPost.platform}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-white/60 mb-1">Views</p>
                      <p className="text-2xl font-bold text-white">
                        {metrics.topPost.views || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-white/60 mb-1">Clicks</p>
                      <p className="text-2xl font-bold text-white">
                        {metrics.topPost.clicks || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-white/60 mb-1">Likes</p>
                      <p className="text-2xl font-bold text-white">
                        {metrics.topPost.likes || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-white/60 mb-1">Engagement</p>
                      <p className="text-2xl font-bold text-blue-400">
                        {(metrics.topPost.engagement_rate || 0).toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="glass-card rounded-2xl p-12 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-white/10 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-8 h-8 text-white/70" />
              </div>
            </div>
            <p className="text-white/60 mb-4">No analytics data available yet</p>
            <p className="text-sm text-white/50">
              Analytics data will appear once you publish content to your connected platforms
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
