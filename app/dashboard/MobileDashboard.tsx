'use client'

// Purpose-built mobile dashboard. Instagram-style feed layout: greeting card
// on top, a horizontal-scroll row of primary Generate actions, then a
// vertical stack of Recent Items. No sidebar assumptions, no wide tables.
//
// Data fetching is shared with the desktop dashboard — parent passes it as
// props so we don't duplicate the effect.

import Link from 'next/link'
import { Sparkles, Camera, Video, Layers, ArrowRight } from 'lucide-react'

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

// Quick-action tile — sits in a horizontal scroll row at the top of the
// dashboard. Big colored square, icon, label. Thumb-reachable.
interface QuickAction {
  href: string
  label: string
  sub: string
  icon: React.ReactNode
  accent: string    // subtle background tint
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    href: '/generate/ugc',
    label: 'UGC Ad',
    sub: 'Talking head video',
    icon: <Sparkles size={20} />,
    accent: 'linear-gradient(135deg, #FFE1B8 0%, #FFCC7A 100%)',
  },
  {
    href: '/generate/social',
    label: 'Social',
    sub: 'Carousel + captions',
    icon: <Layers size={20} />,
    accent: 'linear-gradient(135deg, #D4E4FF 0%, #A8C4F5 100%)',
  },
  {
    href: '/generate/image',
    label: 'Image',
    sub: 'Product shot / hero',
    icon: <Camera size={20} />,
    accent: 'linear-gradient(135deg, #E4D4FF 0%, #C0A8F5 100%)',
  },
  {
    href: '/generate/video',
    label: 'Video',
    sub: 'Any format',
    icon: <Video size={20} />,
    accent: 'linear-gradient(135deg, #D4FFE4 0%, #8FE0B0 100%)',
  },
]

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  if (secs < 172800) return 'yesterday'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function MobileDashboard({
  userName,
  greeting,
  recentItems,
  recentLoading,
  credits,
  brandName,
}: MobileDashboardProps) {
  return (
    <div style={{ padding: '14px 16px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Greeting + brand line */}
      <div>
        <div style={{ fontSize: 12, color: 'var(--ink-mute)', letterSpacing: 0.4, textTransform: 'uppercase', fontFamily: 'var(--font-mono, monospace)', marginBottom: 4 }}>
          {greeting}
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
          {userName}
        </h1>
        {brandName && (
          <div style={{ fontSize: 13.5, color: 'var(--ink-mute)', marginTop: 4 }}>
            Working on <strong style={{ color: 'var(--ink)' }}>{brandName}</strong>
          </div>
        )}
      </div>

      {/* Credits chip — big, tappable, drives to billing */}
      {credits && (
        <Link
          href="/settings/billing"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px', borderRadius: 14,
            background: 'linear-gradient(120deg, #FBF3D9, #F5E4A9)',
            color: '#5C3E00', textDecoration: 'none',
            border: '1px solid #E8D188',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: '#8A6B1B' }}>
              Credits
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1, fontFamily: 'var(--font-mono, monospace)' }}>
              {credits.balance.toLocaleString()}
              <span style={{ fontSize: 13, color: '#8A6B1B', fontWeight: 500, marginLeft: 6 }}>cr</span>
            </div>
            <div style={{ fontSize: 12, color: '#8A6B1B', marginTop: 2 }}>
              {credits.plan.charAt(0).toUpperCase() + credits.plan.slice(1)} plan · resets {new Date(credits.resetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
          </div>
          <ArrowRight size={20} strokeWidth={2} />
        </Link>
      )}

      {/* Quick actions — horizontal scroll row */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--ink)' }}>
            Create
          </h2>
          <Link href="/generate/ugc" style={{ fontSize: 12.5, color: 'var(--ink-mute)', textDecoration: 'none' }}>
            All tools →
          </Link>
        </div>
        <div style={{
          display: 'flex', gap: 10,
          overflowX: 'auto', paddingBottom: 4,
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          margin: '0 -16px', padding: '0 16px 4px',
        }}>
          {QUICK_ACTIONS.map(a => (
            <Link
              key={a.href}
              href={a.href}
              style={{
                display: 'flex', flexDirection: 'column',
                justifyContent: 'space-between',
                minWidth: 148, height: 132,
                padding: 14, borderRadius: 14,
                background: a.accent,
                color: '#2A1E00',
                textDecoration: 'none',
                scrollSnapAlign: 'start',
                boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
              }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: 10,
                background: 'rgba(255,255,255,0.55)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#3A2A00',
              }}>
                {a.icon}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>{a.label}</div>
                <div style={{ fontSize: 12, opacity: 0.72, marginTop: 2 }}>{a.sub}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent items */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--ink)' }}>
            Recent
          </h2>
          <Link href="/library" style={{ fontSize: 12.5, color: 'var(--ink-mute)', textDecoration: 'none' }}>
            All →
          </Link>
        </div>
        {recentLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                height: 76, borderRadius: 12,
                background: 'var(--surface-2, rgba(0,0,0,0.04))',
                animation: 'cf-pulse 1.4s ease-in-out infinite',
                animationDelay: `${i * 0.1}s`,
              }} />
            ))}
            <style>{`
              @keyframes cf-pulse {
                0%, 100% { opacity: 0.55; }
                50% { opacity: 0.85; }
              }
            `}</style>
          </div>
        ) : recentItems.length === 0 ? (
          <div style={{
            padding: 24, borderRadius: 14,
            border: '1px dashed var(--border)',
            textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13.5,
          }}>
            Nothing here yet. Tap a Create tool above to make your first asset.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentItems.map(item => (
              <Link
                key={item.id}
                href={`/library?id=${item.id}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: 10, borderRadius: 12,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  textDecoration: 'none', color: 'var(--ink)',
                }}
              >
                <div style={{
                  width: 56, height: 56, borderRadius: 10, flexShrink: 0,
                  overflow: 'hidden', background: 'var(--surface-2, rgba(0,0,0,0.06))',
                  position: 'relative',
                }}>
                  {item.metadata?.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.metadata.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                  {item.metadata?.video && !item.metadata?.image && (
                    <video src={item.metadata.video} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.metadata?.productName ?? item.content_type.replace(/_/g, ' ')}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 2 }}>
                    {item.content_type.replace(/_/g, ' ')} · {timeAgo(item.created_at)}
                  </div>
                </div>
                <ArrowRight size={16} strokeWidth={2} color="var(--ink-mute)" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
