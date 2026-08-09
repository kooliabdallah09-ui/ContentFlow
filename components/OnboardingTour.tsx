'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const STEPS = [
  {
    icon: '✦',
    title: 'Welcome to ContentFlow',
    body: 'You have 60 free credits. Let\'s get you set up in 3 steps so you can start making content.',
    cta: 'Let\'s go →',
    href: null,
  },
  {
    icon: '📦',
    title: 'Step 1 — Add your product',
    body: 'Go to Studios → Products and upload your product photos. This is the foundation — every shoot, ad, and campaign you make will pull from it.',
    cta: 'Go to Products →',
    href: '/generate/products',
  },
  {
    icon: '🎭',
    title: 'Step 2 — Create an AI actor',
    body: 'In Studios → Influencers, create your brand\'s AI character. Give it a face, a name, and a personality. You\'ll reuse it across all your content.',
    cta: 'Go to Influencers →',
    href: '/influencers',
  },
  {
    icon: '📅',
    title: 'Step 3 — Plan your campaign',
    body: 'Head to Campaigns and map out your content. Pick your product, your actor, and your goal — the AI drafts a full shot list for you.',
    cta: 'Go to Campaigns →',
    href: '/campaigns',
  },
  {
    icon: '✨',
    title: 'Then — shoot lifestyle content',
    body: 'Once your product and actor are set up, use the Studios to generate lifestyle photos, product shoots, and influencer scenes in any aesthetic — no photographer, no set.',
    cta: 'Open Studios →',
    href: '/generate/products',
  },
]

export default function OnboardingTour() {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)
  const router = useRouter()

  useEffect(() => {
    if (typeof localStorage === 'undefined') return
    if (localStorage.getItem('cf-new-user') === '1') {
      setVisible(true)
    }
  }, [])

  function dismiss() {
    localStorage.removeItem('cf-new-user')
    setVisible(false)
  }

  function next() {
    const current = STEPS[step]
    if (current.href) router.push(current.href)
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
    } else {
      dismiss()
    }
  }

  if (!visible) return null

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={dismiss}
        style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(3px)' }}
      />

      {/* Tour card */}
      <div style={{
        position: 'fixed', zIndex: 1000,
        bottom: 32, right: 32,
        width: 320,
        borderRadius: 18,
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        boxShadow: '0 24px 60px rgba(0,0,0,0.18), 0 8px 20px rgba(0,0,0,0.1)',
        padding: '24px 24px 20px',
        display: 'flex', flexDirection: 'column', gap: 16,
        animation: 'tourIn 0.3s cubic-bezier(0.16,1,0.3,1)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 5 }}>
            {STEPS.map((_, i) => (
              <div key={i} style={{ width: i === step ? 18 : 6, height: 6, borderRadius: 999, background: i === step ? 'var(--ink)' : 'var(--border)', transition: 'all 0.25s' }} />
            ))}
          </div>
          <button
            onClick={dismiss}
            style={{ fontSize: 12, color: 'var(--ink-mute)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 6 }}
          >
            Skip
          </button>
        </div>

        {/* Icon */}
        <div style={{ fontSize: 36, lineHeight: 1 }}>{current.icon}</div>

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.3 }}>{current.title}</div>
          <div style={{ fontSize: 13.5, color: 'var(--ink-dim)', lineHeight: 1.6 }}>{current.body}</div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          {step > 0 ? (
            <button
              onClick={() => setStep(s => s - 1)}
              style={{ fontSize: 13, color: 'var(--ink-mute)', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0' }}
            >
              ← Back
            </button>
          ) : <span />}

          <button
            onClick={next}
            style={{
              padding: '9px 18px', borderRadius: 10, border: 'none',
              background: 'var(--ink)', color: 'var(--on-ink)',
              fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
              letterSpacing: '-0.01em',
            }}
          >
            {current.cta}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes tourIn {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  )
}
