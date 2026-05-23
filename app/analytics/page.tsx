'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/auth'
import { showError } from '@/lib/notifications'

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

const StatCard = ({ label, value, change }: any) => (
  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '16px' }}>
    <p className="eyebrow" style={{ marginBottom: '6px' }}>{label}</p>
    <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>{value}</div>
    {change && (
      <p style={{ fontSize: '11px', fontWeight: 600, color: change > 0 ? 'var(--good)' : 'var(--danger)' }}>
        {change > 0 ? '↑' : '↓'} {Math.abs(change)}%
      </p>
    )}
  </div>
)

export default function AnalyticsPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState(30)
  const [creditUsage, setCreditUsage] = useState<any>(null)

  useEffect(() => {
    fetchMetrics()
  }, [timeRange])

  const fetchMetrics = async () => {
    try {
      setLoading(true)
      const supabase = getSupabase()
      if (!supabase) {
        setLoading(false)
        return
      }

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session?.access_token) {
        setLoading(false)
        return
      }

      // Fetch both social metrics and credit usage
      const [metricsResponse, creditResponse] = await Promise.all([
        fetch(`/api/analytics/metrics?days=${timeRange}`),
        fetch('/api/analytics', {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        }),
      ])

      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json()
        setMetrics(metricsData.metrics)
      }

      if (creditResponse.ok) {
        const creditData = await creditResponse.json()
        setCreditUsage(creditData)
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
      showError('Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="content">
      <div className="page-head">
        <div className="page-meta">
          <span className="dot" />
          <span className="eyebrow">Performance Tracking</span>
        </div>
        <h1 className="page-title">Analytics <em>Dashboard</em></h1>
        <p className="page-sub">Track your content performance, engagement, and credits usage across all platforms.</p>
      </div>

      {/* Time Range Selector */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        {[7, 30, 90].map((days) => (
          <button
            key={days}
            onClick={() => setTimeRange(days)}
            className={timeRange === days ? 'btn btn-primary' : 'btn btn-ghost'}
            style={{ fontSize: '13px' }}
          >
            Last {days} days
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '4px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--ink)', fontSize: '14px' }}>Loading analytics...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : metrics ? (
        <>
          {/* Key Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            <StatCard label="Total Posts" value={metrics.totalPosts} />
            <StatCard label="Total Views" value={metrics.totalViews.toLocaleString()} />
            <StatCard label="Total Clicks" value={metrics.totalClicks.toLocaleString()} />
            <StatCard label="Total Shares" value={metrics.totalShares.toLocaleString()} />
          </div>

          {/* Engagement Rate */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '20px', marginBottom: '24px' }}>
            <div className="section-head">
              <h2 className="section-title">Average Engagement Rate</h2>
            </div>
            <div style={{ fontSize: '40px', fontWeight: 600, color: 'var(--accent)' }}>
              {metrics.averageEngagementRate.toFixed(2)}%
            </div>
            <p className="eyebrow" style={{ marginTop: '8px' }}>How well your content resonates with your audience</p>
          </div>

          {/* Credit Usage Analytics */}
          {creditUsage && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '16px' }}>
                  <p className="eyebrow" style={{ marginBottom: '8px' }}>Total Generated</p>
                  <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>
                    {creditUsage.totalGenerated}
                  </div>
                  <p className="eyebrow">content pieces</p>
                </div>

                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '16px' }}>
                  <p className="eyebrow" style={{ marginBottom: '8px' }}>Credits Used</p>
                  <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--accent)', marginBottom: '4px' }}>
                    {creditUsage.totalCreditsUsed}
                  </div>
                  <p className="eyebrow">total credits</p>
                </div>
              </div>

              {/* Generation by Type */}
              {Object.keys(creditUsage.generationsByType).length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <div className="section-head">
                    <h2 className="section-title">Content Generation by Type</h2>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                    {Object.entries(creditUsage.generationsByType).map(([type, count]: any) => (
                      <div key={type} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '14px' }}>
                        <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '10px', textTransform: 'capitalize' }}>
                          {type.replace('_', ' ')}
                        </h3>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <p className="eyebrow" style={{ marginBottom: '2px' }}>Generated</p>
                            <p style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)' }}>{count}</p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p className="eyebrow" style={{ marginBottom: '2px' }}>Credits</p>
                            <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--accent)' }}>
                              {creditUsage.creditsByType[type] || 0}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Platform Breakdown */}
          {Object.keys(metrics.platformBreakdown).length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div className="section-head">
                <h2 className="section-title">Performance by Platform</h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
                {Object.entries(metrics.platformBreakdown).map(([platform, data]: any) => (
                  <div
                    key={platform}
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '14px' }}
                  >
                    <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '10px', textTransform: 'capitalize' }}>
                      {platform}
                    </h3>
                    <div style={{ fontSize: '12px', color: 'var(--ink-dim)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Posts:</span>
                        <span style={{ color: 'var(--ink)' }}>{data.posts}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Views:</span>
                        <span style={{ color: 'var(--ink)' }}>{data.views.toLocaleString()}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Clicks:</span>
                        <span style={{ color: 'var(--ink)' }}>{data.clicks.toLocaleString()}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Shares:</span>
                        <span style={{ color: 'var(--ink)' }}>{data.shares.toLocaleString()}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '6px', marginTop: '6px' }}>
                        <span>Engagement:</span>
                        <span style={{ color: 'var(--accent)' }}>
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
            <div style={{ marginBottom: '24px' }}>
              <div className="section-head">
                <h2 className="section-title">Top Performing Post</h2>
              </div>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
                  {metrics.topPost.title || 'Untitled'}
                </h3>
                <p className="eyebrow" style={{ marginBottom: '12px' }}>on {metrics.topPost.platform}</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '12px' }}>
                  <div>
                    <p className="eyebrow" style={{ marginBottom: '4px' }}>Views</p>
                    <p style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)' }}>
                      {metrics.topPost.views || 0}
                    </p>
                  </div>
                  <div>
                    <p className="eyebrow" style={{ marginBottom: '4px' }}>Clicks</p>
                    <p style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)' }}>
                      {metrics.topPost.clicks || 0}
                    </p>
                  </div>
                  <div>
                    <p className="eyebrow" style={{ marginBottom: '4px' }}>Likes</p>
                    <p style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)' }}>
                      {metrics.topPost.likes || 0}
                    </p>
                  </div>
                  <div>
                    <p className="eyebrow" style={{ marginBottom: '4px' }}>Engagement</p>
                    <p style={{ fontSize: '18px', fontWeight: 600, color: 'var(--accent)' }}>
                      {(metrics.topPost.engagement_rate || 0).toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📊</div>
          <p style={{ color: 'var(--ink)', fontSize: '14px', marginBottom: '6px' }}>No analytics data available yet</p>
          <p className="eyebrow">Analytics data will appear once you publish content to your connected platforms</p>
        </div>
      )}
    </div>
  )
}
