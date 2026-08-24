'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/auth'
import { Logo } from '@/components/Logo'

const plans = [
  {
    name: 'Free',
    price: { monthly: '$0', annual: '$0' },
    annualTotal: null,
    credits: '30 one-time signup credits',
    planKey: 'free',
    features: [
      '30 credits on sign-up (~6 images)',
      'Try every studio & tool',
      'AI image generator',
      'Social captions',
      'Business card generator',
      'Voiceover',
    ],
    cta: 'Start for free',
    ctaHref: '/auth/signup',
  },
  {
    name: 'Lite',
    price: { monthly: '$8', annual: '$7' },
    annualTotal: '$80/yr',
    credits: '300 credits/month',
    planKey: 'lite',
    features: [
      'Product photos & images',
      'AI Influencer Studio',
      'Social captions',
      'Voiceover',
      'Carousel maker',
      'Business card generator',
      'UGC & AI video generation',
    ],
    cta: 'Get Lite',
  },
  {
    name: 'Starter',
    price: { monthly: '$19', annual: '$16' },
    annualTotal: '$190/yr',
    credits: '800 credits/month',
    planKey: 'starter',
    features: [
      '~6 UGC videos/mo at 5s',
      '~160 product images/mo',
      '~100 AI influencer photos/mo',
      'AI Influencer Studio',
      'Product Studio',
      'No watermark · Video editor',
      'Priority support',
    ],
    cta: 'Get Starter',
  },
  {
    name: 'Pro',
    price: { monthly: '$49', annual: '$41' },
    annualTotal: '$490/yr',
    credits: '2,000 credits/month',
    planKey: 'pro',
    popular: true,
    features: [
      '~16 UGC videos/mo at 5s',
      '~400 product images/mo',
      '~250 AI influencer photos/mo',
      'Everything in Starter',
      'Shopify product import',
      'Campaign planner',
    ],
    cta: 'Get Pro',
  },
  {
    name: 'Agency',
    price: { monthly: '$149', annual: '$124' },
    annualTotal: '$1,490/yr',
    credits: '6,500 credits/month',
    planKey: 'agency',
    features: [
      '~52 UGC videos/mo at 5s',
      '~1,300 product images/mo',
      '~800 AI influencer photos/mo',
      'Everything in Pro',
      'Multiple brand profiles',
      'Dedicated support',
    ],
    cta: 'Get Agency',
  },
  {
    name: 'Enterprise',
    price: { monthly: '$605', annual: '$500' },
    annualTotal: '$6,000/yr',
    credits: '25,000 credits/month',
    planKey: 'enterprise',
    features: [
      '~200 UGC videos/mo at 5s',
      '~5,000 product images/mo',
      'Everything in Agency',
      'API access · White-label',
      '5 team seats · Priority queue',
      'Dedicated Slack & account manager',
    ],
    cta: 'Get Enterprise',
  },
]

// ─── Plan Recommender (public) ──────────────────────────────────────────────
type PubCTOption = { key: string; choices: string[]; default: string }
type PubContentType = { key: string; label: string; sub: string; color: string; crBase: number; opts?: PubCTOption[]; crMod?: (s: Record<string, string>) => number }

const _SD_720P  = (720  * 1280  * 24) / 1024 / 1_000_000 * 7
const _SD_1080P = (1080 * 1920  * 24) / 1024 / 1_000_000 * 7.7
const _SD_4K    = (2160 * 3840  * 24) / 1024 / 1_000_000 * 4.0
const _SD_480P  = (480  * 854   * 24) / 1024 / 1_000_000 * 5.5
const _PUB_MARKUP = 1.4; const _PUB_CR = 0.025; const _PUB_NB = 0.075; const _PUB_CL = 0.010
function pubSdCr(dur: number, perS: number) { return Math.ceil(((perS * dur) + _PUB_NB + _PUB_CL) * _PUB_MARKUP / _PUB_CR) }
const PUB_DUR: Record<string, number> = { '5s': 5, '8s': 8, '10s': 10, '15s': 15, '30s': 30 }

