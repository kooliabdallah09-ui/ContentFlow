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

// ── Mini-mockup illustrations (rendered at 2× then scaled to 380×138) ─────────
function IlluWrap({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: '100%', height: 138, overflow: 'hidden', position: 'relative', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
      <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: 760, height: 276, padding: '18px 24px', boxSizing: 'border-box' }}>
        {children}
      </div>
    </div>
  )
}

function IlluDashboard() {
  return (
    <IlluWrap>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 30, fontWeight: 400, color: 'var(--ink)', lineHeight: 1.1, letterSpacing: '-0.02em' }}>Good afternoon, <em>S.</em></div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 400, color: 'var(--ink-dim)', lineHeight: 1.1, letterSpacing: '-0.02em', fontStyle: 'italic', marginTop: 4 }}>What are we making today?</div>
        </div>
        <div style={{ background: 'var(--ink)', color: '#fff', borderRadius: 99, padding: '7px 16px', fontSize: 13, fontWeight: 700, flexShrink: 0, marginTop: 6 }}>830 cr</div>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        {[
          { label: 'UGC Package', sub: 'Talking-head ads' },
          { label: 'Image', sub: 'Product shots' },
          { label: 'Voice', sub: 'AI voiceover' },
          { label: 'Blog', sub: 'SEO article' },
        ].map((item, i) => (
          <div key={i} style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 12, padding: '14px 12px', background: 'var(--bg)' }}>
            <div style={{ width: 28, height: 28, background: 'var(--border)', borderRadius: 7, marginBottom: 10 }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 4, lineHeight: 1.2 }}>{item.label}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-mute)', lineHeight: 1.3 }}>{item.sub}</div>
          </div>
        ))}
      </div>
    </IlluWrap>
  )
}

function IlluProductStudio() {
  return (
    <IlluWrap>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 400, color: 'var(--ink)', letterSpacing: '-0.02em' }}>Product studio</div>
          <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 5 }}>Add your product once — shoot it in endless aesthetics.</div>
        </div>
        <div style={{ background: 'var(--ink)', color: '#fff', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 700, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16 }}>+</span> Add product
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {['Summer Serum', 'Night Cream', 'Face Wash'].map((name, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 14px', border: '1px solid var(--border)', borderRadius: 11, background: 'var(--bg)' }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--border)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{name}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>3 photos · Beauty</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>Generate →</div>
          </div>
        ))}
      </div>
    </IlluWrap>
  )
}

function IlluInfluencerStudio() {
  return (
    <IlluWrap>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 400, color: 'var(--ink)', letterSpacing: '-0.02em' }}>Influencer studio</div>
        <div style={{ background: 'var(--ink)', color: '#fff', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 700 }}>+ New actor</div>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        {[
          { name: 'Maya', niche: 'Lifestyle', hasPhoto: true },
          { name: 'Alex', niche: 'Fitness', hasPhoto: true },
          { name: 'Zoe', niche: 'Beauty', hasPhoto: true },
          { name: 'Create new', niche: 'AI-generated', dashed: true },
        ].map((actor, i) => (
          <div key={i} style={{ flex: 1, border: actor.dashed ? '1.5px dashed var(--border)' : '1px solid var(--border)', borderRadius: 12, padding: '14px 10px', background: 'var(--bg)', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: actor.dashed ? 'transparent' : 'var(--border)', margin: '0 auto 10px', border: actor.dashed ? '2px dashed var(--border)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {actor.dashed && <span style={{ fontSize: 22, color: 'var(--ink-mute)', lineHeight: 1 }}>+</span>}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: actor.dashed ? 'var(--ink-mute)' : 'var(--ink)' }}>{actor.name}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 3 }}>{actor.niche}</div>
          </div>
        ))}
      </div>
    </IlluWrap>
  )
}

