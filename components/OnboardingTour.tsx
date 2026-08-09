'use client'

import React, { useState, useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

// ── SVG icons ────────────────────────────────────────────────────────────────
function IconSpark() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z"/>
    </svg>
  )
}
function IconBox() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  )
}
function IconPerson() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
}
function IconCalendar() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}
function IconCamera() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  )
}
function IconZap() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  )
}

// ── Step definitions ──────────────────────────────────────────────────────────
const STEPS: { Icon: () => React.ReactElement; label: string; title: string; body: ReactNode; tip: string | null; cta: string; href: string | null }[] = [
  {
    Icon: IconSpark,
    label: 'Welcome',
    title: 'Your AI content studio is ready.',
    body: <>ContentFlow turns your product into <strong>scroll-stopping ads</strong>, <strong>lifestyle shoots</strong>, and <strong>branded content</strong> — <strong>fully AI-generated</strong>. No photographer, no crew, no agency. Follow this short guide to set everything up correctly before you start creating.</>,
    tip: null,
    cta: 'Start the setup',
    href: null,
  },
  {
    Icon: IconBox,
    label: 'Product',
    title: 'Add your product first.',
    body: <>Everything in ContentFlow is built around your product. Go to <strong>Studios → Products</strong>, upload your photos from <strong>multiple angles</strong>, and give it a name and description. The AI will use those <strong>reference photos</strong> in every shoot, ad, and campaign you run — so <strong>the more angles you provide, the better every result will look</strong>.</>,
    tip: 'Pro tip: upload at least 3 angles — front, back, and a detail shot. This dramatically improves consistency across all generated content.',
    cta: 'Open Product Studio',
    href: '/generate/products',
  },
  {
    Icon: IconPerson,
    label: 'Actor',
    title: 'Create your AI actor.',
    body: <>Your AI actor is the <strong>face of your brand content</strong>. Go to <strong>Studios → Influencers</strong> and <strong>let the AI generate a unique actor for you</strong> — just give it a name, personality, and niche. You can optionally upload a reference photo to guide the look. ContentFlow builds a full <strong>character sheet</strong> — a reusable identity that stays consistent across every ad, scene, and shoot.</>,
    tip: 'Pro tip: describe a specific look in the personality field — age, style, energy. The more precise you are, the more consistent your actor will be across shoots.',
    cta: 'Open Influencer Studio',
    href: '/influencers',
  },
  {
    Icon: IconCalendar,
    label: 'Campaign',
    title: 'Plan your campaign.',
    body: <>Campaigns let you map out a <strong>full content strategy</strong> in one place. Select your product, pick your actor, choose a goal (launch, awareness, or conversion), and the AI generates a <strong>complete shot list with scripts and hooks</strong>. You can then generate each shot directly from the <strong>campaign planner</strong> without starting from scratch each time.</>,
    tip: 'Pro tip: build a launch campaign before your next product drop. It pre-generates 10–20 pieces of content you can deploy over weeks.',
    cta: 'Open Campaigns',
    href: '/campaigns',
  },
  {
    Icon: IconCamera,
    label: 'Shoot',
    title: 'Generate lifestyle content.',
    body: <>With your product and actor saved, the Studios become your <strong>production engine</strong>. In <strong>Product Studio</strong> you can shoot your product in any aesthetic — golden hour lifestyle, studio white, street editorial, or custom scenes you describe. In <strong>Influencer Studio</strong>, shoot your actor in branded scenes, outfits, and settings. Every output is <strong>production-ready</strong>.</>,
    tip: 'Pro tip: create a Scene in Studios → Scenes first to lock in a specific environment. Then use that scene across multiple shoots for a cohesive look.',
    cta: 'Start shooting',
    href: '/generate/products',
  },
  {
    Icon: IconZap,
    label: 'Upgrade',
    title: 'Ready for UGC ads and video?',
    body: <><strong>UGC Package</strong> and <strong>AI Video generation</strong> — talking-head ads, podcast ads, and scroll-stop video — require a <strong>paid plan</strong>. These features use our most advanced models and are currently available to upgraded accounts. When you&apos;re ready to produce your first ad, <strong>upgrade and the full studio unlocks immediately</strong>.</>,
    tip: null,
    cta: 'View upgrade options',
    href: '/settings/billing',
  },
]

