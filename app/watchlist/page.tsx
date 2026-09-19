'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/auth'
import { showError, showSuccess } from '@/lib/notifications'
import { daysLive, verdictFor, needsCheck, VERDICT_LABEL, VERDICT_HINT, type AdVerdict } from '@/lib/watchlist'
import { Eye, Trash2, Check, X, Loader2 } from 'lucide-react'

interface WatchedAd {
  id: string
  competitor: string
  platform: string
  source_url: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  teardown: any
  thumb_url: string | null
  first_seen_at: string
  last_confirmed_at: string
  died_at: string | null
  check_count: number
}

const ACCENT = '#b91c1c'

const VERDICT_STYLE: Record<AdVerdict, { bg: string; fg: string; border: string }> = {
  proven:      { bg: 'rgba(185,28,28,0.10)', fg: ACCENT,            border: 'rgba(185,28,28,0.28)' },
  working:     { bg: 'var(--surface-2)',     fg: 'var(--ink)',      border: 'var(--border)' },
  testing:     { bg: 'transparent',          fg: 'var(--ink-mute)', border: 'var(--border)' },
  'died-fast': { bg: 'transparent',          fg: 'var(--ink-fade)', border: 'var(--border)' },
  retired:     { bg: 'transparent',          fg: 'var(--ink-fade)', border: 'var(--border)' },
}

