'use client'

import { useRef, useState } from 'react'
import { getSupabase } from '@/lib/auth'
import { useCredits } from '@/lib/useCredits'
import { showError, showSuccess } from '@/lib/notifications'
import { Download, Upload, X, Monitor } from 'lucide-react'

const CHAR_BLOCK = 80
const MIN_CREDITS = 20
const MAX_CHARS = 2000
const MAX_VIDEO_MB = 200

function calcCredits(charCount: number): number {
  return Math.max(MIN_CREDITS, Math.ceil(charCount / CHAR_BLOCK))
}

const VOICES = [
  { id: 'Drew',   label: 'Drew',   sub: 'Confident, warm',        gender: 'M' },
  { id: 'Paul',   label: 'Paul',   sub: 'Authoritative, grounded', gender: 'M' },
  { id: 'James',  label: 'James',  sub: 'Smooth, conversational', gender: 'M' },
  { id: 'Rachel', label: 'Rachel', sub: 'Calm, conversational',   gender: 'F' },
  { id: 'Hope',   label: 'Hope',   sub: 'Bubbly, vibrant',        gender: 'F' },
  { id: 'Sarah',  label: 'Sarah',  sub: 'Bright, friendly',       gender: 'F' },
  { id: 'Aria',   label: 'Aria',   sub: 'Energetic, expressive',  gender: 'F' },
]

const ASPECTS = [
  { id: 'landscape', label: 'Landscape', sub: '16:9' },
  { id: 'portrait',  label: 'Portrait',  sub: '9:16' },
  { id: 'square',    label: 'Square',    sub: '1:1'  },
]

type RenderStatus = 'idle' | 'uploading' | 'rendering' | 'done' | 'failed'