// ── Component ─────────────────────────────────────────────────────────────────
export default function OnboardingTour() {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)
  const [confirmSkip, setConfirmSkip] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (typeof localStorage === 'undefined') return
    if (localStorage.getItem('cf-new-user') === '1') setVisible(true)
  }, [])

  function dismiss() {
    localStorage.removeItem('cf-new-user')
    setVisible(false)
    setConfirmSkip(false)
  }

  function next() {
    const current = STEPS[step]
    if (current.href) router.push(current.href)
    if (step < STEPS.length - 1) setStep(s => s + 1)
    else dismiss()
  }

  if (!visible) return null

  const current = STEPS[step]
  const progress = ((step) / (STEPS.length - 1)) * 100

  return (
    <>
      {/* Backdrop */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }} />

      {/* Tour card */}
      <div style={{
        position: 'fixed', zIndex: 1000,
        bottom: 32, right: 32,
        width: 380,
        borderRadius: 20,
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.2), 0 8px 24px rgba(0,0,0,0.1)',
        overflow: 'hidden',
        animation: 'tourIn 0.35s cubic-bezier(0.16,1,0.3,1)',
      }}>

        {/* Progress bar */}
        <div style={{ height: 3, background: 'var(--border)' }}>
          <div style={{ height: '100%', background: 'var(--ink)', width: `${progress}%`, transition: 'width 0.4s ease' }} />
        </div>

        <div style={{ padding: '22px 24px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Step pills */}
            <div style={{ display: 'flex', gap: 4 }}>
              {STEPS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  title={s.label}
                  style={{
                    padding: '3px 8px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 10.5, fontWeight: 600,
                    fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', textTransform: 'uppercase',
                    background: i === step ? 'var(--ink)' : i < step ? 'var(--border)' : 'transparent',
                    color: i === step ? 'var(--on-ink)' : i < step ? 'var(--ink-dim)' : 'var(--ink-mute)',
                    transition: 'all 0.2s',
                  }}
                >
                  {i < step ? '✓' : i + 1}
                </button>
              ))}
            </div>

            {/* Skip all */}
            <button
              onClick={() => setConfirmSkip(true)}
              style={{ fontSize: 12, color: 'var(--ink-mute)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
            >
              Skip all
            </button>
          </div>

          {/* Skip confirmation */}
          {confirmSkip && (
            <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(234,88,12,0.06)', border: '1px solid rgba(234,88,12,0.2)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#9a3412' }}>Not recommended</div>
              <div style={{ fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>Skipping the guide means you may miss key setup steps. Your content quality will be lower without a product and actor configured first.</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setConfirmSkip(false)}
                  style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid rgba(234,88,12,0.3)', background: 'transparent', fontSize: 12, fontWeight: 600, color: '#9a3412', cursor: 'pointer' }}
                >
                  Keep going
                </button>
                <button
                  onClick={dismiss}
                  style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', background: 'rgba(234,88,12,0.12)', fontSize: 12, fontWeight: 600, color: '#9a3412', cursor: 'pointer' }}
                >
                  Skip anyway
                </button>
              </div>
            </div>
          )}

          {/* Icon + step label */}
          {!confirmSkip && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)', flexShrink: 0 }}>
                  <current.Icon />
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)', marginBottom: 3 }}>
                    {step === 0 ? 'Getting started' : `Step ${step} of ${STEPS.length - 1}`}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.25 }}>{current.title}</div>
                </div>
              </div>

              {/* Body */}
              <div style={{ fontSize: 13.5, color: 'var(--ink-dim)', lineHeight: 1.7 }}>{current.body}</div>

              {/* Tip */}
              {current.tip && (
                <div style={{ padding: '10px 13px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 12.5, color: 'var(--ink-dim)', lineHeight: 1.6 }}>
                  <span style={{ fontWeight: 700, color: 'var(--ink)', marginRight: 4 }}>Tip.</span>
                  {current.tip.replace('Pro tip: ', '')}
                </div>
              )}

              {/* Footer */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 2 }}>
                {step > 0 ? (
                  <button
                    onClick={() => setStep(s => s - 1)}
                    style={{ fontSize: 13, color: 'var(--ink-mute)', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0', display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                    Back
                  </button>
                ) : <span />}

                <button
                  onClick={next}
                  style={{
                    padding: '10px 20px', borderRadius: 11, border: 'none',
                    background: step === STEPS.length - 1 ? '#16a34a' : 'var(--ink)',
                    color: 'var(--on-ink)',
                    fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
                    letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 7,
                    transition: 'background 0.2s',
                  }}
                >
                  {current.cta}
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes tourIn {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  )
}
