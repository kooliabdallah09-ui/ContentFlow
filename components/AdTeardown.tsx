'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/auth'
import { showError, showSuccess } from '@/lib/notifications'
import { Loader2, Lock, Check, Copy, RotateCcw } from 'lucide-react'

interface Caption {
  text: string
  start: number
  end: number
  style: string
  position: string
}

interface Breakdown {
  hook: string
  beats: string[]
  pacing: string
  cuts: number
  musicMood: string
  character: string
  scene: string
  captionStyle: string
}

interface AnalyzeResult {
  breakdown: Breakdown
  videoPrompt: string
  captions: Caption[]
  captionsLocked?: boolean
}

interface Frame {
  base64: string
  mimeType: string
  timeSeconds: number
}

// Signed-in runs get the full frame budget and audio transcription. Anonymous
// runs sample fewer, smaller frames — that's what keeps a public teardown at
// roughly $0.015 instead of $0.05.
const FRAME_COUNT_AUTHED = 10
const FRAME_COUNT_ANON = 6
const FRAME_MAX_EDGE_ANON = 512

const STEPS = ['Sampling frames', 'Reading composition', 'Mapping the beats', 'Writing your prompt'] as const

const ACCENT = '#b91c1c'

// Rendered standalone at /teardown — the landing page links here rather than
// embedding the tool, so this page can rank and be shared on its own.
export function AdTeardown() {
  const router = useRouter()
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [step, setStep] = useState(0)
  const [frames, setFrames] = useState<Frame[]>([])
  const [result, setResult] = useState<AnalyzeResult | null>(null)
  const [editablePrompt, setEditablePrompt] = useState('')
  const [copied, setCopied] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    (async () => {
      const supabase = getSupabase()
      if (!supabase) { setSignedIn(false); return }
      const { data: sess } = await supabase.auth.getSession()
      setSignedIn(!!sess?.session?.access_token)
    })()
  }, [])

  function reset() {
    setResult(null)
    setEditablePrompt('')
    setFrames([])
    setStep(0)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setFile(null)
    setDuration(0)
  }

  function handleFile(f: File | null) {
    setResult(null)
    setEditablePrompt('')
    setFrames([])
    setStep(0)
    if (!f) { setFile(null); setPreviewUrl(null); return }
    if (!f.type.startsWith('video/')) {
      showError('Not a video', 'Upload an .mp4, .webm or .mov file.')
      return
    }
    setFile(f)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(f))
  }

  // Sample evenly-spaced JPEG frames. Anonymous runs are downscaled to keep
  // the vision-token bill (and our API cost) low.
  async function sampleFrames(v: HTMLVideoElement, count: number, maxEdge: number | null) {
    const c = canvasRef.current!
    const dur = v.duration
    let w = v.videoWidth
    let h = v.videoHeight
    if (maxEdge && Math.max(w, h) > maxEdge) {
      const scale = maxEdge / Math.max(w, h)
      w = Math.round(w * scale)
      h = Math.round(h * scale)
    }
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')!
    const out: Frame[] = []
    for (let i = 0; i < count; i++) {
      const t = (dur * (i + 0.5)) / count
      v.currentTime = t
      await new Promise<void>(res => {
        const done = () => { v.removeEventListener('seeked', done); res() }
        v.addEventListener('seeked', done)
      })
      ctx.drawImage(v, 0, 0, w, h)
      const dataUrl = c.toDataURL('image/jpeg', 0.7)
      const frame = { base64: dataUrl.split(',')[1], mimeType: 'image/jpeg', timeSeconds: t }
      out.push(frame)
      // Surface frames as they're captured — the filmstrip fills in live.
      setFrames(prev => [...prev, frame])
    }
    return out
  }

  async function analyze() {
    if (!file || !videoRef.current) return
    const v = videoRef.current
    // Guard: transcription + vision on a 90s reel would time out the 300s route.
    if (v.duration > 90) {
      showError('Too long', `That ad is ${v.duration.toFixed(0)}s — trim it under 90s.`)
      return
    }
    if (file.size > 100 * 1024 * 1024) {
      showError('Too big', 'Please upload a video under 100 MB.')
      return
    }

    setAnalyzing(true)
    setFrames([])
    setStep(0)
    try {
      const supabase = getSupabase()
      const { data: sess } = supabase ? await supabase.auth.getSession() : { data: null }
      const token = sess?.session?.access_token ?? null

      // Audio transcription needs the file in storage, which needs an account.
      // Anonymous teardowns stay entirely client-side until the frames POST.
      let audioUrl: string | undefined
      if (token && supabase) {
        const urlRes = await fetch('/api/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ folder: 'analyzer-source', ext: 'mp4' }),
        })
        const urlData = await urlRes.json()
        if (!urlRes.ok || !urlData.signedUrl) throw new Error(urlData.error || 'Could not prepare upload')
        const uploadController = new AbortController()
        const uploadTimeout = setTimeout(() => uploadController.abort(), 180_000)
        try {
          const putRes = await fetch(urlData.signedUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type || 'video/mp4' },
            body: file,
            signal: uploadController.signal,
          })
          if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`)
        } finally {
          clearTimeout(uploadTimeout)
        }
        const { data: pub } = supabase.storage.from('ugc-assets').getPublicUrl(urlData.storagePath)
        audioUrl = pub.publicUrl
      }

      setStep(0)
      await new Promise<void>(r => {
        if (v.readyState >= 2) r()
        else v.addEventListener('loadeddata', () => r(), { once: true })
      })
      const captured = await sampleFrames(
        v,
        token ? FRAME_COUNT_AUTHED : FRAME_COUNT_ANON,
        token ? null : FRAME_MAX_EDGE_ANON,
      )

      setStep(1)
      const res = await fetch('/api/analyzer/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ frames: captured, audioUrl, videoDurationSeconds: v.duration }),
      })
      setStep(2)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analysis failed')
      setStep(3)
      setResult(data as AnalyzeResult)
      setEditablePrompt((data as AnalyzeResult).videoPrompt)
      showSuccess('Teardown complete', 'Full anatomy below.')
    } catch (err) {
      showError('Teardown failed', err instanceof Error ? err.message : 'Try again')
    } finally {
      setAnalyzing(false)
    }
  }

  function useForUGC() {
    if (!result) return
    // Stash the teardown for /generate/ugc to pre-fill. Survives the signup
    // round-trip too, so an anonymous visitor who converts lands back here
    // with their prompt intact.
    try {
      sessionStorage.setItem('chatPrefillTopic', editablePrompt.slice(0, 1500))
      sessionStorage.setItem('analyzerCaptions', JSON.stringify(result.captions))
      sessionStorage.setItem('analyzerBreakdown', JSON.stringify(result.breakdown))
    } catch { /* quota — ignore */ }
    if (signedIn) router.push('/generate/ugc')
    else router.push('/auth/signup?next=/generate/ugc')
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(editablePrompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { showError('Copy failed', 'Select the text and copy manually.') }
  }

  const body = (
    <>
      {/* ── Stage 1: drop the ad ───────────────────────────────── */}
      {!file && !result && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0] ?? null) }}
          style={{ position: 'relative' }}
        >
          <label
            className="td-drop"
            style={{
              position: 'relative', display: 'block', cursor: 'pointer',
              borderRadius: 22, overflow: 'hidden',
              border: `1.5px dashed ${dragging ? ACCENT : 'var(--border)'}`,
              background: 'var(--surface)',
              transform: dragging ? 'scale(1.01)' : 'none',
              transition: 'border-color 160ms, transform 160ms',
            }}
          >
            {/* crimson glow */}
            <div style={{
              position: 'absolute', top: -120, left: '50%', transform: 'translateX(-50%)',
              width: 560, height: 260, borderRadius: '50%', pointerEvents: 'none',
              background: `radial-gradient(ellipse, rgba(185,28,28,${dragging ? 0.22 : 0.11}) 0%, transparent 70%)`,
              transition: 'background 200ms',
            }} />

            <div style={{ position: 'relative', padding: '56px 32px 44px', textAlign: 'center' }}>
              {/* filmstrip motif */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginBottom: 26 }}>
                {[0, 1, 2, 3, 4].map(i => (
                  <div
                    key={i}
                    className="td-cell"
                    style={{
                      width: 34, height: 52, borderRadius: 5,
                      border: '1px solid var(--border)',
                      background: i === 2 ? ACCENT : 'var(--bg)',
                      opacity: i === 2 ? 1 : 0.5 + i * 0.04,
                      animationDelay: `${i * 110}ms`,
                    }}
                  />
                ))}
              </div>

              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, letterSpacing: '-0.01em', marginBottom: 8 }}>
                Drop the ad that&apos;s <em>beating you</em>
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--ink-mute)', maxWidth: 400, margin: '0 auto 22px', lineHeight: 1.6 }}>
                Right-click → Save any TikTok or Reels ad, then drop the .mp4 here.
                Nothing uploads until you hit analyze.
              </div>

              <span style={{
                display: 'inline-block', padding: '12px 26px', borderRadius: 11,
                background: ACCENT, color: '#fff', fontSize: 14, fontWeight: 600,
              }}>
                Choose a video
              </span>

              <div style={{
                marginTop: 30, paddingTop: 22, borderTop: '1px solid var(--border-soft)',
                display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap',
              }}>
                {['The hook, named', 'Beat-by-beat structure', 'Pacing + cut count', 'A prompt to rebuild it'].map(t => (
                  <span key={t} style={{
                    fontSize: 11.5, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
                    color: 'var(--ink-mute)', border: '1px solid var(--border)',
                    borderRadius: 999, padding: '5px 12px', background: 'var(--bg)',
                  }}>{t}</span>
                ))}
              </div>
            </div>
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      )}

      {/* ── Stage 2: loaded / analyzing ─────────────────────────── */}
      {file && !result && (
        <div style={{
          border: '1px solid var(--border)', borderRadius: 22, background: 'var(--surface)',
          padding: 24, display: 'grid', gridTemplateColumns: '240px 1fr', gap: 26,
        }} className="td-stage">
          <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', background: '#000', aspectRatio: '9 / 16' }}>
            <video
              ref={videoRef}
              src={previewUrl ?? undefined}
              controls={!analyzing}
              playsInline
              muted
              onLoadedMetadata={e => setDuration((e.currentTarget as HTMLVideoElement).duration)}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            {analyzing && (
              <>
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }} />
                <div className="td-scan" style={{
                  position: 'absolute', left: 0, right: 0, height: 3,
                  background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)`,
                  boxShadow: `0 0 18px 5px rgba(185,28,28,0.5)`,
                }} />
              </>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: 'var(--ink-fade)', textTransform: 'uppercase' }}>
              {analyzing ? 'Tearing it down' : 'Ready'}
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, margin: '6px 0 4px' }}>
              {file.name.replace(/\.[^.]+$/, '').slice(0, 40)}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-mute)', marginBottom: 20 }}>
              {(file.size / 1024 / 1024).toFixed(1)} MB{duration > 0 && ` · ${duration.toFixed(1)}s`}
            </div>

            {analyzing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {STEPS.map((s, i) => {
                  const done = i < step
                  const active = i === step
                  return (
                    <div key={s} style={{
                      display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5,
                      color: done || active ? 'var(--ink)' : 'var(--ink-fade)',
                    }}>
                      <span style={{
                        width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                        border: `1.5px solid ${done ? ACCENT : active ? ACCENT : 'var(--border)'}`,
                        background: done ? ACCENT : 'transparent',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {done && <Check size={11} color="#fff" strokeWidth={3} />}
                        {active && <Loader2 size={11} className="animate-spin" color={ACCENT} />}
                      </span>
                      {s}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={analyze} disabled={!duration} style={{
                  padding: '13px 26px', borderRadius: 11, background: ACCENT, color: '#fff',
                  border: 'none', fontSize: 14, fontWeight: 600, cursor: duration ? 'pointer' : 'wait',
                }}>
                  Tear it down →
                </button>
                <button onClick={reset} style={{
                  padding: '13px 18px', borderRadius: 11, background: 'transparent',
                  border: '1px solid var(--border)', color: 'var(--ink)', fontSize: 13.5, cursor: 'pointer',
                }}>
                  Replace
                </button>
              </div>
            )}

            {/* live filmstrip */}
            {frames.length > 0 && (
              <div style={{ marginTop: 'auto', paddingTop: 22 }}>
                <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: 'var(--ink-fade)', marginBottom: 8 }}>
                  FRAMES READ · {frames.length}
                </div>
                <div style={{ display: 'flex', gap: 4, overflowX: 'auto' }}>
                  {frames.map((f, i) => (
                    <img
                      key={i}
                      src={`data:image/jpeg;base64,${f.base64}`}
                      alt=""
                      className="td-frame-in"
                      style={{ height: 54, borderRadius: 4, border: '1px solid var(--border)', flexShrink: 0 }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
      )}

      {/* ── Stage 3: the teardown ───────────────────────────────── */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* hook as editorial pull-quote */}
          <div style={{
            position: 'relative', borderRadius: 22, overflow: 'hidden',
            border: '1px solid var(--border)', background: 'var(--surface)', padding: '34px 34px 30px',
          }}>
            <div style={{
              position: 'absolute', top: -100, right: -60, width: 420, height: 240,
              borderRadius: '50%', pointerEvents: 'none',
              background: 'radial-gradient(ellipse, rgba(185,28,28,0.10) 0%, transparent 70%)',
            }} />
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', color: ACCENT, textTransform: 'uppercase', marginBottom: 12 }}>
                  ◆ The hook
                </div>
                <div style={{
                  fontFamily: 'var(--font-serif)', fontSize: 27, lineHeight: 1.3,
                  letterSpacing: '-0.01em', borderLeft: `2px solid ${ACCENT}`, paddingLeft: 18,
                }}>
                  {result.breakdown.hook || '—'}
                </div>
              </div>
              <button onClick={reset} style={{
                flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'transparent', border: '1px solid var(--border)', borderRadius: 9,
                padding: '7px 13px', fontSize: 12.5, cursor: 'pointer', color: 'var(--ink)',
              }}>
                <RotateCcw size={12} /> New
              </button>
            </div>
          </div>

          {/* stat strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }} className="td-stats">
            <StatTile label="Pacing">
              <div style={{ display: 'flex', gap: 3, marginTop: 7 }}>
                {['slow', 'medium', 'fast'].map(p => {
                  const on = result.breakdown.pacing === p
                  return (
                    <div key={p} style={{
                      flex: 1, height: 5, borderRadius: 3,
                      background: on ? ACCENT : 'var(--border)',
                    }} />
                  )
                })}
              </div>
              <div style={{ fontSize: 14, marginTop: 8, textTransform: 'capitalize' }}>{result.breakdown.pacing}</div>
            </StatTile>

            <StatTile label="Cuts">
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 30, lineHeight: 1, marginTop: 6 }}>
                {result.breakdown.cuts}
              </div>
              <div style={{ display: 'flex', gap: 2, marginTop: 9 }}>
                {Array.from({ length: Math.min(result.breakdown.cuts || 0, 14) }).map((_, i) => (
                  <div key={i} style={{ width: 3, height: 12, borderRadius: 2, background: ACCENT, opacity: 0.35 + (i % 3) * 0.25 }} />
                ))}
              </div>
            </StatTile>

            <StatTile label="Music">
              <div style={{ fontSize: 15, marginTop: 10, textTransform: 'capitalize', lineHeight: 1.4 }}>
                {result.breakdown.musicMood || '—'}
              </div>
            </StatTile>

            <StatTile label="Captions">
              <div style={{ fontSize: 15, marginTop: 10, textTransform: 'capitalize', lineHeight: 1.4 }}>
                {result.breakdown.captionStyle || '—'}
              </div>
            </StatTile>
          </div>

          {/* anatomy timeline + who/where */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 16 }} className="td-split">
            <div style={{ border: '1px solid var(--border)', borderRadius: 22, background: 'var(--surface)', padding: 28 }}>
              <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', color: 'var(--ink-fade)', textTransform: 'uppercase', marginBottom: 20 }}>
                Anatomy · {result.breakdown.beats.length} beats
              </div>
              <div style={{ position: 'relative' }}>
                {/* connecting rail */}
                {result.breakdown.beats.length > 1 && (
                  <div style={{
                    position: 'absolute', left: 11, top: 12, bottom: 12, width: 1,
                    background: 'var(--border)',
                  }} />
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {result.breakdown.beats.map((b, i) => (
                    <div key={i} style={{ position: 'relative', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                      <div style={{
                        position: 'relative', zIndex: 1, flexShrink: 0,
                        width: 23, height: 23, borderRadius: '50%',
                        background: i === 0 ? ACCENT : 'var(--bg)',
                        border: `1.5px solid ${i === 0 ? ACCENT : 'var(--border)'}`,
                        color: i === 0 ? '#fff' : 'var(--ink-mute)',
                        fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>{i + 1}</div>
                      <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink-2)', paddingTop: 2 }}>{b}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <DetailCard label="Who's on camera" value={result.breakdown.character} />
              <DetailCard label="Where it's shot" value={result.breakdown.scene} />
            </div>
          </div>

          {/* frames read */}
          {frames.length > 0 && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 22, background: 'var(--surface)', padding: 24 }}>
              <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', color: 'var(--ink-fade)', textTransform: 'uppercase', marginBottom: 14 }}>
                What we looked at
              </div>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                {frames.map((f, i) => (
                  <div key={i} style={{ flexShrink: 0, textAlign: 'center' }}>
                    <img
                      src={`data:image/jpeg;base64,${f.base64}`}
                      alt=""
                      style={{ height: 104, borderRadius: 8, border: '1px solid var(--border)', display: 'block' }}
                    />
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-fade)', marginTop: 5 }}>
                      {f.timeSeconds.toFixed(1)}s
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* prompt */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 22, background: 'var(--surface)', padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 12 }}>
              <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', color: 'var(--ink-fade)', textTransform: 'uppercase' }}>
                Your rebuild prompt
              </div>
              <button onClick={copyPrompt} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'transparent', border: '1px solid var(--border)', borderRadius: 8,
                padding: '6px 12px', fontSize: 12, cursor: 'pointer',
                color: copied ? ACCENT : 'var(--ink)',
              }}>
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--ink-mute)', margin: '0 0 14px', lineHeight: 1.6 }}>
              Same structure, your product. Edit it, then generate — captions get placed separately in the editor.
            </p>
            <textarea
              value={editablePrompt}
              onChange={e => setEditablePrompt(e.target.value)}
              rows={7}
              style={{
                width: '100%', boxSizing: 'border-box', padding: 16, borderRadius: 13,
                border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink)',
                fontSize: 13, fontFamily: 'var(--font-mono)', lineHeight: 1.65, resize: 'vertical',
              }}
            />
          </div>

          {/* captions — real, or locked */}
          {result.captionsLocked ? (
            <div style={{
              position: 'relative', border: `1px solid var(--border)`, borderRadius: 22,
              background: 'var(--surface)', padding: 28, overflow: 'hidden',
            }}>
              {/* blurred teaser rows behind the lock */}
              <div aria-hidden style={{ filter: 'blur(6px)', opacity: 0.4, pointerEvents: 'none', userSelect: 'none' }}>
                {[['0.0s – 1.2s', 'okay so I never post this'], ['1.2s – 2.6s', 'but this thing actually'], ['2.6s – 4.1s', 'changed how my skin looks']].map(([t, s]) => (
                  <div key={t} style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: 12, padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 6 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-mute)' }}>{t}</span>
                    <span style={{ fontSize: 13 }}>{s}</span>
                  </div>
                ))}
              </div>
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24,
                background: 'color-mix(in srgb, var(--surface) 72%, transparent)',
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 11, marginBottom: 12,
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Lock size={16} />
                </div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 21, marginBottom: 6 }}>
                  The spoken script, <em>word for word</em>
                </div>
                <p style={{ fontSize: 13, color: 'var(--ink-dim)', margin: '0 0 16px', maxWidth: 400, lineHeight: 1.6 }}>
                  We transcribe every line with timestamps and drop it straight into the video editor.
                  Free account, 30 credits, no card.
                </p>
                <Link href="/auth/signup?next=/teardown" style={{
                  padding: '11px 22px', borderRadius: 11, background: ACCENT, color: '#fff',
                  textDecoration: 'none', fontSize: 13.5, fontWeight: 600,
                }}>
                  Unlock the transcript →
                </Link>
              </div>
            </div>
          ) : (
            <div style={{ border: '1px solid var(--border)', borderRadius: 22, background: 'var(--surface)', padding: 28 }}>
              <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', color: 'var(--ink-fade)', textTransform: 'uppercase', marginBottom: 14 }}>
                Transcript · {result.captions.length} lines
              </div>
              {result.captions.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--ink-mute)' }}>No spoken dialogue detected.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
                  {result.captions.map((c, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: 12, padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 10 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-mute)' }}>
                        {c.start.toFixed(1)}s – {c.end.toFixed(1)}s
                      </span>
                      <span style={{ fontSize: 13 }}>{c.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* closing CTA */}
          <div style={{
            border: '1px solid var(--border)', borderRadius: 22, padding: '30px 28px',
            background: 'var(--surface)', textAlign: 'center', position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', bottom: -140, left: '50%', transform: 'translateX(-50%)',
              width: 520, height: 260, borderRadius: '50%', pointerEvents: 'none',
              background: 'radial-gradient(ellipse, rgba(185,28,28,0.12) 0%, transparent 70%)',
            }} />
            <div style={{ position: 'relative' }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 27, marginBottom: 8, letterSpacing: '-0.01em' }}>
                Now make it <em>yours</em>
              </div>
              <p style={{ fontSize: 14, color: 'var(--ink-dim)', margin: '0 auto 20px', maxWidth: 420, lineHeight: 1.6 }}>
                Same beats, same pacing — your product, your actor, your voice.
              </p>
              <button onClick={useForUGC} style={{
                padding: '14px 30px', borderRadius: 12, background: ACCENT, color: '#fff',
                border: 'none', fontSize: 14.5, fontWeight: 600, cursor: 'pointer',
              }}>
                {signedIn ? 'Build this ad for my product →' : 'Build this for my product — free →'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes td-scan {
          0%   { top: 0%; opacity: 0; }
          12%  { opacity: 1; }
          88%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .td-scan { animation: td-scan 1.9s cubic-bezier(.4,0,.6,1) infinite; }
        @keyframes td-pulse {
          0%, 100% { transform: translateY(0); opacity: .55; }
          50%      { transform: translateY(-5px); opacity: 1; }
        }
        .td-drop:hover { border-color: var(--ink-fade); }
        .td-drop:hover .td-cell { animation: td-pulse 1.5s ease-in-out infinite; }
        @keyframes td-frame-in {
          from { opacity: 0; transform: scale(.85); }
          to   { opacity: 1; transform: scale(1); }
        }
        .td-frame-in { animation: td-frame-in 260ms ease-out; }
        @media (max-width: 860px) {
          .td-stage { grid-template-columns: 1fr !important; }
          .td-split { grid-template-columns: 1fr !important; }
          .td-stats { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </>
  )

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '44px 24px 100px' }}>
      <div style={{ marginBottom: 30 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', color: 'var(--ink-fade)', textTransform: 'uppercase', marginBottom: 12 }}>
          Free tool / Ad teardown
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 52, fontWeight: 400, margin: '0 0 12px', letterSpacing: '-0.02em', lineHeight: 1.05 }}>
          Why does <em style={{ color: ACCENT }}>that</em> ad work?
        </h1>
        <p style={{ fontSize: 16.5, color: 'var(--ink-dim)', margin: 0, maxWidth: 600, lineHeight: 1.65 }}>
          Drop in any TikTok or Reels ad. We name the hook, map the beat structure, count the cuts,
          read the caption style — then hand you a prompt that rebuilds it for your product.
          {signedIn === false && ' Free, no account needed.'}
        </p>
      </div>
      {body}
    </main>
  )
}

function StatTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 16, background: 'var(--surface)', padding: '16px 18px' }}>
      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', color: 'var(--ink-fade)', textTransform: 'uppercase' }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 18, background: 'var(--surface)', padding: 24, flex: 1 }}>
      <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', color: 'var(--ink-fade)', textTransform: 'uppercase', marginBottom: 10 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--ink-2)' }}>{value || '—'}</div>
    </div>
  )
}
