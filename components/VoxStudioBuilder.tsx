'use client'

import { useState, useRef, useCallback } from 'react'
import { getSupabase } from '@/lib/auth'
import type { VoxBeat, VoxBeatMap } from '@/lib/vox-beatmap'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tone = 'informative' | 'energetic' | 'documentary'
type Duration = 30 | 45 | 60
type Step = 'form' | 'beatmap' | 'frames' | 'preview'

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getToken(): Promise<string> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Not authenticated')
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  if (!token) throw new Error('Not authenticated')
  return token
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function pollVideoStatus(
  jobId: string,
  token: string,
  maxWaitMs = 300_000,
): Promise<string> {
  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    await new Promise(r => setTimeout(r, 4000))
    const res = await fetch(`/api/ugc/video-status?videoId=${jobId}&provider=seedance-2`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) continue
    const data = await res.json()
    const v = data?.video
    if (!v) continue
    if (v.status === 'completed' && v.videoUrl) return v.videoUrl as string
    if (v.status === 'failed') throw new Error(`Seedance job ${jobId} failed`)
  }
  throw new Error(`Seedance job ${jobId} timed out after ${maxWaitMs / 1000}s`)
}

async function pollShotstackStatus(
  renderId: string,
  token: string,
  maxWaitMs = 300_000,
): Promise<string> {
  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    await new Promise(r => setTimeout(r, 5000))
    const res = await fetch(`/api/ugc/stitch?renderId=${renderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) continue
    const data = await res.json()
    if (data.status === 'succeeded' && data.url) return data.url as string
    if (data.status === 'failed') throw new Error(`Shotstack render ${renderId} failed: ${data.error ?? ''}`)
  }
  throw new Error(`Shotstack render ${renderId} timed out`)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BeatCard({ beat, frameUrl }: { beat: VoxBeat; frameUrl?: string | null }) {
  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 10,
      overflow: 'hidden',
      background: 'var(--surface)',
    }}>
      {frameUrl && (
        <div style={{ position: 'relative', aspectRatio: '9/16', overflow: 'hidden', maxHeight: 160 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={frameUrl}
            alt={beat.headline}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '6px 8px',
            background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            {beat.duration_sec}s
          </div>
        </div>
      )}
      {!frameUrl && (
        <div style={{
          height: 100,
          background: beat.accent_color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          opacity: 0.9,
        }}>
          {beat.duration_sec}s
        </div>
      )}
      <div style={{ padding: '10px 12px' }}>
        <div style={{
          fontSize: 12,
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: 'var(--ink)',
          marginBottom: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span style={{
            display: 'inline-block',
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: beat.accent_color,
            flexShrink: 0,
          }} />
          {beat.headline}
        </div>
        <p style={{
          fontSize: 11.5,
          color: 'var(--ink-2)',
          lineHeight: 1.5,
          margin: 0,
        }}>
          {beat.narration}
        </p>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function VoxStudioBuilder() {
  // Form state
  const [topic, setTopic] = useState('')
  const [tone, setTone] = useState<Tone>('informative')
  const [duration, setDuration] = useState<Duration>(30)
  const [productFile, setProductFile] = useState<File | null>(null)
  const [productPreview, setProductPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Pipeline state
  const [step, setStep] = useState<Step>('form')
  const [beatMap, setBeatMap] = useState<VoxBeatMap | null>(null)
  const [frameUrls, setFrameUrls] = useState<(string | null)[]>([])
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null)

  // Status
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [error, setError] = useState('')

  // ── File upload ──────────────────────────────────────────────────────────

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setProductFile(file)
    const url = URL.createObjectURL(file)
    setProductPreview(url)
  }, [])

  // ── Step 1: Generate beat map ────────────────────────────────────────────

  const handleGenerateBeatMap = useCallback(async () => {
    if (!topic.trim()) {
      setError('Please enter a topic')
      return
    }
    setError('')
    setLoading(true)
    setStatusMsg('Generating beat map…')
    try {
      const token = await getToken()
      const res = await fetch('/api/vox/beat-map', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), tone, targetDuration: duration }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Beat map generation failed')
      setBeatMap(data.beatMap)
      setStep('beatmap')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Beat map generation failed')
    } finally {
      setLoading(false)
      setStatusMsg('')
    }
  }, [topic, tone, duration])

  // ── Step 2: Generate frames ──────────────────────────────────────────────

  const handleGenerateFrames = useCallback(async () => {
    if (!beatMap) return
    setError('')
    setLoading(true)
    setStatusMsg('Generating editorial frames…')
    try {
      const token = await getToken()

      let productImageBase64: string | undefined
      let productImageMimeType: string | undefined
      if (productFile) {
        productImageBase64 = await toBase64(productFile)
        productImageMimeType = productFile.type || 'image/png'
      }

      const res = await fetch('/api/vox/frames', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beats: beatMap.beats,
          productImageBase64,
          productImageMimeType,
          productName: topic,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Frame generation failed')
      setFrameUrls(data.frameUrls)
      setStep('frames')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Frame generation failed')
    } finally {
      setLoading(false)
      setStatusMsg('')
    }
  }, [beatMap, productFile, topic])

  // ── Step 3: Animate + stitch ─────────────────────────────────────────────

  const handleAnimateAndStitch = useCallback(async () => {
    if (!beatMap || frameUrls.length === 0) return
    setError('')
    setLoading(true)

    try {
      const token = await getToken()
      const beats = beatMap.beats

      // 1. Submit all Seedance jobs in parallel (fan-out)
      const jobIds: (string | null)[] = await Promise.all(
        frameUrls.map(async (frameUrl, i) => {
          if (!frameUrl) return null
          setStatusMsg(`Animating beat ${i + 1} of ${beats.length}…`)
          try {
            const res = await fetch('/api/ugc/motion-broll-animate', {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                frameUrl,
                formatKey: 'aesthetic-broll',
                productName: topic,
                duration: beats[i]?.duration_sec ?? 5,
                aspect: 'portrait',
                resolution: '1080p',
                engine: 'seedance-2',
              }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Animate failed')
            return data.jobId as string
          } catch (err) {
            console.warn(`[vox] animate beat ${i} failed:`, err)
            return null
          }
        }),
      )

      setStatusMsg('Generating voiceover…')

      // 2. Voiceover (runs in parallel with polling below)
      const narrationText = beats.map(b => b.narration).join(' ')
      const voiceoverPromise = fetch('/api/voiceover', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: narrationText, voiceId: 'openai:onyx' }),
      }).then(async res => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Voiceover failed')
        return data.audioUrl as string
      })

      // 3. Poll each Seedance job to completion
      setStatusMsg(`Waiting for animation renders (${jobIds.filter(Boolean).length} clips)…`)
      const videoUrls: (string | null)[] = await Promise.all(
        jobIds.map(async (jobId, i) => {
          if (!jobId) return null
          try {
            setStatusMsg(`Animating beat ${i + 1} of ${beats.length}…`)
            const url = await pollVideoStatus(jobId, token)
            return url
          } catch (err) {
            console.warn(`[vox] poll beat ${i} failed:`, err)
            return null
          }
        }),
      )

      // 4. Await voiceover
      setStatusMsg('Finalizing voiceover…')
      const voiceoverUrl = await voiceoverPromise

      // 5. Stitch
      setStatusMsg('Stitching…')
      const stitchRes = await fetch('/api/vox/stitch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beats,
          videoUrls,
          voiceoverUrl,
          aspectId: 'portrait',
        }),
      })
      const stitchData = await stitchRes.json()
      if (!stitchRes.ok) throw new Error(stitchData.error || 'Stitch failed')
      const { renderId } = stitchData

      // 6. Poll Shotstack
      setStatusMsg('Stitching — rendering final video…')
      const finalUrl = await pollShotstackStatus(renderId, token)

      setFinalVideoUrl(finalUrl)
      setStep('preview')
      setStatusMsg('Done!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Animation/stitch failed')
    } finally {
      setLoading(false)
      setStatusMsg('')
    }
  }, [beatMap, frameUrls, topic])

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Error banner */}
      {error && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(220,38,38,0.06)',
          border: '1px solid rgba(220,38,38,0.25)',
          borderRadius: 8,
          color: '#dc2626',
          fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* Status message */}
      {loading && statusMsg && (
        <div style={{
          padding: '10px 16px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          fontSize: 13,
          color: 'var(--ink-2)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span style={{
            display: 'inline-block',
            width: 14,
            height: 14,
            border: '2px solid var(--border)',
            borderTopColor: 'var(--ink)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            flexShrink: 0,
          }} />
          {statusMsg}
        </div>
      )}

      {/* ── STEP: FORM ── */}
      {step === 'form' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Topic */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-2)' }}>
              Topic
            </label>
            <input
              type="text"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Why oat milk is taking over"
              style={{
                padding: '10px 14px',
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'var(--surface)',
                color: 'var(--ink)',
                fontSize: 14,
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Tone */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-2)' }}>
              Tone
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['informative', 'energetic', 'documentary'] as Tone[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTone(t)}
                  style={{
                    padding: '8px 16px',
                    border: `1px solid ${tone === t ? 'var(--ink)' : 'var(--border)'}`,
                    borderRadius: 6,
                    background: tone === t ? 'var(--ink)' : 'var(--surface)',
                    color: tone === t ? 'var(--on-ink)' : 'var(--ink-2)',
                    fontSize: 13,
                    fontWeight: tone === t ? 700 : 500,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                    transition: 'all 120ms',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-2)' }}>
              Target Duration
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {([30, 45, 60] as Duration[]).map(d => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  style={{
                    padding: '8px 20px',
                    border: `1px solid ${duration === d ? 'var(--ink)' : 'var(--border)'}`,
                    borderRadius: 6,
                    background: duration === d ? 'var(--ink)' : 'var(--surface)',
                    color: duration === d ? 'var(--on-ink)' : 'var(--ink-2)',
                    fontSize: 13,
                    fontWeight: duration === d ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 120ms',
                  }}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>

          {/* Optional product image */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-2)' }}>
              Product Image <span style={{ fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>(optional — improves frame accuracy)</span>
            </label>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            {productPreview ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={productPreview}
                  alt="product"
                  style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }}
                />
                <button
                  onClick={() => { setProductFile(null); setProductPreview(null) }}
                  style={{
                    fontSize: 12,
                    color: 'var(--ink-2)',
                    background: 'none',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '4px 10px',
                    cursor: 'pointer',
                  }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: '10px 16px',
                  border: '1px dashed var(--border)',
                  borderRadius: 8,
                  background: 'var(--surface)',
                  color: 'var(--ink-2)',
                  fontSize: 13,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                Upload product image…
              </button>
            )}
          </div>

          {/* CTA */}
          <button
            onClick={handleGenerateBeatMap}
            disabled={loading || !topic.trim()}
            style={{
              padding: '12px 24px',
              background: loading || !topic.trim() ? 'var(--border)' : 'var(--ink)',
              color: loading || !topic.trim() ? 'var(--ink-2)' : 'var(--on-ink)',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              cursor: loading || !topic.trim() ? 'not-allowed' : 'pointer',
              alignSelf: 'flex-start',
              transition: 'all 120ms',
            }}
          >
            {loading ? 'Generating…' : 'Generate Beat Map →'}
          </button>
        </div>
      )}

      {/* ── STEP: BEAT MAP ── */}
      {step === 'beatmap' && beatMap && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-fade)', marginBottom: 4 }}>
                Beat Map — {beatMap.beats.length} scenes · {beatMap.total_duration}s
              </div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>
                {beatMap.title}
              </h2>
            </div>
            <button
              onClick={() => setStep('form')}
              style={{
                fontSize: 12,
                color: 'var(--ink-2)',
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '6px 12px',
                cursor: 'pointer',
              }}
            >
              ← Start over
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            {beatMap.beats.map(beat => (
              <BeatCard key={beat.id} beat={beat} />
            ))}
          </div>

          <button
            onClick={handleGenerateFrames}
            disabled={loading}
            style={{
              padding: '12px 24px',
              background: loading ? 'var(--border)' : 'var(--ink)',
              color: loading ? 'var(--ink-2)' : 'var(--on-ink)',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              alignSelf: 'flex-start',
              transition: 'all 120ms',
            }}
          >
            {loading ? 'Generating frames…' : 'Generate Frames →'}
          </button>
        </div>
      )}

      {/* ── STEP: FRAMES ── */}
      {step === 'frames' && beatMap && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-fade)', marginBottom: 4 }}>
                Frames — {frameUrls.filter(Boolean).length} of {beatMap.beats.length} generated
              </div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>
                {beatMap.title}
              </h2>
            </div>
            <button
              onClick={() => setStep('beatmap')}
              style={{
                fontSize: 12,
                color: 'var(--ink-2)',
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '6px 12px',
                cursor: 'pointer',
              }}
            >
              ← Back to beats
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            {beatMap.beats.map((beat, i) => (
              <BeatCard key={beat.id} beat={beat} frameUrl={frameUrls[i]} />
            ))}
          </div>

          <button
            onClick={handleAnimateAndStitch}
            disabled={loading}
            style={{
              padding: '12px 24px',
              background: loading ? 'var(--border)' : 'var(--ink)',
              color: loading ? 'var(--ink-2)' : 'var(--on-ink)',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              alignSelf: 'flex-start',
              transition: 'all 120ms',
            }}
          >
            {loading ? statusMsg || 'Processing…' : 'Animate + Stitch →'}
          </button>
        </div>
      )}

      {/* ── STEP: PREVIEW ── */}
      {step === 'preview' && finalVideoUrl && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-fade)', marginBottom: 4 }}>
                Vox Studio / Final Cut
              </div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>
                {beatMap?.title}
              </h2>
            </div>
            <button
              onClick={() => {
                setStep('form')
                setBeatMap(null)
                setFrameUrls([])
                setFinalVideoUrl(null)
                setError('')
              }}
              style={{
                fontSize: 12,
                color: 'var(--ink-2)',
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '6px 12px',
                cursor: 'pointer',
              }}
            >
              Start over
            </button>
          </div>

          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* Video player */}
            <div style={{
              flex: '0 0 auto',
              width: 280,
              borderRadius: 12,
              overflow: 'hidden',
              border: '1px solid var(--border)',
              background: '#000',
            }}>
              <video
                src={finalVideoUrl}
                controls
                autoPlay
                loop
                style={{ width: '100%', display: 'block' }}
              />
            </div>

            {/* Actions */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 200 }}>
              <a
                href={finalVideoUrl}
                download="vox-video.mp4"
                style={{
                  display: 'inline-block',
                  padding: '10px 20px',
                  background: 'var(--ink)',
                  color: 'var(--on-ink)',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  textDecoration: 'none',
                  textAlign: 'center',
                }}
              >
                Download MP4
              </a>
              <button
                onClick={() => {
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(finalVideoUrl)
                  }
                }}
                style={{
                  padding: '10px 20px',
                  background: 'var(--surface)',
                  color: 'var(--ink)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Copy URL
              </button>

              {/* Beat summary */}
              {beatMap && (
                <div style={{
                  marginTop: 8,
                  padding: '12px 14px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-2)', marginBottom: 8 }}>
                    {beatMap.beats.length} beats · {beatMap.total_duration}s
                  </div>
                  {beatMap.beats.map(beat => (
                    <div key={beat.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{
                        display: 'inline-block',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: beat.accent_color,
                        flexShrink: 0,
                      }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', minWidth: 80 }}>
                        {beat.headline}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>
                        {beat.duration_sec}s
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
