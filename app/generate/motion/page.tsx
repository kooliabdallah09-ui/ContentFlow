'use client'

// Motion Ads: brief → storyboard → AI-written animated ad → MP4 with sound.
//
// The ad's code is written by /api/motion/write and only ever runs in the
// motion sandbox iframe (lib/motion/sandbox-client.ts). This page drives the
// loop: load the code, snapshot stills, send them to /api/motion/revise for
// the self-review, fix compile/runtime errors, then preview and export.

import { useEffect, useRef, useState } from 'react'
import { getSupabase } from '@/lib/auth'
import { useCredits } from '@/lib/useCredits'
import { showError, showSuccess } from '@/lib/notifications'
import { MotionSandbox } from '@/lib/motion/sandbox-client'
import type { SandboxAssets } from '@/lib/motion/sandbox-protocol'
import { MOTION_TONES, MOTION_TRACKS, SFX_NAMES, motionTrack, sfxUrl, type MotionTone } from '@/lib/motion/music'
import type { MotionStoryboard } from '@/lib/motion/generate'

const AD_CREDITS = 35 // keep in step with MOTION_AD_CREDITS in lib/motion/server.ts
const W = 1080
const H = 1920

type Stage = 'brief' | 'planning' | 'storyboard' | 'writing' | 'checking' | 'reviewing' | 'ready'

type Brief = {
  brandName: string
  product: string
  audience: string
  idea: string
  cta: string
  website: string
  tone: MotionTone
  trackKey: string | null
}

type Product = { id: string; name: string; description?: string | null; photo_urls: string[]; product_type: 'physical' | 'app' | null; website_url: string | null }

// The page's working state is also kept in sessionStorage. The app shell
// swaps between its mobile and desktop layouts at 900px, which remounts the
// page (rotating a tablet is enough), and an ad the user has paid for must
// survive that. saveDraft works even after the component has unmounted, so
// code that arrives mid-remount isn't lost.
const DRAFT_KEY = 'motion-ad-draft'
type Draft = { brief: Brief; productId: string; useLogo: boolean; storyboard: MotionStoryboard | null; ad: { code: string; jobToken: string } | null }

function readDraft(): Partial<Draft> | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as Partial<Draft>) : null
  } catch {
    return null
  }
}

function saveDraft(patch: Partial<Draft>) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...readDraft(), ...patch }))
  } catch { /* storage full or blocked: the draft is a safety net, not required */ }
}

async function authHeaders(): Promise<Record<string, string>> {
  const supabase = getSupabase()
  const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } }
  const token = data.session?.access_token
  if (!token) throw new Error('Please sign in again')
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: 'POST', headers: await authHeaders(), body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data as T
}

async function fetchBlob(url: string | null | undefined): Promise<Blob | null> {
  if (!url) return null
  try {
    const r = await fetch(url)
    return r.ok ? await r.blob() : null
  } catch {
    return null
  }
}

async function blobToBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer())
  let s = ''
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return btoa(s)
}

// Frames the self-review looks at: spread across the ad, including the end card.
const reviewFrames = (d: number) => [0.04, 0.16, 0.3, 0.44, 0.58, 0.72, 0.86, 0.97].map(t => Math.round(t * (d - 1)))