function IlluCampaigns() {
  return (
    <IlluWrap>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 400, color: 'var(--ink)', letterSpacing: '-0.02em' }}>Campaigns</div>
          <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 5 }}>Plan a full month of content in one place.</div>
        </div>
        <div style={{ background: 'var(--ink)', color: '#fff', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 700 }}>New campaign</div>
      </div>
      {[
        { name: 'Summer Launch', meta: 'Beauty · Maya · 12 shots', badge: 'ACTIVE', badgeColor: '#16a34a' },
        { name: 'Fall Collection', meta: 'Fashion · Alex · 8 shots', badge: 'DRAFT', badgeColor: '#6b7280' },
      ].map((c, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg)', marginBottom: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: 'var(--border)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{c.name}</div>
              <div style={{ background: c.badgeColor + '22', color: c.badgeColor, fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 99, letterSpacing: '0.06em' }}>{c.badge}</div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{c.meta}</div>
          </div>
          <div style={{ fontSize: 14, color: 'var(--ink-mute)' }}>→</div>
        </div>
      ))}
    </IlluWrap>
  )
}

function IlluShooting() {
  return (
    <IlluWrap>
      <div style={{ display: 'flex', gap: 18, height: '100%' }}>
        {/* Left: form */}
        <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 400, color: 'var(--ink)', letterSpacing: '-0.02em', marginBottom: 2 }}>Product studio</div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', background: 'var(--bg)', fontSize: 12, color: 'var(--ink-dim)', lineHeight: 1.6 }}>
            Golden hour lifestyle — beach, product held naturally, warm tones, editorial feel...
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--ink-mute)', background: 'var(--bg)' }}>Summer Serum</div>
            <div style={{ background: 'var(--ink)', color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>Generate</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['1 image', '2 images', '4 images'].map((o, i) => (
              <div key={i} style={{ padding: '5px 10px', borderRadius: 7, border: i === 1 ? '1.5px solid var(--ink)' : '1px solid var(--border)', fontSize: 10, fontWeight: i === 1 ? 700 : 400, color: i === 1 ? 'var(--ink)' : 'var(--ink-mute)', background: 'var(--bg)' }}>{o}</div>
            ))}
          </div>
        </div>
        {/* Right: image grid */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 8 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ background: 'var(--border)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="1.4"><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z"/></svg>
            </div>
          ))}
        </div>
      </div>
    </IlluWrap>
  )
}

function IlluBilling() {
  return (
    <IlluWrap>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 400, color: 'var(--ink)', letterSpacing: '-0.02em', marginBottom: 16 }}>Upgrade your plan</div>
      <div style={{ display: 'flex', gap: 10 }}>
        {[
          { name: 'Starter', price: '$49', credits: '800 cr/mo', highlight: false },
          { name: 'Pro', price: '$99', credits: '2,000 cr/mo', highlight: true },
          { name: 'Agency', price: '$249', credits: '6,500 cr/mo', highlight: false },
        ].map((plan, i) => (
          <div key={i} style={{ flex: 1, border: plan.highlight ? '2px solid var(--ink)' : '1px solid var(--border)', borderRadius: 13, padding: '14px 12px', background: 'var(--bg)', position: 'relative' }}>
            {plan.highlight && (
              <div style={{ position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)', background: 'var(--ink)', color: '#fff', fontSize: 8, fontWeight: 700, padding: '2px 9px', borderRadius: 99, whiteSpace: 'nowrap', letterSpacing: '0.06em' }}>POPULAR</div>
            )}
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-mute)', marginBottom: 5, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'monospace' }}>{plan.name}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.03em', lineHeight: 1 }}>{plan.price}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--ink-mute)' }}>/mo</span></div>
            <div style={{ fontSize: 10, color: 'var(--ink-mute)', margin: '5px 0 12px' }}>{plan.credits}</div>
            <div style={{ background: plan.highlight ? 'var(--ink)' : 'transparent', color: plan.highlight ? '#fff' : 'var(--ink)', border: plan.highlight ? 'none' : '1px solid var(--border)', borderRadius: 8, padding: '7px 0', fontSize: 11, fontWeight: 700, textAlign: 'center' }}>
              {plan.highlight ? 'Upgrade →' : 'Select'}
            </div>
          </div>
        ))}
      </div>
    </IlluWrap>
  )
}

