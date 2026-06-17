'use client'

import { useEffect, useRef, useState } from 'react'
import { getSupabase } from '@/lib/auth'
import {
  DURATION_OPTIONS,
  DURATION_CONFIGS,
  DEFAULT_DURATION,
  calculateStandaloneVideoCredits,
  creditsToUSD,
  type UGCDuration,
} from '@/lib/tiers'
import { Loader2, Upload, X, Download, Play } from 'lucide-react'

interface VideoState {
  videoId?: string
  videoUrl?: string
  status: 'processing' | 'completed' | 'failed'
  duration?: number
  error?: string
}

// Standalone Sora 2 video generator. Plain prompt + duration + optional reference
// image. No avatar selection, no character builder, no B-rolls, no stitch. Just
// "type what you want, get a Sora video back".
export default function VideoGeneratorPage() {
  const [prompt, setPrompt] = useState('')
  const [duration, setDuration] = useState<UGCDuration>(DEFAULT_DURATION)
  const [refImage, setRefImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(null)
  const [creditBalance, setCreditBalance] = useState(0)
  const [creditsLoading, setCreditsLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [video, setVideo] = useState<VideoState | null>(null)
  const [error, setError] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const cost = calculateStandaloneVideoCredits(duration)
  const canGenerate = prompt.trim().length >= 5 && creditBalance >= cost

  // Load credits on mount.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = getSupabase()
      if (!supabase) return
      const { data: sess } = await supabase.auth.getSession()
      const userId = sess?.session?.user?.id
      if (!userId) return
      const { data } = await supabase.from('user_credits').select('balance').eq('user_id', userId).single()
      if (!cancelled) {
        setCreditBalance(data?.balance ?? 0)
        setCreditsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Poll Sora status when a generation is in flight.
  useEffect(() => {
    if (!video?.videoId || video.status !== 'processing') return

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/ugc/video-status?videoId=${video.videoId}&provider=sora-2`)
        const data = await res.json()
        if (data.video) {
          const v = data.video
          if (v.status === 'completed' || v.status === 'failed') {
            setVideo(prev => prev ? { ...prev, status: v.status, videoUrl: v.videoUrl, error: v.error } : prev)
            clearInterval(pollRef.current!)
          }
        }
      } catch {}
    }, 5000)

    return () => clearInterval(pollRef.current!)
  }, [video?.videoId, video?.status])

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Reference image must be under 5MB')
      return
    }
    const reader = new FileReader()
    reader.onload = ev => {
      const result = ev.target?.result as string
      const base64 = result.split(',')[1]
      setRefImage({ base64, mimeType: file.type, preview: result })
    }
    reader.readAsDataURL(file)
  }

  async function generate() {
    if (!canGenerate || generating) return
    setError('')
    setGenerating(true)
    setVideo(null)

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
          duration,
          referenceImageBase64: refImage?.base64,
          referenceImageMimeType: refImage?.mimeType,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')

      setVideo(data.components?.video ?? null)
      setCreditBalance(data.newBalance ?? creditBalance - cost)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <main style={{ padding: '24px 32px 80px', maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <header style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--ink-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
          <span>Studio</span><span>/</span><span>Create</span><span>/</span><span style={{ color: 'var(--ink)' }}>Video</span>
        </div>
        <h1 style={{ margin: '12px 0 4px', fontFamily: 'var(--font-serif)', fontSize: '32px', color: 'var(--ink)', fontWeight: 400 }}>
          Video
        </h1>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.6 }}>
          Plain prompt to Sora 2. Describe what you want — a character, an action, a scene, a product shot — and get a cinematic 9:16 video back. Optionally upload a reference image for image-to-video.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
        {/* Cost banner */}
        <div style={{
          padding: '12px 16px',
          background: 'var(--accent-soft)', border: '1px solid var(--accent)',
          borderRadius: 'var(--r-md)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: '13px', color: 'var(--ink)' }}>
            Generation cost
          </span>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent)' }}>
            {cost} cr <span style={{ fontSize: '11px', color: 'var(--ink-dim)', fontWeight: 400, marginLeft: 6 }}>≈ ${creditsToUSD(cost).toFixed(2)}</span>
          </span>
        </div>

        {/* Prompt */}
        <div className="form-row">
          <label className="form-label">
            Prompt <span style={{ color: 'var(--ink-dim)', fontWeight: 400 }}>(required)</span>
          </label>
          <p style={{ fontSize: '11px', color: 'var(--ink-dim)', margin: '0 0 8px', lineHeight: 1.5 }}>
            Describe the shot you want. Be specific about camera, subject, action, scene, mood. Sora handles cinematic detail well.
          </p>
          <textarea
            className="input"
            value={prompt}
            onChange={e => setPrompt(e.target.value.slice(0, 4000))}
            disabled={generating}
            rows={6}
            placeholder={'Example:\nHandheld phone-camera selfie, 25-year-old woman in a parked car with sunlight streaming through the windshield, mid-laugh, holding up a coffee cup and saying "this is exactly what I needed." Real skin texture, no beauty filter, soft natural lighting, ambient car-interior sound.'}
            style={{ resize: 'vertical', fontFamily: 'inherit', minHeight: '140px' }}
          />
          <p style={{ fontSize: '10px', color: 'var(--ink-dim)', textAlign: 'right', margin: '4px 0 0', fontFamily: 'var(--font-mono)' }}>
            {prompt.length} / 4000
          </p>
        </div>

        {/* Duration */}
        <div>
          <span className="eyebrow" style={{ display: 'block', marginBottom: '12px' }}>Duration</span>
          {(['native', 'extended', 'chained'] as const).map(group => {
            const groupDurations = DURATION_OPTIONS.filter(d => DURATION_CONFIGS[d].strategy === group)
            if (!groupDurations.length) return null
            const groupLabel =
              group === 'native'   ? 'Short — single Sora generation'
            : group === 'extended' ? 'Extended (Sora + B-roll fill)'
                                   : 'Cinematic (chained Sora clips)'
            return (
              <div key={group} style={{ marginBottom: '12px' }}>
                <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-dim)', margin: '0 0 6px', fontWeight: 600 }}>
                  {groupLabel}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${groupDurations.length}, 1fr)`, gap: '8px' }}>
                  {groupDurations.map(sec => {
                    const dCfg = DURATION_CONFIGS[sec]
                    const active = duration === sec
                    const c = calculateStandaloneVideoCredits(sec)
                    const usd = creditsToUSD(c)
                    const locked = !dCfg.available
                    return (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => !locked && setDuration(sec)}
                        disabled={generating || locked}
                        title={locked ? 'Coming soon' : undefined}
                        style={{
                          textAlign: 'center',
                          cursor: locked ? 'not-allowed' : (generating ? 'not-allowed' : 'pointer'),
                          padding: '12px 8px', borderRadius: 'var(--r-md)',
                          border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                          background: active ? 'var(--accent-soft)' : 'var(--surface)',
                          opacity: locked ? 0.5 : 1,
                          transition: 'all 0.15s',
                          display: 'flex', flexDirection: 'column', gap: '3px',
                          position: 'relative',
                        }}>
                        <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ink)' }}>{sec}s</span>
                        <span style={{ fontSize: '11px', color: active ? 'var(--accent)' : 'var(--ink-dim)', fontWeight: 600 }}>{c} cr</span>
                        <span style={{ fontSize: '10px', color: 'var(--ink-dim)', fontFamily: 'var(--font-mono)' }}>≈${usd.toFixed(2)}</span>
                        {locked && (
                          <span style={{
                            position: 'absolute', top: '4px', right: '4px',
                            fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                            padding: '2px 5px', borderRadius: '4px',
                            background: 'var(--ink-dim)', color: 'var(--surface)',
                          }}>Soon</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Reference image (optional) */}
        <div className="form-row">
          <label className="form-label">
            Reference Image <span style={{ color: 'var(--ink-dim)', fontWeight: 400 }}>(optional)</span>
          </label>
          <p style={{ fontSize: '11px', color: 'var(--ink-dim)', margin: '0 0 8px', lineHeight: 1.5 }}>
            Upload an image to seed the first frame. Sora will animate from it. Resized to 720×1280 (portrait 9:16).
          </p>
          {refImage ? (
            <div style={{
              display: 'flex', gap: '12px', alignItems: 'center',
              padding: '10px', borderRadius: 'var(--r-md)',
              background: 'var(--surface)', border: '1px solid var(--border)',
            }}>
              <img src={refImage.preview} alt="reference" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: 'var(--r-sm)' }} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--ink)', fontWeight: 600 }}>Reference uploaded</p>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--ink-dim)' }}>{refImage.mimeType}</p>
              </div>
              <button
                onClick={() => setRefImage(null)}
                disabled={generating}
                style={{ background: 'transparent', border: 'none', color: 'var(--ink-dim)', cursor: 'pointer', padding: '4px', display: 'flex' }}
                aria-label="Remove"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <label style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '14px 16px', borderRadius: 'var(--r-md)',
              border: '1px dashed var(--border-strong)',
              cursor: generating ? 'not-allowed' : 'pointer',
              color: 'var(--ink-dim)', fontSize: '13px',
            }}>
              <Upload size={16} />
              <span>Click to upload reference image (max 5MB)</span>
              <input type="file" accept="image/*" onChange={handleImageChange} disabled={generating} style={{ display: 'none' }} />
            </label>
          )}
        </div>

        {/* Errors */}
        {error && (
          <div style={{
            padding: '10px 14px',
            background: 'rgba(255,80,80,0.10)', border: '1px solid var(--danger)',
            borderRadius: 'var(--r-sm)',
            color: 'var(--danger)', fontSize: '13px',
          }}>
            {error}
          </div>
        )}

        {/* Generate button + balance */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: 'var(--ink-dim)' }}>Your balance</span>
            <span style={{ fontWeight: 600, color: creditBalance >= cost ? 'var(--good)' : 'var(--danger)' }}>
              {creditsLoading ? '…' : `${creditBalance} credits`}
            </span>
          </div>

          <button
            onClick={generate}
            disabled={!canGenerate || generating || creditsLoading}
            className="btn btn-primary"
            style={{ padding: '12px', fontSize: '14px' }}
          >
            {generating ? <><Loader2 size={14} className="animate-spin" /> Submitting…</> : 'Generate video'}
          </button>

          {!canGenerate && prompt.trim().length >= 5 && (
            <p style={{ fontSize: '12px', color: 'var(--danger)', textAlign: 'center', margin: 0 }}>
              Not enough credits. Need {cost}, have {creditBalance}.
            </p>
          )}
        </div>

        {/* Output */}
        {video && (
          <div className="card" style={{ padding: '20px', marginTop: '12px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: '12px' }}>
              Generated Video
            </h3>

            {video.status === 'processing' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--ink-dim)', marginBottom: '8px' }}>
                <Loader2 size={14} className="animate-spin" />
                Sora is generating — usually 2–4 minutes. This page polls automatically.
              </div>
            )}

            {video.status === 'failed' && (
              <div style={{ marginBottom: '12px' }}>
                <p style={{ fontSize: '13px', color: 'var(--danger)', fontWeight: 600, marginBottom: '6px' }}>
                  Generation failed
                </p>
                {video.error ? (
                  <p style={{ fontSize: '11px', color: 'var(--ink-fade)', fontFamily: 'var(--font-mono)', wordBreak: 'break-word', padding: '8px 10px', background: 'var(--bg)', borderRadius: 'var(--r-sm)', lineHeight: 1.5 }}>
                    {video.error}
                  </p>
                ) : (
                  <p style={{ fontSize: '12px', color: 'var(--ink-fade)' }}>
                    No detail returned. Common causes: OpenAI credit exhausted, content-policy rejection, or transient outage.
                  </p>
                )}
              </div>
            )}

            {video.status === 'completed' && video.videoUrl && (
              <>
                <video controls src={video.videoUrl} style={{ width: '100%', borderRadius: 'var(--r-md)', marginBottom: '12px', maxHeight: '500px', background: '#000' }} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <a
                    href={video.videoUrl}
                    download={`video-${Date.now()}.mp4`}
                    className="btn btn-ghost"
                    style={{ flex: 1, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <Download size={14} />
                    Download
                  </a>
                  <a
                    href={video.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost"
                    style={{ flex: 1, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <Play size={14} />
                    Open in tab
                  </a>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
