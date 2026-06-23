'use client'

import { useState } from 'react'
import { getSupabase } from '@/lib/auth'
import Link from 'next/link'

const HOOK_ANGLES = [
  { id: 'problem', label: 'Problem → Solution', desc: 'Open with the pain point the product solves' },
  { id: 'transformation', label: 'Before / After', desc: 'Before state vs. after using the product' },
  { id: 'curiosity', label: 'Curiosity hook', desc: 'Start with a surprising fact or bold claim' },
  { id: 'social_proof', label: 'Social proof', desc: 'Lead with results, numbers, or testimonial-style' },
  { id: 'question', label: 'Question hook', desc: 'Open with a direct question to the viewer' },
  { id: 'story', label: 'Mini-story', desc: 'Personal story arc that ends with the product' },
]

interface JobState {
  angle: typeof HOOK_ANGLES[0]
  status: 'idle' | 'running' | 'done' | 'error'
  contentId?: string
  videoUrl?: string
  error?: string
  progress: number
  progressLabel: string
}

async function getToken() {
  const supabase = getSupabase()
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data?.session?.access_token ?? null
}

export default function BatchPage() {
  const [productName, setProductName] = useState('')
  const [productDescription, setProductDescription] = useState('')
  const [benefits, setBenefits] = useState('')
  const [callToAction, setCallToAction] = useState('Shop now')
  const [selectedAngles, setSelectedAngles] = useState<Set<string>>(new Set(['problem', 'transformation']))
  const [jobs, setJobs] = useState<JobState[]>([])
  const [generating, setGenerating] = useState(false)

  const toggleAngle = (id: string) => {
    setSelectedAngles(prev => {
      const next = new Set(prev)
      if (next.has(id)) { if (next.size > 1) next.delete(id) }
      else { if (next.size < 6) next.add(id) }
      return next
    })
  }

  const updateJob = (idx: number, patch: Partial<JobState>) => {
    setJobs(prev => prev.map((j, i) => i === idx ? { ...j, ...patch } : j))
  }

  const runJob = async (idx: number, angle: typeof HOOK_ANGLES[0], token: string) => {
    const STEPS = [
      { pct: 10, label: 'Writing script…' },
      { pct: 30, label: 'Generating character…' },
      { pct: 55, label: 'Rendering video…' },
      { pct: 80, label: 'Processing audio…' },
      { pct: 95, label: 'Finalizing…' },
    ]

    updateJob(idx, { status: 'running', progress: 5, progressLabel: 'Starting…' })

    let stepIdx = 0
    const stepTimer = setInterval(() => {
      if (stepIdx < STEPS.length) {
        updateJob(idx, { progress: STEPS[stepIdx].pct, progressLabel: STEPS[stepIdx].label })
        stepIdx++
      }
    }, 18000)

    try {
      const res = await fetch('/api/ugc/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ugcType: 'image-with-voiceover',
          productName,
          productDescription,
          benefits,
          callToAction,
          customInstructions: `Hook angle: ${angle.label}. ${angle.desc}. Keep the hook tight and the energy high.`,
          style: 'realistic',
        }),
      })

      clearInterval(stepTimer)
      const data = await res.json()

      if (!res.ok || data.error) {
        updateJob(idx, { status: 'error', error: data.error || 'Generation failed', progress: 0, progressLabel: '' })
        return
      }

      updateJob(idx, {
        status: 'done',
        contentId: data.contentId,
        videoUrl: data.videoUrl,
        progress: 100,
        progressLabel: 'Done',
      })
    } catch (err) {
      clearInterval(stepTimer)
      updateJob(idx, { status: 'error', error: err instanceof Error ? err.message : 'Network error', progress: 0, progressLabel: '' })
    }
  }

  const handleGenerate = async () => {
    if (!productName.trim() || !productDescription.trim()) return
    const angles = HOOK_ANGLES.filter(a => selectedAngles.has(a.id))
    const token = await getToken()
    if (!token) { alert('Please sign in first'); return }

    const initialJobs: JobState[] = angles.map(a => ({
      angle: a,
      status: 'idle',
      progress: 0,
      progressLabel: '',
    }))
    setJobs(initialJobs)
    setGenerating(true)

    await Promise.allSettled(angles.map((angle, idx) => runJob(idx, angle, token)))
    setGenerating(false)
  }

  const allDone = jobs.length > 0 && jobs.every(j => j.status === 'done' || j.status === 'error')
  const doneCount = jobs.filter(j => j.status === 'done').length

  return (
    <div className="content">
      <div className="page-head">
        <h1 className="page-title">Batch <em>Generation</em></h1>
        <p className="page-sub">
          Generate multiple UGC variants in parallel — each with a different hook angle. Perfect for split-testing in feed.
        </p>
      </div>

      {jobs.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 680 }}>

          {/* Product info */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Product Info</h2>

            <div>
              <label style={labelStyle}>Product name *</label>
              <input
                value={productName}
                onChange={e => setProductName(e.target.value)}
                placeholder="e.g. Glow Serum Pro"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Product description *</label>
              <textarea
                value={productDescription}
                onChange={e => setProductDescription(e.target.value)}
                placeholder="What does it do? Who is it for? What problem does it solve?"
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <div>
              <label style={labelStyle}>Key benefits</label>
              <input
                value={benefits}
                onChange={e => setBenefits(e.target.value)}
                placeholder="e.g. Clears acne in 7 days, dermatologist approved, vegan"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Call to action</label>
              <input
                value={callToAction}
                onChange={e => setCallToAction(e.target.value)}
                placeholder="e.g. Shop now, Get 20% off today"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Hook angles */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Hook angles to generate</h2>
            <p style={{ fontSize: 13, color: 'var(--ink-mute)', marginBottom: 16 }}>
              Select 2–6 angles. Each becomes one video variant. ({selectedAngles.size} selected)
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {HOOK_ANGLES.map(a => {
                const sel = selectedAngles.has(a.id)
                return (
                  <button
                    key={a.id}
                    onClick={() => toggleAngle(a.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '12px 16px', borderRadius: 'var(--r-md)',
                      border: sel ? '2px solid var(--accent)' : '1px solid var(--border)',
                      background: sel ? 'var(--surface-2, var(--surface))' : 'var(--bg)',
                      cursor: 'pointer', textAlign: 'left', transition: 'all 120ms',
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                      border: sel ? '2px solid var(--accent)' : '2px solid var(--border)',
                      background: sel ? 'var(--accent)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {sel && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{a.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 1 }}>{a.desc}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Credit estimate */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Estimated cost</div>
              <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 2 }}>
                {selectedAngles.size} variant{selectedAngles.size !== 1 ? 's' : ''} × ~180 credits each
              </div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>
              ~{selectedAngles.size * 180} cr
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={!productName.trim() || !productDescription.trim()}
            className="btn btn-primary"
            style={{ padding: '14px 24px', fontSize: 14, opacity: (!productName.trim() || !productDescription.trim()) ? 0.5 : 1 }}
          >
            Generate {selectedAngles.size} variant{selectedAngles.size !== 1 ? 's' : ''} →
          </button>
        </div>
      )}

      {/* Progress / results */}
      {jobs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
          {allDone && (
            <div style={{ padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {doneCount} of {jobs.length} variant{jobs.length !== 1 ? 's' : ''} ready
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 2 }}>View them in your library</div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <Link href="/library" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}>View in library</Link>
                <button onClick={() => { setJobs([]); setGenerating(false) }} className="btn" style={{ padding: '8px 16px', fontSize: 13, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}>New batch</button>
              </div>
            </div>
          )}

          {jobs.map((job, idx) => (
            <div key={idx} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Variant {idx + 1} — {job.angle.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 2 }}>{job.angle.desc}</div>
                </div>
                <StatusPill status={job.status} />
              </div>

              {job.status === 'running' && (
                <div>
                  <div style={{ height: 4, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'var(--accent)', borderRadius: 99, width: `${job.progress}%`, transition: 'width 600ms ease' }} />
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>
                    {job.progressLabel}
                  </div>
                </div>
              )}

              {job.status === 'done' && job.videoUrl && (
                <video
                  src={job.videoUrl}
                  controls
                  style={{ width: '100%', maxWidth: 280, borderRadius: 'var(--r-md)', background: '#000' }}
                />
              )}

              {job.status === 'done' && !job.videoUrl && (
                <div style={{ fontSize: 13, color: 'var(--ink-mute)' }}>
                  Saved to library —{' '}
                  <Link href="/library" style={{ color: 'var(--accent)' }}>view it there</Link>
                </div>
              )}

              {job.status === 'error' && (
                <div style={{ fontSize: 13, color: '#c0392b', background: 'rgba(192,57,43,0.08)', padding: '10px 14px', borderRadius: 'var(--r-sm)' }}>
                  {job.error}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusPill({ status }: { status: JobState['status'] }) {
  const map: Record<JobState['status'], { label: string; color: string; bg: string }> = {
    idle:    { label: 'Queued',     color: 'var(--ink-mute)',  bg: 'var(--border)' },
    running: { label: 'Generating', color: 'var(--accent)',    bg: 'var(--surface-2, var(--surface))' },
    done:    { label: 'Ready',      color: '#2F7A4E',          bg: 'rgba(47,122,78,0.1)' },
    error:   { label: 'Failed',     color: '#c0392b',          bg: 'rgba(192,57,43,0.08)' },
  }
  const { label, color, bg } = map[status]
  return (
    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color, background: bg, borderRadius: 99, padding: '4px 10px', whiteSpace: 'nowrap', flexShrink: 0 }}>
      {label}
    </span>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  fontSize: 14,
  border: '1px solid var(--border)',
  borderRadius: 'var(--r-md)',
  background: 'var(--bg)',
  color: 'var(--ink)',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 6,
  fontSize: 11.5,
  fontWeight: 700,
  color: 'var(--ink-mute)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}
