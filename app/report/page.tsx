'use client'

import { useState } from 'react'
import Link from 'next/link'

const REASONS = [
  'Impersonation / real-person likeness misuse',
  'Minor / underage subject',
  'Explicit / NSFW content',
  'Hateful or discriminatory content',
  'Copyright / trademark infringement',
  'Other',
]

export default function ReportPage() {
  const [reason, setReason] = useState(REASONS[0])
  const [description, setDescription] = useState('')
  const [contentUrl, setContentUrl] = useState('')
  const [reporterEmail, setReporterEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setState('sending')
    setErrorMsg('')
    try {
      const res = await fetch('/api/abuse-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, description, contentUrl, reporterEmail }),
      })
      const data = await res.json()
      if (!res.ok) {
        setState('error')
        setErrorMsg(data.error ?? 'Something went wrong. Try again.')
        return
      }
      setState('sent')
    } catch {
      setState('error')
      setErrorMsg('Network error. Try again.')
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '60px 32px 100px', color: 'var(--ink)', lineHeight: 1.6 }}>
      <div style={{ marginBottom: 32 }}>
        <Link href="/" style={{ fontSize: 13, color: 'var(--ink-dim)', textDecoration: 'none', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
          ← Back to ContentFlow
        </Link>
      </div>

      <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 36, lineHeight: 1.1, letterSpacing: '-0.01em', margin: '0 0 8px' }}>
        Report abuse or content
      </h1>
      <p style={{ fontSize: 14, color: 'var(--ink-dim)', margin: '0 0 32px' }}>
        We review every report within 24 hours. Use this form to flag impersonation, minors, explicit content, or IP violations.
      </p>

      {state === 'sent' ? (
        <div style={{ padding: 24, border: '1px solid #16a34a', borderRadius: 12, background: '#f0fdf4' }}>
          <div style={{ fontWeight: 700, color: '#166534', marginBottom: 6 }}>Report received</div>
          <p style={{ margin: 0, fontSize: 13.5, color: '#15803d' }}>Thanks — a moderator will review it within 24 hours. If we need more information we&apos;ll email you at the address you provided (optional).</p>
        </div>
      ) : (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-dim)' }}>Reason *</span>
            <select value={reason} onChange={e => setReason(e.target.value)} required style={inputStyle}>
              {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-dim)' }}>What&apos;s wrong? *</span>
            <textarea value={description} onChange={e => setDescription(e.target.value)} required rows={6} style={{ ...inputStyle, resize: 'vertical', minHeight: 120 }}
              placeholder="Describe what you saw and why it violates our policies." />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-dim)' }}>Content URL (if any)</span>
            <input type="url" value={contentUrl} onChange={e => setContentUrl(e.target.value)} placeholder="https://contentflow-web.com/library/..." style={inputStyle} />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-dim)' }}>Your email (optional — so we can follow up)</span>
            <input type="email" value={reporterEmail} onChange={e => setReporterEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} />
          </label>

          {errorMsg && <div style={{ fontSize: 13, color: '#b91c1c' }}>{errorMsg}</div>}

          <button type="submit" disabled={state === 'sending'} style={{
            padding: '13px 22px', borderRadius: 10, border: 'none',
            background: 'var(--ink)', color: 'var(--on-ink, #fff)',
            fontWeight: 600, fontSize: 14, cursor: 'pointer',
            opacity: state === 'sending' ? 0.5 : 1,
          }}>
            {state === 'sending' ? 'Sending…' : 'Submit report'}
          </button>
        </form>
      )}
    </main>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '10px 14px', borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--ink)',
  fontSize: 14, fontFamily: 'inherit',
}
