'use client'

// Full-screen dark overlay shown while a generator is working.
// Usage: <GeneratingOverlay active={loading} steps={[...]} tipSeconds={30} />

import { useEffect, useState } from 'react'

interface Step { label: string; sub: string }

interface Props {
  active: boolean
  steps: Step[]
  tipSeconds?: number
}

export function GeneratingOverlay({ active, steps, tipSeconds = 30 }: Props) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!active) { setStep(0); return }
    const delays = [0, 4000, 9000, 16000, 24000]
    const timers = delays.slice(0, steps.length).map((d, i) =>
      setTimeout(() => setStep(i), d)
    )
    return () => timers.forEach(clearTimeout)
  }, [active, steps.length])

  if (!active) return null

  const current = steps[Math.min(step, steps.length - 1)]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#0f0f0f',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      <style>{`
        @keyframes gol-a { from{transform:rotate(0deg) translateX(54px) rotate(0deg)} to{transform:rotate(360deg) translateX(54px) rotate(-360deg)} }
        @keyframes gol-b { from{transform:rotate(120deg) translateX(38px) rotate(-120deg)} to{transform:rotate(480deg) translateX(38px) rotate(-480deg)} }
        @keyframes gol-c { from{transform:rotate(240deg) translateX(66px) rotate(-240deg)} to{transform:rotate(600deg) translateX(66px) rotate(-600deg)} }
        @keyframes gol-ring { 0%,100%{opacity:.18;transform:scale(1)} 50%{opacity:.06;transform:scale(1.18)} }
        @keyframes gol-in { from{opacity:0;transform:translateY(7px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Orbital */}
      <div style={{ position: 'relative', width: 160, height: 160, marginBottom: 44 }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1px solid rgba(255,255,255,.12)', animation: 'gol-ring 2.8s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 14, height: 14, borderRadius: '50%', background: '#fff', opacity: .9 }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', marginTop: -5, marginLeft: -5, width: 10, height: 10, borderRadius: '50%', background: '#c8a97e', animation: 'gol-a 3.2s linear infinite' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', marginTop: -4, marginLeft: -4, width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,.5)', animation: 'gol-b 2.1s linear infinite' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', marginTop: -3, marginLeft: -3, width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,.22)', animation: 'gol-c 4.5s linear infinite' }} />
      </div>

      {/* Label */}
      <div key={step} style={{ textAlign: 'center', animation: 'gol-in .4s ease forwards' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 400, letterSpacing: '-.01em', color: '#fff', marginBottom: 8 }}>
          {current.label}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.38)', letterSpacing: '.02em' }}>
          {current.sub}
        </div>
      </div>

      {/* Progress dots */}
      <div style={{ display: 'flex', gap: 8, marginTop: 44 }}>
        {steps.map((_, i) => (
          <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i <= step ? '#fff' : 'rgba(255,255,255,.18)', transition: 'background .4s ease' }} />
        ))}
      </div>

      <div style={{ position: 'absolute', bottom: 36, fontSize: 11.5, color: 'rgba(255,255,255,.2)', letterSpacing: '.05em', textTransform: 'uppercase' }}>
        This takes about {tipSeconds} seconds
      </div>
    </div>
  )
}