// ── Step definitions ──────────────────────────────────────────────────────────
const STEPS: { Icon: () => React.ReactElement; label: string; title: string; body: ReactNode; illustration: React.ReactElement; tip: string | null; cta: string; href: string | null }[] = [
  {
    Icon: IconSpark,
    label: 'Welcome',
    title: 'Your AI content studio is ready.',
    illustration: <IlluDashboard />,
    body: <>ContentFlow turns your product into <strong>scroll-stopping ads</strong>, <strong>lifestyle shoots</strong>, and <strong>branded content</strong> — <strong>fully AI-generated</strong>. No photographer, no crew, no agency. Follow this short guide to set everything up correctly before you start creating.</>,
    tip: null,
    cta: 'Start the setup',
    href: null,
  },
  {
    Icon: IconBox,
    label: 'Product',
    title: 'Add your product first.',
    illustration: <IlluProductStudio />,
    body: <>Everything in ContentFlow is built around your product. Go to <strong>Studios → Products</strong>, upload your photos from <strong>multiple angles</strong>, and give it a name and description. The AI will use those <strong>reference photos</strong> in every shoot, ad, and campaign you run — so <strong>the more angles you provide, the better every result will look</strong>.</>,
    tip: 'Pro tip: upload at least 3 angles — front, back, and a detail shot. This dramatically improves consistency across all generated content.',
    cta: 'Open Product Studio',
    href: '/generate/products',
  },
  {
    Icon: IconPerson,
    label: 'Actor',
    title: 'Create your AI actor.',
    illustration: <IlluInfluencerStudio />,
    body: <>Your AI actor is the <strong>face of your brand content</strong>. Go to <strong>Studios → Influencers</strong> and <strong>let the AI generate a unique actor for you</strong> — just give it a name, personality, and niche. You can optionally upload a reference photo to guide the look. ContentFlow builds a full <strong>character sheet</strong> — a reusable identity that stays consistent across every ad, scene, and shoot.</>,
    tip: 'Pro tip: describe a specific look in the personality field — age, style, energy. The more precise you are, the more consistent your actor will be across shoots.',
    cta: 'Open Influencer Studio',
    href: '/influencers',
  },
  {
    Icon: IconCalendar,
    label: 'Campaign',
    title: 'Plan your campaign.',
    illustration: <IlluCampaigns />,
    body: <>Campaigns let you map out a <strong>full content strategy</strong> in one place. Select your product, pick your actor, choose a goal (launch, awareness, or conversion), and the AI generates a <strong>complete shot list with scripts and hooks</strong>. You can then generate each shot directly from the <strong>campaign planner</strong> without starting from scratch each time.</>,
    tip: 'Pro tip: build a launch campaign before your next product drop. It pre-generates 10–20 pieces of content you can deploy over weeks.',
    cta: 'Open Campaigns',
    href: '/campaigns',
  },
  {
    Icon: IconCamera,
    label: 'Shoot',
    title: 'Generate lifestyle content.',
    illustration: <IlluShooting />,
    body: <>With your product and actor saved, the Studios become your <strong>production engine</strong>. In <strong>Product Studio</strong> you can shoot your product in any aesthetic — golden hour lifestyle, studio white, street editorial, or custom scenes you describe. In <strong>Influencer Studio</strong>, shoot your actor in branded scenes, outfits, and settings. Every output is <strong>production-ready</strong>.</>,
    tip: 'Pro tip: create a Scene in Studios → Scenes first to lock in a specific environment. Then use that scene across multiple shoots for a cohesive look.',
    cta: 'Start shooting',
    href: '/generate/products',
  },
  {
    Icon: IconZap,
    label: 'Upgrade',
    title: 'Ready for UGC ads and video?',
    illustration: <IlluBilling />,
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

        {/* Step illustration */}
        {current.illustration}

        <div style={{ padding: '20px 24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

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

          {/* Icon + step label + body + tip + footer */}
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
