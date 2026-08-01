'use client'

import { useEffect, useState } from 'react'
import { DriveConnectBanner } from '@/components/DriveConnectBanner'
import Link from 'next/link'
import { getSupabase } from '@/lib/auth'

interface LibraryItem {
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

function timeAgo(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  if (secs < 172800) return 'yesterday'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function ArrowUpRight() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17L17 7M9 7h8v8"/>
    </svg>
  )
}

export default function DashboardPage() {
  const [userName, setUserName] = useState('Creator')
  const [recentItems, setRecentItems] = useState<LibraryItem[]>([])
  const [recentLoading, setRecentLoading] = useState(true)
  const [credits, setCredits] = useState<CreditsData | null>(null)

  const today = new Date()
  const dayStr = today.toLocaleDateString('en-US', { weekday: 'long' })
  const dateStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  const yearStr = today.getFullYear()
  const hours = today.getHours()
  const greeting = hours < 12 ? 'Good morning' : hours < 18 ? 'Good afternoon' : 'Good evening'

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) return

    supabase.auth.getUser().then(({ data }: { data: { user: { user_metadata?: { full_name?: string }; email?: string } | null } }) => {
      const name = data.user?.user_metadata?.full_name || data.user?.email?.split('@')[0]
      if (name) setUserName(name)
    })

    supabase.auth.getSession().then(async ({ data }: { data: { session: { access_token?: string } | null } }) => {
      const token = data.session?.access_token
      if (!token) { setRecentLoading(false); return }

      // Parallel fetches
      const [libRes, creditsRes] = await Promise.allSettled([
        fetch('/api/library', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/credits/balance', { headers: { Authorization: `Bearer ${token}` } }),
      ])

      if (libRes.status === 'fulfilled' && libRes.value.ok) {
        const { items } = await libRes.value.json()
        setRecentItems((items || []).slice(0, 4))
      }
      if (creditsRes.status === 'fulfilled' && creditsRes.value.ok) {
        setCredits(await creditsRes.value.json())
      }

      setRecentLoading(false)
    })
  }, [])

  const creditsPercent = credits ? Math.min(100, Math.round((credits.balance / credits.monthlyCredits) * 100)) : null

  return (
    <main className="content">
      <DriveConnectBanner />
      <div className="page-meta">{dayStr} · {dateStr} · {yearStr}</div>
      <h1 className="page-title">
        {greeting}, {userName.charAt(0).toUpperCase() + userName.slice(1)}.<br/>
        <span style={{ color: 'var(--ink-mute)' }}>What are we making <em>today?</em></span>
      </h1>

      {/* Credits banner */}
      <div style={{
        background: 'linear-gradient(120deg, #FBF7EC, #F3EBD6)',
        border: '1px solid #EADFBB',
        borderRadius: 18,
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 32,
        marginTop: 24,
        marginBottom: 4,
        flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A6420', marginBottom: 4 }}>Available credits</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 36, letterSpacing: '-0.02em', lineHeight: 1 }}>{credits?.balance?.toLocaleString() ?? '—'}</div>
        </div>
        <div style={{ width: 1, height: 40, background: '#E4D2A0', flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 10.5, color: '#8A8264', marginBottom: 3 }}>Monthly allocation</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{credits ? credits.monthlyCredits.toLocaleString() : '—'} · {credits?.plan ?? 'Free plan'}</div>
        </div>
        {credits?.resetDate && (
          <>
            <div style={{ width: 1, height: 40, background: '#E4D2A0', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 10.5, color: '#8A8264', marginBottom: 3 }}>Resets</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{new Date(credits.resetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
            </div>
          </>
        )}
        <Link href="/settings/billing" style={{
          marginLeft: 'auto', background: 'var(--ink)', color: '#fff',
          borderRadius: 9, padding: '9px 18px', fontSize: 13, fontWeight: 600,
          textDecoration: 'none', flexShrink: 0,
        }}>Upgrade plan</Link>
      </div>

      {/* THREE-UP FORMAT CARDS */}
      <div className="dash-grid">

        {/* UGC Package */}
        <Link href="/generate/ugc" className="dash-card">
          <div className="dash-art" style={{ background: '#18170F', flexDirection: 'column', gap: 0, padding: 0, justifyContent: 'flex-start' }}>
            <span className="dash-flag" style={{ background: '#D4B97A', color: '#3A2D10', top: 14, left: 14 }}>FLAGSHIP</span>
            {/* Scene: avatar + script */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              {/* Phone frame with avatar */}
              <div style={{ width: 62, height: 100, borderRadius: 12, background: '#2A2920', border: '1.5px solid rgba(255,255,255,0.12)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                <div style={{ flex: 1, background: 'linear-gradient(180deg, #1E1D14 0%, #2D2B1E 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #C5A96B, #A8894A)', border: '2px solid rgba(255,255,255,0.15)' }} />
                </div>
                <div style={{ height: 22, background: '#1A1910', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '0 6px' }}>
                  {[8, 13, 10, 7].map((w, i) => <div key={i} style={{ height: 3, width: w, borderRadius: 2, background: 'rgba(255,255,255,0.3)' }} />)}
                </div>
              </div>
              {/* Script preview */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ fontSize: 8.5, fontFamily: 'var(--font-mono)', color: '#D4B97A', letterSpacing: '0.08em', marginBottom: 4 }}>SCRIPT</div>
                {[70, 55, 80, 45, 65].map((w, i) => (
                  <div key={i} style={{ height: 5, width: w, borderRadius: 3, background: i === 0 ? 'rgba(212,185,122,0.6)' : 'rgba(255,255,255,0.15)' }} />
                ))}
                <div style={{ marginTop: 6, display: 'flex', gap: 3, alignItems: 'center' }}>
                  {[4, 7, 5, 8, 4, 6, 5, 7, 4, 6].map((h, i) => (
                    <div key={i} style={{ width: 3, height: h, borderRadius: 2, background: 'rgba(212,185,122,0.7)' }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="dash-card-body">
            <div className="dash-card-head">
              <h3>UGC Package</h3>
              <ArrowUpRight />
            </div>
            <p>Full talking-head ad — script, character, voice, captions &amp; B-roll.</p>
          </div>
        </Link>

        {/* Image */}
        <Link href="/generate/image" className="dash-card">
          <div className="dash-art" style={{ background: 'linear-gradient(145deg, #F7F2EA, #EDE5D6)', overflow: 'hidden' }}>
            {/* Light rays */}
            <div style={{ position: 'absolute', top: -30, right: -20, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,235,180,0.5) 0%, transparent 70%)' }} />
            {/* Product bottle */}
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
              {/* Cap */}
              <div style={{ width: 20, height: 10, borderRadius: '6px 6px 0 0', background: '#C8A96A' }} />
              {/* Neck */}
              <div style={{ width: 16, height: 16, background: 'linear-gradient(180deg, #D4B97A, #C4A96A)' }} />
              {/* Body */}
              <div style={{ width: 52, height: 78, borderRadius: '8px 8px 10px 10px', background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(240,230,210,0.95))', border: '1px solid rgba(180,155,100,0.3)', boxShadow: '4px 6px 20px rgba(0,0,0,0.12), inset -4px 0 12px rgba(255,255,255,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <div style={{ width: 34, height: 4, borderRadius: 3, background: 'rgba(160,130,80,0.4)' }} />
                <div style={{ width: 24, height: 3, borderRadius: 3, background: 'rgba(160,130,80,0.25)' }} />
              </div>
              {/* Shadow */}
              <div style={{ width: 44, height: 6, borderRadius: '50%', background: 'rgba(0,0,0,0.08)', marginTop: 2 }} />
            </div>
            {/* Corner label */}
            <span style={{ position: 'absolute', bottom: 12, right: 14, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-fade)', letterSpacing: '0.1em' }}>PRODUCT SHOT</span>
          </div>
          <div className="dash-card-body">
            <div className="dash-card-head">
              <h3>Image</h3>
              <ArrowUpRight />
            </div>
            <p>AI product photos &amp; creative imagery from a prompt.</p>
          </div>
        </Link>

        {/* Video */}
        <Link href="/generate/video" className="dash-card">
          <div className="dash-art" style={{ background: '#0E0E0C', overflow: 'hidden', flexDirection: 'column' }}>
            {/* Cinematic letterbox bars */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 24, background: '#000', zIndex: 2 }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 24, background: '#000', zIndex: 2 }} />
            {/* Gradient scene */}
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 60%, rgba(60,50,30,0.8) 0%, #0E0E0C 70%)' }} />
            {/* Horizon line */}
            <div style={{ position: 'absolute', top: '52%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.06)' }} />
            {/* Play button */}
            <div style={{ position: 'relative', zIndex: 3, width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 8px rgba(255,255,255,0.08)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#0E0E0C"><path d="M8 5v14l11-7z"/></svg>
            </div>
            {/* Subtle film grain dots */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 1, opacity: 0.06, backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          </div>
          <div className="dash-card-body">
            <div className="dash-card-head">
              <h3>Video</h3>
              <ArrowUpRight />
            </div>
            <p>Open-ended AI video motion from any prompt.</p>
          </div>
        </Link>
      </div>

      {/* MADE WITH CONTENTFLOW */}
      <div className="section-head">
        <h2 className="section-title">Made with <em>ContentFlow</em></h2>
        <div className="section-actions">
          <Link href="/library">View library →</Link>
        </div>
      </div>

      <div className="dash-recent">
        {DASH_DEMOS.map(d => (
          <div key={d.label} className="dash-recent-item">
            <div className="dash-recent-thumb" style={{ background: '#111' }}>
              <video src={d.src} autoPlay muted loop playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 55%, rgba(0,0,0,0.4) 100%)' }} />
              <span className="dash-recent-tag">{d.tag}</span>
            </div>
            <div className="dash-recent-meta">
              <div className="dash-recent-title">{d.label}</div>
              <div className="dash-recent-status">
                <span className="dash-recent-dot" style={{ background: '#2F7A4E' }} />
                Example output
              </div>
            </div>
          </div>
        ))}
        {!recentLoading && recentItems.filter(i => i.status === 'completed' || i.status === 'ready').map(item => {
          const title = item.metadata?.productName || item.content_type || 'Untitled'
          const tag = item.content_type === 'ugc' ? 'UGC' : item.content_type?.toUpperCase() ?? '—'
          return (
            <div key={item.id} className="dash-recent-item">
              <div className="dash-recent-thumb" style={item.metadata?.video ? { backgroundImage: `url(${item.metadata.video})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
                <div className="dash-recent-play"><div><svg width="14" height="14" viewBox="0 0 24 24" fill="var(--ink)"><path d="M8 5v14l11-7z"/></svg></div></div>
                <span className="dash-recent-tag">{tag}</span>
              </div>
              <div className="dash-recent-meta">
                <div className="dash-recent-title">{title}</div>
                <div className="dash-recent-status">
                  <span className="dash-recent-dot" style={{ background: '#2F7A4E' }} />
                  Ready · {timeAgo(item.created_at)}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <style>{`
        .dash-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-top: 24px;
        }
        .dash-card {
          display: flex;
          flex-direction: column;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 17px;
          overflow: hidden;
          color: inherit;
          transition: box-shadow 160ms, transform 160ms;
        }
        .dash-card:hover {
          box-shadow: var(--shadow-lg);
          transform: translateY(-3px);
        }
        .dash-art {
          height: 158px;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          border-bottom: 1px solid var(--border);
          overflow: hidden;
        }
        .dash-art-ugc { background: var(--surface-2); }
        .dash-art-stripe { background: repeating-linear-gradient(135deg, var(--surface-2) 0 10px, var(--surface-3) 10px 20px); }
        .dash-flag {
          position: absolute;
          top: 12px; left: 12px;
          font-size: 10px; font-weight: 600; letter-spacing: 0.04em;
          background: var(--ink); color: var(--on-ink);
          border-radius: 6px; padding: 3px 8px;
        }
        .dash-strip { width: 54px; border-radius: 8px; background: repeating-linear-gradient(135deg, #E7E3DA 0 8px, #EFEBE2 8px 16px); border: 1px solid var(--border-strong); }
        .dash-strip-short { height: 96px; }
        .dash-strip-tall { height: 108px; background: repeating-linear-gradient(135deg, #E2DED4 0 8px, #ECE8DE 8px 16px); box-shadow: var(--shadow-md); }
        .dash-play {
          width: 46px; height: 46px; border-radius: 50%;
          background: var(--surface); border: 1px solid var(--border-strong);
          display: flex; align-items: center; justify-content: center;
          box-shadow: var(--shadow-md);
        }
        .dash-card-body { padding: 16px 17px 18px; }
        .dash-card-head { display: flex; align-items: center; justify-content: space-between; }
        .dash-card-head h3 { font-size: 16px; font-weight: 600; letter-spacing: -0.02em; margin: 0; }
        .dash-card-body p { font-size: 13px; color: var(--ink-dim); margin: 6px 0 0; line-height: 1.5; }

        .dash-recent {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 18px;
          margin-top: 20px;
        }
        .dash-recent-thumb {
          aspect-ratio: 0.5625;
          border-radius: 13px; border: 1px solid var(--border);
          background: repeating-linear-gradient(135deg, var(--surface-2) 0 9px, var(--surface-3) 9px 18px);
          position: relative; overflow: hidden;
          display: flex; align-items: flex-end; padding: 10px;
          transition: box-shadow 160ms;
        }
        .dash-recent-thumb:hover { box-shadow: var(--shadow-lg); }
        .dash-recent-play { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
        .dash-recent-play > div { width: 38px; height: 38px; border-radius: 50%; background: rgba(255,255,255,0.92); display: flex; align-items: center; justify-content: center; }
        .dash-recent-tag {
          position: absolute; top: 9px; right: 9px;
          font-family: var(--font-mono); font-size: 10px;
          background: rgba(26,26,23,0.85); color: #fff;
          border-radius: 5px; padding: 2px 6px;
        }
        .dash-recent-meta { padding: 10px 2px 0; }
        .dash-recent-title { font-size: 13px; font-weight: 600; letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dash-recent-status { display: flex; align-items: center; gap: 7px; margin-top: 5px; font-size: 11.5px; color: var(--ink-mute); }
        .dash-recent-dot { width: 6px; height: 6px; border-radius: 50%; }

        @media (max-width: 768px) {
          .dash-grid { grid-template-columns: 1fr; }
          .dash-recent { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </main>
  )
}

const DASH_DEMOS = [
  { src: 'https://hqtlrfpzgrflbnkxxvhm.supabase.co/storage/v1/object/public/ugc-assets/demo/ugc-shopify.mp4', label: 'Shopify product ad', tag: 'UGC' },
  { src: 'https://hqtlrfpzgrflbnkxxvhm.supabase.co/storage/v1/object/public/ugc-assets/demo/ugc-talking-head.mp4', label: 'Talking-head UGC', tag: 'UGC' },
  { src: 'https://hqtlrfpzgrflbnkxxvhm.supabase.co/storage/v1/object/public/ugc-assets/demo/video-pepsi.mp4', label: 'Sora 2 video ad', tag: 'VIDEO' },
]

const QUICK = [
  { label: 'UGC Package', href: '/generate/ugc' },
  { label: 'AI Video', href: '/generate/video' },
  { label: 'Image', href: '/generate/image' },
  { label: 'Social caption', href: '/generate/social' },
  { label: 'Voice', href: '/generate/voice' },
]