export default function ScreenDemoPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [script, setScript] = useState('')
  const [voiceId, setVoiceId] = useState('Rachel')
  const [aspect, setAspect] = useState('landscape')
  const [status, setStatus] = useState<RenderStatus>('idle')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { balance: rawBalance, refresh: refreshCredits } = useCredits()
  const creditBalance = rawBalance ?? 0

  const charCount = script.length
  const cost = calcCredits(charCount)
  const canGenerate = !!videoFile && charCount >= 10 && charCount <= MAX_CHARS && creditBalance >= cost && status === 'idle'

  function handleFile(file: File) {
    if (!file.type.startsWith('video/')) { showError('Please upload a video file'); return }
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) { showError(`Video must be under ${MAX_VIDEO_MB} MB`); return }
    setVideoFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  async function pollStatus(renderId: string, token: string) {
    try {
      const res = await fetch(`/api/screen-demo/status/${renderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.status === 'succeeded' && data.url) {
        setResultUrl(data.url)
        setStatus('done')
        showSuccess('Screen demo ready!')
        refreshCredits()
      } else if (data.status === 'failed') {
        setStatus('failed')
        showError(data.error || 'Render failed')
      } else {
        pollRef.current = setTimeout(() => pollStatus(renderId, token), 4000)
      }
    } catch {
      pollRef.current = setTimeout(() => pollStatus(renderId, token), 6000)
    }
  }

  async function handleGenerate() {
    if (!canGenerate || !videoFile) return
    const supabase = getSupabase()
    if (!supabase) { showError('Not authenticated'); return }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) { showError('Not authenticated'); return }

    setStatus('uploading')
    setResultUrl(null)

    try {
      const form = new FormData()
      form.append('video', videoFile)
      form.append('script', script)
      form.append('voiceId', voiceId)
      form.append('aspect', aspect)

      const res = await fetch('/api/screen-demo/generate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      })
      const data = await res.json()
      if (!res.ok || !data.renderId) {
        setStatus('idle')
        showError(data.error || 'Failed to start generation')
        return
      }
      setStatus('rendering')
      pollStatus(data.renderId, session.access_token)
    } catch (err) {
      setStatus('idle')
      showError(err instanceof Error ? err.message : 'Generation failed')
    }
  }

  const busy = status === 'uploading' || status === 'rendering'

  return (
    <div className="page-shell">
      <div className="page-header">
        <span className="page-eyebrow">Create</span>
        <h1 className="page-title" style={{ fontFamily: 'var(--font-serif)' }}>Screen Demo</h1>
        <p className="page-sub">Upload your screen recording and add an AI voiceover. We mix them into a polished demo ad.</p>
      </div>

      <div style={{ maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* Video upload */}
        <div>
          <label className="form-label">Screen recording</label>
          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => !videoFile && fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--accent)' : videoFile ? 'var(--good, #10b981)' : 'var(--border)'}`,
              borderRadius: 12,
              padding: '28px 20px',
              textAlign: 'center',
              cursor: videoFile ? 'default' : 'pointer',
              background: dragOver ? 'rgba(var(--accent-rgb,99,102,241),0.04)' : 'var(--surface)',
              transition: 'border-color 0.15s',
              position: 'relative',
            }}
          >
            <input ref={fileRef} type="file" accept="video/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            {videoFile ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <Monitor size={18} style={{ color: 'var(--good, #10b981)', flexShrink: 0 }} />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{videoFile.name}</span>
                <span style={{ fontSize: 12, color: 'var(--ink-dim)' }}>({(videoFile.size / 1024 / 1024).toFixed(1)} MB)</span>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setVideoFile(null) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--ink-mute)', display: 'flex' }}
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              <div>
                <Upload size={22} style={{ color: 'var(--ink-mute)', marginBottom: 8 }} />
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>Drop screen recording here</p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--ink-dim)' }}>MP4, MOV, WebM · up to {MAX_VIDEO_MB} MB</p>
              </div>
            )}
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--ink-mute)' }}>
            Record your app in action. The recording&apos;s audio will be replaced by the voiceover.
          </p>
        </div>

        {/* Script */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <label className="form-label" style={{ margin: 0 }}>Voiceover script</label>
            <span style={{ fontSize: 11.5, color: charCount > MAX_CHARS ? 'var(--danger,#e84a4a)' : 'var(--ink-mute)' }}>
              {charCount} / {MAX_CHARS}
            </span>
          </div>
          <textarea
            className="input"
            value={script}
            onChange={e => setScript(e.target.value)}
            placeholder="Write what the voiceover should say. e.g. 'ContentFlow lets you create UGC ads in minutes — just describe your product and hit generate.'"
            rows={5}
            disabled={busy}
            style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
          />
        </div>

        {/* Voice picker */}
        <div>
          <label className="form-label">Voice</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
            {VOICES.map(v => {
              const active = voiceId === v.id
              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={busy}
                  onClick={() => setVoiceId(v.id)}
                  style={{
                    padding: '9px 12px',
                    borderRadius: 10,
                    border: `1.5px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                    background: active ? 'var(--ink)' : 'var(--surface)',
                    color: active ? '#fff' : 'var(--ink)',
                    textAlign: 'left',
                    cursor: busy ? 'not-allowed' : 'pointer',
                    transition: 'all 0.12s',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{v.label}</div>
                  <div style={{ fontSize: 11, opacity: 0.65, marginTop: 2 }}>{v.sub}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Aspect ratio */}
        <div>
          <label className="form-label">Output format</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {ASPECTS.map(a => {
              const active = aspect === a.id
              return (
                <button
                  key={a.id}
                  type="button"
                  disabled={busy}
                  onClick={() => setAspect(a.id)}
                  style={{
                    padding: '8px 20px',
                    borderRadius: 10,
                    border: `1.5px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                    background: active ? 'var(--ink)' : 'var(--surface)',
                    color: active ? '#fff' : 'var(--ink)',
                    cursor: busy ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    transition: 'all 0.12s',
                  }}
                >
                  <div>{a.label}</div>
                  <div style={{ fontSize: 11, opacity: 0.6, fontWeight: 400 }}>{a.sub}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Cost + generate */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
          <div style={{ fontSize: 13, color: 'var(--ink-dim)' }}>
            Cost: <strong style={{ color: 'var(--ink)' }}>{cost} credits</strong>
            <span style={{ marginLeft: 12 }}>
              Balance: <strong style={{ color: creditBalance >= cost ? 'var(--good,#10b981)' : 'var(--danger,#e84a4a)' }}>{creditBalance}</strong>
            </span>
          </div>
          <button
            className="btn-primary"
            onClick={handleGenerate}
            disabled={!canGenerate}
            style={{ minWidth: 180, opacity: canGenerate ? 1 : 0.5 }}
          >
            {status === 'uploading' ? (
              <><span style={{ display: 'inline-block', width: 13, height: 13, border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginRight: 7 }} />Uploading…</>
            ) : status === 'rendering' ? (
              <><span style={{ display: 'inline-block', width: 13, height: 13, border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginRight: 7 }} />Rendering…</>
            ) : (
              `Generate · ${cost} credits`
            )}
          </button>
        </div>

        {/* Result */}
        {status === 'done' && resultUrl && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', background: 'var(--surface)' }}>
            <video
              src={resultUrl}
              controls
              style={{ width: '100%', display: 'block', maxHeight: 480, background: '#000' }}
            />
            <div style={{ padding: '14px 16px', display: 'flex', gap: 10 }}>
              <a
                href={resultUrl}
                download="screen-demo.mp4"
                className="btn-primary"
                style={{ fontSize: 13, padding: '8px 18px', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
              >
                <Download size={14} /> Download
              </a>
              <button
                className="btn-secondary"
                onClick={() => { setStatus('idle'); setResultUrl(null); setVideoFile(null); setScript('') }}
                style={{ fontSize: 13, padding: '8px 18px' }}
              >
                New demo
              </button>
            </div>
          </div>
        )}

        {status === 'failed' && (
          <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(232,74,74,0.08)', border: '1px solid rgba(232,74,74,0.2)', fontSize: 13, color: 'var(--danger,#e84a4a)' }}>
            Render failed. Your credits were not charged. Please try again.
            <button onClick={() => setStatus('idle')} style={{ marginLeft: 12, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', textDecoration: 'underline', fontSize: 13 }}>Retry</button>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
