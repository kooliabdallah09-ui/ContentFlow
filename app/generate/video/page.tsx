'use client'

import { useEffect, useRef, useState } from 'react'
import { DriveConnectBanner } from '@/components/DriveConnectBanner'
import { getSupabase } from '@/lib/auth'
import { readPrefill } from '@/lib/calendar-prefill'
import { readChatPrefill } from '@/lib/chat-prefill'
import { useCredits } from '@/lib/useCredits'
import { showError, showSuccess } from '@/lib/notifications'
import { Download, Play, Upload, X } from 'lucide-react'
import { GeneratingOverlay } from '@/components/GeneratingOverlay'
import { SectionTabs, VIDEO_STUDIO_TABS } from '@/components/SectionTabs'

type Model = 'seedance-2' | 'seedance-2-5' | 'seedance-mini'
type Resolution = '480p' | '720p' | '1080p' | '4k'

const MODELS: {
  id: Model
  name: string
  badge: string
  tagline: string
  excels: string[]
  caveat: string
  durations: number[]
  credits: Record<number, number>
}[] = [
  {
    id: 'seedance-2',
    name: 'Seedance 2.0',
    badge: 'Default',
    tagline: 'AI video model with native audio, character consistency, and up to 4K output.',
    excels: [
      'Native audio (voice, ambient, music)',
      'Product / character continuity from a reference image',
      'Fluid camera moves + timed beats',
      'Up to 60 seconds per clip',
    ],
    caveat: 'Pick resolution below — 480p is 6× cheaper than 1080p',
    // Seedance supports any int duration up to 60. Presets picked to match
    // common short-form clip lengths.
    durations: [5, 10, 15, 30, 60],
    // Credits: per-second based on RESOLUTION, not duration. Kept for
    // interface compatibility; real cost computed with getSeedanceCost().
    credits: { 5: 0, 10: 0, 15: 0, 30: 0, 60: 0 },
  },
  {
    id: 'seedance-2-5',
    name: 'Seedance 2.5',
    badge: 'Premium',
    tagline: 'ByteDance’s newest AI video model — sharpest motion + best prompt adherence.',
    excels: [
      'Sharpest physics + motion of the family',
      'Best prompt adherence for complex scenes',
      'Same multimodal inputs + native audio',
      'Up to 60 seconds per clip',
    ],
    caveat: 'Caps at 1080p (no 4K). ~1.5× the per-second cost of 2.0.',
    durations: [5, 10, 15, 30, 60],
    credits: { 5: 0, 10: 0, 15: 0, 30: 0, 60: 0 },
  },
  {
    id: 'seedance-mini',
    name: 'Seedance Mini',
    badge: 'Draft',
    tagline: 'AI video model at ~½ the price — fast drafts, capped at 720p.',
    excels: [
      'About half the per-second cost',
      'Same multimodal inputs + native audio',
      'Great for drafts + high-volume output',
      'Up to 60 seconds per clip',
    ],
    caveat: 'Caps at 720p — quality below full Seedance, fine for social drafts',
    durations: [5, 10, 15, 30, 60],
    credits: { 5: 0, 10: 0, 15: 0, 30: 0, 60: 0 },
  },
]

interface VideoState {
  predictionId: string
  provider: 'seedance'
  status: 'processing' | 'completed' | 'failed'
  videoUrl?: string
  error?: string
}