const CONTENT_TYPES_PUB: PubContentType[] = [
  { key: 'ugc', label: 'UGC Video', sub: 'Talking-head · 9:16', color: '#D97706', crBase: 48,
    opts: [{ key: 'duration', choices: ['5s','10s','15s','30s'], default: '5s' }, { key: 'quality', choices: ['480p','720p','1080p','4K'], default: '720p' }],
    crMod: (s) => { const perS = s.quality === '4K' ? _SD_4K : s.quality === '1080p' ? _SD_1080P : s.quality === '480p' ? _SD_480P : _SD_720P; return pubSdCr(PUB_DUR[s.duration] ?? 5, perS) } },
  { key: 'budget-ugc', label: 'Budget UGC', sub: 'Seedance Mini · 9:16', color: '#7C3AED', crBase: 40,
    opts: [{ key: 'duration', choices: ['5s','8s','10s'], default: '5s' }],
    crMod: (s) => s.duration === '10s' ? 72 : s.duration === '8s' ? 60 : 40 },
  { key: 'image', label: 'Product Image', sub: 'AI photo · studio shot', color: '#0EA5E9', crBase: 5,
    opts: [{ key: 'quality', choices: ['Budget (NB2)','Standard (NBPro 2K)','4K (NBPro 4K)'], default: 'Budget (NB2)' }],
    crMod: (s) => s.quality === '4K (NBPro 4K)' ? 18 : s.quality === 'Standard (NBPro 2K)' ? 9 : 5 },
  { key: 'influencer', label: 'AI Influencer', sub: 'Lifestyle · portrait', color: '#EC4899', crBase: 8,
    opts: [{ key: 'quality', choices: ['Budget (NB2)','Standard (NBPro 2K)','4K (NBPro 4K)'], default: 'Budget (NB2)' }],
    crMod: (s) => s.quality === '4K (NBPro 4K)' ? 26 : s.quality === 'Standard (NBPro 2K)' ? 14 : 8 },
  { key: 'cinematic', label: 'Cinematic Video', sub: 'Kling · scene video', color: '#10B981', crBase: 140,
    opts: [{ key: 'duration', choices: ['5s','10s','15s'], default: '5s' }, { key: 'quality', choices: ['720p','1080p','4K'], default: '720p' }],
    crMod: (s) => Math.round(140 * (s.duration === '15s' ? 2 : s.duration === '10s' ? 1.5 : 1) * (s.quality === '4K' ? 2.2 : s.quality === '1080p' ? 1.35 : 1)) },
  { key: 'voiceover', label: 'Voiceover', sub: 'ElevenLabs · per clip', color: '#6366F1', crBase: 10,
    opts: [{ key: 'duration', choices: ['30s','60s','90s','120s'], default: '30s' }],
    crMod: (s) => s.duration === '120s' ? 28 : s.duration === '90s' ? 22 : s.duration === '60s' ? 16 : 10 },
  { key: 'social', label: 'Social Post', sub: 'AI copywriting', color: '#F59E0B', crBase: 5 },
  { key: 'carousel', label: 'Carousel', sub: 'AI slides · per carousel', color: '#EC4899', crBase: 30,
    opts: [{ key: 'slides', choices: ['4','6','8','10'], default: '6' }, { key: 'model', choices: ['Budget (NB2)','Standard (NBPro)'], default: 'Standard (NBPro)' }],
    crMod: (s) => (parseInt(s.slides) || 6) * (s.model === 'Budget (NB2)' ? 3 : 5) },
]

function pubGetCrEach(t: PubContentType, sel: Record<string, string>): number {
  if (t.crMod) { const defs = Object.fromEntries((t.opts ?? []).map(o => [o.key, o.default])); return t.crMod({ ...defs, ...sel }) }
  return t.crBase
}

const PUB_CAPS: Record<string, number> = { lite: 300, starter: 800, pro: 2000, agency: 6500, enterprise: 25000 }
const PUB_PRICES: Record<string, { name: string; monthly: string; annual: string; planKey: string }> = {
  lite:       { name: 'Lite',       monthly: '$8',   annual: '$7',   planKey: 'lite'       },
  starter:    { name: 'Starter',    monthly: '$19',  annual: '$16',  planKey: 'starter'    },
  pro:        { name: 'Pro',        monthly: '$49',  annual: '$41',  planKey: 'pro'        },
  agency:     { name: 'Agency',     monthly: '$149', annual: '$124', planKey: 'agency'     },
  enterprise: { name: 'Enterprise', monthly: '$605', annual: '$500', planKey: 'enterprise' },
}

