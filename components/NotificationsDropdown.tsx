'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/auth'

interface Notification {
  id: string
  icon: 'check' | 'video' | 'youtube' | 'alert' | 'credit'
  title: string
  detail: string
  date: string
  href?: string
  unread: boolean
}

const READ_KEY = 'cf-notifications-read-at'

function timeAgo(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  if (secs < 172800) return 'yesterday'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function Icon({ name }: { name: Notification['icon'] }) {
  const props = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (name) {
    case 'check': return (
      <svg {...props}><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>
    )
    case 'video': return (
      <svg {...props}><rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 10 6-4v12l-6-4"/></svg>
    )
    case 'youtube': return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="#FF0000"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
    )
    case 'alert': return (
      <svg {...props}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    )
    case 'credit': return (
      <svg {...props}><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
    )
  }
}

const COLORS: Record<Notification['icon'], string> = {
  check: '#10B981',
  video: '#7C6CF8',
  youtube: '#FF0000',
  alert: '#EF4444',
  credit: '#F59E0B',
}

export function NotificationsDropdown({ onUnreadChange }: { onUnreadChange?: (n: number) => void }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const ref = useRef<HTMLDivElement>(null)
  const lastReadAt = typeof window !== 'undefined' ? (localStorage.getItem(READ_KEY) || '1970-01-01') : '1970-01-01'

  async function load() {
    const supabase = getSupabase()
    if (!supabase) { setLoading(false); return }
    const { data: sess } = await supabase.auth.getSession()
    const token = sess?.session?.access_token
    if (!token) { setLoading(false); return }

    const [libRes, ytRes, creditsRes] = await Promise.allSettled([
      fetch('/api/library', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/youtube/queue', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/credits/balance', { headers: { Authorization: `Bearer ${token}` } }),
    ])

    const events: Notification[] = []

    // Library completions
    if (libRes.status === 'fulfilled' && libRes.value.ok) {
      const { items } = await libRes.value.json()
      ;(items ?? [])
        .filter((i: { status: string }) => i.status === 'completed' || i.status === 'ready')
        .slice(0, 5)
        .forEach((item: { id: string; content_type: string; created_at: string; metadata?: { productName?: string } }) => {
          const name = item.metadata?.productName || item.content_type
          events.push({
            id: `lib-${item.id}`,
            icon: 'video',
            title: `${item.content_type.toUpperCase()} ready`,
            detail: name,
            date: item.created_at,
            href: '/library',
            unread: new Date(item.created_at) > new Date(lastReadAt),
          })
        })
    }

    // YouTube queue events
    if (ytRes.status === 'fulfilled' && ytRes.value.ok) {
      const { jobs } = await ytRes.value.json()
      ;(jobs ?? []).slice(0, 5).forEach((j: { id: string; status: string; title: string; scheduled_at: string; error_message?: string }) => {
        if (j.status === 'published') {
          events.push({
            id: `yt-${j.id}`,
            icon: 'youtube',
            title: 'Published to YouTube',
            detail: j.title,
            date: j.scheduled_at,
            href: '/library',
            unread: new Date(j.scheduled_at) > new Date(lastReadAt),
          })
        } else if (j.status === 'failed') {
          events.push({
            id: `yt-${j.id}`,
            icon: 'alert',
            title: 'YouTube publish failed',
            detail: j.error_message || j.title,
            date: j.scheduled_at,
            href: '/library',
            unread: new Date(j.scheduled_at) > new Date(lastReadAt),
          })
        } else if (j.status === 'queued') {
          events.push({
            id: `yt-${j.id}`,
            icon: 'youtube',
            title: 'Scheduled for YouTube',
            detail: j.title,
            date: j.scheduled_at,
            href: '/library',
            unread: false,
          })
        }
      })
    }

    // Credits low
    if (creditsRes.status === 'fulfilled' && creditsRes.value.ok) {
      const { balance, monthlyCredits } = await creditsRes.value.json()
      if (balance < monthlyCredits * 0.2) {
        events.push({
          id: 'credits-low',
          icon: 'credit',
          title: 'Credits running low',
          detail: `${balance} of ${monthlyCredits} remaining this month`,
          date: new Date().toISOString(),
          href: '/settings/billing',
          unread: true,
        })
      }
    }

    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    setNotifications(events.slice(0, 10))
    setLoading(false)
    onUnreadChange?.(events.filter(e => e.unread).length)
  }

  useEffect(() => { load() }, [])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const unread = notifications.filter(n => n.unread).length

  function markAllRead() {
    localStorage.setItem(READ_KEY, new Date().toISOString())
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })))
    onUnreadChange?.(0)
  }

  function handleClick(n: Notification) {
    if (n.href) router.push(n.href)
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="icon-btn"
        title="Notifications"
        onClick={() => setOpen(o => !o)}
        style={{ position: 'relative' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>
        {unread > 0 && (
          <span style={{ position: 'absolute', top: 7, right: 8, minWidth: 8, height: 8, padding: '0 3px', borderRadius: 8, background: '#EF4444', border: '1.5px solid var(--bg)' }} />
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 8,
          width: 360, maxHeight: 480,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 13, boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden', zIndex: 200, display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid var(--border-soft)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
              Notifications {unread > 0 && <span style={{ color: 'var(--ink-mute)', fontWeight: 400 }}>({unread})</span>}
            </div>
            {unread > 0 && (
              <button onClick={markAllRead} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 11.5, color: 'var(--ink-mute)', fontWeight: 600,
              }}>Mark all read</button>
            )}
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>Loading…</div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '36px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>All caught up</div>
                <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>You&apos;ll see content events and YouTube publishes here.</div>
              </div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  style={{
                    display: 'flex', gap: 12, padding: '12px 16px',
                    width: '100%', border: 'none', background: 'transparent',
                    cursor: 'pointer', textAlign: 'left',
                    borderBottom: '1px solid var(--border-soft)',
                    position: 'relative',
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 9,
                    background: `${COLORS[n.icon]}18`, color: COLORS[n.icon],
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon name={n.icon} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 2, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span>{n.title}</span>
                      <span style={{ fontSize: 11, color: 'var(--ink-mute)', fontWeight: 400, flexShrink: 0 }}>{timeAgo(n.date)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.detail}</div>
                  </div>
                  {n.unread && (
                    <div style={{ position: 'absolute', top: 18, right: 12, width: 6, height: 6, borderRadius: '50%', background: '#EF4444' }} />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
