'use client'

import { useEffect, useRef, useState } from 'react'
import { getSupabase } from '@/lib/auth'
import { readPrefill } from '@/lib/calendar-prefill'
import { useCredits } from '@/lib/useCredits'
import { showError, showSuccess } from '@/lib/notifications'
import { Download, Upload, X, Sparkles } from 'lucide-react'
import { useDriveSync } from '@/lib/useDriveSync'
import PublishToYouTube from '@/components/PublishToYouTube'

const CHAR_BLOCK = 80
const MIN_CREDITS = 20
const MAX_CHARS = 2000
const MAX_VIDEO_MB = 200

function calcCredits(charCount: number): number {
  return Math.max(MIN_CREDITS, Math.ceil(charCount / CHAR_BLOCK))
}

const VOICES = [
  { id: 'Drew',   label: 'Drew',   sub: 'Confident, warm',         gender: 'M' },
  { id: 'Paul',   label: 'Paul',   sub: 'Authoritative, grounded', gender: 'M' },
  { id: 'James',  label: 'James',  sub: 'Smooth, conversational',  gender: 'M' },
  { id: 'Rachel', label: 'Rachel', sub: 'Calm, conversational',    gender: 'F' },
  { id: 'Hope',   label: 'Hope',   sub: 'Bubbly, vibrant',         gender: 'F' },
  { id: 'Sarah',  label: 'Sarah',  sub: 'Bright, friendly',        gender: 'F' },
  { id: 'Aria',   label: 'Aria',   sub: 'Energetic, expressive',   gender: 'F' },
]

const FORMATS = [
  { id: 'landscape', label: 'Landscape', sub: '16:9', icon: '▭' },
  { id: 'portrait',  label: 'Portrait',  sub: '9:16', icon: '▯' },
  { id: 'square',    label: 'Square',    sub: '1:1',  icon: '□' },
] as const

type RenderStatus = 'idle' | 'uploading' | 'rendering' | 'done' | 'failed'

