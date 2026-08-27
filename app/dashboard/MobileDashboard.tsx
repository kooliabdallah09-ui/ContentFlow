'use client'

// Editorial-warm mobile Dashboard, matching the Claude design artifact.
// Layout: serif greeting → dark credits card → Create 2×2 grid → Recent
// horizontal scroll. Same data source as the desktop dashboard, passed
// in from the parent page component.

import Link from 'next/link'

interface RecentItem {
  id: string
  content_type: string
  storage_url: string
  metadata: { productName?: string; video?: string; image?: string } | null
  created_at: string
  status: string
}

interface CreditsData {
  balance: number
  plan: string
  monthlyCredits: number
  resetDate: string
}

interface MobileDashboardProps {
  userName: string
  greeting: string
  recentItems: RecentItem[]
  recentLoading: boolean
  credits: CreditsData | null
  brandName: string | null
}

const CREATE_TILES = [
  { href: '/generate/ugc',    label: 'UGC Package', sub: 'Full talking-head ad',      cost: '40 cr',      tint: '#F1E6C9' },
  { href: '/generate/image',  label: 'Image',       sub: 'Product & creative shots',  cost: 'from 8 cr',  tint: '#E8EDE4' },
  { href: '/generate/voice',  label: 'Voiceover',   sub: 'Script to studio audio',    cost: '5 cr',       tint: '#F0E7E4' },
  { href: '/campaigns',       label: 'Campaign',    sub: 'A month, planned',          cost: '40 cr',      tint: '#EDEAE0' },
]

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  if (secs < 172800) return 'Yesterday'
  const days = Math.floor(secs / 86400)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function contentTypeLabel(t: string): string {
  const s = t.toLowerCase()
  if (s.includes('video') || s.includes('ugc')) return 'VIDEO'
  if (s.includes('image') || s.includes('photo')) return 'IMAGE'
  if (s.includes('audio') || s.includes('voice')) return 'AUDIO'
  if (s.includes('carousel') || s.includes('social')) return 'SOCIAL'
  return t.split('_')[0].toUpperCase().slice(0, 6)
}

