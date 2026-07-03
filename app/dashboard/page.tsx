'use client'

import { useEffect, useState } from 'react'
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

interface CalendarDay {
  date: string
  contentType: string
  title: string
  description: string
  icon: string
  completed: boolean
  suggestedTime?: string
}

const CONTENT_HREF: Record<string, string> = {
  ugc: '/generate/ugc',
  video: '/generate/video',
  image: '/generate/image',
  social: '/generate/social',
  voice: '/generate/voice',
  'screen-demo': '/generate/screen-demo',
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
  const [todayTask, setTodayTask] = useState<CalendarDay | null>(null)

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
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
      const [libRes, creditsRes, planRes] = await Promise.allSettled([
        fetch('/api/library', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/credits/balance', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/planner/get-monthly-plan', { headers: { Authorization: `Bearer ${token}` } }),
      ])

      if (libRes.status === 'fulfilled' && libRes.value.ok) {
        const { items } = await libRes.value.json()
        setRecentItems((items || []).slice(0, 4))
      }
      if (creditsRes.status === 'fulfilled' && creditsRes.value.ok) {
        setCredits(await creditsRes.value.json())
      }
      if (planRes.status === 'fulfilled' && planRes.value.ok) {
        const { plan } = await planRes.value.json()
        if (plan?.days) {
          const task = plan.days.find((d: CalendarDay) => d.date === todayStr)
          if (task) setTodayTask(task)
        }
      }

      setRecentLoading(false)
    })
  }, [todayStr])

  const creditsPercent = credits ? Math.min(100, Math.round((credits.balance / credits.monthlyCredits) * 100)) : null

  return (
    <main className="content">
      <div className="page-meta">{dayStr} · {dateStr} · {yearStr}</div>
      <h1 className="page-title">
        {greeting}, {userName.charAt(0).toUpperCase() + userName.slice(1)}.<br/>
        <span style={{ color: 'var(--ink-mute)' }}>What are we making <em>today?</em></span>
      </h1>

      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 28 }}>
        {/* Credits */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 13, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Credits</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.03em' }}>
            {credits?.balance ?? '—'}
          </div>
          {credits && (
            <>
              <div style={{ height: 4, borderRadius: 4, background: 'var(--surface-3)', marginTop: 8 }}>
                <div style={{ height: '100%', borderRadius: 4, width: `${creditsPercent}%`, background: creditsPercent! > 20 ? '#10B981' : '#EF4444', transition: 'width 0.3s' }} />
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', marginTop: 5 }}>
                of {credits.monthlyCredits}/mo · {credits.plan}
              </div>
            </>
          )}
        </div>

        {/* Today's plan */}
        {todayTask ? (
          <Link href={CONTENT_HREF[todayTask.contentType] ?? '/calendar'} style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 13,
            padding: '14px 16px', textDecoration: 'none', color: 'inherit',
            transition: 'box-shadow 0.15s', display: 'block',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Today&apos;s task</div>
              {todayTask.completed && <span style={{ fontSize: 10, fontWeight: 600, color: '#10B981', background: 'rgba(16,185,129,0.1)', borderRadius: 5, padding: '2px 6px' }}>Done</span>}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {todayTask.title}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', marginTop: 6 }}>
              {todayTask.contentType.toUpperCase()} · {todayTask.suggestedTime}
            </div>
          </Link>
        ) : (
          <Link href="/calendar" style={{
            background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 13,
            padding: '14px 16px', textDecoration: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'center',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Today&apos;s task</div>
            <div style={{ fontSize: 13, color: 'var(--ink-mute)' }}>No task for today — view calendar →</div>
          </Link>
        )}

        {/* Quick links */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 13, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Quick create</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {QUICK.slice(0, 4).map(q => (
              <Link key={q.label} href={q.href} style={{
                fontSize: 12.5, fontWeight: 500, color: 'var(--ink-2)',
                textDecoration: 'none', padding: '3px 0',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                {q.label}
                <span style={{ color: 'var(--ink-faint)', fontSize: 11 }}>→</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* THREE-UP FORMAT CARDS */}
      <div className="dash-grid">
        <Link href="/generate/ugc" className="dash-card">
          <div className="dash-art dash-art-ugc">
            <span className="dash-flag">FLAGSHIP</span>
            <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
              <div className="dash-strip dash-strip-short" />
              <div className="dash-strip dash-strip-tall" />
              <div className="dash-strip dash-strip-short" />
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

        <Link href="/generate/image" className="dash-card">
          <div className="dash-art dash-art-stripe">
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-faint)', letterSpacing: '0.05em' }}>PRODUCT SHOT</span>
          </div>
          <div className="dash-card-body">
            <div className="dash-card-head">
              <h3>Image</h3>
              <ArrowUpRight />
            </div>
            <p>AI product photos &amp; creative imagery from a prompt.</p>
          </div>
        </Link>

        <Link href="/generate/video" className="dash-card">
          <div className="dash-art dash-art-stripe">
            <div className="dash-play">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--ink)"><path d="M8 5v14l11-7z"/></svg>
            </div>
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
