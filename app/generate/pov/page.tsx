'use client'

import { useEffect, useRef, useState } from 'react'
import { getSupabase } from '@/lib/auth'
import { POV_FORMATS, type PovFormat } from '@/lib/pov-formats'
import { showError, showSuccess } from '@/lib/notifications'

interface GenState {
  predictionId: string
  provider: 'seedance'
  voiceoverUrl?: string
  status: 'processing' | 'completed' | 'failed'
  videoUrl?: string
  error?: string
  formatName: string
  duration: number
}

export default function PovGeneratorPage() {
  const [selectedFormat, setSelectedFormat] = useState<PovFormat | null>(null)
  const [productName, setProductName] = useState('')
  const [productDescription, setProductDescription] = useState('')
  const [benefit, setBenefit] = useState('')
  const [extraDirection, setExtraDirection] = useState('')
  const [script, setScript] = useState('')
  const [productImage, setProductImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(null)
  const [uiScreenshot, setUiScreenshot] = useState<{ base64: string; mimeType: string; preview: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [gen, setGen] = useState<GenState | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  // Poll for video status when a job is running
  useEffect(() => {
    if (!gen || gen.status !== 'processing') return
    let stop = false
    const tick = async () => {
      try {
        const res = await fetch(
          `/api/ugc/video-status?videoId=${gen.predictionId}&provider=seedance`,
        )
        const data = await res.json()
        if (stop) return
        const v = data.video
        if (v?.status === 'completed' && v.videoUrl) {
          setGen({ ...gen, status: 'completed', videoUrl: v.videoUrl })
        } else if (v?.status === 'failed') {
          setGen({ ...gen, status: 'failed', error: v.error ?? 'Generation failed' })
        }
      } catch { /* keep polling */ }
    }
    const id = setInterval(tick, 4000)
    return () => { stop = true; clearInterval(id) }
  }, [gen])

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>, target: 'product' | 'ui') {
    const file = e.target.files?.[0]
    if (!file) return
    const buf = await file.arrayBuffer()
    const b64 = Buffer.from(buf).toString('base64')
    const url = URL.createObjectURL(file)
    const value = { base64: b64, mimeType: file.type, preview: url }
    if (target === 'product') setProductImage(value)
    else setUiScreenshot(value)
  }

  async function submit() {
    if (!selectedFormat) return
    if (!productName || !productDescription || !benefit) {
      showError('Missing info', 'Fill product name, description, and benefit')
      return
    }
    if (selectedFormat.needsProductImage && !productImage) {
      showError('Missing image', 'This format needs a product photo')
      return
    }
    if (selectedFormat.needsUiScreenshot && !uiScreenshot) {
      showError('Missing screenshot', 'This format needs a UI screenshot')
      return
    }
    if (selectedFormat.needsVoiceover && !script.trim()) {
      showError('Missing script', 'Write a short voiceover script (1–2 sentences)')
      return
    }

    setLoading(true)
    try {
      const supabase = getSupabase()!
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) throw new Error('Please sign in')

      const res = await fetch('/api/pov/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          formatId: selectedFormat.id,
          productName,
          productDescription,
          benefit,
          extraDirection: extraDirection.trim() || undefined,
          script: selectedFormat.needsVoiceover ? script : undefined,
          productImageBase64: selectedFormat.needsProductImage ? productImage?.base64 : undefined,
          productImageMimeType: selectedFormat.needsProductImage ? productImage?.mimeType : undefined,
          uiScreenshotBase64: selectedFormat.needsUiScreenshot ? uiScreenshot?.base64 : undefined,
          uiScreenshotMimeType: selectedFormat.needsUiScreenshot ? uiScreenshot?.mimeType : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')

      const video = data.components?.video
      setGen({
        predictionId: video.videoId,
        provider: 'seedance',
        voiceoverUrl: video.voiceoverUrl,
        status: 'processing',
        formatName: selectedFormat.name,
        duration: video.duration,
      })
      showSuccess('Generating', `${selectedFormat.name} is rendering — usually 60–120s`)
    } catch (err) {
      showError('Error', err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setGen(null)
    setSelectedFormat(null)
    setProductName('')
    setProductDescription('')
    setBenefit('')
    setExtraDirection('')
    setScript('')
    setProductImage(null)
    setUiScreenshot(null)
  }

  // Sync-play audio + video together on the result screen
  useEffect(() => {
    if (gen?.status !== 'completed' || !gen.voiceoverUrl) return
    const v = videoRef.current
    const a = audioRef.current
    if (!v || !a) return
    const play = () => { a.currentTime = 0; a.play().catch(() => {}) }
    const pause = () => a.pause()
    const seek = () => { a.currentTime = v.currentTime }
    v.addEventListener('play', play)
    v.addEventListener('pause', pause)
    v.addEventListener('seeked', seek)
    return () => {
      v.removeEventListener('play', play)
      v.removeEventListener('pause', pause)
      v.removeEventListener('seeked', seek)
    }
  }, [gen?.status, gen?.voiceoverUrl])

  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: '40px 32px 100px' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: 'var(--ink-dim)', marginBottom: 8 }}>
          STUDIO / POV STUDIO
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 42, fontWeight: 400, letterSpacing: '-0.01em', margin: '0 0 8px' }}>
          POV <em>Studio</em>
        </h1>
        <p style={{ fontSize: 14.5, color: 'var(--ink-dim)', margin: 0, maxWidth: 620 }}>
          Faceless UGC — the product does the selling, not a talking head. Seedance renders realistic phone-shot POV clips: unboxings, product-in-use, cozy discovery, and app demos.
        </p>
      </div>

      {gen && (
        <ResultBox gen={gen} videoRef={videoRef} audioRef={audioRef} onReset={reset} />
      )}

      {!gen && !selectedFormat && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {POV_FORMATS.map(f => (
            <button
              key={f.id}
              onClick={() => setSelectedFormat(f)}
              className="card"
              style={{
                textAlign: 'left',
                padding: 20,
                border: '1px solid var(--line)',
                borderRadius: 14,
                background: 'var(--surface)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div style={{ fontSize: 28, lineHeight: 1 }}>{f.emoji}</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>{f.name}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-dim)', lineHeight: 1.45 }}>{f.tagline}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-mute)' }}>
                <span>{f.durationSeconds}s</span>
                <span>·</span>
                <span>{f.aspectRatio}</span>
                <span>·</span>
                <span>{f.durationSeconds === 5 ? 30 : 50}cr</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {!gen && selectedFormat && (
        <div>
          <button
            onClick={() => setSelectedFormat(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--ink-dim)',
              cursor: 'pointer',
              fontSize: 13,
              marginBottom: 24,
              padding: 0,
            }}
          >
            ← Back to formats
          </button>

          <div style={{ padding: 24, border: '1px solid var(--line)', borderRadius: 14, marginBottom: 24, background: 'var(--surface)' }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{selectedFormat.emoji}</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{selectedFormat.name}</div>
            <div style={{ fontSize: 13.5, color: 'var(--ink-dim)', marginTop: 4 }}>{selectedFormat.tagline}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <Field label="Product / app name">
              <input className="input" placeholder="e.g. ContentFlow, Lumo Skin, Nike Vaporfly" value={productName} onChange={(e) => setProductName(e.target.value)} />
            </Field>

            <Field label="Product description" hint="1 sentence — what it is and who it's for">
              <textarea
                className="textarea"
                rows={2}
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                placeholder="AI-powered UGC video generator for DTC brands"
              />
            </Field>

            <Field label="Key benefit shown" hint="The moment / feeling this clip should sell">
              <input
                className="input"
                value={benefit}
                onChange={(e) => setBenefit(e.target.value)}
                placeholder="how easy it is to launch an ad in 30 seconds"
              />
            </Field>

            {selectedFormat.needsProductImage && (
              <Field label="Product photo" hint="A clean shot of the product — the model will keep it consistent across the clip">
                <FileInput file={productImage} onChange={(e) => pickFile(e, 'product')} />
              </Field>
            )}

            {selectedFormat.needsUiScreenshot && (
              <Field label="UI screenshot" hint="The app / website screen the character will show on-screen">
                <FileInput file={uiScreenshot} onChange={(e) => pickFile(e, 'ui')} />
              </Field>
            )}

            {selectedFormat.needsVoiceover && (
              <Field label="Voiceover script" hint="1–2 sentences. Casual, conversational — like you're telling a friend">
                <textarea
                  className="textarea"
                  rows={3}
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  placeholder="wait bro I just found this app that literally does UGC ads for you… like it just generates them"
                />
              </Field>
            )}

            <Field label="Extra direction (optional)" hint="Any specific vibe or detail — the sky's the limit">
              <textarea
                className="textarea"
                rows={2}
                value={extraDirection}
                onChange={(e) => setExtraDirection(e.target.value)}
                placeholder="green plants in background, moody warm light, holding an iced matcha"
              />
            </Field>

            <button
              onClick={submit}
              disabled={loading}
              className="btn btn-primary"
              style={{ padding: '14px 24px', borderRadius: 12, marginTop: 12, opacity: loading ? 0.6 : 1 }}
            >
              {loading ? 'Submitting…' : `Generate — ${selectedFormat.durationSeconds === 5 ? 30 : 50} credits`}
            </button>
          </div>
        </div>
      )}
    </main>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="form-row">
      <label className="form-label">{label}</label>
      {children}
      {hint && <p className="help">{hint}</p>}
    </div>
  )
}

function FileInput({ file, onChange }: { file: { preview: string } | null; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <div>
      {file && (
        <div style={{ marginBottom: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={file.preview} alt="" style={{ maxWidth: 240, borderRadius: 10, border: '1px solid var(--line)' }} />
        </div>
      )}
      <input type="file" accept="image/*" onChange={onChange} className="input" />
    </div>
  )
}

function ResultBox({
  gen,
  videoRef,
  audioRef,
  onReset,
}: {
  gen: GenState
  videoRef: React.RefObject<HTMLVideoElement | null>
  audioRef: React.RefObject<HTMLAudioElement | null>
  onReset: () => void
}) {
  return (
    <div style={{ padding: 24, border: '1px solid var(--line)', borderRadius: 14, background: 'var(--surface)', marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-dim)' }}>NOW RENDERING</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{gen.formatName}</div>
        </div>
        <button
          onClick={onReset}
          style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 14px', cursor: 'pointer', fontSize: 13 }}
        >
          New generation
        </button>
      </div>

      {gen.status === 'processing' && (
        <div style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 15, marginBottom: 8 }}>Seedance is rendering your clip…</div>
          <div style={{ fontSize: 13, color: 'var(--ink-dim)' }}>Typically 60–120 seconds. You can leave this page — it'll be in Library when done.</div>
        </div>
      )}

      {gen.status === 'failed' && (
        <div style={{ padding: 24, background: 'rgba(184,58,53,0.08)', border: '1px solid var(--danger)', borderRadius: 10, color: 'var(--danger)' }}>
          Generation failed: {gen.error}
        </div>
      )}

      {gen.status === 'completed' && gen.videoUrl && (
        <div>
          <video
            ref={videoRef}
            src={gen.videoUrl}
            controls
            playsInline
            style={{ width: '100%', maxWidth: 400, borderRadius: 12, display: 'block', margin: '0 auto' }}
          />
          {gen.voiceoverUrl && (
            // Hidden audio element — synced with the video via effect above.
            <audio ref={audioRef} src={gen.voiceoverUrl} style={{ display: 'none' }} />
          )}
          <div style={{ marginTop: 16, display: 'flex', gap: 10, justifyContent: 'center' }}>
            <a href={gen.videoUrl} download className="btn" style={{ padding: '10px 18px', borderRadius: 10 }}>
              Download video
            </a>
            {gen.voiceoverUrl && (
              <a href={gen.voiceoverUrl} download className="btn" style={{ padding: '10px 18px', borderRadius: 10 }}>
                Download voiceover
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