export default function ScreenDemoPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [description, setDescription] = useState('')
  const [script, setScript] = useState('')
  const [voiceId, setVoiceId] = useState('Rachel')
  const [aspect, setAspect] = useState<'landscape' | 'portrait' | 'square'>('landscape')
  const [status, setStatus] = useState<RenderStatus>('idle')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [generatingScript, setGeneratingScript] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const { autoSave: saveToDrive } = useDriveSync()
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { balance: rawBalance, refresh: refreshCredits } = useCredits()
  const creditBalance = rawBalance ?? 0

  useEffect(() => {
    const suggestion = readPrefill('screen-demo')
    if (!suggestion) return
    setDescription(suggestion.title)
    setScript(suggestion.description)
  }, [])

  const charCount = script.length
  const cost = calcCredits(charCount)
  const busy = status === 'uploading' || status === 'rendering'
  const canGenerate = !!videoFile && charCount >= 10 && charCount <= MAX_CHARS && creditBalance >= cost && !busy

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

  async function handleGenerateScript() {
    if (!description.trim() || generatingScript) return
    const supabase = getSupabase()
    if (!supabase) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return

    setGeneratingScript(true)
    try {
      const res = await fetch('/api/screen-demo/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ description: description.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { showError(data.error || 'Script generation failed'); return }
      setScript(data.script)
    } catch {
      showError('Script generation failed')
    } finally {
      setGeneratingScript(false)
    }
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
        saveToDrive({
          sourceUrl: data.url,
          filename: `screen-demo-${Date.now()}.mp4`,
          mimeType: 'video/mp4',
          contentType: 'screen-demo',
          metadata: { script: script.slice(0, 200) },
        })
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
      // Step 1: get a signed upload URL so the video goes browser → Supabase
      // directly (bypasses the Vercel 4.5 MB body limit on API routes).
      const urlRes = await fetch('/api/screen-demo/upload-url', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const urlData = await urlRes.json()
      if (!urlRes.ok || !urlData.signedUrl) {
        setStatus('idle')
        showError(urlData.error || 'Could not prepare upload')
        return
      }

      // Step 2: PUT the video file directly to Supabase storage
      const uploadRes = await fetch(urlData.signedUrl, {
        method: 'PUT',
        body: videoFile,
        headers: { 'Content-Type': 'video/mp4' },
      })
      if (!uploadRes.ok) {
        setStatus('idle')
        showError('Video upload failed — please try again')
        return
      }

      // Step 3: call generate with the storage path (no large body)
      const res = await fetch('/api/screen-demo/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ storagePath: urlData.storagePath, script, voiceId, aspect }),
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

  const sectionCard: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: 20,
  }
  const sectionLabel: React.CSSProperties = {
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--ink-dim)',
    marginBottom: 14,
  }

  return (
    <main style={{ maxWidth: 860, margin: '0 auto', padding: '42px 40px 90px' }}>
      <header style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-dim)', marginBottom: 8 }}>
          Create
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 48, lineHeight: 1.05, letterSpacing: '-0.01em', margin: 0 }}>
          Screen Demo
        </h1>
        <p style={{ fontSize: 14.5, color: 'var(--ink-dim)', margin: '10px 0 0', lineHeight: 1.55 }}>
          Upload your screen recording and add an AI voiceover. We mix them into a polished demo video.
        </p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Screen recording upload */}
        <div style={sectionCard}>
          <div style={sectionLabel}>Screen recording</div>
          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => !videoFile && fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--ink)' : videoFile ? 'var(--good, #10b981)' : 'var(--border)'}`,
              borderRadius: 10,
              padding: '28px 20px',
              textAlign: 'center',
              cursor: videoFile ? 'default' : 'pointer',
              background: dragOver ? 'rgba(0,0,0,0.02)' : 'transparent',
              transition: 'border-color 0.15s',
            }}
          >
            <input ref={fileRef} type="file" accept="video/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            {videoFile ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>🎬</span>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{videoFile.name}</span>
                <span style={{ fontSize: 12, color: 'var(--ink-dim)' }}>({(videoFile.size / 1024 / 1024).toFixed(1)} MB)</span>
                <button type="button" onClick={e => { e.stopPropagation(); setVideoFile(null) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--ink-mute)', display: 'flex' }}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <Upload size={22} style={{ color: 'var(--ink-dim)', marginBottom: 8 }} />
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>Drop screen recording here</p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--ink-dim)' }}>MP4, MOV, WebM · up to {MAX_VIDEO_MB} MB</p>
              </>
            )}
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--ink-dim)', margin: '8px 0 0', fontFamily: 'var(--font-mono)' }}>
            The recording&apos;s original audio will be replaced by the AI voiceover.
          </p>
        </div>

        {/* Script */}
        <div style={sectionCard}>
          <div style={sectionLabel}>Voiceover script</div>

          {/* AI script generation */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGenerateScript()}
                placeholder="Describe your app or what you're showing…"
                disabled={busy || generatingScript}
                style={{
                  flex: 1, padding: '9px 13px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--ink)', fontSize: 13, outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
              <button
                type="button"
                onClick={handleGenerateScript}
                disabled={!description.trim() || busy || generatingScript}
                style={{
                  padding: '9px 16px', borderRadius: 8,
                  border: 'none', background: 'var(--ink)', color: 'var(--on-ink)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  opacity: !description.trim() || busy || generatingScript ? 0.4 : 1,
                  display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
                  transition: 'opacity 0.15s',
                }}
              >
                {generatingScript
                  ? <><span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--on-ink-subtle)', borderTopColor: 'var(--on-ink)', display: 'inline-block', animation: 'sd-spin 0.8s linear infinite' }} />Writing…</>
                  : <><Sparkles size={13} />Generate script</>}
              </button>
            </div>
          </div>

          <textarea
            value={script}
            onChange={e => setScript(e.target.value)}
            placeholder="Your voiceover script will appear here — or write it yourself."
            rows={6}
            disabled={busy}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '12px 14px', borderRadius: 10,
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--ink)', fontSize: 13.5, lineHeight: 1.6,
              fontFamily: 'inherit', resize: 'vertical', outline: 'none',
            }}
          />
          <p style={{ fontSize: 10.5, color: charCount > MAX_CHARS ? 'var(--danger,#e84a4a)' : 'var(--ink-dim)', textAlign: 'right', margin: '4px 0 0', fontFamily: 'var(--font-mono)' }}>
            {charCount} / {MAX_CHARS}
          </p>
        </div>

        {/* Voice */}
        <div style={sectionCard}>
          <div style={sectionLabel}>Voice</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {VOICES.map(v => {
              const active = voiceId === v.id
              return (
                <button key={v.id} type="button" disabled={busy} onClick={() => setVoiceId(v.id)}
                  style={{
                    padding: '11px 14px', borderRadius: 10, textAlign: 'left',
                    border: `1.5px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                    background: active ? 'var(--ink)' : 'transparent',
                    color: active ? 'var(--on-ink)' : 'var(--ink)',
                    cursor: busy ? 'not-allowed' : 'pointer',
                    transition: 'all 0.12s',
                  }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{v.label}</div>
                  <div style={{ fontSize: 11, opacity: 0.65, marginTop: 2 }}>{v.sub}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Format */}
        <div style={sectionCard}>
          <div style={sectionLabel}>Format</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {FORMATS.map(f => {
              const active = aspect === f.id
              return (
                <button key={f.id} type="button" disabled={busy} onClick={() => setAspect(f.id)}
                  style={{
                    flex: 1, padding: '14px 8px', borderRadius: 10, textAlign: 'center',
                    border: `1.5px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                    background: active ? 'var(--ink)' : 'transparent',
                    color: active ? 'var(--on-ink)' : 'var(--ink)',
                    cursor: busy ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s',
                    display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center',
                  }}>
                  <span style={{ fontSize: 18 }}>{f.icon}</span>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{f.label}</span>
                  <span style={{ fontSize: 11, opacity: 0.65, fontWeight: 500 }}>{f.sub}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Generate */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink-dim)' }}>
            <span>Cost: <strong style={{ color: 'var(--ink)' }}>{cost} credits</strong></span>
            <span>Balance: <strong style={{ color: creditBalance >= cost ? 'var(--good,#10b981)' : 'var(--danger,#e84a4a)' }}>{creditBalance}</strong></span>
          </div>
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            style={{
              width: '100%', padding: '14px 0', borderRadius: 12,
              background: !canGenerate ? 'var(--border)' : 'var(--ink)',
              color: !canGenerate ? 'var(--ink-dim)' : 'var(--on-ink)',
              border: 'none', fontSize: 15, fontWeight: 700,
              cursor: !canGenerate ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background 0.15s',
            }}
          >
            {status === 'uploading' ? (
              <><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid var(--on-ink-subtle)', borderTopColor: 'var(--on-ink)', borderRadius: '50%', animation: 'sd-spin 0.8s linear infinite' }} />Uploading…</>
            ) : status === 'rendering' ? (
              <><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid var(--on-ink-subtle)', borderTopColor: 'var(--on-ink)', borderRadius: '50%', animation: 'sd-spin 0.8s linear infinite' }} />Rendering — usually 1–2 min…</>
            ) : (
              `Generate Screen Demo · ${cost} credits`
            )}
          </button>
          {!videoFile && <p style={{ fontSize: 12, color: 'var(--ink-dim)', textAlign: 'center', margin: 0 }}>Upload a screen recording to continue</p>}
          {videoFile && charCount < 10 && <p style={{ fontSize: 12, color: 'var(--ink-dim)', textAlign: 'center', margin: 0 }}>Add a voiceover script to continue</p>}
        </div>

        {/* Result */}
        {status === 'done' && resultUrl && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-dim)', padding: '16px 20px 0' }}>
              Result
            </div>
            <video src={resultUrl} controls style={{ width: '100%', display: 'block', maxHeight: 480, background: '#000', marginTop: 12 }} />
            <div style={{ padding: '14px 20px', display: 'flex', gap: 10 }}>
              <a href={resultUrl} download="screen-demo.mp4"
                style={{
                  padding: '9px 20px', borderRadius: 9, background: 'var(--ink)', color: 'var(--on-ink)',
                  fontSize: 13, fontWeight: 600, textDecoration: 'none',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                <Download size={14} /> Download
              </a>
              <PublishToYouTube videoUrl={resultUrl} defaultTitle="Screen Demo" />
              <button onClick={() => { setStatus('idle'); setResultUrl(null); setVideoFile(null); setScript(''); setDescription('') }}
                style={{
                  padding: '9px 20px', borderRadius: 9,
                  border: '1.5px solid var(--border)', background: 'transparent',
                  color: 'var(--ink)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
                New demo
              </button>
            </div>
          </div>
        )}

        {status === 'failed' && (
          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(232,74,74,0.08)', border: '1px solid rgba(232,74,74,0.2)', fontSize: 13, color: 'var(--danger,#e84a4a)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Render failed — your credits were not charged.</span>
            <button onClick={() => setStatus('idle')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', textDecoration: 'underline', fontSize: 13 }}>Retry</button>
          </div>
        )}
      </div>

      <style>{`@keyframes sd-spin { to { transform: rotate(360deg) } }`}</style>
    </main>
  )
}
