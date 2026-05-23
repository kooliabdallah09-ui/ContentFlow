'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/auth'
import Link from 'next/link'
import { showSuccess, showError } from '@/lib/notifications'

interface Integration {
  platform: string
  name: string
  icon: string
  description: string
  connected: boolean
  connectedAt?: string
  accountName?: string
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState<string | null>(null)

  useEffect(() => {
    loadIntegrations()
  }, [])

  const loadIntegrations = async () => {
    try {
      const supabase = getSupabase()
      if (!supabase) return

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session?.access_token) return

      const response = await fetch('/api/integrations/list', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      }).catch(() => null)

      if (response?.ok) {
        const data = await response.json()
        setIntegrations(data.integrations || defaultIntegrations)
      } else {
        setIntegrations(defaultIntegrations)
      }
    } catch (error) {
      console.error('Failed to load integrations:', error)
      setIntegrations(defaultIntegrations)
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async (platform: string) => {
    setConnecting(platform)
    try {
      const supabase = getSupabase()
      if (!supabase) throw new Error('Not authenticated')

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session?.access_token) throw new Error('No session')

      const redirectUrl = `/api/integrations/${platform}/connect?redirectTo=${encodeURIComponent(window.location.href)}`
      window.location.href = redirectUrl
    } catch (error) {
      showError('Connection failed', error instanceof Error ? error.message : 'Please try again')
      setConnecting(null)
    }
  }

  const handleDisconnect = async (platform: string) => {
    if (!confirm(`Disconnect ${platform}?`)) return

    try {
      const supabase = getSupabase()
      if (!supabase) throw new Error('Not authenticated')

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session?.access_token) throw new Error('No session')

      const response = await fetch(`/api/integrations/${platform}/disconnect`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) throw new Error('Failed to disconnect')

      setIntegrations((prev) =>
        prev.map((int) =>
          int.platform === platform
            ? { ...int, connected: false, connectedAt: undefined, accountName: undefined }
            : int
        )
      )

      showSuccess('Disconnected', `${platform} has been disconnected`)
    } catch (error) {
      showError('Disconnection failed', error instanceof Error ? error.message : 'Please try again')
    }
  }

  const defaultIntegrations: Integration[] = [
    {
      platform: 'instagram',
      name: 'Instagram',
      icon: '📷',
      description: 'Connect your Instagram account to schedule posts and track engagement',
      connected: false,
    },
    {
      platform: 'twitter',
      name: 'Twitter / X',
      icon: '𝕏',
      description: 'Share your content directly to Twitter and track performance',
      connected: false,
    },
    {
      platform: 'facebook',
      name: 'Facebook',
      icon: '👍',
      description: 'Post to Facebook pages and manage your social presence',
      connected: false,
    },
    {
      platform: 'linkedin',
      name: 'LinkedIn',
      icon: '💼',
      description: 'Share professional content with your LinkedIn network',
      connected: false,
    },
    {
      platform: 'tiktok',
      name: 'TikTok',
      icon: '🎵',
      description: 'Reach millions with short-form video content on TikTok',
      connected: false,
    },
    {
      platform: 'youtube',
      name: 'YouTube',
      icon: '▶️',
      description: 'Upload and manage your YouTube channel',
      connected: false,
    },
  ]

  if (loading) {
    return (
      <div className="content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '4px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--ink-dim)', fontSize: '14px' }}>Loading integrations...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    )
  }

  const connectedCount = integrations.filter((i) => i.connected).length

  return (
    <div className="content">
      <div className="page-head">
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px', overflowX: 'auto' }}>
          <a href="/settings/brand" style={{ padding: '8px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--ink-dim)', textDecoration: 'none', whiteSpace: 'nowrap' }}>Brand</a>
          <a href="/settings/account" style={{ padding: '8px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--ink-dim)', textDecoration: 'none', whiteSpace: 'nowrap' }}>Account</a>
          <a href="/settings/billing" style={{ padding: '8px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--ink-dim)', textDecoration: 'none', whiteSpace: 'nowrap' }}>Billing</a>
          <a href="/settings/integrations" style={{ padding: '8px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--accent)', borderBottom: '2px solid var(--accent)', textDecoration: 'none', whiteSpace: 'nowrap' }}>Integrations</a>
        </div>
        <h1 className="page-title">Integrations</h1>
        <p className="page-sub">Connect your social media accounts to schedule and track your content across platforms.</p>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '20px', marginBottom: '32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div>
            <p className="eyebrow" style={{ marginBottom: '8px' }}>Connected Accounts</p>
            <p style={{ fontSize: '28px', fontWeight: 700, color: 'var(--accent)' }}>
              {connectedCount} / {integrations.length}
            </p>
          </div>
          <div>
            <p className="eyebrow" style={{ marginBottom: '8px' }}>Coverage</p>
            <p style={{ fontSize: '28px', fontWeight: 700, color: 'var(--ink)' }}>
              {Math.round((connectedCount / integrations.length) * 100)}%
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
        {integrations.map((integration) => (
          <div
            key={integration.platform}
            style={{
              background: 'var(--surface)',
              border: integration.connected ? '2px solid var(--accent)' : '1px solid var(--border)',
              borderRadius: 'var(--r-lg)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ fontSize: '32px' }}>{integration.icon}</div>
              {integration.connected && (
                <div style={{ background: 'var(--good)', color: 'white', fontSize: '11px', fontWeight: 600, padding: '4px 8px', borderRadius: 'var(--r-sm)' }}>
                  Connected
                </div>
              )}
            </div>

            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>
              {integration.name}
            </h3>

            <p style={{ fontSize: '13px', color: 'var(--ink-dim)', marginBottom: '16px', flex: 1, lineHeight: 1.5 }}>
              {integration.description}
            </p>

            {integration.connected ? (
              <button
                onClick={() => handleDisconnect(integration.platform)}
                className="btn btn-ghost"
                style={{ width: '100%' }}
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={() => handleConnect(integration.platform)}
                disabled={connecting === integration.platform}
                className="btn btn-primary"
                style={{ width: '100%', opacity: connecting === integration.platform ? 0.6 : 1 }}
              >
                {connecting === integration.platform ? 'Connecting...' : 'Connect'}
              </button>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: '48px', padding: '20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '12px' }}>
          About Integrations
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.6, marginBottom: '12px' }}>
          Connect your social media accounts to ContentFlow and unlock powerful features:
        </p>
        <ul style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.8, listStyle: 'none', padding: 0 }}>
          <li>✓ Schedule content across multiple platforms at once</li>
          <li>✓ Track engagement and performance metrics</li>
          <li>✓ Auto-publish generated content directly to your accounts</li>
          <li>✓ Analyze what content resonates with your audience</li>
        </ul>
      </div>
    </div>
  )
}
