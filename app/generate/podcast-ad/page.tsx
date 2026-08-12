'use client'

// Podcast Ad — 6-shot dialogue-driven ad in a premium studio.
// Flow: setup form → Sonnet writes script → user edits → fire 6 Seedance
// jobs in parallel → poll each until done → show 6 MP4s.

import { useEffect, useMemo, useRef, useState } from 'react'
import { getSupabase } from '@/lib/auth'
import { showError, showSuccess } from '@/lib/notifications'
import { SectionTabs, VIDEO_STUDIO_TABS } from '@/components/SectionTabs'
import { Loader2, Sparkles, Play, ArrowRight } from 'lucide-react'
import type { PodcastScript } from '@/lib/podcast-ad'

interface Product { id: string; name: string; image_url: string | null; description?: string }
interface Influencer { id: string; name: string; portrait_url: string; character_sheet_url?: string | null }

async function getToken() {
  const supabase = getSupabase()
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

type Step = 'setup' | 'script' | 'frames' | 'rendering'

interface JobStatus {
  shot: number
  predictionId: string | null
  status: 'submitting' | 'processing' | 'completed' | 'failed'
  videoUrl?: string
  error?: string
}

export default function PodcastAdPage() {
  const [step, setStep] = useState<Step>('setup')

  // Setup form.
  const [products, setProducts] = useState<Product[]>([])
  const [influencers, setInfluencers] = useState<Influencer[]>([])
  const [productId, setProductId] = useState('')
  const [productName, setProductName] = useState('')
  const [productDescription, setProductDescription] = useState('')
  const [productImageUrl, setProductImageUrl] = useState('')
  const [hostId, setHostId] = useState('')
  const [expertId, setExpertId] = useState('')
  const [brief, setBrief] = useState('')
  const [offer, setOffer] = useState('')
  const [resolution, setResolution] = useState<'720p' | '1080p'>('720p')
  const [aspect, setAspect] = useState<'9:16' | '3:4' | '4:5' | '1:1' | '16:9'>('9:16')

  const [planning, setPlanning] = useState(false)
  const [script, setScript] = useState<PodcastScript | null>(null)

  const [rendering, setRendering] = useState(false)
  const [jobs, setJobs] = useState<JobStatus[]>([])

  const [frameOptions, setFrameOptions] = useState<Array<{ url: string; variant: number; label: string }>>([])
  const [selectedFrame, setSelectedFrame] = useState<string | null>(null)
  const [framesLoading, setFramesLoading] = useState(false)

  const [scenes, setScenes] = useState<Array<{ id: string; name: string; category: string; hero_image_url: string; scene_prompt: string }>>([])
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null)
  const [refImageBase64, setRefImageBase64] = useState<string | null>(null)
  const [refImageMime, setRefImageMime] = useState<string>('image/jpeg')

  useEffect(() => {
    void (async () => {
      const token = await getToken()
      if (!token) return
      const [p, i, s] = await Promise.all([
        fetch('/api/products-studio', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({ products: [] })),
        fetch('/api/influencers', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({ influencers: [] })),
        fetch('/api/scenes', { headers: { Authorization: `Bearer ${token}` } }).then(x => x.json()).catch(() => ({ scenes: [] })),
      ])
      // Normalise studio products → { id, name, image_url, description }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setProducts((p.products ?? []).map((x: any) => ({
        id: x.id,
        name: x.name,
        image_url: Array.isArray(x.photo_urls) && x.photo_urls.length > 0 ? x.photo_urls[0] : null,
        description: x.description ?? '',
      })))
      setInfluencers(i.influencers ?? [])
      setScenes(s.scenes ?? [])
    })()
  }, [])

  function handleRefImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const [meta, b64] = dataUrl.split(',')
      const mime = meta.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
      setRefImageBase64(b64)
      setRefImageMime(mime)
    }
    reader.readAsDataURL(file)
  }

  function selectProduct(id: string) {
    setProductId(id)
    const p = products.find(x => x.id === id)
    if (p) {
      setProductName(p.name)
      setProductImageUrl(p.image_url ?? '')
      if (p.description) setProductDescription(p.description)
    }
  }

  async function planScript() {
    if (!productName.trim()) { showError('Product name required'); return }
    if (!hostId || !expertId) { showError('Pick host + expert'); return }
    if (hostId === expertId) { showError('Host and expert must be different people'); return }
    setPlanning(true)
    const token = await getToken()
    if (!token) { setPlanning(false); return }
    try {
      const host = influencers.find(i => i.id === hostId)
      const expert = influencers.find(i => i.id === expertId)
      const res = await fetch('/api/podcast-ad/plan', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: productId || undefined,
          productName,
          productDescription: productDescription || undefined,
          brief: brief || undefined,
          offer: offer || undefined,
          hostName: host?.name,
          expertName: expert?.name,
        }),
      })
      const data = await res.json()
      if (!res.ok) { showError(data.error ?? 'Script generation failed'); return }
      setScript(data.script)
      setStep('script')
    } finally {
      setPlanning(false)
    }
  }

  function updateLine(shotKey: keyof PodcastScript, lineKey: string, value: string) {
    setScript(prev => {
      if (!prev) return prev
      const shot = { ...(prev[shotKey] as Record<string, string>) }
      shot[lineKey] = value
      return { ...prev, [shotKey]: shot }
    })
  }

  async function previewFrames() {
    setFramesLoading(true)
    const token = await getToken()
    if (!token) { setFramesLoading(false); return }
    try {
      const res = await fetch('/api/podcast-ad/frames', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostInfluencerId: hostId, expertInfluencerId: expertId, productName, productDescription, aspect, sceneId: selectedSceneId || undefined, refImageBase64: refImageBase64 || undefined, refImageMime }),
      })
      const data = await res.json()
      if (!res.ok) { showError(data.error ?? 'Frame generation failed'); return }
      setFrameOptions(data.frames ?? [])
      setSelectedFrame(data.frames?.[0]?.url ?? null)
      setStep('frames')
    } finally {
      setFramesLoading(false)
    }
  }

  async function renderAll() {
    if (!script) return
    setRendering(true)
    setStep('rendering')
    // Seed job placeholders so the UI shows all 6 slots immediately.
    setJobs([1,2,3,4,5,6].map(shot => ({ shot, predictionId: null, status: 'submitting' })))
    const token = await getToken()
    if (!token) { setRendering(false); return }
    try {
      const res = await fetch('/api/podcast-ad/render', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script,
          hostInfluencerId: hostId,
          expertInfluencerId: expertId,
          productName,
          productDescription,
          productImageUrl: productImageUrl || undefined,
          resolution,
          aspect,
          selectedFrameUrl: selectedFrame || undefined,
          sceneId: selectedSceneId || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { showError(data.error ?? 'Render failed'); setStep('script'); return }
      const initial: JobStatus[] = (data.jobs as Array<{ shot: number; predictionId: string | null; error?: string }>).map(j => ({
        shot: j.shot,
        predictionId: j.predictionId,
        status: j.predictionId ? 'processing' : 'failed',
        error: j.error,
      }))
      setJobs(initial)
      showSuccess('Podcast ad kicked off', `${data.submitted}/${data.totalShots} shots submitted · ${data.creditsCharged} cr`)
    } finally {
      setRendering(false)
    }
  }

  // Poll each job's status until completed / failed.
  const pollingRef = useRef<Set<number>>(new Set())
  useEffect(() => {
    if (step !== 'rendering') return
    const token$ = getToken()
    jobs.forEach(job => {
      if (!job.predictionId) return
      if (job.status !== 'processing') return
      if (pollingRef.current.has(job.shot)) return
      pollingRef.current.add(job.shot)
      const poll = async () => {
        const token = await token$
        if (!token) return
        try {
          const r = await fetch(`/api/ugc/video-status?videoId=${encodeURIComponent(job.predictionId!)}&provider=seedance-2`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          const data = await r.json()
          if (data.status === 'completed' && data.videoUrl) {
            setJobs(prev => prev.map(j => j.shot === job.shot ? { ...j, status: 'completed', videoUrl: data.videoUrl } : j))
            pollingRef.current.delete(job.shot)
            fetch('/api/library/save-video', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ videoUrl: data.videoUrl, source: 'podcast-ad', title: `Podcast Ad — Shot ${job.shot}` }),
            }).catch(() => {})
            return
          }
          if (data.status === 'failed') {
            setJobs(prev => prev.map(j => j.shot === job.shot ? { ...j, status: 'failed', error: data.error } : j))
            pollingRef.current.delete(job.shot)
            return
          }
          setTimeout(poll, 6000)
        } catch { setTimeout(poll, 8000) }
      }
      void poll()
    })
  }, [step, jobs])

  const shotOrder = useMemo(() => ([1,2,3,4,5,6] as const), [])

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '36px 40px 90px' }}>
      <SectionTabs tabs={VIDEO_STUDIO_TABS} />
      <header style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>Studio / Podcast Ad</div>
        <h1 style={{ fontFamily: 'var(--font-serif, serif)', fontWeight: 400, fontSize: 44, lineHeight: 1.02, margin: '10px 0 0' }}>
          Two-person <em>podcast ad</em>.
        </h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', maxWidth: 620, marginTop: 10, lineHeight: 1.55 }}>
          Pick a product, pick two influencers, review the AI-drafted script. We render 6 Seedance shots in parallel — about 5 minutes.
        </p>
      </header>

      {step === 'setup' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Field label="Product">
            {products.length > 0 ? (
              <select value={productId} onChange={e => selectProduct(e.target.value)} style={inp}>
                <option value="">— pick from library —</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            ) : (
              <input value={productName} onChange={e => setProductName(e.target.value)} placeholder="Product name" style={inp} />
            )}
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Host (interviewer)">
              <InfluencerPicker value={hostId} onChange={setHostId} list={influencers} />
            </Field>
            <Field label="Expert (guest)">
              <InfluencerPicker value={expertId} onChange={setExpertId} list={influencers.filter(i => i.id !== hostId)} />
            </Field>
          </div>

          <Field label="Brief (optional)">
            <textarea
              value={brief}
              onChange={e => setBrief(e.target.value)}
              placeholder="e.g. Selling a prebiotic gummy for gut health. Audience: women 25-40 tired of powdered greens. The problem is powders being disgusting and abandoned in the cupboard."
              rows={4}
              style={{ ...inp, resize: 'vertical', minHeight: 90 }}
            />
          </Field>

          <Field label="Offer (optional) — appears in shot 5 CTA">
            <input value={offer} onChange={e => setOffer(e.target.value)} placeholder="e.g. 50% off with code PODCAST50" style={inp} />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Format">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {([
                  { value: '9:16', label: '9:16', sub: 'Reels · TikTok' },
                  { value: '3:4', label: '3:4', sub: 'Tall' },
                  { value: '4:5', label: '4:5', sub: 'Instagram' },
                  { value: '1:1', label: '1:1', sub: 'Square' },
                  { value: '16:9', label: '16:9', sub: 'YouTube' },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAspect(opt.value)}
                    style={{ padding: '7px 12px', borderRadius: 8, border: `1.5px solid ${aspect === opt.value ? 'var(--ink)' : 'var(--border)'}`, background: aspect === opt.value ? 'var(--ink)' : 'var(--surface)', color: aspect === opt.value ? 'var(--on-ink)' : 'var(--ink)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{opt.label}</span>
                    <span style={{ fontSize: 10, opacity: 0.65 }}>{opt.sub}</span>
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Resolution">
              <select value={resolution} onChange={e => setResolution(e.target.value as '720p' | '1080p')} style={inp}>
                <option value="720p">720p · cheaper</option>
                <option value="1080p">1080p · flagship</option>
              </select>
            </Field>
          </div>

          {/* Reference image */}
          <Field label="Reference image (optional)">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8, border: '1.5px dashed var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 13, color: 'var(--ink-2)', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                {refImageBase64 ? 'Change image' : 'Upload a reference photo'}
                <input type="file" accept="image/*" onChange={handleRefImage} style={{ display: 'none' }} />
              </label>
              {refImageBase64 && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`data:${refImageMime};base64,${refImageBase64}`} alt="ref" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }} />
                  <button type="button" onClick={() => { setRefImageBase64(null) }} style={{ fontSize: 12, color: 'var(--ink-mute)', background: 'none', border: 'none', cursor: 'pointer' }}>✕ Remove</button>
                </>
              )}
            </div>
          </Field>

          {/* Scene selector */}
          {scenes.length > 0 && (
            <Field label="Scene (optional) — pick a location from your Studio">
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                {scenes.map(s => {
                  const active = selectedSceneId === s.id
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedSceneId(active ? null : s.id)}
                      style={{ flexShrink: 0, padding: 5, borderRadius: 10, border: `1.5px solid ${active ? 'var(--ink)' : 'var(--border)'}`, background: active ? 'var(--surface-2)' : 'var(--surface)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 5, width: 88 }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.hero_image_url} alt={s.name} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 7, display: 'block' }} />
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>{s.name}</div>
                    </button>
                  )
                })}
              </div>
            </Field>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button
              onClick={planScript}
              disabled={planning}
              className="btn btn-primary"
              style={{ fontSize: 14, padding: '12px 22px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              {planning ? <><Loader2 size={15} className="spin" /> Writing script…</> : <><Sparkles size={15} /> Draft the script</>}
            </button>
          </div>
        </div>
      )}

      {step === 'script' && script && (
        <>
          {framesLoading && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', gap: 24 }}>
              {/* Pulsing ring animation */}
              <div style={{ position: 'relative', width: 80, height: 80 }}>
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.15)', animation: 'ping 1.4s ease-in-out infinite' }} />
                <div style={{ position: 'absolute', inset: 6, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.25)', animation: 'ping 1.4s ease-in-out 0.35s infinite' }} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Loader2 size={28} color="#fff" className="spin" />
                </div>
              </div>
              <div style={{ textAlign: 'center', color: '#fff' }}>
                <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 6 }}>Generating scene frames</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', maxWidth: 280 }}>NanoBanana is compositing your two hosts into 4 studio compositions — usually 30–60 s</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[0,1,2,3].map(i => (
                  <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', opacity: 0.4, animation: `bounce 1.2s ease-in-out ${i * 0.15}s infinite` }} />
                ))}
              </div>
            </div>
          )}
          <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface-2)', marginBottom: 16, fontSize: 13, color: 'var(--ink-2)' }}>
            Edit any line before rendering. Every line under 25 words works best — Seedance loses lip-sync on longer takes.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {shotOrder.map(idx => {
              const shotKey = `shot${idx}` as keyof PodcastScript
              const shot = script[shotKey] as Record<string, string>
              return (
                <div key={idx} style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)' }}>#{idx}</span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>Shot {idx}</span>
                    <span style={{ fontSize: 11, color: 'var(--ink-mute)', marginLeft: 'auto' }}>~{[15,15,15,12,15,6][idx-1]}s</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {Object.entries(shot).map(([k, v]) => (
                      <div key={k}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: 'var(--ink-2)', marginBottom: 3, textTransform: 'uppercase' }}>
                          {k.startsWith('host') ? '🎙️ Host' : '🎤 Expert'}{k.endsWith('2') ? ' (line 2)' : ''}
                        </div>
                        <textarea
                          value={v}
                          onChange={e => updateLine(shotKey, k, e.target.value)}
                          rows={2}
                          style={{ ...inp, minHeight: 44 }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18 }}>
            <button onClick={() => setStep('setup')} className="btn btn-ghost" style={{ fontSize: 13 }}>← Back</button>
            <button
              onClick={previewFrames}
              disabled={framesLoading}
              className="btn btn-primary"
              style={{ fontSize: 14, padding: '12px 22px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              {framesLoading ? <><Loader2 size={15} className="spin" /> Generating frames…</> : <>Preview 4 scene frames <ArrowRight size={14} /></>}
            </button>
          </div>
        </>
      )}

      {step === 'frames' && (
        <>
          <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface-2)', marginBottom: 20, fontSize: 13, color: 'var(--ink-2)' }}>
            Pick the scene composition you like best — this frame anchors the visual style for all 6 shots.
          </div>
          {frameOptions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-mute)', fontSize: 13 }}>No frames generated — go back and try again.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
              {frameOptions.map(f => {
                const active = selectedFrame === f.url
                return (
                  <button
                    key={f.url}
                    type="button"
                    onClick={() => setSelectedFrame(f.url)}
                    style={{ padding: 0, border: `2.5px solid ${active ? 'var(--ink)' : 'var(--border)'}`, borderRadius: 12, background: 'var(--surface)', cursor: 'pointer', overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'border-color 0.15s' }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.url} alt={f.label} style={{ width: '100%', aspectRatio: '9/16', objectFit: 'cover', display: 'block' }} />
                    <div style={{ padding: '8px 12px', fontSize: 12.5, fontWeight: active ? 700 : 500, color: active ? 'var(--ink)' : 'var(--ink-mute)', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {active && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>}
                      {f.label}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={() => setStep('script')} className="btn btn-ghost" style={{ fontSize: 13 }}>← Back to script</button>
            <button
              onClick={renderAll}
              disabled={!selectedFrame || rendering}
              className="btn btn-primary"
              style={{ fontSize: 14, padding: '12px 22px', display: 'inline-flex', alignItems: 'center', gap: 8, opacity: !selectedFrame ? 0.45 : 1 }}
            >
              {rendering ? <><Loader2 size={15} className="spin" /> Submitting…</> : <>Render all 6 shots <ArrowRight size={14} /></>}
            </button>
          </div>
        </>
      )}

      {step === 'rendering' && (
        <>
          <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface-2)', marginBottom: 16, fontSize: 13, color: 'var(--ink-2)' }}>
            Each shot takes 2–5 minutes. All 6 render in parallel. This page updates automatically — you can leave it open.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            {jobs.map(job => (
              <div key={job.shot} style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>Shot {job.shot}</span>
                  <span style={{ fontSize: 10.5, marginLeft: 'auto', padding: '2px 8px', borderRadius: 999, background: job.status === 'completed' ? '#dcfce7' : job.status === 'failed' ? '#fee2e2' : 'var(--surface-2)', color: job.status === 'completed' ? '#166534' : job.status === 'failed' ? '#991b1b' : 'var(--ink-2)', fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase' }}>
                    {job.status}
                  </span>
                </div>
                {job.status === 'processing' && (
                  <div style={{ aspectRatio: '9/16', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}>
                    <Loader2 size={22} className="spin" style={{ color: 'var(--ink-2)' }} />
                  </div>
                )}
                {job.status === 'completed' && job.videoUrl && (
                  <video src={job.videoUrl} controls playsInline style={{ width: '100%', aspectRatio: '9/16', objectFit: 'cover', borderRadius: 8, background: '#000' }} />
                )}
                {job.status === 'failed' && (
                  <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: '#991b1b' }}>{job.error ?? 'Render failed'}</div>
                )}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20 }}>
            <button onClick={() => setStep('script')} className="btn btn-ghost" style={{ fontSize: 13 }}>← Back to script</button>
          </div>
        </>
      )}
      <style>{`
        @keyframes ping {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.18); opacity: 0.15; }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-8px); opacity: 1; }
        }
      `}</style>
    </main>
  )
}

function InfluencerPicker({ value, onChange, list }: { value: string; onChange: (v: string) => void; list: Influencer[] }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {list.length === 0 && <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>No influencers yet — create one in the Studios tab first.</div>}
      {list.map(i => {
        const active = value === i.id
        return (
          <button
            key={i.id}
            onClick={() => onChange(active ? '' : i.id)}
            title={i.name}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px 4px 4px', borderRadius: 999, border: `2px solid ${active ? 'var(--ink)' : 'var(--border)'}`, background: 'var(--surface)', cursor: 'pointer', flexShrink: 0 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={i.portrait_url} alt={i.name} style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>{i.name}</span>
          </button>
        )
      })}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 0.4, color: 'var(--ink-2)', marginBottom: 6, textTransform: 'uppercase' }}>{label}</div>
      {children}
    </div>
  )
}

const inp: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: 14,
  fontFamily: 'inherit',
  border: '1px solid var(--border)',
  borderRadius: 9,
  background: 'var(--surface)',
  color: 'var(--ink)',
}
