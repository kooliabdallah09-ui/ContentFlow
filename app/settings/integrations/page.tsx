'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { getSupabase } from '@/lib/auth'
import { showSuccess, showError } from '@/lib/notifications'

interface Integration {
  id: string
  platform: string
  account_name?: string
  connected_at: string
}

const PlatformLogo = ({ id }: { id: string }) => {
  switch (id) {
    case 'instagram':
      return (
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <defs>
            <radialGradient id="ig-grad" cx="30%" cy="107%" r="130%">
              <stop offset="0%" stopColor="#fdf497" />
              <stop offset="5%" stopColor="#fdf497" />
              <stop offset="45%" stopColor="#fd5949" />
              <stop offset="60%" stopColor="#d6249f" />
              <stop offset="90%" stopColor="#285AEB" />
            </radialGradient>
          </defs>
          <rect width="36" height="36" rx="9" fill="url(#ig-grad)" />
          <rect x="10" y="10" width="16" height="16" rx="4.5" stroke="white" strokeWidth="2" fill="none" />
          <circle cx="18" cy="18" r="4" stroke="white" strokeWidth="2" fill="none" />
          <circle cx="24" cy="12" r="1.2" fill="white" />
        </svg>
      )
    case 'tiktok':
      return (
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <rect width="36" height="36" rx="9" fill="#010101" />
          <path d="M23.5 8h-3.3v13.5a3.2 3.2 0 01-3.2 3.1 3.2 3.2 0 01-3.2-3.1 3.2 3.2 0 013.2-3.1c.3 0 .6 0 .9.1V15a6.5 6.5 0 00-.9-.1 6.5 6.5 0 00-6.5 6.5A6.5 6.5 0 0017 28a6.5 6.5 0 006.5-6.5V14a9.8 9.8 0 005.8 1.9v-3.3a6.5 6.5 0 01-5.8-4.6z" fill="white" />
          <path d="M23.5 8h-3.3v13.5a3.2 3.2 0 01-3.2 3.1 3.2 3.2 0 01-3.2-3.1 3.2 3.2 0 013.2-3.1c.3 0 .6 0 .9.1V15a6.5 6.5 0 00-.9-.1 6.5 6.5 0 00-6.5 6.5A6.5 6.5 0 0017 28a6.5 6.5 0 006.5-6.5V14a9.8 9.8 0 005.8 1.9v-3.3a6.5 6.5 0 01-5.8-4.6z" fill="#69C9D0" fillOpacity="0.5" />
        </svg>
      )
    case 'linkedin':
      return (
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <rect width="36" height="36" rx="9" fill="#0A66C2" />
          <path d="M12 14h3v10h-3V14zm1.5-4.5a1.75 1.75 0 110 3.5 1.75 1.75 0 010-3.5zM17 14h2.9v1.4h.1c.4-.8 1.4-1.6 2.9-1.6 3.1 0 3.6 2 3.6 4.7V24h-3v-4.8c0-1.1 0-2.6-1.6-2.6s-1.9 1.3-1.9 2.5V24H17V14z" fill="white" />
        </svg>
      )
    case 'twitter':
      return (
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <rect width="36" height="36" rx="9" fill="#000000" />
          <path d="M20.3 16.3L26.5 9h-1.5l-5.3 6.2L15.3 9H10l6.5 9.5L10 27h1.5l5.7-6.6 4.5 6.6H27L20.3 16.3zm-2 2.3l-.7-1-5.3-7.6h2.3l4.3 6.2.7 1 5.6 8h-2.3l-4.6-6.6z" fill="white" />
        </svg>
      )
    case 'youtube':
      return (
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <rect width="36" height="36" rx="9" fill="#FF0000" />
          <path d="M28.5 13.5a2.5 2.5 0 00-1.8-1.8C25 11.2 18 11.2 18 11.2s-7 0-8.7.5a2.5 2.5 0 00-1.8 1.8C7 15.2 7 18 7 18s0 2.8.5 4.5a2.5 2.5 0 001.8 1.8c1.7.5 8.7.5 8.7.5s7 0 8.7-.5a2.5 2.5 0 001.8-1.8c.5-1.7.5-4.5.5-4.5s0-2.8-.5-4.5z" fill="white" />
          <path d="M15.5 21.2l5.8-3.2-5.8-3.2v6.4z" fill="#FF0000" />
        </svg>
      )
    case 'facebook':
      return (
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <rect width="36" height="36" rx="9" fill="#1877F2" />
          <path d="M22 18h-2.7v9H16v-9h-2v-3h2v-1.8C16 11 17.3 9 20 9h2.5v3H21c-.6 0-1 .4-1 1V15H23l-.3 3H20v9h-2.7V18H22z" fill="white" />
        </svg>
      )
    default:
      return <div style={{ width: 36, height: 36, background: 'var(--border)', borderRadius: 9 }} />
  }
}

const platforms = [
  { id: 'instagram', name: 'Instagram', connectUrl: '/api/integrations/connect/instagram' },
  { id: 'tiktok', name: 'TikTok', connectUrl: '/api/integrations/connect/tiktok' },
  { id: 'linkedin', name: 'LinkedIn', connectUrl: '/api/integrations/connect/linkedin' },
  { id: 'twitter', name: 'X (Twitter)', connectUrl: '/api/integrations/twitter/connect' },
  { id: 'youtube', name: 'YouTube', connectUrl: '/api/integrations/connect/youtube' },
  { id: 'facebook', name: 'Facebook', connectUrl: '/api/integrations/connect/facebook' },
]

