'use client'

// Full-screen dark overlay shown while a generator is working. Blocks the
// whole viewport (including the sidebar + nav) so the user can't accidentally
// click away mid-render, and installs a beforeunload listener that prompts
// the browser tab-close dialog while active.
//
// Usage: <GeneratingOverlay active={loading} steps={[...]} tipSeconds={30} />

import { useEffect, useState } from 'react'

interface Step { label: string; sub: string }

interface Props {
  active: boolean
  steps: Step[]
  tipSeconds?: number
  // Optional custom copy for the "don't leave" hint at the top.
  // Default: "Please don't close this tab — your render is in progress"
  holdMessage?: string
}

export function GeneratingOverlay({ active, steps, tipSeconds = 30, holdMessage }: Props) {
  const [step, setStep] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  // Advance through the labelled steps at increasing intervals. Later steps
  // take longer because Nano Banana / Seedance calls slow down as they go.
  useEffect(() => {
    if (!active) { setStep(0); return }
    const delays = [0, 4000, 9000, 16000, 24000, 40000, 60000, 90000]
    const timers = delays.slice(0, steps.length).map((d, i) =>
      setTimeout(() => setStep(i), d)
    )
    return () => timers.forEach(clearTimeout)
  }, [active, steps.length])

  // Live elapsed-time counter for the small mono chip in the corner.
  useEffect(() => {
    if (!active) { setElapsed(0); return }
    const t = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(t)
  }, [active])

  // Navigation guard — while the overlay is active, warn the user before
  // they close the tab or hit back. Chrome will show its native "changes
  // may not be saved" dialog. Doesn't block route changes within the SPA
  // (those are handled by AppRouter events elsewhere).
  useEffect(() => {
    if (!active) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
      return ''
    }
    window.addEventListener('beforeunload', handler)
    // Also lock body scroll so the page underneath can't be manipulated.
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('beforeunload', handler)
      document.body.style.overflow = prevOverflow
    }
  }, [active])

  if (!active) return null

  const current = steps[Math.min(step, steps.length - 1)]
  const pct = Math.min(100, Math.round(((step + 1) / steps.length) * 100))
  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  const elapsedLabel = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'radial-gradient(circle at 50% 40%, #1a1815 0%, #0a0a09 70%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      // Block all pointer events on children behind the overlay (e.g. sidebar links).
      pointerEvents: 'auto',
    }}>
      <style>{`
        @keyframes gol-a { from{transform:rotate(0deg) translateX(54px) rotate(0deg)} to{transform:rotate(360deg) translateX(54px) rotate(-360deg)} }
        @keyframes gol-b { from{transform:rotate(120deg) translateX(38px) rotate(-120deg)} to{transform:rotate(480deg) translateX(38px) rotate(-480deg)} }
        @keyframes gol-c { from{transform:rotate(240deg) translateX(66px) rotate(-240deg)} to{transform:rotate(600deg) translateX(66px) rotate(-600deg)} }
        @keyframes gol-ring { 0%,100%{opacity:.18;transform:scale(1)} 50%{opacity:.06;transform:scale(1.18)} }
        @keyframes gol-ring2 { 0%,100%{opacity:.08;transform:scale(1.05)} 50%{opacity:.02;transform:scale(1.35)} }
        @keyframes gol-in { from{opacity:0;transform:translateY(7px)} to{opacity:1;transform:translateY(0)} }
        @keyframes gol-pulse { 0%,100%{opacity:.35} 50%{opacity:1} }
      `}</style>

      {/* Top "hold tight" banner — pulses gently. */}
      <div style={{
        position: 'absolute', top: 'max(28px, env(safe-area-inset-top, 20px))',
        left: '50%', transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 14px', borderRadius: 99,
        background: 'rgba(200, 169, 126, 0.08)',
        border: '1px solid rgba(200, 169, 126, 0.18)',
        color: '#e6d4b6',
        fontSize: 12, fontWeight: 500, letterSpacing: '0.02em',
        maxWidth: 'min(92vw, 480px)', textAlign: 'center',
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: '#c8a97e', animation: 'gol-pulse 1.6s ease-in-out infinite',
        }} />
        {holdMessage ?? "Please don't close this tab — your render is in progress"}
      </div>

      {/* Orbital */}
      <div style={{ position: 'relative', width: 160, height: 160, marginBottom: 44 }}>
        <div style={{ position: 'absolute', inset: -14, borderRadius: '50%', border: '1px solid rgba(255,255,255,.06)', animation: 'gol-ring2 3.6s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1px solid rgba(255,255,255,.12)', animation: 'gol-ring 2.8s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 14, height: 14, borderRadius: '50%', background: '#fff', opacity: .9 }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', marginTop: -5, marginLeft: -5, width: 10, height: 10, borderRadius: '50%', background: '#c8a97e', animation: 'gol-a 3.2s linear infinite' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', marginTop: -4, marginLeft: -4, width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,.5)', animation: 'gol-b 2.1s linear infinite' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', marginTop: -3, marginLeft: -3, width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,.22)', animation: 'gol-c 4.5s linear infinite' }} />
      </div>

      {/* Label */}
      <div key={step} style={{ textAlign: 'center', animation: 'gol-in .4s ease forwards', padding: '0 24px' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 400, letterSpacing: '-.01em', color: '#fff', marginBottom: 8 }}>
          {current.label}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.42)', letterSpacing: '.02em', maxWidth: 380, margin: '0 auto' }}>
          {current.sub}
        </div>
      </div>

      {/* Progress bar (thin, top-aligned under the label) */}
      <div style={{ marginTop: 32, width: 'min(240px, 60vw)', height: 3, background: 'rgba(255,255,255,.08)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: 'linear-gradient(90deg, rgba(200,169,126,.4), #c8a97e)',
          borderRadius: 2,
          transition: 'width 800ms ease-out',
        }} />
      </div>

      {/* Step + elapsed row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 20, fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'rgba(255,255,255,.35)', letterSpacing: '.06em' }}>
        <span>STEP {Math.min(step + 1, steps.length)} / {steps.length}</span>
        <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,.2)' }} />
        <span>{elapsedLabel} ELAPSED</span>
      </div>

      <div style={{ position: 'absolute', bottom: 'max(28px, env(safe-area-inset-bottom, 20px))', fontSize: 11, color: 'rgba(255,255,255,.22)', letterSpacing: '.06em', textTransform: 'uppercase', textAlign: 'center', padding: '0 24px' }}>
        Usually takes about {tipSeconds} seconds
      </div>
    </div>
  )
}