export default function WatchlistPage() {
  const router = useRouter()
  const [ads, setAds] = useState<WatchedAd[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const token = useCallback(async () => {
    const supabase = getSupabase()
    if (!supabase) return null
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  }, [])

  const load = useCallback(async () => {
    try {
      const t = await token()
      if (!t) return
      const res = await fetch('/api/watchlist', { headers: { Authorization: `Bearer ${t}` } })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setAds(data.ads ?? [])
    } catch (err) {
      showError('Could not load watchlist', err instanceof Error ? err.message : 'Try again')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { void load() }, [load])

  async function mark(id: string, status: 'live' | 'dead') {
    setBusyId(id)
    try {
      const t = await token()
      if (!t) return
      const res = await fetch(`/api/watchlist/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Update failed')
      await load()
      if (status === 'dead') showSuccess('Marked as stopped', 'Its run is recorded — that length is the signal.')
    } catch (err) {
      showError('Could not update', err instanceof Error ? err.message : 'Try again')
    } finally {
      setBusyId(null)
    }
  }

  async function remove(id: string) {
    setBusyId(id)
    try {
      const t = await token()
      if (!t) return
      await fetch(`/api/watchlist/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${t}` } })
      setAds(prev => prev.filter(a => a.id !== id))
    } finally {
      setBusyId(null)
    }
  }

  // Hand the stored teardown to the builder — same handoff the teardown page
  // uses, so no re-analysis is needed.
  function buildFrom(ad: WatchedAd) {
    try {
      if (ad.teardown?.videoPrompt) sessionStorage.setItem('chatPrefillTopic', String(ad.teardown.videoPrompt).slice(0, 1500))
      sessionStorage.setItem('analyzerBreakdown', JSON.stringify(ad.teardown))
    } catch { /* quota — ignore */ }
    router.push('/generate/ugc')
  }

  const live = ads.filter(a => !a.died_at)
  const dead = ads.filter(a => a.died_at)
  const stale = live.filter(a => needsCheck(a.last_confirmed_at, a.died_at))

  return (
    <main style={{ maxWidth: 1040, margin: '0 auto', padding: '36px 32px 90px' }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', color: 'var(--ink-fade)', textTransform: 'uppercase', marginBottom: 10 }}>
          Competitor radar
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 40, fontWeight: 400, margin: '0 0 10px', letterSpacing: '-0.02em' }}>
          Ad <em style={{ color: ACCENT }}>watchlist</em>
        </h1>
        <p style={{ fontSize: 15, color: 'var(--ink-dim)', margin: 0, maxWidth: 620, lineHeight: 1.6 }}>
          Brands stop paying for ads that don&apos;t work. The longer a competitor keeps one running,
          the better it&apos;s performing — so how long it survives tells you what to copy, without
          anyone sharing their numbers.
        </p>
      </div>

      {stale.length > 0 && (
        <div style={{
          border: '1px solid var(--border)', borderRadius: 14, padding: '14px 18px',
          background: 'var(--surface)', marginBottom: 22, fontSize: 13.5, color: 'var(--ink-dim)',
        }}>
          <strong style={{ color: 'var(--ink)' }}>{stale.length} ad{stale.length === 1 ? '' : 's'} need a check.</strong>
          {' '}Open the Ad Library, see if they&apos;re still running, and mark them below — that&apos;s what keeps the timeline honest.
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: 'var(--ink-mute)', fontSize: 14 }}>
          <Loader2 size={15} className="animate-spin" /> Loading…
        </div>
      ) : ads.length === 0 ? (
        <div style={{
          border: '1.5px dashed var(--border)', borderRadius: 18, padding: '48px 28px',
          textAlign: 'center', background: 'var(--surface)',
        }}>
          <Eye size={24} style={{ color: 'var(--ink-mute)', marginBottom: 12 }} />
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, marginBottom: 8 }}>Nothing on watch yet</div>
          <p style={{ fontSize: 13.5, color: 'var(--ink-mute)', margin: '0 auto 20px', maxWidth: 430, lineHeight: 1.6 }}>
            Tear down a competitor&apos;s ad, then hit <strong>Watch this ad</strong>. The clock starts
            the day you add it — so the sooner you start, the more the history is worth.
          </p>
          <button onClick={() => router.push('/generate/teardown')} style={{
            padding: '12px 24px', borderRadius: 11, background: ACCENT, color: '#fff',
            border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>
            Tear down an ad →
          </button>
        </div>
      ) : (
        <>
          <Section title="Still running" count={live.length}>
            {live.map(ad => (
              <AdCard key={ad.id} ad={ad} busy={busyId === ad.id}
                onLive={() => mark(ad.id, 'live')} onDead={() => mark(ad.id, 'dead')}
                onRemove={() => remove(ad.id)} onBuild={() => buildFrom(ad)} />
            ))}
          </Section>

          {dead.length > 0 && (
            <Section title="Stopped running" count={dead.length}>
              {dead.map(ad => (
                <AdCard key={ad.id} ad={ad} busy={busyId === ad.id}
                  onLive={() => mark(ad.id, 'live')} onDead={() => mark(ad.id, 'dead')}
                  onRemove={() => remove(ad.id)} onBuild={() => buildFrom(ad)} />
              ))}
            </Section>
          )}
        </>
      )}
    </main>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  if (count === 0) return null
  return (
    <section style={{ marginBottom: 34 }}>
      <div style={{
        fontSize: 10.5, fontFamily: 'var(--font-mono)', letterSpacing: '0.12em',
        textTransform: 'uppercase', color: 'var(--ink-fade)', marginBottom: 14,
      }}>
        {title} · {count}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
        {children}
      </div>
    </section>
  )
}

function AdCard({ ad, busy, onLive, onDead, onRemove, onBuild }: {
  ad: WatchedAd
  busy: boolean
  onLive: () => void
  onDead: () => void
  onRemove: () => void
  onBuild: () => void
}) {
  const days = daysLive(ad.first_seen_at, ad.died_at)
  const verdict = verdictFor(ad.first_seen_at, ad.died_at)
  const vs = VERDICT_STYLE[verdict]

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 16, background: 'var(--surface)',
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
      opacity: ad.died_at ? 0.72 : 1,
    }}>
      {ad.thumb_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ad.thumb_url} alt="" style={{ width: '100%', height: 132, objectFit: 'cover', display: 'block' }} />
      )}
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)' }}>{ad.competitor}</div>
          <span title={VERDICT_HINT[verdict]} style={{
            flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
            textTransform: 'uppercase', padding: '3px 8px', borderRadius: 5,
            background: vs.bg, color: vs.fg, border: `1px solid ${vs.border}`,
          }}>
            {VERDICT_LABEL[verdict]}
          </span>
        </div>

        <div style={{ fontSize: 12.5, color: 'var(--ink-mute)' }}>
          {ad.died_at ? `Ran ${days} day${days === 1 ? '' : 's'}` : `${days} day${days === 1 ? '' : 's'} and counting`}
        </div>

        {ad.teardown?.hook && (
          <div style={{
            fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5,
            borderLeft: `2px solid ${ACCENT}`, paddingLeft: 10,
          }}>
            {String(ad.teardown.hook).slice(0, 140)}
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 'auto', paddingTop: 6 }}>
          <button onClick={onBuild} style={{
            padding: '7px 13px', borderRadius: 8, border: 'none', background: 'var(--ink)',
            color: 'var(--on-ink)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            Make my version
          </button>
          {!ad.died_at ? (
            <>
              <IconBtn label="Still running" busy={busy} onClick={onLive}><Check size={12} /></IconBtn>
              <IconBtn label="Stopped" busy={busy} onClick={onDead}><X size={12} /></IconBtn>
            </>
          ) : (
            <IconBtn label="Running again" busy={busy} onClick={onLive}><Check size={12} /></IconBtn>
          )}
          <IconBtn label="Remove" busy={busy} onClick={onRemove}><Trash2 size={12} /></IconBtn>
        </div>
      </div>
    </div>
  )
}

function IconBtn({ label, busy, onClick, children }: {
  label: string; busy: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button onClick={onClick} disabled={busy} title={label} style={{
      padding: '7px 11px', borderRadius: 8, border: '1px solid var(--border)',
      background: 'transparent', color: 'var(--ink-mute)', fontSize: 12,
      cursor: busy ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
    }}>
      {children}
    </button>
  )
}
