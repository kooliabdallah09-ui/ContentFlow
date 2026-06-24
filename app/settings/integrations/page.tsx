'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/auth'
import { showError, showSuccess } from '@/lib/notifications'

interface Integration {
  platform: string
  account_name: string
  is_connected: boolean
  connected_at: string
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Record<string, Integration>>({})
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = getSupabase()
      if (!supabase) { setLoading(false); return }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { setLoading(false); return }
      setUserId(session.user.id)

      const { data } = await supabase
        .from('integrations')
        .select('platform, account_name, is_connected, connected_at')
        .eq('user_id', session.user.id)

      const map: Record<string, Integration> = {}
      for (const row of data ?? []) {
        if (row.is_connected) map[row.platform] = row
      }
      setIntegrations(map)

      // Handle OAuth success/error from URL params
      const params = new URLSearchParams(window.location.search)
      const success = params.get('success')
      const error = params.get('error')
      if (success) {
        showSuccess(
          success === 'google-drive' ? 'Google Drive connected' : 'Connected successfully',
        )
        window.history.replaceState({}, '', window.location.pathname)
      }
      if (error) {
        showError(`Connection failed: ${error}`)
        window.history.replaceState({}, '', window.location.pathname)
      }

      setLoading(false)
    }
    load()
  }, [])

  async function disconnect(platform: string) {
    setDisconnecting(platform)
    try {
      const supabase = getSupabase()
      if (!supabase) return
      await supabase
        .from('integrations')
        .update({ is_connected: false, access_token: null, refresh_token: null })
        .eq('user_id', userId)
        .eq('platform', platform)
      setIntegrations(prev => {
        const next = { ...prev }
        delete next[platform]
        return next
      })
      showSuccess('Disconnected')
    } catch {
      showError('Failed to disconnect')
    } finally {
      setDisconnecting(null)
    }
  }

  if (loading) {
    return (
      <main style={{ maxWidth: 680, margin: '0 auto', padding: '42px 32px' }}>
        <p style={{ color: 'var(--ink-dim)', fontSize: 14 }}>Loading…</p>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: 680, margin: '0 auto', padding: '42px 32px 90px' }}>
      <header style={{ marginBottom: 36 }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 36, margin: 0 }}>
          Integrations
        </h1>
        <p style={{ fontSize: 14, color: 'var(--ink-dim)', margin: '8px 0 0' }}>
          Connect external services to extend ContentFlow.
        </p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Google Drive */}
        <IntegrationCard
          icon="🗂️"
          title="Google Drive"
          description="All your generations are automatically saved to a ContentFlow folder in your Drive and power your content library."
          badge="Library"
          connected={!!integrations['google-drive']}
          accountName={integrations['google-drive']?.account_name}
          connectedAt={integrations['google-drive']?.connected_at}
          disconnecting={disconnecting === 'google-drive'}
          onConnect={() => {
            window.location.href = `/api/integrations/connect/google-drive?userId=${userId}`
          }}
          onDisconnect={() => disconnect('google-drive')}
        />

        {/* YouTube */}
        <IntegrationCard
          icon="▶️"
          title="YouTube"
          description="Publish videos and UGC content directly to your YouTube channel without leaving ContentFlow."
          badge="Publishing"
          connected={!!integrations['youtube']}
          accountName={integrations['youtube']?.account_name}
          connectedAt={integrations['youtube']?.connected_at}
          disconnecting={disconnecting === 'youtube'}
          onConnect={() => {
            window.location.href = `/api/integrations/connect/youtube?userId=${userId}`
          }}
          onDisconnect={() => disconnect('youtube')}
        />

        {/* Coming soon */}
        {(['TikTok', 'Instagram', 'Meta Ads'] as const).map(name => (
          <IntegrationCard
            key={name}
            icon={name === 'TikTok' ? '🎵' : name === 'Instagram' ? '📸' : '📢'}
            title={name}
            description={`Publish and schedule content directly to ${name}.`}
            connected={false}
            comingSoon
          />
        ))}
      </div>
    </main>
  )
}

function IntegrationCard({
  icon, title, description, badge,
  connected, accountName, connectedAt,
  disconnecting, comingSoon,
  onConnect, onDisconnect,
}: {
  icon: string
  title: string
  description: string
  badge?: string
  connected: boolean
  accountName?: string
  connectedAt?: string
  disconnecting?: boolean
  comingSoon?: boolean
  onConnect?: () => void
  onDisconnect?: () => void
}) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${connected ? 'var(--good, #10b981)' : 'var(--border)'}`,
      borderRadius: 14,
      padding: '18px 20px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 16,
    }}>
      <span style={{ fontSize: 26, flexShrink: 0, marginTop: 2 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{title}</span>
          {badge && (
            <span style={{
              fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em',
              textTransform: 'uppercase', padding: '2px 7px', borderRadius: 20,
              background: 'var(--accent, #6366f1)', color: '#fff',
            }}>
              {badge}
            </span>
          )}
          {comingSoon && (
            <span style={{
              fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em',
              textTransform: 'uppercase', padding: '2px 7px', borderRadius: 20,
              background: 'var(--border)', color: 'var(--ink-dim)',
            }}>
              Soon
            </span>
          )}
        </div>
        <p style={{ fontSize: 13, color: 'var(--ink-dim)', margin: 0, lineHeight: 1.5 }}>
          {description}
        </p>
        {connected && accountName && (
          <p style={{ fontSize: 11.5, color: 'var(--good, #10b981)', margin: '6px 0 0', fontFamily: 'var(--font-mono)' }}>
            Connected as {accountName}
            {connectedAt && ` · ${new Date(connectedAt).toLocaleDateString()}`}
          </p>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>
        {comingSoon ? null : connected ? (
          <button
            onClick={onDisconnect}
            disabled={disconnecting}
            style={{
              padding: '7px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
              border: '1.5px solid var(--border)', background: 'transparent',
              color: 'var(--ink-dim)', cursor: disconnecting ? 'not-allowed' : 'pointer',
              opacity: disconnecting ? 0.5 : 1, whiteSpace: 'nowrap',
            }}
          >
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </button>
        ) : (
          <button
            onClick={onConnect}
            style={{
              padding: '7px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
              border: 'none', background: 'var(--ink)', color: '#fff',
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            Connect
          </button>
        )}
      </div>
    </div>
  )
}
