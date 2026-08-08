'use client'

import { useEffect, useState } from 'react'
import { DriveConnectBanner } from '@/components/DriveConnectBanner'
import { useSearchParams } from 'next/navigation'
import { readChatPrefill } from '@/lib/chat-prefill'
import { saveCampaignShotPrefill, peekCampaignShotLink, clearCampaignShotLink, clearCampaignShotPrefill } from '@/lib/campaign-shot-prefill'
import { SectionTabs, VIDEO_STUDIO_TABS } from '@/components/SectionTabs'
import { getSupabase } from '@/lib/auth'
import UGCPackageBuilder from '@/components/UGCPackageBuilder'
import UGCPackagePreview from '@/components/UGCPackagePreview'
import { Icon } from '@/components/Icons'
import { showSuccess, showError } from '@/lib/notifications'
import { useAutoSave } from '@/lib/useAutoSave'

interface UGCComponent {
  image?: { url: string; id: string }
  script?: string
  video?: {
    videoId?: string
    videoUrl?: string
    status: 'processing' | 'completed' | 'failed'
    estimatedDuration?: number
    duration?: number
  }
  scrollStopHook?: {
    jobId: string
    frameUrl: string
    hookKey: string
    durationSec: number
    trimToSec?: number
  }
  musicMood?: string
}