// Seedance 2.0 non_video_in pricing per second, in credits (1.8× markup
// on the raw BytePlus rate, rounded up so we never lose money).
const SEEDANCE_CR_PER_SECOND: Record<Resolution, number> = {
  '480p': 6,     // $0.08/s
  '720p': 13,    // $0.18/s
  '1080p': 33,   // $0.45/s
  '4k':   72,    // $1.00/s
}
// Disabling native audio drops the compute meaningfully — we pass 15% of
// the savings back to the user (nice round discount, still profitable).
const NO_AUDIO_MULTIPLIER = 0.85
const SEEDANCE_MINI_CR_PER_SECOND: Record<'480p' | '720p', number> = {
  '480p': 3,   // $0.04/s
  '720p': 7,   // $0.09/s
}
// Seedance 2.5 — BytePlus pinned pricing (10.70 / 10.70 / 11.70 USD/M
// tokens for 480p / 720p / 1080p). 4K unsupported on 2.5. Matches
// lib/ugc-pricing.ts's SEEDANCE_2_5_CR_PER_SECOND to the cent.
const SEEDANCE_2_5_CR_PER_SECOND: Record<'480p' | '720p' | '1080p', number> = {
  '480p':  6,
  '720p':  13,
  '1080p': 32,
}
function perSecondFor(model: Model, resolution: Resolution): number {
  if (model === 'seedance-mini') {
    return SEEDANCE_MINI_CR_PER_SECOND[resolution === '480p' ? '480p' : '720p']
  }
  if (model === 'seedance-2-5') {
    // 2.5 caps at 1080p — anything higher bills at 1080p.
    const res: '480p' | '720p' | '1080p' = resolution === '4k' ? '1080p' : resolution
    return SEEDANCE_2_5_CR_PER_SECOND[res]
  }
  return SEEDANCE_CR_PER_SECOND[resolution]
}
// CineMotion adds Sonnet direction + the NB Pro opening frame. Sync with
// CINEMOTION_CR on the server.
const CINEMOTION_CR = 14
function getSeedanceCost(duration: number, resolution: Resolution, withAudio: boolean, model: Model = 'seedance-2', cinemotion: boolean = false): number {
  const base = duration * perSecondFor(model, resolution)
  return Math.max(1, Math.ceil(withAudio ? base : base * NO_AUDIO_MULTIPLIER)) + (cinemotion ? CINEMOTION_CR : 0)
}
function getSeedancePerSecond(resolution: Resolution, withAudio: boolean, model: Model = 'seedance-2'): number {
  const per = perSecondFor(model, resolution)
  return withAudio ? per : Math.ceil(per * NO_AUDIO_MULTIPLIER)
}