export function MobileDashboard({
  userName,
  greeting,
  recentItems,
  recentLoading,
  credits,
  brandName,
}: MobileDashboardProps) {
  // Strip trailing "," so we can drop the name on its own line.
  const cleanGreeting = greeting.replace(/,\s*$/, '')
  const firstName = userName.split(' ')[0]

  // Progress bar shows how much of the monthly allocation is left.
  const monthly = credits?.monthlyCredits ?? 0
  const balance = credits?.balance ?? 0
  const pct = monthly > 0 ? Math.min(100, Math.round((balance / monthly) * 100)) : 0

  const resetLabel = credits?.resetDate
    ? new Date(credits.resetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '—'

  const planLabel = (credits?.plan ?? 'free').replace(/^\w/, c => c.toUpperCase()) + ' plan'

  return (
    <div style={{ padding: '18px 18px 30px' }}>
      {/* Greeting */}
      <div style={{
        fontFamily: 'var(--m-serif)',
        fontSize: 29, lineHeight: 1.15, letterSpacing: '-0.02em',
        marginBottom: 3, color: 'var(--m-ink)',
      }}>
        {cleanGreeting},<br />
        <em>{firstName}.</em>
      </div>
      <div style={{ fontSize: 13, color: 'var(--m-mute)', marginBottom: 16 }}>
        {brandName ? `Working on ${brandName}.` : 'What are we making today?'}
      </div>

      {/* Dark credits card */}
      {credits && (
        <div style={{
          background: 'var(--m-dark-card)',
          borderRadius: 20, padding: '18px 20px', color: '#fff',
          marginBottom: 18,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{
                fontSize: 9.5, fontWeight: 600, letterSpacing: '0.11em',
                textTransform: 'uppercase', color: 'var(--m-credits-hint)',
                marginBottom: 5, fontFamily: 'var(--m-mono)',
              }}>
                Available credits
              </div>
              <div style={{
                fontFamily: 'var(--m-serif)', fontSize: 36,
                lineHeight: 1, letterSpacing: '-0.02em',
              }}>
                {balance.toLocaleString()}
              </div>
            </div>
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
              textTransform: 'uppercase',
              background: 'rgba(255,255,255,0.12)',
              borderRadius: 99, padding: '5px 10px',
            }}>
              {planLabel}
            </span>
          </div>
          <div style={{
            height: 4, background: 'rgba(255,255,255,0.14)',
            borderRadius: 99, margin: '14px 0 10px',
          }}>
            <div style={{
              height: '100%', width: `${pct}%`,
              background: 'var(--m-credits-fill)', borderRadius: 99,
            }} />
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 11.5, color: '#B5B29E' }}>
              Resets {resetLabel} · {monthly.toLocaleString()}/mo allocation
            </span>
            <Link href="/settings/billing" data-press style={{
              fontSize: 12, fontWeight: 600, color: '#fff',
              textDecoration: 'underline', textUnderlineOffset: 3,
            }}>
              Upgrade
            </Link>
          </div>
        </div>
      )}

      {/* Start creating */}
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>Start creating</div>
        <span style={{
          fontSize: 11, color: 'var(--m-mute-2)', whiteSpace: 'nowrap',
        }}>
          Costs shown per run
        </span>
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
        marginBottom: 20,
      }}>
        {CREATE_TILES.map(t => (
          <Link key={t.href} href={t.href} data-press style={{
            background: 'var(--m-card)',
            border: '1px solid var(--m-border)',
            borderRadius: 16, padding: 14, minHeight: 104,
            display: 'flex', flexDirection: 'column',
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(30,26,16,0.04)',
            textDecoration: 'none', color: 'var(--m-ink)',
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9,
              background: t.tint, marginBottom: 10, flexShrink: 0,
            }} />
            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 2 }}>
              {t.label}
            </div>
            <div style={{ fontSize: 11, color: 'var(--m-mute)', lineHeight: 1.4 }}>
              {t.sub}
            </div>
            <div style={{
              marginTop: 'auto', paddingTop: 8,
              fontFamily: 'var(--m-mono)', fontSize: 10.5,
              fontWeight: 600, color: '#8A6420', whiteSpace: 'nowrap',
            }}>
              {t.cost}
            </div>
          </Link>
        ))}
      </div>

      {/* Recent */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>Recent</div>
        <Link href="/library" style={{
          fontSize: 12, color: 'var(--m-mute)', textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}>
          Library →
        </Link>
      </div>
      {recentLoading ? (
        <div className="m-noscroll" style={{
          display: 'flex', gap: 10, overflowX: 'auto',
          margin: '0 -18px', padding: '0 18px 4px',
        }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              flexShrink: 0, width: 112,
            }}>
              <div style={{
                height: 140, borderRadius: 14,
                background: 'var(--m-surface-3)',
                animation: 'cf-m-pulse 1.4s ease-in-out infinite',
                animationDelay: `${i * 0.1}s`,
                marginBottom: 6,
              }} />
              <div style={{ height: 12, width: '70%', background: 'var(--m-surface-3)', borderRadius: 4, marginBottom: 4 }} />
              <div style={{ height: 10, width: '45%', background: 'var(--m-surface-3)', borderRadius: 4 }} />
            </div>
          ))}
          <style>{`
            @keyframes cf-m-pulse {
              0%, 100% { opacity: 0.55; }
              50% { opacity: 0.85; }
            }
          `}</style>
        </div>
      ) : recentItems.length === 0 ? (
        <div style={{
          padding: 22, borderRadius: 14,
          border: `1.5px dashed var(--m-border-2)`,
          textAlign: 'center', color: 'var(--m-mute-2)',
          fontSize: 12.5,
        }}>
          Nothing here yet. Tap Create above to make your first asset.
        </div>
      ) : (
        <div className="m-noscroll" style={{
          display: 'flex', gap: 10, overflowX: 'auto',
          margin: '0 -18px', padding: '0 18px 4px',
        }}>
          {recentItems.map(item => (
            <Link
              key={item.id}
              href={`/library?id=${item.id}`}
              data-press
              style={{
                flexShrink: 0, width: 112,
                textDecoration: 'none', color: 'var(--m-ink)',
              }}
            >
              <div style={{
                height: 140, borderRadius: 14,
                background: 'var(--m-surface-3)',
                display: 'grid', placeItems: 'center',
                fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em',
                color: 'var(--m-mute-3)',
                fontFamily: 'var(--m-mono)',
                overflow: 'hidden', position: 'relative',
                marginBottom: 6,
              }}>
                {item.metadata?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.metadata.image} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : item.metadata?.video ? (
                  <video src={item.metadata.video} muted playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  contentTypeLabel(item.content_type)
                )}
              </div>
              <div style={{
                fontSize: 11.5, fontWeight: 600,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {item.metadata?.productName ?? item.content_type.replace(/_/g, ' ')}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--m-mute-2)' }}>
                {timeAgo(item.created_at)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