export default function IntegrationsPage() {
  const searchParams = useSearchParams()
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)

  const loadIntegrations = useCallback(async () => {
    try {
      setLoading(true)
      const supabase = getSupabase()
      if (!supabase) return
      const { data: sessionData } = await supabase.auth.getSession()
      const userId = sessionData.session?.user.id
      if (!userId) return
      const res = await fetch(`/api/integrations/status?userId=${encodeURIComponent(userId)}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const json = await res.json()
      setIntegrations(json.integrations || [])
    } catch (error) {
      console.error('Failed to load integrations:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadIntegrations()
  }, [loadIntegrations])

  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    if (success) {
      const name = platforms.find(p => p.id === success || success.startsWith(p.id))?.name || success
      showSuccess('Connected!', `${name} connected successfully`)
      window.history.replaceState({}, '', '/settings/integrations')
      loadIntegrations()
    } else if (error) {
      const messages: Record<string, string> = {
        instagram_not_configured: 'Instagram app not configured',
        tiktok_not_configured: 'TikTok app not configured — add TIKTOK_CLIENT_KEY',
        linkedin_not_configured: 'LinkedIn app not configured — add LINKEDIN_CLIENT_ID',
        youtube_not_configured: 'YouTube app not configured — add GOOGLE_CLIENT_ID',
        invalid_state: 'Security check failed, please try again',
        not_authenticated: 'You must be logged in to connect',
        callback_error: 'OAuth callback failed, check server logs',
      }
      showError('Connection failed', messages[error] || error)
      window.history.replaceState({}, '', '/settings/integrations')
    }
  }, [searchParams])

  const handleConnect = async (connectUrl: string) => {
    const supabase = getSupabase()
    let userId = ''
    if (supabase) {
      const { data } = await supabase.auth.getSession()
      userId = data.session?.user.id || ''
    }
    // Pass userId as query param — more reliable than cookies on production
    const url = userId ? `${connectUrl}?userId=${encodeURIComponent(userId)}` : connectUrl
    window.location.href = url
  }

  const handleDisconnect = async (platform: string) => {
    if (!confirm(`Disconnect ${platform}?`)) return
    try {
      setDisconnecting(platform)
      const supabase = getSupabase()
      if (!supabase) return
      const { data: sessionData } = await supabase.auth.getSession()
      const userId = sessionData.session?.user.id
      if (!userId) return
      const res = await fetch('/api/integrations/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, userId }),
      })
      if (!res.ok) throw new Error('Failed')
      setIntegrations(prev => prev.filter(i => i.platform !== platform))
      showSuccess('Disconnected', `${platform} disconnected`)
    } catch {
      showError('Error', 'Failed to disconnect')
    } finally {
      setDisconnecting(null)
    }
  }

  return (
    <div className="content">
      <div className="page-head">
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px', overflowX: 'auto' }}>
          <a href="/settings/brand" style={{ padding: '8px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--ink-dim)', textDecoration: 'none', whiteSpace: 'nowrap' }}>Brand</a>
          <a href="/settings/account" style={{ padding: '8px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--ink-dim)', textDecoration: 'none', whiteSpace: 'nowrap' }}>Account</a>
          <a href="/settings/billing" style={{ padding: '8px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--ink-dim)', textDecoration: 'none', whiteSpace: 'nowrap' }}>Billing</a>
          <a href="/settings/integrations" style={{ padding: '8px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--accent)', borderBottom: '2px solid var(--accent)', textDecoration: 'none', whiteSpace: 'nowrap' }}>Integrations</a>
        </div>
        <h1 className="page-title">Connect Your <em>Platforms</em></h1>
        <p className="page-sub">Automatically publish your content to your social media accounts.</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', opacity: 0.5, fontSize: '13px' }}>
          Loading...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', maxWidth: '1200px' }}>
          {platforms.map((platform) => {
            const integration = integrations.find(i => i.platform === platform.id)
            const isConnected = !!integration
            const isDisconnecting = disconnecting === platform.id

            return (
              <div
                key={platform.id}
                style={{
                  background: 'var(--surface)',
                  border: `1px solid ${isConnected ? 'var(--good)' : 'var(--border)'}`,
                  borderRadius: 'var(--r-lg)',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <PlatformLogo id={platform.id} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ margin: '0 0 2px 0', fontSize: '15px', fontWeight: 600, color: 'var(--ink)' }}>
                      {platform.name}
                    </h3>
                    {isConnected ? (
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--good)', fontWeight: 500 }}>
                        {integration.account_name ? `@${integration.account_name}` : 'Connected'}
                      </p>
                    ) : (
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--ink-dim)' }}>
                        Not connected
                      </p>
                    )}
                  </div>
                  {isConnected && (
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--good)', flexShrink: 0 }} />
                  )}
                </div>

                <button
                  onClick={() =>
                    isConnected
                      ? handleDisconnect(platform.id)
                      : handleConnect(platform.connectUrl)
                  }
                  disabled={isDisconnecting}
                  className={isConnected ? 'btn btn-ghost' : 'btn btn-primary'}
                  style={{ padding: '10px 12px', fontSize: '13px', opacity: isDisconnecting ? 0.6 : 1 }}
                >
                  {isDisconnecting ? 'Disconnecting...' : isConnected ? 'Disconnect' : 'Connect'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