const hostOf = (url: string | null | undefined) => (url ?? '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/[/?#].*$/, '')

const chip = (active: boolean, disabled = false): React.CSSProperties => ({
  padding: '8px 16px', borderRadius: 999,
  background: active ? 'var(--ink)' : 'var(--surface)',
  border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
  color: active ? 'var(--on-ink)' : 'var(--ink-2)',
  fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
})
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }
const label: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--ink-dim)', marginBottom: 6, display: 'block' }
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 14, fontFamily: 'inherit' }
const primary = (disabled: boolean): React.CSSProperties => ({ padding: '12px 22px', borderRadius: 999, border: 'none', background: 'var(--ink)', color: 'var(--on-ink)', fontSize: 14, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 })
const ghost: React.CSSProperties = { padding: '11px 18px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }

const PROGRESS: Record<'writing' | 'checking' | 'reviewing', { title: string; sub: string }> = {
  writing: { title: 'Writing the animation', sub: 'Turning the storyboard into code. Usually 1–2 minutes.' },
  checking: { title: 'Rendering test frames', sub: 'Running it in the preview and snapshotting every scene.' },
  reviewing: { title: 'Art-director pass', sub: 'The AI is looking at its own frames and fixing what it sees. About a minute.' },
}

export default function MotionAdsPage() {
  const { balance, refresh: refreshCredits } = useCredits()
  const [stage, setStage] = useState<Stage>('brief')
  const [brief, setBrief] = useState<Brief>({ brandName: '', product: '', audience: '', idea: '', cta: '', website: '', tone: 'playful', trackKey: MOTION_TONES.playful.track })
  const [musicPicked, setMusicPicked] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [productId, setProductId] = useState<string>('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [useLogo, setUseLogo] = useState(true)
  const [siteUrl, setSiteUrl] = useState('')
  const [filling, setFilling] = useState(false)
  const [storyboard, setStoryboard] = useState<MotionStoryboard | null>(null)
  const [stageAt, setStageAt] = useState(0)
  const [now, setNow] = useState(0)
  const [ad, setAd] = useState<{ code: string; id: string; jobToken: string } | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [renderProgress, setRenderProgress] = useState<number | null>(null)
  const [video, setVideo] = useState<{ blob: Blob; url: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [restorable, setRestorable] = useState<{ code: string; jobToken: string } | null>(null)

  const box = useRef<HTMLDivElement>(null)
  const sandbox = useRef<MotionSandbox | null>(null)
  const assets = useRef<Promise<SandboxAssets> | null>(null)
  // Saving the draft waits until it's been restored; otherwise the fresh,
  // empty state of a remount would overwrite it first.
  const draftRestored = useRef(false)

  const product = products.find(p => p.id === productId) ?? null
  const busy = stage === 'planning' || stage === 'writing' || stage === 'checking' || stage === 'reviewing'

  // The sandbox iframe is created once and stays on screen: Chrome throttles
  // cross-origin iframes that are off-screen, which would stall the stills.
  useEffect(() => {
    if (!box.current) return
    const sb = new MotionSandbox(box.current)
    sb.onRuntimeError(message => setPreviewError(message))
    sandbox.current = sb
    return () => sb.destroy()
  }, [])

  // Prefill from the brand profile and Product Studio.
  useEffect(() => {
    const draft = readDraft()
    ;(async () => {
      try {
        const supabase = getSupabase()
        const { data: sess } = supabase ? await supabase.auth.getSession() : { data: { session: null } }
        const session = sess?.session
        if (draft?.brief) setBrief(draft.brief)
        if (draft?.productId !== undefined) setProductId(draft.productId)
        if (draft?.useLogo !== undefined) setUseLogo(draft.useLogo)
        if (draft?.storyboard) { setStoryboard(draft.storyboard); go('storyboard') }
        if (draft?.ad) setRestorable(draft.ad)
        draftRestored.current = true
        if (!supabase || !session) return
        const [brandRes, productRes] = await Promise.all([
          supabase.from('brand_profiles').select('company_name, description, unique_value_prop, target_audience, logo_url').eq('user_id', session.user.id).maybeSingle(),
          fetch('/api/products-studio', { headers: { Authorization: `Bearer ${session.access_token}` } }).then(r => (r.ok ? r.json() : { products: [] })).catch(() => ({ products: [] })),
        ])
        const b = brandRes.data
        const list = ((productRes.products ?? []) as Product[]).filter(p => Array.isArray(p.photo_urls) && p.photo_urls.length > 0)
        setProducts(list)
        setLogoUrl(b?.logo_url ?? null)
        const first = list[0]
        if (first && draft?.productId === undefined) setProductId(first.id)
        setBrief(prev => ({
          ...prev,
          brandName: prev.brandName || b?.company_name || '',
          product: prev.product || [b?.description, b?.unique_value_prop].filter(Boolean).join(' ') || first?.description || '',
          audience: prev.audience || b?.target_audience || '',
          cta: prev.cta || (first?.product_type === 'app' ? 'Try it free' : first ? 'Shop now' : ''),
          website: prev.website || hostOf(first?.website_url),
        }))
      } catch (err) {
        console.warn('[motion] prefill unavailable', err)
      } finally {
        draftRestored.current = true
      }
    })()
  }, [])

  // Elapsed-time display while the AI works: the stage records when it
  // started (go), the interval only ticks the clock.
  useEffect(() => {
    if (!busy) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [busy])
  const elapsed = Math.max(0, Math.round((now - stageAt) / 1000))

  function go(next: Stage) {
    const t = Date.now()
    setStage(next)
    setStageAt(t)
    setNow(t)
  }

  useEffect(() => {
    if (draftRestored.current) saveDraft({ brief, productId, useLogo, storyboard })
  }, [brief, productId, useLogo, storyboard])

  function setTone(tone: MotionTone) {
    setBrief(prev => ({ ...prev, tone, trackKey: musicPicked ? prev.trackKey : MOTION_TONES[tone].track }))
  }

  function briefPayload() {
    return {
      ...brief,
      hasProductImage: !!product,
      hasLogo: !!(logoUrl && useLogo),
      storyboard,
    }
  }

  async function fillFromWebsite() {
    const url = siteUrl.trim()
    if (!url) return
    setFilling(true)
    try {
      const res = await fetch(`/api/product-url?url=${encodeURIComponent(/^https?:\/\//i.test(url) ? url : `https://${url}`)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not read that page')
      setBrief(prev => ({
        ...prev,
        brandName: prev.brandName || data.productName || '',
        product: [data.productDescription, data.benefits].filter(Boolean).join('\n') || prev.product,
        cta: data.callToAction || prev.cta,
        website: hostOf(url),
      }))
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not read that page')
    } finally {
      setFilling(false)
    }
  }

  async function plan() {
    go('planning')
    try {
      const { storyboard: sb } = await post<{ storyboard: MotionStoryboard }>('/api/motion/plan', { brief: { ...briefPayload(), storyboard: null } })
      setStoryboard(sb)
      go('storyboard')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not plan the ad')
      go(storyboard ? 'storyboard' : 'brief')
    }
  }

  function loadAssets(): Promise<SandboxAssets> {
    const track = motionTrack(brief.trackKey)
    return (async () => {
      const [productImage, logo, music, ...sfx] = await Promise.all([
        fetchBlob(product?.photo_urls[0]),
        fetchBlob(useLogo ? logoUrl : null),
        fetchBlob(track?.url),
        ...SFX_NAMES.map(n => fetchBlob(sfxUrl(n))),
      ])
      return {
        productImage,
        logo,
        music: music && track ? { blob: music, offset: track.offset } : null,
        sfx: Object.fromEntries(SFX_NAMES.flatMap((n, i) => (sfx[i] ? [[n, sfx[i]]] : []))),
      }
    })()
  }

  // Loads code into the sandbox and snapshots it. A compile or runtime error
  // goes back to the model to fix while the job still has fixes left.
  async function loadAndShoot(code: string, jobToken: string, sandboxAssets: SandboxAssets) {
    const sb = sandbox.current!
    for (let attempt = 0; ; attempt++) {
      try {
        const { id, durationInFrames } = await sb.load(code, { width: W, height: H, assets: sandboxAssets })
        const frames = reviewFrames(durationInFrames)
        const stills = await sb.stills(id, frames)
        return { code, id, frames, stills }
      } catch (err) {
        if (attempt >= 1) throw err
        const fix = await post<{ code: string | null }>('/api/motion/revise', { jobToken, brief: briefPayload(), code, error: err instanceof Error ? err.message : String(err) })
        if (!fix.code) throw err
        code = fix.code
      }
    }
  }

  async function makeAd() {
    go('writing')
    setAd(null)
    setVideo(null)
    setSaved(false)
    setPreviewError(null)
    assets.current = loadAssets()
    try {
      const { code, jobToken } = await post<{ code: string; jobToken: string }>('/api/motion/write', { brief: briefPayload() })
      saveDraft({ ad: { code, jobToken } })
      refreshCredits?.()
      go('checking')
      const sandboxAssets = await assets.current
      let shot = await loadAndShoot(code, jobToken, sandboxAssets)

      go('reviewing')
      try {
        const stills = await Promise.all(shot.stills.map(async (b, i) => ({ frame: shot.frames[i], jpegBase64: await blobToBase64(b) })))
        const review = await post<{ code: string | null }>('/api/motion/revise', { jobToken, brief: briefPayload(), code: shot.code, stills })
        if (review.code) {
          const before = shot
          try {
            shot = await loadAndShoot(review.code, jobToken, sandboxAssets)
          } catch (err) {
            // The reviewed version broke and couldn't be fixed: keep the one that worked.
            console.warn('[motion] reviewed version failed, keeping the draft', err)
            shot = await loadAndShoot(before.code, jobToken, sandboxAssets)
          }
        }
      } catch (err) {
        // The review is a polish step; the draft already works.
        console.warn('[motion] review skipped', err)
      }
      saveDraft({ ad: { code: shot.code, jobToken } })
      setAd({ code: shot.code, id: shot.id, jobToken })
      setRestorable(null)
      go('ready')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not make the ad')
      go('storyboard')
    }
  }

  // Brings back the last ad from this tab's draft (after a remount or reload).
  async function showSaved() {
    if (!restorable || !sandbox.current) return
    go('checking')
    try {
      const { id } = await sandbox.current.load(restorable.code, { width: W, height: H, assets: await loadAssets() })
      setAd({ code: restorable.code, id, jobToken: restorable.jobToken })
      setRestorable(null)
      go('ready')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not load the saved ad')
      go(storyboard ? 'storyboard' : 'brief')
    }
  }

  async function exportVideo() {
    if (!ad || !sandbox.current) return
    setRenderProgress(0)
    try {
      const blob = await sandbox.current.render(ad.id, p => setRenderProgress(p))
      if (video) URL.revokeObjectURL(video.url)
      setVideo({ blob, url: URL.createObjectURL(blob) })
      setSaved(false)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setRenderProgress(null)
    }
  }

  async function saveToLibrary() {
    if (!video) return
    setSaving(true)
    try {
      const { signedUrl, storagePath } = await post<{ signedUrl: string; storagePath: string }>('/api/upload-url', { folder: 'motion-ads', ext: 'mp4' })
      const put = await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': 'video/mp4' }, body: video.blob })
      if (!put.ok) throw new Error(`Upload failed (${put.status})`)
      const publicUrl = getSupabase()!.storage.from('ugc-assets').getPublicUrl(storagePath).data.publicUrl
      await post('/api/library/save-video', {
        videoUrl: publicUrl,
        source: 'motion-ad',
        title: `${brief.brandName} motion ad`,
        creditCost: AD_CREDITS,
        metadata: { tone: brief.tone, track: brief.trackKey, shareCopy: storyboard?.shareCopy ?? null, code: ad?.code ?? null },
      })
      setSaved(true)
      showSuccess('Saved to your Library')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  function updateScene(i: number, patch: Partial<MotionStoryboard['scenes'][number]>) {
    setStoryboard(sb => sb && { ...sb, scenes: sb.scenes.map((s, j) => (j === i ? { ...s, ...patch } : s)) })
  }

  const totalSeconds = storyboard?.scenes.reduce((a, s) => a + (Number(s.seconds) || 0), 0) ?? 0
  const canPlan = brief.brandName.trim().length > 0 && brief.product.trim().length >= 10 && !busy
  const canAfford = (balance ?? 0) >= AD_CREDITS

  return (
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: '42px 40px 90px' }}>
      <header style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 54, lineHeight: 1.05, letterSpacing: '-0.01em', margin: 0 }}>
          Motion <em>ads</em>
        </h1>
        <p style={{ fontSize: 15.5, color: 'var(--ink-dim)', margin: '14px 0 0', maxWidth: 600, lineHeight: 1.55 }}>
          Animated story ads: little characters act out your product inside app windows, with music and sound. You approve the storyboard, the AI animates it, you export an MP4.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 380px', gap: 28, alignItems: 'start' }} className="motion-grid">
        {/* ── Left: brief → storyboard → progress → actions ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {restorable && !busy && stage !== 'ready' && (
            <div style={{ ...card, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontSize: 14 }}><strong>Your last ad is ready.</strong> <span style={{ color: 'var(--ink-dim)' }}>It was made in this tab before the page reloaded.</span></div>
              <button type="button" onClick={showSaved} style={primary(false)}>Show it</button>
            </div>
          )}
          {(stage === 'brief' || stage === 'planning') && (
            <div style={card}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={siteUrl} onChange={e => setSiteUrl(e.target.value)} placeholder="Fill from a website: yourbrand.com" style={{ ...input, flex: 1 }} disabled={filling || busy} />
                <button type="button" onClick={fillFromWebsite} disabled={filling || busy || !siteUrl.trim()} style={ghost}>{filling ? 'Reading…' : 'Fill'}</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <span style={label}>Brand name</span>
                  <input value={brief.brandName} onChange={e => setBrief({ ...brief, brandName: e.target.value })} maxLength={60} style={input} disabled={busy} />
                </div>
                <div>
                  <span style={label}>Button</span>
                  <input value={brief.cta} onChange={e => setBrief({ ...brief, cta: e.target.value })} placeholder="Try it free" maxLength={30} style={input} disabled={busy} />
                </div>
              </div>
              <div>
                <span style={label}>What are you selling?</span>
                <textarea value={brief.product} onChange={e => setBrief({ ...brief, product: e.target.value })} rows={3} maxLength={1200} placeholder="What it is, what it does, why it's better. The ad only uses claims you write here." style={{ ...input, resize: 'vertical', lineHeight: 1.5 }} disabled={busy} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <span style={label}>Audience <span style={{ fontWeight: 400 }}>(optional)</span></span>
                  <input value={brief.audience} onChange={e => setBrief({ ...brief, audience: e.target.value })} maxLength={300} style={input} disabled={busy} />
                </div>
                <div>
                  <span style={label}>Website <span style={{ fontWeight: 400 }}>(optional)</span></span>
                  <input value={brief.website} onChange={e => setBrief({ ...brief, website: e.target.value })} maxLength={80} placeholder="yourbrand.com" style={input} disabled={busy} />
                </div>
              </div>
              <div>
                <span style={label}>Story idea <span style={{ fontWeight: 400 }}>(optional)</span></span>
                <input value={brief.idea} onChange={e => setBrief({ ...brief, idea: e.target.value })} maxLength={600} placeholder="e.g. our app racing the old way to the finish line" style={input} disabled={busy} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <span style={label}>Product image</span>
                  <select value={productId} onChange={e => setProductId(e.target.value)} style={input} disabled={busy}>
                    <option value="">None</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}{p.product_type === 'app' ? ' (app)' : ''}</option>)}
                  </select>
                </div>
                <div>
                  <span style={label}>Music</span>
                  <select
                    value={brief.trackKey ?? ''}
                    onChange={e => { setMusicPicked(true); setBrief({ ...brief, trackKey: e.target.value || null }) }}
                    style={input} disabled={busy}
                  >
                    <option value="">No music</option>
                    {MOTION_TRACKS.map(t => <option key={t.key} value={t.key}>{t.title} · {t.bpm} BPM</option>)}
                  </select>
                </div>
              </div>
              {logoUrl && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-dim)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={useLogo} onChange={e => setUseLogo(e.target.checked)} disabled={busy} />
                  Show my logo
                </label>
              )}

              <div>
                <span style={label}>Tone</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {(Object.keys(MOTION_TONES) as MotionTone[]).map(t => (
                    <button key={t} type="button" onClick={() => setTone(t)} disabled={busy} title={MOTION_TONES[t].direction} style={chip(brief.tone === t, busy)}>
                      {MOTION_TONES[t].label}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--ink-mute)', margin: '8px 0 0' }}>{MOTION_TONES[brief.tone].direction}</p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button type="button" onClick={plan} disabled={!canPlan || !canAfford} style={primary(!canPlan || !canAfford)}>
                  {stage === 'planning' ? `Writing the storyboard… ${elapsed}s` : 'Write the storyboard'}
                </button>
                <span style={{ fontSize: 12.5, color: 'var(--ink-mute)' }}>
                  {canAfford ? `Free. The ad itself is ${AD_CREDITS} credits.` : `You need ${AD_CREDITS} credits for a motion ad.`}
                </span>
              </div>
            </div>
          )}

          {(stage === 'writing' || stage === 'checking' || stage === 'reviewing') && (
            <div style={card}>
              {(['writing', 'checking', 'reviewing'] as const).map(s => {
                const order = ['writing', 'checking', 'reviewing']
                const state = order.indexOf(s) < order.indexOf(stage) ? 'done' : s === stage ? 'now' : 'next'
                return (
                  <div key={s} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', opacity: state === 'next' ? 0.45 : 1 }}>
                    <span style={{ width: 22, height: 22, borderRadius: 99, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: state === 'done' ? 'var(--ink)' : 'transparent', color: state === 'done' ? 'var(--on-ink)' : 'var(--ink)', border: '1.5px solid var(--ink)' }}>
                      {state === 'done' ? '✓' : order.indexOf(s) + 1}
                    </span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{PROGRESS[s].title}{state === 'now' ? ` · ${elapsed}s` : ''}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--ink-mute)', marginTop: 2 }}>{PROGRESS[s].sub}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {stage === 'ready' && ad && (
            <div style={card}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Your ad is ready</div>
              <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-dim)' }}>Press play in the preview to hear it. Export renders the MP4 on your device, with sound.</p>
              {previewError && <div style={{ fontSize: 12.5, color: 'var(--danger)' }}>The preview hit an error: {previewError}</div>}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <button type="button" onClick={exportVideo} disabled={renderProgress !== null} style={primary(renderProgress !== null)}>
                  {renderProgress !== null ? `Exporting… ${Math.round(renderProgress * 100)}%` : video ? 'Export again' : 'Export MP4'}
                </button>
                {video && (
                  <>
                    <a href={video.url} download={`${brief.brandName || 'motion'}-ad.mp4`.replace(/[^a-zA-Z0-9._-]+/g, '-')} style={{ ...ghost, textDecoration: 'none' }}>Download</a>
                    <button type="button" onClick={saveToLibrary} disabled={saving || saved} style={ghost}>{saved ? '✓ In your Library' : saving ? 'Saving…' : 'Save to Library'}</button>
                  </>
                )}
              </div>
              {storyboard?.shareCopy && (
                <div>
                  <span style={label}>Caption to post with it</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <p style={{ margin: 0, flex: 1, fontSize: 13.5, lineHeight: 1.5, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>{storyboard.shareCopy}</p>
                    <button type="button" onClick={() => { void navigator.clipboard.writeText(storyboard.shareCopy); showSuccess('Copied') }} style={ghost}>Copy</button>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button type="button" onClick={makeAd} disabled={!canAfford} style={ghost}>Another take · {AD_CREDITS} cr</button>
                <button type="button" onClick={() => go('storyboard')} style={ghost}>Change the storyboard</button>
                <button type="button" onClick={() => { sessionStorage.removeItem(DRAFT_KEY); setStoryboard(null); setAd(null); setVideo(null); setRestorable(null); go('brief') }} style={ghost}>Start over</button>
              </div>
            </div>
          )}
          {storyboard && (stage === 'storyboard' || stage === 'writing' || stage === 'checking' || stage === 'reviewing' || stage === 'ready') && (
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>Storyboard</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-mute)' }}>{totalSeconds.toFixed(1)}s · {MOTION_TONES[brief.tone].label} · {motionTrack(brief.trackKey)?.title ?? 'no music'}</div>
              </div>
              <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-dim)', lineHeight: 1.5 }}>{storyboard.angle}</p>
              <div>
                <span style={label}>Hook (first 2 seconds)</span>
                <textarea value={storyboard.hook} onChange={e => setStoryboard({ ...storyboard, hook: e.target.value })} rows={2} style={{ ...input, resize: 'vertical' }} disabled={stage !== 'storyboard'} />
              </div>
              {storyboard.scenes.map((s, i) => (
                <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-mute)' }}>{i + 1}</span>
                    <input value={s.title} onChange={e => updateScene(i, { title: e.target.value })} style={{ ...input, fontWeight: 600 }} disabled={stage !== 'storyboard'} />
                    <input type="number" min={1} max={8} step={0.5} value={s.seconds} onChange={e => updateScene(i, { seconds: Number(e.target.value) })} style={{ ...input, width: 76 }} disabled={stage !== 'storyboard'} title="Seconds" />
                  </div>
                  <textarea value={s.action} onChange={e => updateScene(i, { action: e.target.value })} rows={2} style={{ ...input, resize: 'vertical', fontSize: 13 }} disabled={stage !== 'storyboard'} />
                  <input value={s.text} onChange={e => updateScene(i, { text: e.target.value })} placeholder="On-screen text" style={{ ...input, fontSize: 13 }} disabled={stage !== 'storyboard'} />
                </div>
              ))}
              <div>
                <span style={label}>Punchline</span>
                <input value={storyboard.punchline} onChange={e => setStoryboard({ ...storyboard, punchline: e.target.value })} style={input} disabled={stage !== 'storyboard'} />
              </div>
              {stage === 'storyboard' && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button type="button" onClick={makeAd} disabled={!canAfford} style={primary(!canAfford)}>Make the ad · {AD_CREDITS} credits</button>
                  <button type="button" onClick={plan} style={ghost}>New storyboard</button>
                  <button type="button" onClick={() => go('brief')} style={ghost}>Edit brief</button>
                </div>
              )}
            </div>
          )}

        </div>

        {/* ── Right: the sandboxed preview. Always mounted and on screen. ── */}
        <div style={{ position: 'sticky', top: 24 }}>
          <div style={{ position: 'relative', width: '100%', aspectRatio: '9 / 16', borderRadius: 18, overflow: 'hidden', border: '1px solid var(--border)', background: '#111' }}>
            <div ref={box} style={{ position: 'absolute', inset: 0 }} />
            {stage !== 'ready' && stage !== 'checking' && stage !== 'reviewing' && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'var(--surface-2)', color: 'var(--ink-mute)', fontSize: 13, textAlign: 'center', padding: 24 }}>
                <span style={{ fontSize: 28 }}>▶</span>
                {stage === 'writing' ? 'The preview appears here in a minute or two.' : 'Your ad will preview here.'}
              </div>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink-mute)', margin: '10px 2px 0', lineHeight: 1.5 }}>
            1080×1920 · made for TikTok, Reels and Shorts. Keeps the bottom fifth clear for their captions.
          </p>
        </div>
      </div>
      <style>{`@media (max-width: 900px) { .motion-grid { grid-template-columns: 1fr !important; } }`}</style>
    </main>
  )
}
