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

// ── Platform SVG logos ────────────────────────────────────────────────────────

function GoogleDriveLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
      <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
      <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 27h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
    </svg>
  )
}

function YouTubeLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 0 0 .5 6.19C0 8.04 0 12 0 12s0 3.96.5 5.81a3.02 3.02 0 0 0 2.12 2.14C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14C24 15.96 24 12 24 12s0-3.96-.5-5.81z" fill="#FF0000"/>
      <path d="M9.75 15.02V8.98L15.5 12l-5.75 3.02z" fill="#fff"/>
    </svg>
  )
}

function TikTokLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.79a4.85 4.85 0 0 1-1.01-.1z" fill="currentColor"/>
    </svg>
  )
}

function InstagramLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="ig-grad" cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#fdf497"/>
          <stop offset="5%" stopColor="#fdf497"/>
          <stop offset="45%" stopColor="#fd5949"/>
          <stop offset="60%" stopColor="#d6249f"/>
          <stop offset="90%" stopColor="#285AEB"/>
        </radialGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#ig-grad)"/>
      <rect x="2" y="2" width="20" height="20" rx="5" fill="none" stroke="#fff" strokeWidth="1.6"/>
      <circle cx="12" cy="12" r="4.5" fill="none" stroke="#fff" strokeWidth="1.6"/>
      <circle cx="17.5" cy="6.5" r="1.2" fill="#fff"/>
    </svg>
  )
}

function FacebookLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973.14.604.375 1.082.73 1.277.31.17.66.159.985-.015.32-.174.625-.498.92-.98l.816-1.352c.495-.806.962-1.48 1.414-2.04.47-.57.935-.971 1.41-1.17.5-.206 1.016-.2 1.56-.01.567.197 1.14.649 1.73 1.33.575.67 1.152 1.554 1.737 2.614.563 1.02 1.136 2.17 1.727 3.445l.143.3c.38.787.823 1.427 1.35 1.883.54.468 1.177.72 1.91.72.687 0 1.305-.235 1.842-.666.5-.4.89-.966 1.17-1.676.28-.7.437-1.52.475-2.414.04-1-.025-2.015-.2-2.985a8.79 8.79 0 0 0-.718-2.29c-.349-.712-.816-1.264-1.414-1.572-.612-.315-1.336-.342-2.152.067-.702.355-1.378.974-2.01 1.82-.585.782-1.106 1.694-1.572 2.714-.113.25-.22.51-.326.775a27.26 27.26 0 0 0-.57-1.115c-.537-1.02-1.096-1.864-1.69-2.51-.61-.666-1.273-1.12-1.997-1.298-.76-.186-1.524-.04-2.23.4a5.74 5.74 0 0 0-1.737 1.904c-.415.71-.7 1.51-.855 2.34-.15.8-.18 1.62-.085 2.386.095.766.32 1.457.675 1.985.374.552.89.905 1.52.96.607.053 1.24-.17 1.89-.66.644-.487 1.27-1.237 1.878-2.222.358-.585.694-1.22 1.01-1.896.067.17.133.34.2.514.476 1.23.942 2.324 1.41 3.273l.117.23c.477.92 1.01 1.67 1.622 2.206.63.553 1.33.84 2.09.84.713 0 1.35-.234 1.898-.68.518-.423.918-.998 1.202-1.71.284-.712.448-1.52.494-2.396.046-.876-.006-1.797-.16-2.72a10.08 10.08 0 0 0-.666-2.383c-.308-.693-.724-1.26-1.25-1.6-.545-.353-1.178-.427-1.868-.17-.64.238-1.264.77-1.863 1.566-.567.757-1.09 1.706-1.573 2.826-.1.24-.2.49-.3.745-.1-.25-.2-.49-.3-.727-.497-1.168-1.036-2.13-1.618-2.858-.6-.75-1.24-1.247-1.92-1.42-.7-.18-1.393-.01-2.02.44a5.05 5.05 0 0 0-1.455 1.69c-.375.68-.613 1.458-.71 2.277-.094.793-.054 1.615.118 2.37.17.75.48 1.392.917 1.847.462.48 1.05.72 1.74.72.653 0 1.28-.246 1.875-.72.585-.47 1.146-1.154 1.683-2.042.37-.607.722-1.284 1.057-2.02l.014-.03c.337.77.687 1.46 1.05 2.073.607.998 1.24 1.76 1.895 2.274.674.527 1.384.797 2.106.797.69 0 1.326-.234 1.874-.683.515-.42.912-.988 1.193-1.69.28-.7.436-1.51.472-2.397.035-.886-.02-1.808-.178-2.735-.156-.928-.434-1.762-.84-2.47-.424-.74-.974-1.32-1.653-1.66-.706-.356-1.497-.384-2.34 0z" fill="#0082FB"/>
    </svg>
  )
}

const LOGOS: Record<string, React.ReactNode> = {
  'google-drive': <GoogleDriveLogo />,
  youtube: <YouTubeLogo />,
  tiktok: <TikTokLogo />,
  instagram: <InstagramLogo />,
  facebook: <FacebookLogo />,
}

// ─────────────────────────────────────────────────────────────────────────────

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

      const params = new URLSearchParams(window.location.search)
      const success = params.get('success')
      const error = params.get('error')
      if (success) {
        showSuccess(success === 'google-drive' ? 'Google Drive connected' : 'Connected successfully')
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
        <IntegrationCard
          platformKey="google-drive"
          title="Google Drive"
          description="All your generations are automatically saved to a ContentFlow folder in your Drive and power your content library."
          badge="Library"
          connected={!!integrations['google-drive']}
          accountName={integrations['google-drive']?.account_name}
          connectedAt={integrations['google-drive']?.connected_at}
          disconnecting={disconnecting === 'google-drive'}
          onConnect={() => { window.location.href = `/api/integrations/connect/google-drive?userId=${userId}` }}
          onDisconnect={() => disconnect('google-drive')}
        />

        <IntegrationCard
          platformKey="youtube"
          title="YouTube"
          description="Publish videos and UGC content directly to your YouTube channel without leaving ContentFlow."
          badge="Publishing"
          connected={!!integrations['youtube']}
          accountName={integrations['youtube']?.account_name}
          connectedAt={integrations['youtube']?.connected_at}
          disconnecting={disconnecting === 'youtube'}
          onConnect={() => { window.location.href = `/api/integrations/connect/youtube?userId=${userId}` }}
          onDisconnect={() => disconnect('youtube')}
        />

        {([
          { key: 'tiktok', title: 'TikTok', desc: 'Publish and schedule content directly to TikTok.' },
          { key: 'instagram', title: 'Instagram', desc: 'Publish Reels and posts directly to your Instagram account.' },
          { key: 'facebook', title: 'Facebook', desc: 'Post videos and content directly to your Facebook page.' },
        ] as const).map(({ key, title, desc }) => (
          <IntegrationCard
            key={key}
            platformKey={key}
            title={title}
            description={desc}
            connected={false}
            comingSoon
          />
        ))}
      </div>
    </main>
  )
}

function IntegrationCard({
  platformKey, title, description, badge,
  connected, accountName, connectedAt,
  disconnecting, comingSoon,
  onConnect, onDisconnect,
}: {
  platformKey: string
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
      <div style={{
        width: 44, height: 44, borderRadius: 10,
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {LOGOS[platformKey]}
      </div>

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
