'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/auth'
import { ugcPackageCost } from '@/lib/ugc-pricing'
import { showError } from '@/lib/notifications'

// Hook batch: one product, several different hook angles, all rendered as
// cheap Draft ads (Seedance Mini, 5 s, 720p, one starting frame). The user
// reads the scripts first, ticks the ones to render, then picks winners from
// the finished videos in the Library.

const DRAFT_COST = ugcPackageCost(5, '720p', 'seedance-mini')
const FULL_COST = ugcPackageCost(5, '720p')

interface Hook { key: string; label: string; script: string }
type Status = 'idle' | 'frame' | 'video' | 'done' | 'error'
interface Run { status: Status; message?: string; videoUrl?: string }

const STATUS_TEXT: Record<Status, string> = {
  idle: 'Ready',
  frame: 'Casting your creator…',
  video: 'Rendering video…',
  done: 'Submitted',
  error: 'Failed',
}

export default function HookBatchPage() {
  const [url, setUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [image, setImage] = useState<{ base64: string; mimeType: string } | null>(null)
  const [count, setCount] = useState(3)
  const [writing, setWriting] = useState(false)
  const [hooks, setHooks] = useState<Hook[]>([])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [runs, setRuns] = useState<Record<string, Run>>({})
  const [rendering, setRendering] = useState(false)

  const total = picked.size * DRAFT_COST
  const canWrite = name.trim().length > 0 && description.trim().length > 0 && !writing && !rendering

  const token = async () => {
    const supabase = getSupabase()
    const { data } = supabase ? await supabase.auth.getSession() : { data: null }
    return data?.session?.access_token ?? ''
  }

  async function importUrl() {
    if (!url.trim()) return
    setImporting(true)
    try {
      const res = await fetch(`/api/product-url?brand=1&url=${encodeURIComponent(url.trim())}`, {
        headers: { Authorization: `Bearer ${await token()}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not read that page')
      setName(data.productName || '')
      setDescription([data.productDescription, data.benefits].filter(Boolean).join('\n'))
      const dataUrl: string | undefined = data.brand?.image
      const m = dataUrl?.match(/^data:([^;]+);base64,(.+)$/)
      setImage(m ? { mimeType: m[1], base64: m[2] } : null)
    } catch (err) {
      showError("Couldn't read that page", err instanceof Error ? err.message : 'Describe the product below instead.')
    } finally {
      setImporting(false)
    }
  }

  async function writeHooks() {
    setWriting(true)
    setHooks([])
    setRuns({})
    try {
      const res = await fetch('/api/ugc/hook-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ productName: name, productDescription: description, benefits: description, count, language: 'English' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not write the hooks')
      setHooks(data.hooks)
      setPicked(new Set((data.hooks as Hook[]).map(h => h.key)))
    } catch (err) {
      showError('Hook writing failed', err instanceof Error ? err.message : 'Try again')
    } finally {
      setWriting(false)
    }
  }

  const patchRun = (key: string, r: Run) => setRuns(prev => ({ ...prev, [key]: { ...prev[key], ...r } }))

  async function renderOne(hook: Hook, tk: string) {
    try {
      patchRun(hook.key, { status: 'frame', message: undefined })
      const framesRes = await fetch('/api/ugc/hero-frames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
        body: JSON.stringify({
          productName: name,
          productDescription: description,
          productImageBase64: image?.base64,
          productImageMimeType: image?.mimeType,
          avatarGender: 'Female',
          aspectId: 'portrait',
          script: hook.script,
          resolution: '720p',
          engine: 'seedance-mini',
        }),
      })
      const framesData = await framesRes.json().catch(() => ({}))
      if (!framesRes.ok) throw new Error(framesData.error || `Frame generation failed (${framesRes.status})`)
      const first = (framesData.frames ?? [])[0]
      const frameUrl: string | undefined = typeof first === 'string' ? first : first?.url
      if (!frameUrl) throw new Error('No starting frame came back')

      patchRun(hook.key, { status: 'video' })
      const animRes = await fetch('/api/ugc/animate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
        body: JSON.stringify({
          selectedFrameUrl: frameUrl,
          script: hook.script,
          ugcType: 'image-with-voiceover',
          duration: 5,
          productName: name,
          productDescription: description,
          benefits: description,
          callToAction: 'Shop now',
          avatarGender: 'Female',
          language: 'English',
          aspect: 'portrait',
          productImageBase64: image?.base64,
          productImageMimeType: image?.mimeType,
          resolution: '720p',
          engine: 'seedance-mini',
        }),
      })
      const animData = await animRes.json().catch(() => ({}))
      if (!animRes.ok) throw new Error(animData.error || 'Video generation failed')
      patchRun(hook.key, { status: 'done', videoUrl: animData?.components?.video?.videoUrl })
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Failed'
      const message = /vertex|nano banana|billing|403/i.test(raw)
        ? 'Image generation is unavailable right now. No credits were charged.'
        : raw.slice(0, 160)
      patchRun(hook.key, { status: 'error', message })
    }
  }

  async function renderPicked() {
    const queue = hooks.filter(h => picked.has(h.key))
    if (!queue.length) return
    setRendering(true)
    const tk = await token()
    // Two at a time: fast enough, gentle on the image and video providers.
    const pool = [...queue]
    const worker = async () => {
      for (let h = pool.shift(); h; h = pool.shift()) await renderOne(h, tk)
    }
    await Promise.all([worker(), worker()])
    setRendering(false)
  }

  const finished = hooks.length > 0 && hooks.every(h => !picked.has(h.key) || ['done', 'error'].includes(runs[h.key]?.status ?? ''))
  const anyRun = Object.keys(runs).length > 0

  const card: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: 18 }
  const label: React.CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 6, display: 'block' }
  const input: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 14, fontFamily: 'inherit' }
  const btn: React.CSSProperties = { padding: '10px 18px', borderRadius: 8, border: 'none', background: 'var(--ink)', color: 'var(--on-ink)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }

  const costLine = useMemo(
    () => `${picked.size} × ${DRAFT_COST} credits = ${total} credits`,
    [picked.size, total],
  )

  return (
    <div className="content" style={{ maxWidth: 860 }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 30, fontWeight: 400, letterSpacing: '-0.02em', margin: '0 0 6px' }}>
        Hook <span style={{ fontStyle: 'italic', color: 'var(--accent, #A3231F)' }}>batch</span>
      </h1>
      <p style={{ fontSize: 14, color: 'var(--ink-dim)', margin: '0 0 24px', maxWidth: 560 }}>
        One product, several different openings. Render them all as cheap drafts ({DRAFT_COST} credits each), keep the winners, then remake those in full quality ({FULL_COST} credits).
      </p>

      {/* 1. Product */}
      <div style={{ ...card, marginBottom: 16 }}>
        <span style={label}>1. Your product</span>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            style={input} placeholder="Paste a product page link (optional)" value={url}
            onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && importUrl()}
          />
          <button style={{ ...btn, opacity: importing || !url.trim() ? 0.5 : 1, flexShrink: 0 }} disabled={importing || !url.trim()} onClick={importUrl}>
            {importing ? 'Reading…' : 'Import'}
          </button>
        </div>
        <input style={{ ...input, marginBottom: 8 }} placeholder="Product name" value={name} onChange={e => setName(e.target.value)} />
        <textarea style={{ ...input, minHeight: 84, resize: 'vertical' }} placeholder="What is it and why do people buy it?" value={description} onChange={e => setDescription(e.target.value)} />
        {image && <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 8 }}>Product photo found on the page and will be used in the ads.</div>}
        {!image && <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 8 }}>No product photo yet. Importing a product page finds one automatically, and the ads look much better with it.</div>}
      </div>

      {/* 2. Hooks */}
      <div style={{ ...card, marginBottom: 16 }}>
        <span style={label}>2. How many hooks?</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {[3, 4, 5, 6].map(n => (
            <button key={n} onClick={() => setCount(n)} disabled={writing || rendering}
              style={{ padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${count === n ? 'var(--ink)' : 'var(--border)'}`,
                background: count === n ? 'var(--ink)' : 'var(--bg)', color: count === n ? 'var(--on-ink)' : 'var(--ink)' }}>
              {n}
            </button>
          ))}
          <button style={{ ...btn, marginLeft: 'auto', opacity: canWrite ? 1 : 0.5 }} disabled={!canWrite} onClick={writeHooks}>
            {writing ? 'Writing scripts…' : hooks.length ? 'Write again' : 'Write the scripts'}
          </button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 10 }}>Writing the scripts is free. You only pay when you render.</div>
      </div>

      {/* 3. Scripts + render */}
      {hooks.length > 0 && (
        <div style={{ ...card, marginBottom: 16 }}>
          <span style={label}>3. Pick the ones to render</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
            {hooks.map(h => {
              const run = runs[h.key]
              const on = picked.has(h.key)
              return (
                <div key={h.key} style={{ border: `1px solid ${on ? 'var(--ink)' : 'var(--border)'}`, borderRadius: 10, padding: 14, background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14, cursor: rendering ? 'default' : 'pointer' }}>
                    <input type="checkbox" checked={on} disabled={rendering || !!run}
                      onChange={() => setPicked(prev => { const n = new Set(prev); if (n.has(h.key)) n.delete(h.key); else n.add(h.key); return n })} />
                    {h.label}
                  </label>
                  <pre style={{ margin: 0, fontFamily: 'var(--font-mono, monospace)', fontSize: 11.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', color: 'var(--ink-dim)', maxHeight: 190, overflow: 'auto' }}>{h.script}</pre>
                  {run && (
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: run.status === 'error' ? '#b91c1c' : 'var(--ink)' }}>
                      {run.status === 'error' ? `Failed: ${run.message}` : STATUS_TEXT[run.status]}
                    </div>
                  )}
                  {run?.videoUrl && <video src={run.videoUrl} controls playsInline style={{ width: '100%', borderRadius: 8, maxHeight: 280, background: '#000' }} />}
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
            {!anyRun && <span style={{ fontSize: 13, color: 'var(--ink-dim)' }}>{costLine}</span>}
            {!anyRun && (
              <button style={{ ...btn, marginLeft: 'auto', opacity: picked.size && !rendering ? 1 : 0.5 }} disabled={!picked.size || rendering} onClick={renderPicked}>
                Render {picked.size} draft{picked.size === 1 ? '' : 's'}
              </button>
            )}
            {rendering && <span style={{ fontSize: 13, color: 'var(--ink-dim)' }}>Keep this tab open while the scripts turn into frames. Videos finish in the Library.</span>}
            {finished && !rendering && (
              <Link href="/library" style={{ ...btn, marginLeft: 'auto', textDecoration: 'none' }}>Open Library to pick winners</Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
