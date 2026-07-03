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
  const [characterDescription, setCharacterDescription] = useState('')
  const [duration, setDuration] = useState<5 | 10>(5)
  const [productImage, setProductImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(null)
  const [uiScreenshot, setUiScreenshot] = useState<{ base64: string; mimeType: string; preview: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [autofilling, setAutofilling] = useState(false)
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

  async function autofill() {
    if (!selectedFormat) return
    setAutofilling(true)
    try {
      const supabase = getSupabase()!
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) throw new Error('Please sign in')
      const res = await fetch('/api/pov/autofill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ formatId: selectedFormat.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Autofill failed')
      if (data.productName) setProductName(data.productName)
      if (data.productDescription) setProductDescription(data.productDescription)
      if (data.benefit) setBenefit(data.benefit)
      if (data.script && selectedFormat.needsVoiceover) setScript(data.script)
      if (data.characterDescription) setCharacterDescription(data.characterDescription)
      if (data.extraDirection) setExtraDirection(data.extraDirection)
      showSuccess('Filled', 'All fields autofilled from your brand profile')
    } catch (err) {
      showError('Autofill failed', err instanceof Error ? err.message : 'Try again')
    } finally {
      setAutofilling(false)
    }
  }

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
          characterDescription: characterDescription.trim() || undefined,
          duration,
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
    setCharacterDescription('')
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
              onClick={() => { setSelectedFormat(f); setDuration(f.durationSeconds) }}
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
                <span>{f.durationSeconds === 5 ? 60 : 110}cr</span>
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

          <div style={{ padding: 24, border: '1px solid var(--line)', borderRadius: 14, marginBottom: 24, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 24, marginBottom: 4 }}>{selectedFormat.emoji}</div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{selectedFormat.name}</div>
              <div style={{ fontSize: 13.5, color: 'var(--ink-dim)', marginTop: 4 }}>{selectedFormat.tagline}</div>
            </div>
            <button
              onClick={autofill}
              disabled={autofilling}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                borderRadius: 10,
                border: '1px solid var(--line)',
                background: 'var(--bg)',
                color: 'var(--ink)',
                fontSize: 13.5,
                fontWeight: 500,
                cursor: autofilling ? 'wait' : 'pointer',
                opacity: autofilling ? 0.6 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ fontSize: 15 }}>✨</span>
              {autofilling ? 'Filling…' : 'Autofill with AI'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <Field label="Duration" hint="5 seconds is punchy for hooks. 10 seconds gives room for a full beat.">
              <div style={{ display: 'flex', gap: 10 }}>
                {([5, 10] as const).map((d) => {
                  const active = duration === d
                  const cost = d === 5 ? 60 : 110
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDuration(d)}
                      style={{
                        flex: 1,
                        padding: '14px 16px',
                        borderRadius: 12,
                        border: `1px solid ${active ? 'var(--ink)' : 'var(--line)'}`,
                        background: active ? 'var(--ink)' : 'var(--surface)',
                        color: active ? 'var(--bg)' : 'var(--ink)',
                        cursor: 'pointer',
                        fontSize: 14,
                        fontWeight: 500,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                        transition: 'all 0.15s',
                      }}
                    >
                      <span style={{ fontSize: 16, fontWeight: 600 }}>{d} seconds</span>
                      <span style={{ fontSize: 12, opacity: 0.75 }}>{cost} credits</span>
                    </button>
                  )
                })}
              </div>
            </Field>

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

            <Field label="Character (creator)" hint="Who's on camera. One dense line — age, ethnicity, hair, one accessory, one outfit detail. Autofill can generate this.">
              <textarea
                className="textarea"
                rows={2}
                value={characterDescription}
                onChange={(e) => setCharacterDescription(e.target.value)}
                placeholder="a young Southeast Asian woman, 20s, athletic build, warm brown skin, dark hair pulled back into a high ponytail, small gold hoop earrings, oversized black hoodie"
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
              style={{
                padding: '14px 24px',
                borderRadius: 12,
                marginTop: 12,
                opacity: loading ? 0.6 : 1,
                background: 'var(--ink)',
                color: 'var(--bg)',
                border: 'none',
                fontSize: 15,
                fontWeight: 600,
                cursor: loading ? 'wait' : 'pointer',
                width: '100%',
              }}
            >
              {loading ? 'Submitting…' : `Generate — ${duration === 5 ? 60 : 110} credits`}
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
  const inputRef = useRef<HTMLInputElement>(null)

  if (file) {
    return (
      <div
        style={{
          position: 'relative',
          border: '1px solid var(--line)',
          borderRadius: 12,
          padding: 14,
          background: 'var(--surface)',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={file.preview}
          alt=""
          style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)' }}
        />
        <div style={{ flex: 1, fontSize: 13, color: 'var(--ink-dim)' }}>
          Image ready — Seedance will use this as the reference.
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          style={{
            background: 'transparent',
            border: '1px solid var(--line)',
            borderRadius: 8,
            padding: '8px 14px',
            fontSize: 12.5,
            cursor: 'pointer',
            color: 'var(--ink)',
          }}
        >
          Replace
        </button>
        <input ref={inputRef} type="file" accept="image/*" onChange={onChange} style={{ display: 'none' }} />
      </div>
    )
  }

  return (
    <label
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '28px 20px',
        border: '1.5px dashed var(--line)',
        borderRadius: 12,
        background: 'var(--surface)',
        cursor: 'pointer',
        transition: 'all 0.15s',
        textAlign: 'center',
      }}
      onDragOver={(e) => {
        e.preventDefault()
        e.currentTarget.style.borderColor = 'var(--ink)'
      }}
      onDragLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--line)'
      }}
      onDrop={(e) => {
        e.preventDefault()
        e.currentTarget.style.borderColor = 'var(--line)'
        const files = e.dataTransfer.files
        if (files.length) {
          const dt = new DataTransfer()
          dt.items.add(files[0])
          if (inputRef.current) {
            inputRef.current.files = dt.files
            const evt = new Event('change', { bubbles: true })
            inputRef.current.dispatchEvent(evt)
          }
        }
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 10,
          background: 'var(--bg)',
          border: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          marginBottom: 4,
        }}
      >
        ⬆
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>
        Click to upload or drag & drop
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-dim)' }}>
        PNG, JPG, or WebP · up to 10 MB
      </div>
      <input ref={inputRef} type="file" accept="image/*" onChange={onChange} style={{ display: 'none' }} />
    </label>
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