function PlanRecommenderPub({ annual }: { annual: boolean }) {
  const [selected, setSelected] = useState<string[]>([])
  const [qty, setQty] = useState<Record<string, number>>({})
  const [typeOpts, setTypeOpts] = useState<Record<string, Record<string, string>>>({})
  const [step, setStep] = useState(1)

  function getOpts(key: string): Record<string, string> {
    const t = CONTENT_TYPES_PUB.find(x => x.key === key)!
    return { ...Object.fromEntries((t.opts ?? []).map(o => [o.key, o.default])), ...(typeOpts[key] ?? {}) }
  }

  const selTypes = CONTENT_TYPES_PUB.filter(t => selected.includes(t.key))
  const totalCr = selTypes.reduce((s, t) => s + pubGetCrEach(t, getOpts(t.key)) * (qty[t.key] ?? 1), 0)

  function toggle(key: string) {
    setSelected(p => p.includes(key) ? p.filter(k => k !== key) : [...p, key])
    if (!qty[key]) setQty(q => ({ ...q, [key]: 1 }))
  }
  function setOpt(typeKey: string, optKey: string, val: string) {
    setTypeOpts(prev => ({ ...prev, [typeKey]: { ...getOpts(typeKey), [optKey]: val } }))
  }
  function bump(key: string, d: number) { setQty(q => ({ ...q, [key]: Math.max(1, (q[key] ?? 1) + d) })) }

  function getRecKey() {
    if (!selTypes.length) return ''
    if (totalCr > PUB_CAPS.agency) return 'enterprise'
    if (totalCr > PUB_CAPS.pro) return 'agency'
    if (totalCr > PUB_CAPS.starter) return 'pro'
    if (totalCr > PUB_CAPS.lite) return 'starter'
    return 'lite'
  }
  const recKey = getRecKey()
  const rec = recKey ? PUB_PRICES[recKey] : null
  const cap = recKey ? PUB_CAPS[recKey] : 0
  const pct = cap ? Math.min((totalCr / cap) * 100, 100) : 0

  return (
    <div style={{ marginBottom: 64, borderRadius: 20, overflow: 'hidden', border: '1px solid var(--border, #e5e7eb)', background: 'var(--surface, #fff)' }}>
      <div style={{ padding: '22px 28px', borderBottom: '1px solid var(--border, #e5e7eb)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 3 }}>Find the right plan for you</div>
          <div style={{ fontSize: 13, color: 'var(--ink-dim, #666)' }}>Select what you create — we'll calculate the credits you need.</div>
        </div>
        {selTypes.length > 0 && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep(1)} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: step === 1 ? '#111' : '#f3f4f6', color: step === 1 ? '#fff' : '#6b7280' }}>1 · Content</button>
            <button onClick={() => setStep(2)} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: step === 2 ? '#111' : '#f3f4f6', color: step === 2 ? '#fff' : '#6b7280' }}>2 · Volume</button>
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px' }}>
        {/* Left */}
        <div style={{ padding: '24px 28px', borderRight: '1px solid var(--border, #e5e7eb)' }}>
          {step === 1 ? (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 14 }}>What do you want to create?</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
                {CONTENT_TYPES_PUB.map(t => {
                  const active = selected.includes(t.key)
                  const opts = getOpts(t.key)
                  const crNow = pubGetCrEach(t, opts)
                  return (
                    <div key={t.key} style={{ borderRadius: 12, border: `1.5px solid ${active ? t.color : '#e5e7eb'}`, background: active ? `${t.color}12` : '#f9fafb', overflow: 'hidden', transition: 'border-color 0.15s' }}>
                      <button onClick={() => toggle(t.key)} style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px 10px', textAlign: 'left', cursor: 'pointer', background: 'transparent', border: 'none', position: 'relative' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, flexShrink: 0, marginTop: 4 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 2 }}>{t.label}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>{t.sub}</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: t.color, marginTop: 4, fontFamily: 'monospace' }}>{crNow} cr each</div>
                        </div>
                        {active && (
                          <div style={{ width: 16, height: 16, borderRadius: '50%', background: t.color, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                          </div>
                        )}
                      </button>
                      {active && t.opts && t.opts.length > 0 && (
                        <div style={{ padding: '0 12px 10px', display: 'flex', flexWrap: 'wrap', gap: 6 }} onClick={e => e.stopPropagation()}>
                          {t.opts.map(opt => (
                            <div key={opt.key} style={{ display: 'flex', gap: 3 }}>
                              {opt.choices.map(choice => {
                                const sel = opts[opt.key] === choice
                                return (
                                  <button key={choice} onClick={e => { e.stopPropagation(); setOpt(t.key, opt.key, choice) }} style={{
                                    padding: '3px 8px', borderRadius: 5, fontSize: 10.5, fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s',
                                    border: `1px solid ${sel ? t.color : '#e5e7eb'}`, background: sel ? t.color : 'transparent', color: sel ? '#fff' : '#6b7280',
                                  }}>{choice}</button>
                                )
                              })}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {selTypes.length > 0 && (
                <button onClick={() => setStep(2)} style={{ marginTop: 18, padding: '9px 20px', borderRadius: 9, fontSize: 13, fontWeight: 600, background: '#111', color: '#fff', border: 'none', cursor: 'pointer' }}>
                  Set quantities →
                </button>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 14 }}>How many per month?</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selTypes.map(t => {
                  const q = qty[t.key] ?? 1
                  const opts = getOpts(t.key)
                  const crNow = pubGetCrEach(t, opts)
                  const optSummary = t.opts ? t.opts.map(o => opts[o.key]).join(' · ') : ''
                  return (
                    <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 12, border: '1px solid #e5e7eb', background: '#f9fafb' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{t.label}{optSummary ? <span style={{ fontSize: 11, fontWeight: 400, color: '#9ca3af', marginLeft: 6 }}>{optSummary}</span> : null}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{crNow} cr × {q} = <span style={{ fontWeight: 700, color: t.color }}>{crNow * q} cr</span></div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                        <button onClick={() => bump(t.key, -1)} style={{ width: 32, height: 32, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16 }}>−</button>
                        <span style={{ minWidth: 28, textAlign: 'center', fontSize: 13, fontWeight: 700 }}>{q}</span>
                        <button onClick={() => bump(t.key, 1)} style={{ width: 32, height: 32, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16 }}>+</button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 12, background: '#f3f4f6', border: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#6b7280' }}>Estimated monthly credits</span>
                <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em', fontFamily: 'monospace' }}>{totalCr.toLocaleString()} cr</span>
              </div>
            </>
          )}
        </div>
        {/* Right */}
        <div style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column' }}>
          {!selTypes.length ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', textAlign: 'center', gap: 10 }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 12h6M12 9v6"/></svg>
              <span style={{ fontSize: 13 }}>Select content types<br/>to see a recommendation</span>
            </div>
          ) : rec ? (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 14 }}>We recommend</div>
              <div style={{ background: '#f9fafb', borderRadius: 14, padding: '18px', border: '1.5px solid #111', marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{rec.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 10 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>{annual ? rec.annual : rec.monthly}</span>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>/mo</span>
                </div>
                <div style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginBottom: 5 }}>
                    <span>Expected usage</span>
                    <span style={{ fontWeight: 700, color: pct > 80 ? '#EF4444' : pct > 60 ? '#F59E0B' : '#10B981' }}>{totalCr.toLocaleString()} / {cap.toLocaleString()} cr</span>
                  </div>
                  <div style={{ height: 5, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 99, width: `${pct}%`, background: pct > 80 ? '#EF4444' : pct > 60 ? '#F59E0B' : '#10B981', transition: 'width 0.35s ease' }} />
                  </div>
                </div>
              </div>
              <Link href="/auth/signup" style={{ display: 'block', textAlign: 'center', width: '100%', padding: '11px', borderRadius: 10, border: 'none', background: '#111', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', letterSpacing: '-0.01em', textDecoration: 'none', marginTop: 'auto' }}>
                Get {rec.name} →
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

const comparison = [
  ['Starting price', '$19/mo', '$110/mo', '$39/mo',  '$29/mo',  '$15/mo'],
  ['UGC video',         '✓',      '✓',       '✓',       '~',       '✓'],
  ['Product photos',    '✓',      '✗',       '✗',       '✗',       '✗'],
  ['Social copy',       '✓',      '✗',       '✗',       '✗',       '✗'],
  ['Blog + carousel',   '✓',      '✗',       '✗',       '✗',       '✗'],
  ['Brand persistence', '✓',      '✗',       '✗',       '✗',       '✗'],
  ['URL → ad',          '✓',      '~',       '✓',       '✗',       '✓'],
]

const faqs = [
  { q: 'What are credits?', a: 'Credits are consumed when you generate content — images, videos, influencer photos, voiceovers, and more. Each tool has a fixed credit cost shown in the app.' },
  { q: 'Do credits roll over?', a: 'Monthly plan credits reset each billing period. One-time credit pack purchases never expire and survive plan changes.' },
  { q: 'Can I change my plan anytime?', a: 'Yes — upgrade or downgrade at any time. Changes take effect immediately and your balance is adjusted accordingly.' },
  { q: 'Is there a free trial?', a: 'Yes — sign up for free and receive 30 credits immediately. No credit card required.' },
]

export default function PricingPage() {
  const [annual, setAnnual] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)

  useEffect(() => {
    // Pricing page uses light mode
    document.documentElement.removeAttribute('data-theme')
  }, [])

  async function handleCta(plan: typeof plans[number]) {
    if (plan.planKey === 'free') {
      window.location.href = plan.ctaHref ?? '/auth/signup'
      return
    }
    setLoading(plan.planKey)
    try {
      const supabase = getSupabase()
      const { data } = await supabase!.auth.getSession()
      const token = data?.session?.access_token
      if (!token) {
        window.location.href = '/auth/login?redirect=/pricing'
        return
      }
      const res = await fetch('/api/dodo/checkout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey: plan.planKey, annual }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Checkout failed')
      window.location.href = json.url
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #fff)', color: 'var(--ink, #111)', fontFamily: 'var(--font-sans, system-ui)' }}>

      {/* Nav */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', background: 'color-mix(in srgb, var(--bg) 82%, transparent)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ink)', textDecoration: 'none' }}>
            <span style={{ width: 42, height: 42, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Logo size={42} /></span>
            <span style={{ fontSize: 15, color: 'var(--ink)' }}>Content<em>flow</em></span>
          </Link>
          <nav style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link href="/#features" style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink-mute)', textDecoration: 'none', padding: '6px 12px', borderRadius: 8 }}>Features</Link>
            <Link href="/pricing" style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)', textDecoration: 'none', padding: '6px 12px', borderRadius: 8 }}>Pricing</Link>
            <Link href="/help" style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink-mute)', textDecoration: 'none', padding: '6px 12px', borderRadius: 8 }}>Docs</Link>
          </nav>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link href="/auth/login" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-mute)', textDecoration: 'none' }}>Sign in</Link>
            <Link href="/auth/signup" style={{ fontSize: 13, fontWeight: 600, color: '#fff', background: '#b91c1c', borderRadius: 9, padding: '9px 18px', textDecoration: 'none', whiteSpace: 'nowrap' }}>Get started</Link>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 80px' }}>

        {/* Hero */}
        <div style={{ textAlign: 'center', padding: '64px 0 48px' }}>
          <h1 style={{ fontFamily: 'var(--font-serif, Georgia)', fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 400, letterSpacing: '-0.03em', margin: '0 0 16px', lineHeight: 1.1 }}>
            Simple, transparent <em style={{ color: '#b91c1c' }}>pricing</em>
          </h1>
          <p style={{ fontSize: 17, color: 'var(--ink-dim, #666)', maxWidth: 480, margin: '0 auto 36px', lineHeight: 1.6 }}>
            One platform for AI images, UGC videos, social captions, carousels, voiceovers, and more.
          </p>

          {/* Toggle */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'var(--surface, #f9f9f9)', border: '1px solid var(--border, #e5e7eb)', borderRadius: 999, padding: '6px 14px' }}>
            <span style={{ fontSize: 13, fontWeight: annual ? 400 : 700 }}>Monthly</span>
            <button
              onClick={() => setAnnual(a => !a)}
              style={{ position: 'relative', width: 40, height: 22, borderRadius: 999, border: 'none', cursor: 'pointer', background: annual ? '#111' : '#ddd', transition: 'background 0.2s', flexShrink: 0 }}
            >
              <span style={{ position: 'absolute', top: 3, left: annual ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: annual ? '#fff' : '#888', transition: 'left 0.2s', display: 'block' }} />
            </button>
            <span style={{ fontSize: 13, fontWeight: annual ? 700 : 400 }}>Annual</span>
            <span style={{ fontSize: 10, fontWeight: 700, background: '#F1E6C9', color: '#8A6420', borderRadius: 6, padding: '3px 9px', letterSpacing: '0.04em' }}>2 months free</span>
          </div>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, background: '#fef3c7', color: '#92400e', borderRadius: 6, padding: '3px 10px', letterSpacing: '0.04em' }}>Early launch pricing</span>
            <span style={{ fontSize: 11, color: 'var(--ink-mute, #999)' }}>All prices include taxes &amp; payment fees</span>
          </div>
        </div>

        {/* Plan cards */}
        <div className="pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14, marginBottom: 64 }}>
          {plans.map(plan => {
            const price = annual ? plan.price.annual : plan.price.monthly
            const isLoading = loading === plan.planKey
            return (
              <div key={plan.planKey} style={{
                position: 'relative',
                border: `1.5px solid ${plan.popular ? '#b91c1c' : 'var(--border, #e5e7eb)'}`,
                borderRadius: 18,
                padding: '24px 20px',
                background: 'var(--surface, #fff)',
                display: 'flex',
                flexDirection: 'column',
              }}>
                {plan.popular && (
                  <span style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: '#b91c1c', color: '#fff', borderRadius: 999, padding: '3px 12px', whiteSpace: 'nowrap' }}>
                    Most popular
                  </span>
                )}
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{plan.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                  {annual && plan.planKey !== 'free' && (
                    <span style={{ fontSize: 16, color: 'var(--ink-mute, #aaa)', textDecoration: 'line-through', fontWeight: 400, lineHeight: 1 }}>{plan.price.monthly}</span>
                  )}
                  <span style={{ fontFamily: 'var(--font-serif, Georgia)', fontStyle: 'italic', fontSize: 36, fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1 }}>{price}</span>
                  {plan.planKey !== 'free' && <span style={{ fontSize: 13, color: 'var(--ink-mute, #999)' }}>/mo</span>}
                </div>
                {annual && plan.annualTotal && (
                  <div style={{ fontSize: 11, color: 'var(--ink-mute, #999)', marginBottom: 4 }}>billed {plan.annualTotal}</div>
                )}
                <div style={{ fontSize: 12, color: 'var(--ink-dim, #666)', marginBottom: 20 }}>{plan.credits}</div>

                <button
                  onClick={() => handleCta(plan)}
                  disabled={isLoading}
                  style={{
                    width: '100%', padding: '10px', borderRadius: 10, marginBottom: 22,
                    border: plan.popular ? 'none' : '1.5px solid var(--border, #e5e7eb)',
                    background: plan.popular ? '#b91c1c' : 'transparent',
                    color: plan.popular ? '#fff' : 'var(--ink, #111)',
                    fontWeight: 600, fontSize: 13, cursor: 'pointer',
                    opacity: isLoading ? 0.6 : 1,
                  }}
                >
                  {isLoading ? 'Redirecting…' : plan.cta}
                </button>

                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {plan.features.map(f => {
                    const isNegative = f.startsWith('No ')
                    return (
                      <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: isNegative ? 'var(--ink-mute, #999)' : 'var(--ink-dim, #555)', lineHeight: 1.4 }}>
                        {isNegative ? (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                            <path d="M18 6L6 18M6 6l12 12"/>
                          </svg>
                        ) : (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                            <path d="M20 6L9 17l-5-5"/>
                          </svg>
                        )}
                        {f}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
        <style>{`
          @media (max-width: 1300px) { .pricing-grid { grid-template-columns: repeat(3, 1fr) !important; } }
          @media (max-width: 700px)  { .pricing-grid { grid-template-columns: repeat(2, 1fr) !important; } }
          @media (max-width: 480px)  { .pricing-grid { grid-template-columns: 1fr !important; } }
        `}</style>

        {/* Plan recommender */}
        <PlanRecommenderPub annual={annual} />

        {/* Credit packs */}
        <div style={{ marginBottom: 64 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 6 }}>Need more credits?</h2>
          <p style={{ fontSize: 14, color: 'var(--ink-dim, #666)', marginBottom: 8, marginTop: 0 }}>One-off credit boosts — stack on top of your monthly allowance, never expire, and survive plan changes.</p>
          <p style={{ fontSize: 13, color: 'var(--ink-dim, #666)', marginBottom: 24, marginTop: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Available on <strong>Starter plan and above</strong> — not available on Free or Lite.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {[
              { credits: 350,  price: '$8',   perCr: '$0.023/cr' },
              { credits: 700,  price: '$15',  perCr: '$0.021/cr' },
              { credits: 2000, price: '$45',  perCr: '$0.023/cr' },
              { credits: 6000, price: '$130', perCr: '$0.022/cr' },
            ].map(pack => (
              <div key={pack.credits} style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 14, padding: '18px 20px', background: 'var(--surface, #fff)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{pack.credits.toLocaleString()} credits</div>
                <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>{pack.price}</div>
                <Link href="/auth/signup" style={{ display: 'block', textAlign: 'center', padding: '8px', borderRadius: 8, border: '1.5px solid var(--border, #e5e7eb)', fontSize: 13, fontWeight: 600, color: 'var(--ink, #111)', textDecoration: 'none' }}>
                  Buy credits
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Comparison */}
        <div style={{ marginBottom: 64, border: '1px solid var(--border, #e5e7eb)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '22px 28px', borderBottom: '1px solid var(--border, #e5e7eb)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>How we compare</h2>
            <p style={{ fontSize: 13, color: 'var(--ink-mute, #999)', margin: '4px 0 0' }}>ContentFlow vs. the alternatives — same job, lower cost.</p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['', 'ContentFlow', 'Arcads', 'Creatify', 'HeyGen', 'Higgsfield'].map((h, i) => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: i === 0 ? 'left' : 'center', fontWeight: 700, color: i === 1 ? 'var(--ink, #111)' : 'var(--ink-mute, #999)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border, #e5e7eb)', background: i === 1 ? 'rgba(0,0,0,0.02)' : 'transparent' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparison.map(([feature, cf, ...rest]) => (
                  <tr key={feature} style={{ borderBottom: '1px solid var(--border, #e5e7eb)' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--ink-dim, #555)' }}>{feature}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, color: cf === '✓' ? '#16a34a' : cf === '✗' ? '#dc2626' : 'var(--ink, #111)', background: 'rgba(0,0,0,0.02)' }}>{cf}</td>
                    {rest.map((v, i) => (
                      <td key={i} style={{ padding: '10px 16px', textAlign: 'center', color: v === '✓' ? '#16a34a' : v === '✗' ? '#dc2626' : 'var(--ink-mute, #999)' }}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div style={{ marginBottom: 64 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 24 }}>Frequently asked questions</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 28 }}>
            {faqs.map(({ q, a }) => (
              <div key={q}>
                <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 6px' }}>{q}</p>
                <p style={{ fontSize: 13.5, color: 'var(--ink-dim, #666)', margin: 0, lineHeight: 1.6 }}>{a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div style={{ textAlign: 'center', padding: '56px 32px', border: '1px solid var(--border, #e5e7eb)', borderRadius: 20, background: 'var(--surface, #f9f9f9)' }}>
          <h2 style={{ fontFamily: 'var(--font-serif, Georgia)', fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 400, letterSpacing: '-0.03em', margin: '0 0 12px', lineHeight: 1.2 }}>
            Start creating in <em>minutes</em>
          </h2>
          <p style={{ fontSize: 15, color: 'var(--ink-dim, #666)', margin: '0 0 28px' }}>No credit card required for the free plan.</p>
          <Link href="/auth/signup" style={{ display: 'inline-block', padding: '13px 32px', borderRadius: 12, background: '#111', color: '#fff', fontWeight: 700, fontSize: 15, textDecoration: 'none', letterSpacing: '-0.01em' }}>
            Get started free →
          </Link>
        </div>
      </div>
    </div>
  )
}