export default function VideoGeneratorPage() {
  const [model, setModel] = useState<Model>('seedance-2')
  const [userPlan, setUserPlan] = useState('')
  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) return
    supabase.auth.getSession().then(async (res: { data: { session: { user?: { email?: string | null }; access_token?: string } | null } }) => {
      const token = res.data.session?.access_token
      if (token) {
        const r = await fetch('/api/credits/balance', { headers: { Authorization: `Bearer ${token}` } }).catch(() => null)
        if (r?.ok) { const d = await r.json(); if (d.plan) setUserPlan(d.plan) }
      }
    })
  }, [])
  const [prompt, setPrompt] = useState('')
  const [rewriting, setRewriting] = useState(false)
  // Director mode: one-line intent -> Sonnet-directed Seedance prompt +
  // a 3-frame Nano Banana storyboard preview before spending video credits.
  const [intent, setIntent] = useState('')
  const [directing, setDirecting] = useState(false)
  const [storyboard, setStoryboard] = useState<string[]>([])
  const [useKeyframe, setUseKeyframe] = useState(true)
  // HyperMotion: pure-CGI product commercial — product photo in, Sonnet
  // writes the whole physics-driven prompt server-side.
  const [hyperMotion, setHyperMotion] = useState(false)
  const [hyperNote, setHyperNote] = useState('')
  // Product Studio products — one click loads their angle photos as refs.
  const [studioProducts, setStudioProducts] = useState<Array<{ id: string; name: string; photo_urls: string[] }>>([])
  const [videoProductId, setVideoProductId] = useState<string | undefined>(undefined)

  useEffect(() => {
    (async () => {
      try {
        const supabase = getSupabase()
        const { data: sess } = supabase ? await supabase.auth.getSession() : { data: { session: null } }
        const token = sess?.session?.access_token
        if (!token) return
        const res = await fetch('/api/products-studio', { headers: { Authorization: `Bearer ${token}` } })
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data?.products)) setStudioProducts(data.products)
        }
      } catch { /* optional */ }
    })()
  }, [])

  async function importStudioProduct(sp: { id: string; name: string; photo_urls: string[] }) {
    if (videoProductId === sp.id) { setVideoProductId(undefined); setRefImages([]); return }
    setVideoProductId(sp.id)
    const imgs: Array<{ base64: string; mimeType: string; preview: string }> = []
    for (const url of (sp.photo_urls ?? []).slice(0, 2)) {
      try {
        const r = await fetch(url)
        if (!r.ok) continue
        const blob = await r.blob()
        const buf = new Uint8Array(await blob.arrayBuffer())
        let bin = ''
        for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i])
        const base64 = btoa(bin)
        const mimeType = blob.type || 'image/png'
        imgs.push({ base64, mimeType, preview: `data:${mimeType};base64,${base64}` })
      } catch { /* skip */ }
    }
    if (imgs.length) {
      setRefImages(imgs)
      showSuccess('Product loaded', `${sp.name} — ${imgs.length} photo${imgs.length > 1 ? 's' : ''} set as reference.`)
    } else {
      showError('Load failed', 'Could not fetch the product photos')
    }
  }
  const [duration, setDuration] = useState(5)
  const [resolution, setResolution] = useState<Resolution>('720p')
  const [withAudio, setWithAudio] = useState(true)
  const [aspect, setAspect] = useState<'portrait' | 'tall' | 'square' | 'landscape'>('portrait')
  const [refImages, setRefImages] = useState<Array<{ base64: string; mimeType: string; preview: string }>>([])

  const [generating, setGenerating] = useState(false)
  const [video, setVideo] = useState<VideoState | null>(null)
  const [error, setError] = useState('')
  const [contentId, setContentId] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { balance: rawBalance, refresh: refreshCredits } = useCredits()
  const creditBalance = rawBalance ?? 0

  const cfg = MODELS.find(m => m.id === model)!
  // Seedance pricing depends on resolution × duration. Other models keep
  // the flat per-duration table.
  const cost = getSeedanceCost(duration, resolution, withAudio, model, hyperMotion)
  const canGenerate = (hyperMotion ? refImages.length > 0 : prompt.trim().length >= 5) && creditBalance >= cost

  // Reset duration when switching models if current duration isn't valid
  useEffect(() => {
    if (!cfg.durations.includes(duration)) {
      setDuration(cfg.durations[1] ?? cfg.durations[0])
    }
  }, [model])

  // Prefill from a calendar suggestion. Also loads the brand's primary
  // product photo (if any) into refImages so the video seed matches the
  // real product — no extra clicks for the user.
  useEffect(() => {
    const suggestion = readPrefill('video')
    if (suggestion) {
      const richPrompt = (suggestion.description && suggestion.description !== suggestion.title)
        ? suggestion.description
        : suggestion.title
      setPrompt(String(richPrompt).trim().slice(0, 4000))
      // Fire-and-forget: fetch the brand's product image and stash it as a
      // reference image. Runs after the prompt is already filled.
      ;(async () => {
        try {
          const supabase = getSupabase()
          if (!supabase) return
          const { data: sess } = await supabase.auth.getSession()
          const token = sess?.session?.access_token
          if (!token) return
          const res = await fetch('/api/brand/load', { headers: { Authorization: `Bearer ${token}` } })
          if (!res.ok) return
          const data = await res.json()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const brand = data?.brand as any
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const products = Array.isArray(brand?.products) ? brand.products as any[] : []
          const productImageUrl: string | undefined =
            products.find(p => typeof p?.image_url === 'string' && p.image_url)?.image_url
            ?? brand?.product_image_url
          if (!productImageUrl) return
          const imgRes = await fetch(productImageUrl)
          if (!imgRes.ok) return
          const blob = await imgRes.blob()
          const mimeType = blob.type || 'image/jpeg'
          const base64 = await new Promise<string>((resolve, reject) => {
            const r = new FileReader()
            r.onloadend = () => {
              const dataUrl = String(r.result ?? '')
              const b64 = dataUrl.split(',')[1] ?? ''
              b64 ? resolve(b64) : reject(new Error('empty'))
            }
            r.onerror = () => reject(new Error('read'))
            r.readAsDataURL(blob)
          })
          const preview = `data:${mimeType};base64,${base64}`
          setRefImages(prev => prev.length ? prev : [{ base64, mimeType, preview }])
        } catch { /* non-fatal */ }
      })()
      return
    }
    const chat = readChatPrefill()
    if (chat) setPrompt(chat.slice(0, 4000))
  }, [])

  // Poll status while processing
  useEffect(() => {
    if (!video?.predictionId || video.status !== 'processing') return
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/ugc/video-status?videoId=${video.predictionId}&provider=${video.provider}`)
        const data = await res.json()
        const v = data.video
        if (v?.status === 'completed' || v?.status === 'failed') {
          setVideo(prev => prev ? { ...prev, status: v.status, videoUrl: v.videoUrl, error: v.error } : prev)
          if (v.status === 'completed') showSuccess('Video ready', 'Your video has been generated')
          clearInterval(pollRef.current!)

          try {
            const supabase = getSupabase()
            if (supabase) {
              const { data: sess } = await supabase.auth.getSession()
              const token = sess?.session?.access_token
              if (token) {
                if (contentId) {
                  fetch('/api/video/complete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ contentId, videoUrl: v.videoUrl, status: v.status, error: v.error }),
                  }).catch(() => {})
                }
                if (v.status === 'completed' && v.videoUrl) {
                  fetch('/api/library/save-video', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ videoUrl: v.videoUrl, source: 'video', title: 'AI Video', metadata: { prompt } }),
                  }).catch(() => {})
                }
              }
            }
          } catch {}
        }
      } catch {}
    }, 5000)
    return () => clearInterval(pollRef.current!)
  }, [video?.predictionId, video?.status, contentId])

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const remaining = 4 - refImages.length
    const toAdd = files.slice(0, remaining)
    for (const file of toAdd) {
      if (file.size > 5 * 1024 * 1024) { setError('Each reference image must be under 5MB'); continue }
      const reader = new FileReader()
      reader.onload = ev => {
        const result = ev.target?.result as string
        setRefImages(prev => prev.length < 4 ? [...prev, { base64: result.split(',')[1], mimeType: file.type, preview: result }] : prev)
      }
      reader.readAsDataURL(file)
    }
    e.target.value = ''
  }

  async function generate() {
    if (!canGenerate || generating) return
    setError('')
    setGenerating(true)
    setVideo(null)
    setContentId(null)
    try {
      const supabase = getSupabase()
      if (!supabase) throw new Error('Auth not ready')
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) throw new Error('Not signed in')

      const res = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          prompt: prompt.trim(),
          model,
          duration,
          resolution,
          withAudio,
          aspect,
          referenceImages: refImages.map(img => ({ base64: img.base64, mimeType: img.mimeType })),
          startImageUrl: useKeyframe && storyboard[0] ? storyboard[0] : undefined,
          mode: hyperMotion ? 'hypermotion' : undefined,
          hyperNote: hyperMotion ? (hyperNote.trim() || undefined) : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')

      if (data.contentId) setContentId(data.contentId)

      setVideo({
        predictionId: data.predictionId,
        provider: 'seedance',
        status: 'processing',
      })
      refreshCredits()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed'
      setError(msg)
      showError('Generation failed', msg)
    } finally {
      setGenerating(false)
    }
  }

  if (userPlan === 'lite') {
    return (
      <main style={{ maxWidth: 860, margin: '0 auto', padding: '42px 40px 90px' }}>
        <SectionTabs tabs={VIDEO_STUDIO_TABS} />
        <div style={{ marginTop: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
          </div>
          <div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 28, letterSpacing: '-0.02em', margin: '0 0 8px' }}>Video is not included in <em>Lite</em></h2>
            <p style={{ fontSize: 14, color: 'var(--ink-dim)', maxWidth: 380, margin: '0 auto', lineHeight: 1.6 }}>Upgrade to Starter to unlock AI video generation, UGC videos, and more.</p>
          </div>
          <a href="/settings/billing" style={{ marginTop: 8, padding: '11px 28px', borderRadius: 10, background: '#111', color: '#fff', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
            Upgrade to Starter →
          </a>
        </div>
      </main>
    )
  }

  const VIDEO_STEPS = [
    { label: 'Preparing your clip', sub: 'Analysing the prompt and reference…' },
    { label: 'Generating video', sub: 'Running Seedance motion model…' },
    { label: 'Processing frames', sub: 'Upscaling and colour grading…' },
    { label: 'Almost done', sub: 'Finalising the export…' },
  ]

  return (
    <>
    <GeneratingOverlay active={generating} steps={VIDEO_STEPS} tipSeconds={45} />
    <main style={{ maxWidth: 860, margin: '0 auto', padding: '42px 40px 90px' }} className="vid-page">
      <SectionTabs tabs={VIDEO_STUDIO_TABS} />
      <DriveConnectBanner />
      <header style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-dim)', marginBottom: 8 }}>
          Create
        </div>
        <h1 className="vid-h1" style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 48, lineHeight: 1.05, letterSpacing: '-0.01em', margin: 0 }}>
          Video
        </h1>
        <p style={{ fontSize: 14.5, color: 'var(--ink-dim)', margin: '10px 0 0', lineHeight: 1.55 }}>
          AI video generation on the Seedance family — pick the model and resolution.
        </p>
      </header>

      {/* Model picker — Seedance 2.0 (default) / 2.5 (premium) / Mini (draft) */}
      <div className="vid-models" style={{ marginBottom: 24, display: 'flex', gap: 10 }}>
        {MODELS.map(m => {
          const active = model === m.id
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setModel(m.id)
                // Engine-specific resolution caps: mini→720p, 2.5→1080p.
                if (m.id === 'seedance-mini' && (resolution === '1080p' || resolution === '4k')) setResolution('720p')
                if (m.id === 'seedance-2-5' && resolution === '4k') setResolution('1080p')
              }}
              style={{
                flex: 1, textAlign: 'left', padding: '14px 18px', borderRadius: 14, cursor: 'pointer',
                border: `1.5px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                background: active ? 'var(--ink)' : 'var(--surface)',
                color: active ? 'var(--on-ink)' : 'var(--ink)',
                display: 'flex', flexDirection: 'column', gap: 3,
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{m.name}</span>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 999, background: active ? 'var(--on-ink)' : 'var(--surface-2)', color: active ? 'var(--ink)' : 'var(--ink-dim)' }}>{m.badge}</span>
              </div>
              <div style={{ fontSize: 11.5, opacity: 0.8 }}>{m.tagline}</div>
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Duration */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-dim)', marginBottom: 14 }}>Duration</div>
          <div className="vid-chiprow" style={{ display: 'flex', gap: 10 }}>
            {cfg.durations.map(sec => {
              const cr = getSeedanceCost(sec, resolution, withAudio, model)
              const active = duration === sec
              return (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setDuration(sec)}
                  disabled={generating}
                  style={{
                    flex: 1, padding: '14px 8px', borderRadius: 10, textAlign: 'center',
                    border: `1.5px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                    background: active ? 'var(--ink)' : 'transparent',
                    color: active ? 'var(--on-ink)' : 'var(--ink)',
                    cursor: generating ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s',
                    display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 18, fontWeight: 700 }}>{sec}s</span>
                  <span style={{ fontSize: 11, opacity: active ? 0.75 : 1, color: active ? 'var(--on-ink)' : 'var(--ink-dim)', fontWeight: 600 }}>{cr} cr</span>
                </button>
              )
            })}
          </div>

          {/* Resolution — always shown; engine-specific option list. */}
          {(model === 'seedance-2' || model === 'seedance-2-5' || model === 'seedance-mini') && (
            <>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-dim)', marginTop: 24, marginBottom: 14 }}>
                Resolution <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--ink-mute)', fontFamily: 'inherit' }}>· lower is cheaper</span>
              </div>
              <div className="vid-chiprow" style={{ display: 'flex', gap: 10 }}>
                {(((): Resolution[] => {
                  // Mini caps at 720p; 2.5 caps at 1080p; 2.0 supports 4K.
                  if (model === 'seedance-mini') return ['480p', '720p']
                  if (model === 'seedance-2-5') return ['480p', '720p', '1080p']
                  return ['480p', '720p', '1080p', '4k']
                })()).map(r => {
                  const active = resolution === r
                  const perSec = getSeedancePerSecond(r, withAudio, model)
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setResolution(r)}
                      disabled={generating}
                      style={{
                        flex: 1, padding: '12px 8px', borderRadius: 10, textAlign: 'center',
                        border: `1.5px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                        background: active ? 'var(--ink)' : 'transparent',
                        color: active ? 'var(--on-ink)' : 'var(--ink)',
                        cursor: generating ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s',
                        display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center',
                      }}
                    >
                      <span style={{ fontSize: 15, fontWeight: 700 }}>{r}</span>
                      <span style={{ fontSize: 10.5, opacity: active ? 0.75 : 1, color: active ? 'var(--on-ink)' : 'var(--ink-dim)', fontWeight: 500 }}>{perSec} cr/s</span>
                    </button>
                  )
                })}
              </div>

              {/* Audio toggle */}
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-dim)', marginTop: 24, marginBottom: 14 }}>
                Native audio <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--ink-mute)', fontFamily: 'inherit' }}>· voice, ambient sound, music</span>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {([
                  { on: true,  label: 'With audio',    hint: 'default rate' },
                  { on: false, label: 'Silent',        hint: '15% cheaper' },
                ] as const).map(opt => {
                  const active = withAudio === opt.on
                  return (
                    <button
                      key={String(opt.on)}
                      type="button"
                      onClick={() => setWithAudio(opt.on)}
                      disabled={generating}
                      style={{
                        flex: 1, padding: '12px 12px', borderRadius: 10, textAlign: 'left',
                        border: `1.5px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                        background: active ? 'var(--ink)' : 'transparent',
                        color: active ? 'var(--on-ink)' : 'var(--ink)',
                        cursor: generating ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s',
                        display: 'flex', flexDirection: 'column', gap: 2,
                      }}
                    >
                      <span style={{ fontSize: 13.5, fontWeight: 700 }}>{opt.label}</span>
                      <span style={{ fontSize: 10.5, opacity: active ? 0.75 : 1, color: active ? 'var(--on-ink)' : 'var(--ink-dim)', fontWeight: 500 }}>{opt.hint}</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Format */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-dim)', marginBottom: 14 }}>Format</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {([
              { id: 'portrait',  label: 'Portrait',  sub: '9:16',  icon: '▯' },
              { id: 'tall',      label: 'Tall',      sub: '3:4',   icon: '▯' },
              { id: 'square',    label: 'Square',    sub: '1:1',   icon: '□' },
              { id: 'landscape', label: 'Landscape', sub: '16:9',  icon: '▭' },
            ] as const).map(f => {
              const active = aspect === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setAspect(f.id)}
                  disabled={generating}
                  style={{
                    flex: 1, padding: '14px 8px', borderRadius: 10, textAlign: 'center',
                    border: `1.5px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                    background: active ? 'var(--ink)' : 'transparent',
                    color: active ? 'var(--on-ink)' : 'var(--ink)',
                    cursor: generating ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s',
                    display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 20 }}>{f.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{f.label}</span>
                  <span style={{ fontSize: 10.5, opacity: active ? 0.7 : 1, color: active ? 'var(--on-ink)' : 'var(--ink-dim)', fontFamily: 'var(--font-mono)' }}>{f.sub}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Director mode */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <label style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-dim)' }}>
              Director mode
            </label>
            <span style={{ fontSize: 11.5, color: 'var(--ink-mute)' }}>tell it the idea — AI writes the full shot list + storyboard</span>
          </div>
          <div className="vid-director-row" style={{ display: 'flex', gap: 10 }}>
            <input
              type="text"
              value={intent}
              onChange={e => setIntent(e.target.value)}
              disabled={directing || generating}
              placeholder='e.g. "Skittles bag bursting open in slow motion, candy raining, luxury vibe"'
              style={{ flex: 1, padding: '11px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 13.5, fontFamily: 'inherit', outline: 'none' }}
            />
            <button
              type="button"
              disabled={directing || generating || intent.trim().length < 5}
              onClick={async () => {
                setDirecting(true)
                setStoryboard([])
                try {
                  const supabase = getSupabase()
                  if (!supabase) throw new Error('Not signed in')
                  const { data: sess } = await supabase.auth.getSession()
                  const token = sess?.session?.access_token
                  if (!token) throw new Error('Not signed in')
                  const res = await fetch('/api/video/direct', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ intent: intent.trim(), durationSeconds: duration, aspect }),
                  })
                  const data = await res.json()
                  if (!res.ok) throw new Error(data.error || 'Direction failed')
                  setPrompt(String(data.prompt).slice(0, 4000))
                  setStoryboard(Array.isArray(data.keyframes) ? data.keyframes : [])
                  showSuccess('Directed', 'Storyboard ready — review it, tweak the prompt if you like, then generate.')
                } catch (err) {
                  showError('Direction failed', err instanceof Error ? err.message : 'Try again')
                } finally {
                  setDirecting(false)
                }
              }}
              className="btn btn-primary"
              style={{ padding: '11px 18px', fontSize: 13, borderRadius: 10, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              {directing ? 'Directing…' : 'Direct my video · 15 cr'}
            </button>
          </div>

          {storyboard.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>
                Storyboard preview — opening · midpoint · final
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {storyboard.map((url, i) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" style={{ display: 'block', borderRadius: 10, overflow: 'hidden', border: `2px solid ${i === 0 && useKeyframe ? 'var(--ink)' : 'var(--border)'}` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Keyframe ${i + 1}`} style={{ width: '100%', display: 'block', objectFit: 'cover' }} />
                  </a>
                ))}
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12.5, color: 'var(--ink-dim)', cursor: 'pointer' }}>
                <input type="checkbox" checked={useKeyframe} onChange={e => setUseKeyframe(e.target.checked)} style={{ accentColor: 'var(--ink)' }} />
                Use the opening frame as the video&apos;s first frame (image-to-video)
              </label>
              <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 4 }}>
                The full shot list landed in the prompt box below — edit anything, then hit Generate.
              </div>
            </div>
          )}
        </div>

        {/* Prompt */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <label style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-dim)' }}>
              Prompt <span style={{ color: 'var(--danger, #e84a4a)' }}>*</span>
            </label>
            <button
              type="button"
              disabled={rewriting || generating || prompt.trim().length < 4}
              onClick={async () => {
                setRewriting(true)
                try {
                  const supabase = getSupabase()
                  if (!supabase) throw new Error('Not signed in')
                  const { data: sess } = await supabase.auth.getSession()
                  const token = sess?.session?.access_token
                  if (!token) throw new Error('Not signed in')
                  const res = await fetch('/api/video/rewrite-prompt', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ prompt: prompt.trim(), duration, aspect }),
                  })
                  const data = await res.json()
                  if (!res.ok) throw new Error(data.error || 'Rewrite failed')
                  if (data.prompt) setPrompt(String(data.prompt).slice(0, 4000))
                } catch (err) {
                  showError('Enhance failed', err instanceof Error ? err.message : 'Try again')
                } finally {
                  setRewriting(false)
                }
              }}
              style={{
                fontSize: 11.5, fontWeight: 600,
                padding: '6px 12px', borderRadius: 8,
                border: '1px dashed var(--border-strong, var(--border))',
                background: 'var(--surface-2, var(--surface))',
                color: 'var(--ink)',
                cursor: (rewriting || generating || prompt.trim().length < 4) ? 'not-allowed' : 'pointer',
                opacity: (rewriting || generating || prompt.trim().length < 4) ? 0.5 : 1,
              }}
            >
              {rewriting ? 'Enhancing…' : '✨ Enhance prompt'}
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink-dim)', margin: '0 0 10px', lineHeight: 1.55 }}>
            {model === 'seedance-2'
              ? 'Describe the scene, camera move, lighting, motion and mood. Reference images below seed the first frame.'
              : 'Describe the character, expression, action and setting. Mention tone of voice or emotion if you want it in the audio.'}
          </p>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value.slice(0, 4000))}
            disabled={generating}
            rows={6}
            placeholder={model === 'seedance-2'
              ? 'Example: Cozy morning kitchen, soft window light. A woman in her late 20s slowly pours coffee into a ceramic mug, steam curling, handheld phone-camera framing, gentle push-in.'
              : 'Example: A confident woman in her 30s looking directly at camera, saying "This changed everything for me" with a warm smile. Lived-in home office background, soft window light, handheld camera feel.'}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '10px 12px', borderRadius: 9,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--ink)', fontSize: 13.5,
              fontFamily: 'inherit', outline: 'none',
              resize: 'vertical', minHeight: 140,
              lineHeight: 1.55,
            }}
          />
          <p style={{ fontSize: 10.5, color: 'var(--ink-dim)', textAlign: 'right', margin: '4px 0 0', fontFamily: 'var(--font-mono)' }}>
            {prompt.length} / 4000
          </p>
        </div>

        {/* Reference images */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-dim)', marginBottom: 6 }}>
            Reference Images <span style={{ fontSize: 10, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional · up to 4)</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink-dim)', margin: '0 0 12px', lineHeight: 1.55 }}>
            {model === 'seedance-2' ? 'Seeds the first frame. Product shots or character references work great.' : 'First image used as the starting face or scene.'}
          </p>

          {refImages.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {refImages.map((img, i) => (
                <div key={i} style={{ position: 'relative', width: 72, height: 72 }}>
                  <img src={img.preview} alt={`ref ${i + 1}`} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 9, border: i === 0 ? '2px solid var(--accent, #6366f1)' : '1.5px solid var(--border)', display: 'block' }} />
                  {i === 0 && (
                    <span style={{ position: 'absolute', bottom: 3, left: 3, fontSize: 9, fontFamily: 'var(--font-mono)', background: 'var(--accent, #6366f1)', color: '#fff', padding: '1px 4px', borderRadius: 4, letterSpacing: '.04em' }}>MAIN</span>
                  )}
                  <button
                    onClick={() => setRefImages(prev => prev.filter((_, j) => j !== i))}
                    disabled={generating}
                    style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: 'var(--danger, #e84a4a)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontSize: 10 }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {refImages.length < 4 && (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 9, border: '1.5px dashed var(--border)', color: 'var(--ink-dim)', fontSize: 13, cursor: generating ? 'not-allowed' : 'pointer' }}>
              <Upload size={14} />
              <span>{refImages.length === 0 ? 'Upload images (max 5MB each)' : 'Add another image'}</span>
              <input type="file" accept="image/*" multiple onChange={handleImageChange} disabled={generating} style={{ display: 'none' }} />
            </label>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(184,58,53,0.08)', border: '1px solid var(--danger, #e84a4a)', color: 'var(--danger, #e84a4a)', fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Generate */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink-dim)' }}>
            <span>Cost: <strong style={{ color: 'var(--ink)' }}>{cost} credits</strong></span>
            <span>Balance: <strong style={{ color: creditBalance >= cost ? 'var(--good, #10b981)' : 'var(--danger, #e84a4a)' }}>{creditBalance}</strong></span>
          </div>
          <button
            onClick={generate}
            disabled={!canGenerate || generating}
            style={{
              width: '100%', padding: '14px 0', borderRadius: 12,
              background: !canGenerate || generating ? 'var(--border)' : 'var(--ink)',
              color: !canGenerate || generating ? 'var(--ink-dim)' : 'var(--on-ink)',
              border: 'none', fontSize: 15, fontWeight: 700,
              cursor: !canGenerate || generating ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background 0.15s',
            }}
          >
            {generating ? (
              <>
                <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid var(--on-ink-subtle)', borderTopColor: 'var(--on-ink)', borderRadius: '50%', animation: 'vid-spin 0.8s linear infinite' }} />
                Submitting…
              </>
            ) : `Generate with ${cfg.name} · ${cost} credits`}
          </button>
          {prompt.trim().length < 5 && (
            <p style={{ fontSize: 12, color: 'var(--ink-dim)', textAlign: 'center', margin: 0 }}>Enter a prompt to generate</p>
          )}
        </div>

        {/* Output */}
        {video && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-dim)', marginBottom: 16 }}>
              Generated Video
            </div>

            {video.status === 'processing' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '20px 0' }}>
                <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--ink)', borderRadius: '50%', animation: 'vid-spin 0.8s linear infinite' }} />
                <p style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 600, margin: 0 }}>
                  {model === 'seedance-2' ? 'Generating your video — usually 60–120 sec' : 'Generating your video — usually 60–90 sec'}
                </p>
                <p style={{ fontSize: 12, color: 'var(--ink-dim)', margin: 0 }}>Polling every 5 seconds…</p>
              </div>
            )}

            {video.status === 'failed' && (
              <div>
                <p style={{ fontSize: 13, color: 'var(--danger, #e84a4a)', fontWeight: 600, marginBottom: 8 }}>Generation failed</p>
                <p style={{ fontSize: 12, color: 'var(--ink-dim)', lineHeight: 1.5, wordBreak: 'break-word', margin: 0 }}>
                  {video.error ?? 'Unknown error. Check your API key balance and try again.'}
                </p>
              </div>
            )}

            {video.status === 'completed' && video.videoUrl && (
              <>
                <video controls src={video.videoUrl} style={{ width: '100%', borderRadius: 10, marginBottom: 14, maxHeight: 500, background: '#000' }} />
                <div style={{ display: 'flex', gap: 10 }}>
                  <a href={video.videoUrl} download={`video-${Date.now()}.mp4`} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', borderRadius: 9, background: 'var(--ink)', color: 'var(--on-ink)', fontSize: 13.5, fontWeight: 600, textDecoration: 'none' }}>
                    <Download size={14} /> Download
                  </a>
                  <a href={video.videoUrl} target="_blank" rel="noopener noreferrer" style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', borderRadius: 9, border: '1px solid var(--border)', color: 'var(--ink)', fontSize: 13.5, fontWeight: 600, textDecoration: 'none' }}>
                    <Play size={14} /> Open in tab
                  </a>
                </div>
                <div style={{ textAlign: 'center', marginTop: 10 }}>
                  <a href="/library" style={{ fontSize: 12.5, color: 'var(--ink-dim)', textDecoration: 'none', fontWeight: 500 }}>
                    Saved to library →
                  </a>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes vid-spin { to { transform: rotate(360deg); } }
        @media (max-width: 680px) {
          .vid-page { padding: 24px 16px 80px !important; }
        }
        @media (max-width: 640px) {
          .vid-h1 { font-size: 36px !important; }
          .vid-models { flex-direction: column !important; }
          .vid-chiprow { flex-wrap: wrap !important; }
          .vid-chiprow > button { flex: 1 1 30% !important; min-width: 88px !important; }
          .vid-director-row { flex-wrap: wrap !important; }
          .vid-director-row > input { flex: 1 1 100% !important; }
        }
      `}</style>
    </main>
    </>
  )
}
