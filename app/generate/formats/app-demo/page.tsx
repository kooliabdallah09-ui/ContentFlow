'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/auth'
import { canAccessFormats } from '@/lib/pov-access'
import { showError, showSuccess } from '@/lib/notifications'
import { Loader2, Upload } from 'lucide-react'

type Phase = 'idle' | 'analyzing' | 'polling' | 'done' | 'failed'

export default function AppDemoTestPage() {
  const [access, setAccess] = useState<'checking' | 'allowed' | 'blocked'>('checking')
  const [klingUrl, setKlingUrl] = useState('')
  const [brollUrl, setBrollUrl] = useState('')
  const [appUiUrl, setAppUiUrl] = useState('')
  const [hookLine, setHookLine] = useState('Are you really still wasting your time playing video games?')
  const [pivotLine, setPivotLine] = useState('Heh, so do I, but at least I earn cash doing that.')
  const [demoLine, setDemoLine] = useState('No, for real. I found this hidden gem — the Benjamin app. You just play games and earn money.')

  const [phase, setPhase] = useState<Phase>('idle')
  const [status, setStatus] = useState('')
  const [renderId, setRenderId] = useState<string | null>(null)
  const [finalUrl, setFinalUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    (async () => {
      const supabase = getSupabase()
      if (!supabase) { setAccess('blocked'); return }
      const { data: sess } = await supabase.auth.getSession()
      setAccess(canAccessFormats(sess?.session?.user?.email) ? 'allowed' : 'blocked')
    })()
  }, [])

  useEffect(() => {
    return () => { if (pollRef.current) clearTimeout(pollRef.current) }
  }, [])

  if (access === 'checking') {
    return <main style={{ maxWidth: 720, margin: '0 auto', padding: '80px 32px', textAlign: 'center', color: 'var(--ink-dim)' }}>Loading…</main>
  }

  if (access === 'blocked') {
    return (
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '80px 32px' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 400 }}>Admin only</h1>
        <Link href="/generate/formats" style={{ color: 'var(--ink)' }}>← Back to Format Library</Link>
      </main>
    )
  }

  async function uploadHelper(file: File, folder: string, setter: (url: string) => void) {
    setUploading(folder)
    try {
      const supabase = getSupabase()!
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) throw new Error('Not signed in')
      const ext = (file.name.split('.').pop() || 'mp4').toLowerCase()

      const urlRes = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ folder, ext }),
      })
      const urlData = await urlRes.json()
      if (!urlRes.ok || !urlData.signedUrl) throw new Error(urlData.error || 'Could not prepare upload')

      const putRes = await fetch(urlData.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'video/mp4' },
        body: file,
      })
      if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`)

      const { data: pub } = supabase.storage.from('ugc-assets').getPublicUrl(urlData.storagePath)
      setter(pub.publicUrl)
      showSuccess('Uploaded', file.name)
    } catch (err) {
      showError('Upload failed', err instanceof Error ? err.message : 'Try again')
    } finally {
      setUploading(null)
    }
  }

  async function submit() {
    if (!klingUrl.trim() || !hookLine.trim() || !pivotLine.trim() || !demoLine.trim()) {
      showError('Missing input', 'Kling URL + all three lines are required.')
      return
    }
    setPhase('analyzing')
    setStatus('Transcribing + removing background… (2-4 min)')
    setError('')
    setFinalUrl(null)
    setRenderId(null)

    try {
      const supabase = getSupabase()!
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) throw new Error('Not signed in')

      const res = await fetch('/api/formats/app-demo/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          klingRawUrl: klingUrl.trim(),
          brollUrl: brollUrl.trim() || undefined,
          appUiUrl: appUiUrl.trim() || undefined,
          hookLine,
          pivotLine,
          demoLine,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Render kickoff failed')

      setRenderId(data.renderId)
      setPhase('polling')
      poll(data.renderId, token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
      setPhase('failed')
    }
  }

  async function poll(id: string, token: string) {
    void token
    try {
      const res = await fetch(`/api/formats/app-demo/render?renderId=${id}`)
      const data = await res.json()
      if (data.status === 'completed' && data.videoUrl) {
        setFinalUrl(data.videoUrl)
        setPhase('done')
        setStatus('')
        return
      }
      if (data.status === 'failed') {
        setError(data.error || 'Render failed')
        setPhase('failed')
        return
      }
      setStatus(`Shotstack ${data.status}… still working`)
      pollRef.current = setTimeout(() => poll(id, token), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Polling error')
      setPhase('failed')
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '40px 32px 100px' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: 'var(--ink-dim)', marginBottom: 8 }}>
          STUDIO / APP DEMO COMPOSITE · TEST HARNESS
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 42, fontWeight: 400, margin: '0 0 8px' }}>
          App Demo <em>Composite</em>
        </h1>
        <p style={{ fontSize: 14.5, color: 'var(--ink-dim)', margin: 0, maxWidth: 620, lineHeight: 1.6 }}>
          Feed the pipeline a rendered Kling talking-head, an optional b-roll for the hook, and an app UI recording for the demo. Whisper transcribes, Replicate keys out the background, and Shotstack stitches the 3-state composite.
        </p>
      </div>

      <section style={{ padding: 24, border: '1px solid var(--border)', borderRadius: 16, background: 'var(--surface)', marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>1. Assets</div>
        <AssetRow
          label="Kling talking-head (required)"
          value={klingUrl}
          onChange={setKlingUrl}
          onUpload={f => uploadHelper(f, 'app-demo-source', setKlingUrl)}
          uploading={uploading === 'app-demo-source'}
          note="16s ideal. Include audio."
        />
        <AssetRow
          label="B-roll for hook (optional)"
          value={brollUrl}
          onChange={setBrollUrl}
          onUpload={f => uploadHelper(f, 'app-demo-broll', setBrollUrl)}
          uploading={uploading === 'app-demo-broll'}
          note="Plays 0-3s behind the avatar cutout. Gameplay footage works."
        />
        <AssetRow
          label="App UI recording (recommended)"
          value={appUiUrl}
          onChange={setAppUiUrl}
          onUpload={f => uploadHelper(f, 'app-demo-appui', setAppUiUrl)}
          uploading={uploading === 'app-demo-appui'}
          note="Plays 5.5-16s behind the avatar cutout. Screen-record of your app."
        />
      </section>

      <section style={{ padding: 24, border: '1px solid var(--border)', borderRadius: 16, background: 'var(--surface)', marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>2. Spoken lines (must be in the Kling audio)</div>
        <p style={{ fontSize: 12.5, color: 'var(--ink-dim)', margin: '0 0 14px', lineHeight: 1.5 }}>
          These drive the caption chunking. Whisper transcribes the Kling audio; captions inherit the color of the segment they land in.
        </p>
        <Field label="Hook (0-3s, purple caption)" value={hookLine} onChange={setHookLine} />
        <Field label="Pivot (3-5.5s, white caption)" value={pivotLine} onChange={setPivotLine} />
        <Field label="Demo (5.5-16s, green caption)" value={demoLine} onChange={setDemoLine} rows={3} />
      </section>

      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <button
          onClick={submit}
          disabled={phase === 'analyzing' || phase === 'polling'}
          style={{
            padding: '14px 26px', borderRadius: 12,
            background: 'var(--ink)', color: 'var(--on-ink)', border: 'none',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}
        >
          {(phase === 'analyzing' || phase === 'polling') && <Loader2 size={14} className="animate-spin" />}
          {phase === 'idle' && 'Render composite →'}
          {phase === 'analyzing' && 'Kicking off…'}
          {phase === 'polling' && 'Rendering on Shotstack…'}
          {phase === 'done' && 'Done — render again'}
          {phase === 'failed' && 'Retry'}
        </button>
        <Link
          href="/generate/formats"
          style={{ padding: '14px 20px', borderRadius: 12, background: 'transparent', border: '1px solid var(--border)', color: 'var(--ink)', textDecoration: 'none', fontSize: 13.5 }}
        >
          Back to Library
        </Link>
      </div>

      {status && phase !== 'done' && phase !== 'failed' && (
        <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface-2)', fontSize: 13, color: 'var(--ink-dim)', marginBottom: 20 }}>
          {status} {renderId && <> — <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>renderId={renderId}</code></>}
        </div>
      )}

      {error && (
        <div style={{ padding: 14, border: '1px solid var(--danger)', borderRadius: 12, background: 'rgba(184,58,53,0.08)', fontSize: 13, color: 'var(--danger)', marginBottom: 20 }}>
          {error}
        </div>
      )}

      {finalUrl && (
        <section style={{ padding: 24, border: '1px solid var(--border)', borderRadius: 16, background: 'var(--surface)' }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Rendered composite</div>
          <video src={finalUrl} controls playsInline style={{ width: '100%', maxWidth: 400, borderRadius: 12, display: 'block', margin: '0 auto' }} />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 14 }}>
            <a href={finalUrl} download style={{ padding: '10px 18px', borderRadius: 10, background: 'var(--ink)', color: 'var(--on-ink)', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>Download</a>
            <a href={finalUrl} target="_blank" rel="noreferrer" style={{ padding: '10px 18px', borderRadius: 10, background: 'transparent', border: '1px solid var(--border)', color: 'var(--ink)', textDecoration: 'none', fontSize: 13 }}>Open in tab</a>
          </div>
        </section>
      )}
    </main>
  )
}

function AssetRow({
  label, value, onChange, onUpload, uploading, note,
}: {
  label: string
  value: string
  onChange: (s: string) => void
  onUpload: (f: File) => void
  uploading: boolean
  note?: string
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="https://…mp4 (paste URL or upload →)"
          className="input"
          style={{ flex: 1 }}
        />
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border)', cursor: uploading ? 'wait' : 'pointer', fontSize: 12.5, background: 'var(--bg)', color: 'var(--ink)' }}>
          {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          Upload
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f) }}
            disabled={uploading}
          />
        </label>
      </div>
      {note && <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', marginTop: 4 }}>{note}</div>}
    </div>
  )
}

function Field({ label, value, onChange, rows = 2 }: { label: string; value: string; onChange: (s: string) => void; rows?: number }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 6 }}>{label}</div>
      <textarea
        className="textarea"
        rows={rows}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', boxSizing: 'border-box' }}
      />
    </div>
  )
}
