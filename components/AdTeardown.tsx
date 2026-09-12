'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/auth'
import { showError, showSuccess } from '@/lib/notifications'
import { Loader2, Upload, Lock } from 'lucide-react'

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

// Signed-in runs get the full frame budget and audio transcription. Anonymous
// runs sample fewer, smaller frames — that's what keeps a public teardown at
// roughly $0.015 instead of $0.05.
const FRAME_COUNT_AUTHED = 10
const FRAME_COUNT_ANON = 6
const FRAME_MAX_EDGE_ANON = 512

export function AdTeardown() {
  const router = useRouter()
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [analyzing, setAnalyzing] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [result, setResult] = useState<AnalyzeResult | null>(null)
  const [editablePrompt, setEditablePrompt] = useState('')
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

  async function handleFile(f: File | null) {
    setResult(null)
    setEditablePrompt('')
    if (!f) { setFile(null); setPreviewUrl(null); return }
    setFile(f)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(f))
  }

  // Sample evenly-spaced JPEG frames from the loaded video. Anonymous runs are
  // downscaled to keep the vision-token bill (and our API cost) low.
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
    const frames: { base64: string; mimeType: string; timeSeconds: number }[] = []
    for (let i = 0; i < count; i++) {
      const t = (dur * (i + 0.5)) / count
      v.currentTime = t
      await new Promise<void>(res => {
        const done = () => { v.removeEventListener('seeked', done); res() }
        v.addEventListener('seeked', done)
      })
      ctx.drawImage(v, 0, 0, w, h)
      const dataUrl = c.toDataURL('image/jpeg', 0.7)
      frames.push({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg', timeSeconds: t })
    }
    return frames
  }

  async function analyze() {
    if (!file || !videoRef.current) return
    const v = videoRef.current
    // Guard: transcription + Claude vision on a 90s reel would time out the
    // 300s route. Keep the teardown honest.
    if (v.duration > 90) {
      showError('Too long', `Reel is ${v.duration.toFixed(0)}s — please trim to under 90s.`)
      return
    }
    if (file.size > 100 * 1024 * 1024) {
      showError('Too big', 'Please upload a video under 100 MB.')
      return
    }

    setAnalyzing(true)
    try {
      const supabase = getSupabase()
      const { data: sess } = supabase ? await supabase.auth.getSession() : { data: null }
      const token = sess?.session?.access_token ?? null

      // Audio transcription needs the file in storage, which needs an account.
      // Anonymous teardowns stay entirely client-side until the frames POST.
      let audioUrl: string | undefined
      if (token && supabase) {
        setStatus('Preparing upload…')
        const urlRes = await fetch('/api/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ folder: 'analyzer-source', ext: 'mp4' }),
        })
        const urlData = await urlRes.json()
        if (!urlRes.ok || !urlData.signedUrl) throw new Error(urlData.error || 'Could not prepare upload')

        setStatus(`Uploading ${(file.size / 1024 / 1024).toFixed(1)} MB…`)
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

      const frameCount = token ? FRAME_COUNT_AUTHED : FRAME_COUNT_ANON
      setStatus(`Sampling ${frameCount} frames…`)
      await new Promise<void>(r => {
        if (v.readyState >= 2) r()
        else v.addEventListener('loadeddata', () => r(), { once: true })
      })
      const frames = await sampleFrames(v, frameCount, token ? null : FRAME_MAX_EDGE_ANON)

      setStatus(token ? 'Analyzing format & transcribing…' : 'Analyzing format…')
      const res = await fetch('/api/analyzer/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ frames, audioUrl, videoDurationSeconds: v.duration }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analysis failed')
      setResult(data as AnalyzeResult)
      setEditablePrompt((data as AnalyzeResult).videoPrompt)
      showSuccess('Teardown ready', 'Scroll down for the full breakdown.')
    } catch (err) {
      showError('Teardown failed', err instanceof Error ? err.message : 'Try again')
    } finally {
      setAnalyzing(false)
      setStatus('')
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

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '40px 32px 100px' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: 'var(--ink-dim)', marginBottom: 8 }}>
          FREE TOOL / AD TEARDOWN
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 42, fontWeight: 400, margin: '0 0 8px', letterSpacing: '-0.01em' }}>
          Why does <em>that</em> ad work?
        </h1>
        <p style={{ fontSize: 14.5, color: 'var(--ink-dim)', margin: 0, maxWidth: 620, lineHeight: 1.55 }}>
          Drop in any TikTok or Reels ad and we&apos;ll break down the hook, the beat structure, the pacing
          and the caption style — then hand you a prompt that recreates the same energy for your product.
          {!signedIn && ' Free, no account needed.'}
        </p>
      </div>

      {!result && (
        <section style={{ padding: 24, border: '1px solid var(--border)', borderRadius: 16, background: 'var(--surface)' }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>1. Load the ad</div>
          <p style={{ fontSize: 13, color: 'var(--ink-dim)', lineHeight: 1.5, marginTop: 0, marginBottom: 18 }}>
            Upload the .mp4 (right-click → Save on TikTok / Reels). Nothing leaves your browser until you hit analyze.
          </p>

          {!file ? (
            <label
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 8, padding: '38px 20px', border: '1.5px dashed var(--border)', borderRadius: 14,
                cursor: 'pointer', background: 'var(--bg)', textAlign: 'center',
              }}
            >
              <Upload size={26} />
              <div style={{ fontSize: 14, fontWeight: 500 }}>Click to upload or drop .mp4</div>
              <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>Up to ~30s ads work best</div>
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files?.[0] ?? null)}
              />
            </label>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, alignItems: 'start' }}>
              <video
                ref={videoRef}
                src={previewUrl ?? undefined}
                controls
                playsInline
                onLoadedMetadata={e => setDuration((e.currentTarget as HTMLVideoElement).duration)}
                style={{ width: '100%', borderRadius: 12, border: '1px solid var(--border)', background: '#000' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 13, color: 'var(--ink-dim)' }}>
                  {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
                  {duration > 0 && ` · ${duration.toFixed(1)}s`}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={analyze}
                    disabled={analyzing || !duration}
                    style={{
                      padding: '12px 20px', borderRadius: 12,
                      background: 'var(--ink)', color: 'var(--on-ink)', border: 'none',
                      fontSize: 14, fontWeight: 600, cursor: analyzing ? 'wait' : 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    {analyzing && <Loader2 size={14} className="animate-spin" />}
                    {analyzing ? (status || 'Analyzing…') : 'Tear it down →'}
                  </button>
                  <button
                    onClick={() => handleFile(null)}
                    disabled={analyzing}
                    style={{
                      padding: '12px 16px', borderRadius: 12,
                      background: 'transparent', border: '1px solid var(--border)',
                      color: 'var(--ink)', fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    Replace
                  </button>
                </div>
              </div>
            </div>
          )}

          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </section>
      )}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <section style={{ padding: 24, border: '1px solid var(--border)', borderRadius: 16, background: 'var(--surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Format breakdown</div>
              <button
                onClick={() => { setResult(null); handleFile(null) }}
                style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', fontSize: 12.5, cursor: 'pointer', color: 'var(--ink)' }}
              >
                New teardown
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 14 }}>
              <Chip label="Pacing" value={result.breakdown.pacing} />
              <Chip label="Cuts" value={String(result.breakdown.cuts)} />
              <Chip label="Music" value={result.breakdown.musicMood} />
              <Chip label="Caption style" value={result.breakdown.captionStyle} />
            </div>
            <Row label="Hook" value={result.breakdown.hook} />
            <Row label="Character" value={result.breakdown.character} />
            <Row label="Scene" value={result.breakdown.scene} />
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-dim)', letterSpacing: '0.06em', marginBottom: 6 }}>BEATS</div>
              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6 }}>
                {result.breakdown.beats.map((b, i) => <li key={i}>{b}</li>)}
              </ol>
            </div>
          </section>

          <section style={{ padding: 24, border: '1px solid var(--border)', borderRadius: 16, background: 'var(--surface)' }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Prompt to recreate it</div>
            <p style={{ fontSize: 12.5, color: 'var(--ink-dim)', margin: '0 0 12px' }}>
              Edit before you generate. Seedance animates this; captions are placed separately in the editor.
            </p>
            <textarea
              value={editablePrompt}
              onChange={e => setEditablePrompt(e.target.value)}
              rows={8}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: 14, borderRadius: 12, border: '1px solid var(--border)',
                background: 'var(--bg)', color: 'var(--ink)',
                fontSize: 13.5, fontFamily: 'inherit', lineHeight: 1.55, resize: 'vertical',
              }}
            />
          </section>

          {result.captionsLocked ? (
            <section style={{ padding: 24, border: '1px dashed var(--border)', borderRadius: 16, background: 'var(--bg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
                <Lock size={15} /> Caption track
              </div>
              <p style={{ fontSize: 13, color: 'var(--ink-dim)', margin: '0 0 14px', lineHeight: 1.55, maxWidth: 560 }}>
                We can transcribe the spoken script with word-level timestamps and hand it straight to the
                video editor — that part needs a free account.
              </p>
              <Link
                href="/auth/signup"
                style={{
                  display: 'inline-block', padding: '11px 18px', borderRadius: 11,
                  background: 'var(--ink)', color: 'var(--on-ink)', textDecoration: 'none',
                  fontSize: 13.5, fontWeight: 600,
                }}
              >
                Create a free account →
              </Link>
            </section>
          ) : (
            <section style={{ padding: 24, border: '1px solid var(--border)', borderRadius: 16, background: 'var(--surface)' }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Captions ({result.captions.length})</div>
              <p style={{ fontSize: 12.5, color: 'var(--ink-dim)', margin: '0 0 12px' }}>
                Auto-transcribed with timestamps. These flow into the video editor after the new video renders.
              </p>
              {result.captions.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--ink-mute)' }}>No spoken captions detected.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
                  {result.captions.map((c, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 12, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 10 }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-mute)' }}>
                        {c.start.toFixed(1)}s – {c.end.toFixed(1)}s
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--ink)' }}>{c.text}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              onClick={useForUGC}
              style={{
                padding: '14px 24px', borderRadius: 12,
                background: 'var(--ink)', color: 'var(--on-ink)', border: 'none',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {signedIn ? 'Recreate in UGC generator →' : 'Make this ad for my product →'}
            </button>
          </div>
        </div>
      )}
    </main>
  )
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg)' }}>
      <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--ink-mute)', letterSpacing: '0.06em' }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 13, color: 'var(--ink)', marginTop: 3, textTransform: 'capitalize' }}>{value || '—'}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-dim)', letterSpacing: '0.06em', marginBottom: 4 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.55 }}>{value || '—'}</div>
    </div>
  )
}