export default function UGCGeneratorPage() {
  // Campaign Planner → Builder handoff.
  // The campaign detail page links to /generate/ugc?campaign=&shot=&product=&hook=&…
  // We stash the params synchronously in sessionStorage BEFORE UGCPackageBuilder
  // mounts so its useState initializers (which read the prefill) paint the form
  // pre-filled with no flash.
  // Campaign Planner → Builder handoff. Any time the URL carries campaign+shot,
  // overwrite the prefill session store. UGCPackageBuilder reads it in its
  // useState initializers on mount. No consume-guard — Strict Mode double
  // renders were eating the value before the builder saw it.
  if (typeof window !== 'undefined') {
    const qs = new URLSearchParams(window.location.search)
    const campaignId = qs.get('campaign')
    const shotId = qs.get('shot')
    if (campaignId && shotId) {
      saveCampaignShotPrefill({
        campaignId,
        shotId,
        productId: qs.get('product') ?? undefined,
        formatKey: qs.get('format') ?? undefined,
        formatLabel: qs.get('formatLabel') ?? undefined,
        hook: qs.get('hook') ?? undefined,
        setting: qs.get('setting') ?? undefined,
        script: qs.get('script') ?? undefined,
        cta: qs.get('cta') ?? undefined,
        visualNotes: qs.get('visualNotes') ?? undefined,
        caption: qs.get('caption') ?? undefined,
        aspect: qs.get('aspect') ?? undefined,
        duration: qs.get('duration') ? Number(qs.get('duration')) : undefined,
        actorId: qs.get('actor') ?? undefined,
        sceneId: qs.get('scene') ?? undefined,
      })
    }
  }
  const [components, setComponents] = useState<UGCComponent | null>(null)
  const [ugcType, setUgcType] = useState('')
  const [creditBalance, setCreditBalance] = useState(200)
  const [creditDeducted, setCreditDeducted] = useState<number | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [creditsLoading, setCreditsLoading] = useState(true)

  // URL → ad scraper
  const [urlInput, setUrlInput] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [urlError, setUrlError] = useState('')
  const [externalPrefill, setExternalPrefill] = useState<{ productName?: string; productDescription?: string; benefits?: string; callToAction?: string } | undefined>(undefined)

  // Actor gallery (loaded from saved-actors API for quick-select strip)
  const [topActors, setTopActors] = useState<Array<{ id: string; name: string; hero_frame_url: string }>>([])
  const [selectedActorId, setSelectedActorId] = useState<string | undefined>(undefined)
  const [formData, setFormData] = useState({
    ugcType: 'image-with-voiceover',
    productName: '',
    productDescription: '',
    benefits: '',
    callToAction: '',
    style: 'realistic',
    imageSize: '1024x1024',
    avatarId: 'sarah',
    voiceId: 'rachel',
  })

  useAutoSave(formData, {
    key: 'ugcGeneratorFormState',
    onRestore: (data) => setFormData(data),
  })

  // Prefill from a Content Plan calendar entry via URL params
  // (?hook=...&format=...). This is used when clicking "Generate ↗" in the
  // dashboard's Content Intelligence panel.
  const searchParams = useSearchParams()
  useEffect(() => {
    const hook = searchParams?.get('hook')
    const format = searchParams?.get('format')
    if (!hook && !format) return
    setFormData(prev => ({
      ...prev,
      benefits: hook ? (prev.benefits ? `${hook}\n\n${prev.benefits}` : hook) : prev.benefits,
      // Stash the format id in callToAction so it makes it into the orchestrate
      // call. The script prompt reads it and shapes the script accordingly.
      callToAction: format && !prev.callToAction ? `[format:${format}]` : prev.callToAction,
    }))
  }, [searchParams])

  // Prefill from a calendar suggestion (Create now). Runs once on mount.
  // The calendar day's title becomes the topic-line, description becomes the
  // benefits/script hint — user can still edit before submitting.
  // Prefill from the calendar / dashboard is now handled inside
  // UGCPackageBuilder itself (synchronously in useState initializers), so
  // the form is populated on the first paint with no flash. We still catch
  // the chat-agent handoff here since UGCPackageBuilder doesn't own that
  // sessionStorage key.
  useEffect(() => {
    const chat = readChatPrefill()
    if (chat) {
      setFormData(prev => ({
        ...prev,
        productDescription: prev.productDescription || chat.slice(0, 500),
        benefits: prev.benefits || chat.slice(0, 500),
      }))
    }
  }, [])

  // Load credit balance
  useEffect(() => {
    const fetchCredits = async () => {
      try {
        const supabase = getSupabase()
        if (!supabase) {
          setCreditsLoading(false)
          return
        }

        const { data: sessionData } = await supabase.auth.getSession()
        if (!sessionData?.session?.access_token) {
          setCreditsLoading(false)
          return
        }

        const response = await fetch('/api/credits/balance', {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        }).catch(() => null)

        if (!response) {
          setCreditsLoading(false)
          return
        }

        if (response.ok) {
          const data = await response.json()
          setCreditBalance(data.balance)
        } else if (response.status === 404) {
          // Initialize credits
          const initResponse = await fetch('/api/credits/init', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${sessionData.session.access_token}`,
            },
            body: JSON.stringify({ plan: 'free' }),
          }).catch(() => null)

          if (initResponse?.ok) {
            const data = await initResponse.json()
            setCreditBalance(data.data.balance)
          }
        }
      } catch (err) {
        console.error('Failed to fetch credits:', err)
      } finally {
        setCreditsLoading(false)
      }
    }

    const timer = setTimeout(() => {
      fetchCredits()
    }, 500)

    return () => clearTimeout(timer)
  }, [])

  // Load top saved actors for the quick-select strip at the top of the page.
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const supabase = getSupabase()
        if (!supabase) return
        const { data: sess } = await supabase.auth.getSession()
        const token = sess?.session?.access_token
        if (!token) return
        const res = await fetch('/api/ugc/saved-actors', { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (!cancelled && Array.isArray(data?.actors)) setTopActors(data.actors.slice(0, 6))
      } catch { /* best-effort */ }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Called after a successful render — if the current browser session was
  // deep-linked from /campaigns/[id], PATCH the corresponding campaign shot
  // so the planner UI shows it as rendered.
  const writeBackToCampaignShot = async (components: UGCComponent | null | undefined) => {
    const link = peekCampaignShotLink()
    if (!link) return
    try {
      const supabase = getSupabase()
      if (!supabase) return
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) return
      await fetch(`/api/campaigns/${link.campaignId}/shots/${link.shotId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'done',
          spec: {
            rendered_video_url: components?.video?.videoUrl ?? null,
            rendered_video_id: components?.video?.videoId ?? null,
            rendered_at: new Date().toISOString(),
          },
        }),
      }).catch(() => { /* soft fail */ })
      clearCampaignShotLink()
      clearCampaignShotPrefill()
    } catch { /* soft fail */ }
  }

  const handleGenerate = async (settings: {
    ugcType: string
    tier: 'standard'
    duration: 5 | 10 | 15 | 20 | 30
    productName: string
    productDescription: string
    benefits: string
    callToAction: string
    style: string
    imageSize: string
    voiceId: string
    productImageBase64?: string
    productImageMimeType?: string
    selectedHook?: string
    character?: import('@/components/CharacterBuilder').CharacterProfile
    customInstructions?: string
    language?: string
    aspect?: 'portrait' | 'tall45' | 'square' | 'landscape'
    prewrittenScript?: string
    scrollStopHook?: {
      jobId: string
      frameUrl: string
      hookKey: string
      durationSec: number
      trimToSec?: number
    }
    musicMood?: string
  }) => {
    setLoading(true)
    setError('')
    setComponents(null)
    setCreditDeducted(undefined)

    try {
      // If the builder already ran the two-step hero-frames → animate flow,
      // it hands us the animate response directly on __animateResponse.
      // In that case we just wire the response into UI state and skip the
      // legacy single-shot orchestrate call.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pre = (settings as any).__animateResponse as
        | { components: unknown; newBalance: number; creditDeducted: number } | undefined
      if (pre) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const merged: any = { ...(pre.components as any) }
        if (settings.scrollStopHook) merged.scrollStopHook = settings.scrollStopHook
        if (settings.musicMood) merged.musicMood = settings.musicMood
        setComponents(merged)
        setUgcType(settings.ugcType)
        setCreditBalance(pre.newBalance)
        setCreditDeducted(pre.creditDeducted)
        showSuccess('UGC package generated successfully', 'Complete package ready to use')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await writeBackToCampaignShot(pre.components as any)
        return
      }

      const supabase = getSupabase()
      if (!supabase) {
        throw new Error('Authentication failed')
      }

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session?.access_token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/ugc/orchestrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify(settings),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate UGC package')
      }

      const data = await response.json()
      const merged = { ...(data.components ?? {}) }
      if (settings.musicMood) merged.musicMood = settings.musicMood
      setComponents(merged)
      setUgcType(settings.ugcType)
      setCreditBalance(data.newBalance)
      setCreditDeducted(data.creditDeducted)
      showSuccess('UGC package generated successfully', 'Complete package ready to use')

      // If this render came from a Campaign Planner shot, write status +
      // video url back to the shot so /campaigns/[id] shows it as rendered.
      await writeBackToCampaignShot(data.components)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate UGC package'
      setError(errorMessage)
      showError('Generation failed', errorMessage)
    } finally {
      setLoading(false)
    }
  }

  async function handleUrlImport() {
    const trimmed = urlInput.trim()
    if (!trimmed) return
    setUrlLoading(true)
    setUrlError('')
    try {
      const res = await fetch(`/api/product-url?url=${encodeURIComponent(trimmed)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not extract product info')
      setExternalPrefill({
        productName: data.productName,
        productDescription: data.productDescription,
        benefits: data.benefits,
        callToAction: data.callToAction,
      })
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : 'Failed to fetch URL')
    } finally {
      setUrlLoading(false)
    }
  }

  return (
    <main style={{ maxWidth: 1140, margin: '0 auto', padding: '36px 40px 90px' }} className="ugc-page">
      <SectionTabs tabs={VIDEO_STUDIO_TABS} />
      <DriveConnectBanner />
      <header style={{ marginBottom: 28, display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'var(--ink-fade)',
          }}>Studio / UGC Package</div>
          <h1 style={{
            fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 44,
            lineHeight: 1.02, letterSpacing: '-0.01em', margin: '10px 0 0',
          }}>
            Build a <span style={{ fontStyle: 'italic' }}>UGC ad</span>.
          </h1>
          <p style={{
            fontSize: 14, color: 'var(--ink-dim)', margin: '10px 0 0',
            maxWidth: 480, lineHeight: 1.55,
          }}>
            One photo in. Script, character, voice, captions and B-roll — out in about 2 minutes.
          </p>
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', borderRadius: 999,
          background: 'var(--ink)', color: 'var(--on-ink)',
          fontSize: 11.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.25)' }} />
          Flagship
        </div>
      </header>

      {/* URL → ad import bar */}
      <div style={{ marginBottom: 20, padding: '14px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>Start from a product URL</span>
          <span style={{ fontSize: 11, color: 'var(--ink-mute)', marginLeft: 2 }}>— paste any product page and we extract the info</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="url"
            placeholder="https://yourstore.com/products/your-product"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleUrlImport()}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 13, outline: 'none' }}
          />
          <button
            type="button"
            onClick={handleUrlImport}
            disabled={!urlInput.trim() || urlLoading}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--ink)', color: 'var(--on-ink)', fontSize: 13, fontWeight: 600, cursor: urlInput.trim() && !urlLoading ? 'pointer' : 'not-allowed', opacity: urlInput.trim() && !urlLoading ? 1 : 0.45, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {urlLoading ? <><span style={{ width: 11, height: 11, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />Importing…</> : 'Import →'}
          </button>
        </div>
        {urlError && <div style={{ fontSize: 12, color: '#e84040' }}>{urlError}</div>}
        {externalPrefill?.productName && (
          <div style={{ fontSize: 12, color: 'var(--good)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
            Imported <strong>{externalPrefill.productName}</strong> — form pre-filled below
          </div>
        )}
      </div>

      {/* Batch mode hero card */}
      <a
        href="/batch"
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', marginBottom: 8, textDecoration: 'none', color: 'inherit', transition: 'border-color 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--ink)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
      >
        <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--on-ink)" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="6" height="18" rx="1"/><rect x="9" y="3" width="6" height="18" rx="1"/><rect x="16" y="3" width="6" height="18" rx="1"/></svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>Batch mode — generate 6 hook variations at once</div>
          <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 2 }}>Problem-solution, before/after, curiosity hook, social proof, question, story. All in one click. → Go to Batch</div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, color: 'var(--ink-mute)' }}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </a>

      {/* Saved actor quick-select strip */}
      {topActors.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>
            Your saved actors — click to pre-select
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {topActors.map(a => {
              const active = selectedActorId === a.id
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelectedActorId(active ? undefined : a.id)}
                  style={{ flexShrink: 0, padding: 5, borderRadius: 10, border: `1.5px solid ${active ? 'var(--ink)' : 'var(--border)'}`, background: active ? 'var(--surface-2)' : 'var(--surface)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 5, width: 80 }}
                >
                  <img src={a.hero_frame_url} alt={a.name} style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 7, display: 'block' }} />
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 344px', gap: 32, alignItems: 'start' }} className="ugc-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <UGCPackageBuilder
            onGenerate={handleGenerate}
            isLoading={loading}
            creditBalance={creditBalance}
            externalPrefill={externalPrefill}
            initialActorId={selectedActorId}
          />
        </div>

        <aside style={{ position: 'sticky', top: 20, display: 'flex', flexDirection: 'column', gap: 14 }} className="ugc-aside">
          <UGCPackagePreview
            components={components}
            ugcType={ugcType}
            isLoading={loading}
            error={error}
            creditDeducted={creditDeducted}
          />
        </aside>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .ugc-page { padding: 20px 16px 90px !important; }
          .ugc-grid { grid-template-columns: 1fr !important; gap: 20px !important; }
          .ugc-aside { position: static !important; }
        }
      `}</style>
    </main>
  )
}
