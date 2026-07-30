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

type Step = 'setup' | 'script' | 'rendering'

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

  const [planning, setPlanning] = useState(false)
  const [script, setScript] = useState<PodcastScript | null>(null)

  const [rendering, setRendering] = useState(false)
  const [jobs, setJobs] = useState<JobStatus[]>([])

  useEffect(() => {
    void (async () => {
      const token = await getToken()
      if (!token) return
      const [p, i] = await Promise.all([
        fetch('/api/products-studio', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({ products: [] })),
        fetch('/api/influencers', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({ influencers: [] })),
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
    })()
  }, [])

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

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
            <Field label="Offer (optional) — appears in shot 5 CTA">
              <input value={offer} onChange={e => setOffer(e.target.value)} placeholder="e.g. 50% off with code PODCAST50" style={inp} />
            </Field>
            <Field label="Resolution">
              <select value={resolution} onChange={e => setResolution(e.target.value as '720p' | '1080p')} style={inp}>
                <option value="720p">720p · cheaper</option>
                <option value="1080p">1080p · flagship</option>
              </select>
            </Field>
          </div>

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
              onClick={renderAll}
              disabled={rendering}
              className="btn btn-primary"
              style={{ fontSize: 14, padding: '12px 22px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
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
