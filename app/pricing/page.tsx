'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/auth'
import { Logo } from '@/components/Logo'
import { ugcPackageCost } from '@/lib/ugc-pricing'

// ─── Plans ─────────────────────────────────────────────────────────────────
// Prices and credit allowances mirror lib/credits.ts and the Dodo products.
// Everything shown about value ($ per credit, $ per ad) is calculated from these.
type Plan = {
  name: string
  planKey: string
  tagline: string
  monthly: number          // USD per month when billed monthly
  annualTotal: number      // USD per year when billed yearly (0 = n/a)
  credits: number          // credits per month (Free: one-time at signup)
  features: string[]
  cta: string
  tag?: string
  dark?: boolean
}

// One 5-second 720p UGC ad, charged exactly like the builder does.
const UGC5 = ugcPackageCost(5, '720p')
const UGC10 = ugcPackageCost(10, '720p')
// A draft ad: Seedance Mini at 720p, one starting frame.
const DRAFT5 = ugcPackageCost(5, '720p', 'seedance-mini')

const plans: Plan[] = [
  { name: 'Free', planKey: 'free', tagline: 'One preview ad. No card.', monthly: 0, annualTotal: 0, credits: 30,
    features: ['30 credits on signup', 'One preview ad from any product URL', `${Math.floor(30 / DRAFT5) === 1 ? 'One draft ad' : `About ${Math.floor(30 / DRAFT5)} draft ads`}, or images and captions`, 'No card required'], cta: 'Start free' },
  { name: 'Lite', planKey: 'lite', tagline: 'One product a week. Test the tool.', monthly: 8, annualTotal: 80, credits: 300,
    features: ['Product photos, carousels, captions', 'AI Influencer Studio', 'Voice and captions in 18 languages', 'Credits roll over'], cta: 'Get Lite' },
  { name: 'Starter', planKey: 'starter', tagline: 'Test 10 hooks per month, on-brand.', monthly: 19, annualTotal: 190, credits: 800,
    features: ['Batch generation of hook variants', 'Full Product Studio', 'Video editor', 'Credits roll over'], cta: 'Get Starter' },
  { name: 'Pro', planKey: 'pro', tagline: 'Ship a week of ads at a time.', monthly: 49, annualTotal: 490, credits: 2000, tag: 'Best for weekly ads', dark: true,
    features: ['Shopify product import', 'Campaign planner', 'Everything in Starter'], cta: 'Get Pro' },
  { name: 'Agency', planKey: 'agency', tagline: 'High volume, every format.', monthly: 149, annualTotal: 1490, credits: 6500,
    features: ['Everything in Pro', 'Email support from the founder'], cta: 'Get Agency' },
]

const paidPlans = plans.filter(p => p.monthly > 0)

function metrics(p: Plan, annual: boolean) {
  const eff = annual && p.annualTotal ? p.annualTotal / 12 : p.monthly
  const perCredit = p.credits ? eff / p.credits : 0
  return { eff, perCredit, perAd: perCredit * UGC5, ads: Math.floor(p.credits / UGC5) }
}
const usd = (n: number, d = 2) => `$${n.toFixed(d)}`
const shownPrice = (p: Plan, annual: boolean) => (p.monthly === 0 ? '$0' : `$${Math.round(annual && p.annualTotal ? p.annualTotal / 12 : p.monthly)}`)

type PubCTOption = { key: string; choices: string[]; default: string }
type PubContentType = { key: string; label: string; sub: string; color: string; crBase: number; opts?: PubCTOption[]; crMod?: (s: Record<string, string>) => number }

// UGC costs come from the same function the builder charges with.
const UGC_RES: Record<string, '480p' | '720p' | '1080p' | '4k'> = { '480p': '480p', '720p': '720p', '1080p': '1080p', '4K': '4k' }
const PUB_DUR: Record<string, number> = { '5s': 5, '8s': 8, '10s': 10, '15s': 15, '30s': 30 }
// Standalone video generator: credits per second by resolution.
const VIDEO_PER_S: Record<string, number> = { '720p': 13, '1080p': 33, '4K': 72 }

const CONTENT_TYPES_PUB: PubContentType[] = [
  { key: 'ugc', label: 'UGC Video', sub: 'Talking-head · 9:16', color: '#A3231F', crBase: 55,
    opts: [{ key: 'duration', choices: ['5s','10s','15s','30s'], default: '5s' }, { key: 'quality', choices: ['480p','720p','1080p','4K'], default: '720p' }],
    crMod: (s) => ugcPackageCost(PUB_DUR[s.duration] ?? 5, UGC_RES[s.quality] ?? '720p') },
  { key: 'budget-ugc', label: 'Draft UGC', sub: 'Seedance Mini · 720p · 9:16', color: '#C9A94F', crBase: ugcPackageCost(5, '720p', 'seedance-mini'),
    opts: [{ key: 'duration', choices: ['5s','10s'], default: '5s' }],
    crMod: (s) => ugcPackageCost(PUB_DUR[s.duration] ?? 5, '720p', 'seedance-mini') },
  { key: 'image', label: 'Product Image', sub: 'AI photo · studio shot', color: '#6B7A99', crBase: 5,
    opts: [{ key: 'quality', choices: ['Budget (NB2)','Standard (NBPro 2K)','4K (NBPro 4K)'], default: 'Budget (NB2)' }],
    crMod: (s) => s.quality === '4K (NBPro 4K)' ? 18 : s.quality === 'Standard (NBPro 2K)' ? 10 : 5 },
  { key: 'influencer', label: 'AI Influencer', sub: 'Lifestyle · portrait', color: '#8E6E95', crBase: 8,
    opts: [{ key: 'quality', choices: ['Budget (NB2)','Standard (NBPro 2K)','4K (NBPro 4K)'], default: 'Budget (NB2)' }],
    crMod: (s) => s.quality === '4K (NBPro 4K)' ? 26 : s.quality === 'Standard (NBPro 2K)' ? 14 : 8 },
  { key: 'cinematic', label: 'Cinematic Video', sub: 'Seedance · scene video', color: '#4F8A8B', crBase: 65,
    opts: [{ key: 'duration', choices: ['5s','10s','15s'], default: '5s' }, { key: 'quality', choices: ['720p','1080p','4K'], default: '720p' }],
    crMod: (s) => (PUB_DUR[s.duration] ?? 5) * (VIDEO_PER_S[s.quality] ?? 13) },
  { key: 'voiceover', label: 'Voiceover', sub: 'ElevenLabs · per clip', color: '#7C9A82', crBase: 6,
    opts: [{ key: 'duration', choices: ['30s','60s','90s','120s'], default: '30s' }],
    crMod: (s) => Math.max(5, Math.ceil((parseInt(s.duration) || 30) * 15 / 80)) },
  { key: 'social', label: 'Social Post', sub: 'AI copywriting', color: '#D98E5F', crBase: 5 },
  { key: 'carousel', label: 'Carousel', sub: 'AI slides · per carousel', color: '#B4776A', crBase: 30,
    opts: [{ key: 'slides', choices: ['4','6','8','10'], default: '6' }, { key: 'model', choices: ['Budget (NB2)','Standard (NBPro)'], default: 'Standard (NBPro)' }],
    crMod: (s) => (parseInt(s.slides) || 6) * (s.model === 'Budget (NB2)' ? 3 : 5) },
]

function pubGetCrEach(t: PubContentType, sel: Record<string, string>): number {
  if (t.crMod) { const defs = Object.fromEntries((t.opts ?? []).map(o => [o.key, o.default])); return t.crMod({ ...defs, ...sel }) }
  return t.crBase
}

const PUB_CAPS: Record<string, number> = { lite: 300, starter: 800, pro: 2000, agency: 6500 }
const PUB_PRICES: Record<string, { name: string; monthly: string; annual: string; planKey: string }> = {
  lite:    { name: 'Lite',    monthly: '$8',   annual: '$7',   planKey: 'lite'    },
  starter: { name: 'Starter', monthly: '$19',  annual: '$16',  planKey: 'starter' },
  pro:     { name: 'Pro',     monthly: '$49',  annual: '$41',  planKey: 'pro'     },
  agency:  { name: 'Agency',  monthly: '$149', annual: '$124', planKey: 'agency'  },
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
    <div style={{ marginBottom: 0, borderRadius: 28, overflow: 'hidden', border: '1px solid var(--border, #E2DCD1)', background: 'var(--surface, #FBFAF7)' }}>
      <div style={{ padding: '22px 28px', borderBottom: '1px solid var(--border, #E2DCD1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 3 }}>How many ads will you ship?</div>
          <div style={{ fontSize: 13, color: 'var(--ink-dim, #666)' }}>Tell us your monthly mix — we&apos;ll show the plan that fits without burning credits.</div>
        </div>
        {selTypes.length > 0 && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep(1)} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: step === 1 ? '#1A1714' : '#ECE7DE', color: step === 1 ? '#fff' : '#4A443D' }}>1 · Content</button>
            <button onClick={() => setStep(2)} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: step === 2 ? '#1A1714' : '#ECE7DE', color: step === 2 ? '#fff' : '#4A443D' }}>2 · Volume</button>
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px' }}>
        {/* Left */}
        <div style={{ padding: '24px 28px', borderRight: '1px solid var(--border, #E2DCD1)' }}>
          {step === 1 ? (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#857D72', marginBottom: 14 }}>What do you want to create?</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
                {CONTENT_TYPES_PUB.map(t => {
                  const active = selected.includes(t.key)
                  const opts = getOpts(t.key)
                  const crNow = pubGetCrEach(t, opts)
                  return (
                    <div key={t.key} style={{ borderRadius: 12, border: `1.5px solid ${active ? t.color : '#E2DCD1'}`, background: active ? `${t.color}12` : '#FBFAF7', overflow: 'hidden', transition: 'border-color 0.15s' }}>
                      <button onClick={() => toggle(t.key)} style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px 10px', textAlign: 'left', cursor: 'pointer', background: 'transparent', border: 'none', position: 'relative' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, flexShrink: 0, marginTop: 4 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1714', marginBottom: 2 }}>{t.label}</div>
                          <div style={{ fontSize: 11, color: '#857D72' }}>{t.sub}</div>
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
                                    border: `1px solid ${sel ? t.color : '#E2DCD1'}`, background: sel ? t.color : 'transparent', color: sel ? '#fff' : '#4A443D',
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
                <button onClick={() => setStep(2)} style={{ marginTop: 18, padding: '9px 20px', borderRadius: 9, fontSize: 13, fontWeight: 600, background: '#1A1714', color: '#fff', border: 'none', cursor: 'pointer' }}>
                  Set quantities →
                </button>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#857D72', marginBottom: 14 }}>How many per month?</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selTypes.map(t => {
                  const q = qty[t.key] ?? 1
                  const opts = getOpts(t.key)
                  const crNow = pubGetCrEach(t, opts)
                  const optSummary = t.opts ? t.opts.map(o => opts[o.key]).join(' · ') : ''
                  return (
                    <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 12, border: '1px solid #E2DCD1', background: '#FBFAF7' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{t.label}{optSummary ? <span style={{ fontSize: 11, fontWeight: 400, color: '#857D72', marginLeft: 6 }}>{optSummary}</span> : null}</div>
                        <div style={{ fontSize: 11, color: '#857D72' }}>{crNow} cr × {q} = <span style={{ fontWeight: 700, color: t.color }}>{crNow * q} cr</span></div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #E2DCD1', borderRadius: 8, overflow: 'hidden' }}>
                        <button onClick={() => bump(t.key, -1)} style={{ width: 32, height: 32, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16 }}>−</button>
                        <span style={{ minWidth: 28, textAlign: 'center', fontSize: 13, fontWeight: 700 }}>{q}</span>
                        <button onClick={() => bump(t.key, 1)} style={{ width: 32, height: 32, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16 }}>+</button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 12, background: '#ECE7DE', border: '1px solid #E2DCD1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#4A443D' }}>Estimated monthly credits</span>
                <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em', fontFamily: 'monospace' }}>{totalCr.toLocaleString()} cr</span>
              </div>
            </>
          )}
        </div>
        {/* Right */}
        <div style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column' }}>
          {!selTypes.length ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#857D72', textAlign: 'center', gap: 10 }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 12h6M12 9v6"/></svg>
              <span style={{ fontSize: 13 }}>Select content types<br/>to see a recommendation</span>
            </div>
          ) : rec ? (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#857D72', marginBottom: 14 }}>We recommend</div>
              <div style={{ background: '#FBFAF7', borderRadius: 14, padding: '18px', border: '1.5px solid #1A1714', marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{rec.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 10 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>{annual ? rec.annual : rec.monthly}</span>
                  <span style={{ fontSize: 12, color: '#857D72' }}>/mo</span>
                </div>
                <div style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#857D72', marginBottom: 5 }}>
                    <span>Expected usage</span>
                    <span style={{ fontWeight: 700, color: pct > 80 ? '#EF4444' : pct > 60 ? '#F59E0B' : '#10B981' }}>{totalCr.toLocaleString()} / {cap.toLocaleString()} cr</span>
                  </div>
                  <div style={{ height: 5, background: '#E2DCD1', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 99, width: `${pct}%`, background: pct > 80 ? '#EF4444' : pct > 60 ? '#F59E0B' : '#10B981', transition: 'width 0.35s ease' }} />
                  </div>
                </div>
              </div>
              <Link href="/auth/signup" style={{ display: 'block', textAlign: 'center', width: '100%', padding: '12px', borderRadius: 999, border: 'none', background: '#1A1714', color: '#fff', fontWeight: 500, fontSize: 14, cursor: 'pointer', letterSpacing: '-0.01em', textDecoration: 'none', marginTop: 'auto' }}>
                Get {rec.name} →
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

const faqs = [
  { q: 'Do credits expire?', a: 'Subscription credits roll over for one billing cycle (capped at 2× your monthly grant). Pack credits are valid 12 months from purchase. If you cancel, unused subscription credits stay in your account for 60 days. This is not legal advice; check our refund policy for full terms.' },
  { q: 'Do I need to label my ads as AI-generated?', a: 'Every creator and video you make here is AI-generated, and ad platforms such as Meta and TikTok require AI-generated ads to be labelled. Add the platform\'s AI disclosure when you publish, and check its current advertising rules before you spend. This is not legal advice.' },
  { q: 'What happens if a render fails?', a: 'Credits for a failed render are refunded automatically, so you only pay for ads you can use.' },
  { q: 'Can I cancel anytime?', a: 'Yes, from your account settings. You keep access until the end of the billing period. Unused subscription credits stay in your account for 60 days after cancellation; pack credits stay valid until their 12-month window closes.' },
  { q: 'What languages do you support?', a: 'Voice and captions in 18 languages: English, Spanish, French, German, Italian, Portuguese, Dutch, Polish, Russian, Turkish, Arabic, Hindi, Japanese, Korean, Chinese, Indonesian, Vietnamese and Thai.' },
  { q: 'Do I need to know how to edit video?', a: 'No. Outputs come with voiceover and captions, ready to post in 9:16, 4:5, 1:1 or 16:9. If you want to tweak, our editor is included. No third-party tool required.' },
  { q: 'How many ads can I actually make?', a: `On Pro ($49/mo, 2,000 credits) you can render about ${Math.floor(2000 / UGC5)} UGC ads a month at 5 seconds and 720p vertical, roughly ${Math.round(Math.floor(2000 / UGC5) / 4.3)} a week. A 5-second ad costs about ${UGC5} credits and a 10-second one about ${UGC10}. Draft ads for testing hooks cost about ${DRAFT5}. Longer or higher-resolution ads cost proportionally more. Use the plan recommender for your exact mix.` },
  { q: 'What if I need more than Agency?', a: 'Higher volume, multiple team seats, API access, or white-label? Email contentflow.web@gmail.com and we\'ll work something out.' },
]

// ─── Value table: which plan is cheapest, calculated ───────────────────────
function ValueTable({ annual }: { annual: boolean }) {
  const rows = paidPlans.map(p => ({ p, m: metrics(p, annual) }))
  const best = rows.reduce((a, b) => (b.m.perAd < a.m.perAd ? b : a))
  const worst = Math.max(...rows.map(r => r.m.perAd))
  // A bigger plan that costs MORE per credit than a smaller one is volume, not a discount.
  const notes: string[] = []
  const bySize = [...rows].sort((a, b) => a.p.credits - b.p.credits)
  for (let i = 1; i < bySize.length; i++) {
    const smaller = bySize.slice(0, i).reduce((a, b) => (b.m.perCredit < a.m.perCredit ? b : a))
    if (bySize[i].m.perCredit > smaller.m.perCredit) {
      const pct = Math.round((bySize[i].m.perCredit / smaller.m.perCredit - 1) * 100)
      if (pct >= 1) notes.push(`${bySize[i].p.name} costs ${pct}% more per credit than ${smaller.p.name}. Pick it for the extra volume, not a discount.`)
    }
  }
  const monthlyBest = rows.map(r => ({ ...r, mm: metrics(r.p, false).perAd, ym: metrics(r.p, true).perAd }))
  const yearSave = Math.round((1 - monthlyBest.reduce((s, r) => s + r.ym / r.mm, 0) / monthlyBest.length) * 100)
  const perCredits = rows.map(r => r.m.perCredit)
  const draftLow = DRAFT5 * Math.min(...perCredits)
  const draftHigh = DRAFT5 * Math.max(...perCredits)
  return (
    <div className="pp-card pp-value">
      <div className="pp-card-h">
        <div>
          <h2>Which plan is the best value?</h2>
          <p>Cost of one 5-second UGC ad ({UGC5} credits), {annual ? 'billed yearly' : 'billed monthly'}.</p>
        </div>
        <div className="pp-best"><span>Lowest cost per ad</span><b>{best.p.name} · {usd(best.m.perAd)}</b></div>
      </div>
      <div className="pp-vt" role="table" aria-label="Plan value comparison">
        <div className="pp-vt-head" role="row"><span>Plan</span><span>Price</span><span>Credits</span><span>5s ads / month</span><span>$ per credit</span><span>$ per ad</span></div>
        {rows.map(({ p, m }) => {
          const isBest = p.planKey === best.p.planKey
          return (
            <div key={p.planKey} className={`pp-vt-row${isBest ? ' best' : ''}`} role="row">
              <span className="pp-vt-name">{p.name}{isBest && <em>Lowest</em>}</span>
              <span>{usd(m.eff, m.eff % 1 ? 2 : 0)}<small>/mo</small></span>
              <span>{p.credits.toLocaleString()}</span>
              <span>{m.ads}</span>
              <span className="mono">{m.perCredit.toFixed(4)}</span>
              <span className="pp-vt-ad"><i style={{ width: `${(m.perAd / worst) * 100}%` }} /><b>{usd(m.perAd)}</b></span>
            </div>
          )
        })}
      </div>
      <ul className="pp-notes">
        <li>Draft ads for testing hooks (Seedance Mini, 720p) cost {DRAFT5} credits, about {usd(draftLow)} to {usd(draftHigh)} each. Re-make the winners in full quality.</li>
        <li>Yearly billing lowers the cost per ad by about {yearSave}% on every plan.</li>
        {notes.map(n => <li key={n}>{n}</li>)}
      </ul>
    </div>
  )
}

// ─── Budget finder: best plan for a given price ────────────────────────────
function BudgetFinder({ annual }: { annual: boolean }) {
  const [budget, setBudget] = useState(40)
  const rows = paidPlans.map(p => ({ p, m: metrics(p, annual) }))
  const cheapest = Math.min(...rows.map(r => r.m.eff))
  const afford = rows.filter(r => r.m.eff <= budget)
  const mostAds = afford.length ? afford.reduce((a, b) => (b.p.credits > a.p.credits ? b : a)) : null
  const lowestPerAd = afford.length ? afford.reduce((a, b) => (b.m.perAd < a.m.perAd ? b : a)) : null
  const same = mostAds && lowestPerAd && mostAds.p.planKey === lowestPerAd.p.planKey
  return (
    <div className="pp-card pp-budget">
      <div className="pp-card-h">
        <div>
          <h2>What fits your budget?</h2>
          <p>Slide to your monthly budget and see which plan gives you the most.</p>
        </div>
        <div className="pp-budget-n">{usd(budget, 0)}<small>/mo</small></div>
      </div>
      <input className="pp-range" type="range" min={5} max={160} step={1} value={budget} onChange={e => setBudget(Number(e.target.value))} aria-label="Monthly budget in dollars" />
      <div className="pp-range-scale"><span>$5</span><span>$40</span><span>$80</span><span>$120</span><span>$160</span></div>
      {!mostAds || !lowestPerAd ? (
        <div className="pp-none">Paid plans start at {usd(cheapest, cheapest % 1 ? 2 : 0)} a month. The free plan gives you 30 credits to try.</div>
      ) : (
        <div className="pp-results">
          <div className="pp-res">
            <small>{same ? 'Best match' : 'Most ads for your budget'}</small>
            <b>{mostAds.p.name}</b>
            <span>{mostAds.m.ads} ads a month · {usd(mostAds.m.eff, mostAds.m.eff % 1 ? 2 : 0)}/mo · {usd(mostAds.m.perAd)} per ad</span>
          </div>
          {!same && (
            <div className="pp-res">
              <small>Cheapest per ad within budget</small>
              <b>{lowestPerAd.p.name}</b>
              <span>{lowestPerAd.m.ads} ads a month · {usd(lowestPerAd.m.eff, lowestPerAd.m.eff % 1 ? 2 : 0)}/mo · {usd(lowestPerAd.m.perAd)} per ad</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const ArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
)
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
)

const INCLUDED = ['Captions and social posts are free with every ad (3 per ad)', 'Failed renders are refunded automatically', 'Credits roll over to the next month', 'Free ad teardown, no credits needed', 'Export in 9:16, 4:5, 1:1 or 16:9', 'Voiceover and captions in 18 languages', 'Google Drive backup for every render']

export default function PricingPage() {
  const [annual, setAnnual] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)

  useEffect(() => {
    // The pricing page is always light.
    document.documentElement.removeAttribute('data-theme')
  }, [])

  const rows = paidPlans.map(p => ({ p, m: metrics(p, annual) }))
  const lowestKey = rows.reduce((a, b) => (b.m.perAd < a.m.perAd ? b : a)).p.planKey

  async function handleCta(plan: Plan) {
    if (plan.planKey === 'free') { window.location.assign('/auth/signup'); return }
    setLoading(plan.planKey)
    try {
      const supabase = getSupabase()
      const { data } = await supabase!.auth.getSession()
      const token = data?.session?.access_token
      if (!token) { window.location.assign('/auth/login?redirect=/pricing'); return }
      const res = await fetch('/api/dodo/checkout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey: plan.planKey, annual }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Checkout failed')
      window.location.assign(json.url)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="pp">
      <nav className="pp-nav">
        <Link href="/" className="pp-logo" aria-label="ContentFlow home"><Logo size={26} /><span>Content<em>flow</em></span></Link>
        <div className="pp-links">
          <Link href="/#features">Features</Link>
          <Link href="/teardown">Free ad teardown</Link>
          <Link href="/pricing" className="on">Pricing</Link>
          <Link href="/help">Docs</Link>
        </div>
        <div className="pp-nav-cta">
          <Link href="/auth/login" className="pp-signin">Sign in</Link>
          <Link href="/auth/signup" className="pp-btn pp-btn-dark pp-btn-sm">Start free <span className="arr"><ArrowIcon /></span></Link>
        </div>
      </nav>

      <main className="pp-wrap">
        <header className="pp-hero">
          <div className="pp-eyebrow">The AI ad engine for e-commerce brands</div>
          <h1>Pricing that doesn&apos;t <em>punish testing.</em></h1>
          <p>One wallet. Every format your store needs. Credits that roll over, and failed renders refund automatically.</p>
          <div className="pp-pills">
            <span><CheckIcon /> Credits roll over</span>
            <span><CheckIcon /> Failed renders refund</span>
            <span><CheckIcon /> Cancel anytime</span>
          </div>
          <div className="pp-toggle" role="group" aria-label="Billing period">
            <button className={!annual ? 'on' : ''} onClick={() => setAnnual(false)}>Monthly</button>
            <button className={annual ? 'on' : ''} onClick={() => setAnnual(true)}>Yearly <small>2 months free</small></button>
          </div>
          <div className="pp-sub">Early launch pricing · Prices in USD</div>
        </header>

        <section className="pp-plans" aria-label="Plans">
          {plans.map(plan => {
            const m = metrics(plan, annual)
            const tag = plan.planKey === lowestKey ? 'Lowest cost per ad' : plan.tag
            const isLoading = loading === plan.planKey
            return (
              <article key={plan.planKey} className={`pp-plan${plan.dark ? ' dark' : ''}`}>
                {tag && <span className="pp-tag">{tag}</span>}
                <h3>{plan.name}</h3>
                <p className="pp-desc">{plan.tagline}</p>
                <div className="pp-price">
                  {annual && plan.monthly > 0 && <s>${plan.monthly}</s>}
                  <span>{shownPrice(plan, annual)}</span>
                  {plan.monthly > 0 && <small>/mo</small>}
                </div>
                <div className="pp-cr">{plan.monthly === 0 ? '30 credits at signup' : `${plan.credits.toLocaleString()} credits a month`}</div>
                {annual && plan.monthly > 0 && <div className="pp-bill">billed ${plan.annualTotal.toLocaleString()}/yr</div>}
                <div className="pp-value-line">
                  {plan.monthly === 0 ? 'One-time, no card' : <><b>{usd(m.perAd)}</b> per 5s ad · about {m.ads} ads a month</>}
                </div>
                <ul>
                  {plan.features.map(f => <li key={f}><CheckIcon />{f}</li>)}
                </ul>
                <button className={`pp-btn ${plan.dark ? 'pp-btn-light' : 'pp-btn-dark'}`} onClick={() => handleCta(plan)} disabled={isLoading}>
                  {isLoading ? 'Redirecting…' : plan.cta} <span className="arr"><ArrowIcon /></span>
                </button>
              </article>
            )
          })}
        </section>

        <section className="pp-two">
          <ValueTable annual={annual} />
          <BudgetFinder annual={annual} />
        </section>

        <section className="pp-section">
          <PlanRecommenderPub annual={annual} />
        </section>

        <section className="pp-section pp-packs">
          <div>
            <h2>Need more credits?</h2>
            <p>One-off credit top-ups for when you need more than your monthly allowance. Pack credits are valid for 12 months from purchase. Available on Starter and above. Pack sizes and prices are shown in Billing once you&apos;re signed in.</p>
          </div>
          <Link href="/settings/billing" className="pp-btn pp-btn-ghost">See credit packs in Billing <span className="arr"><ArrowIcon /></span></Link>
        </section>

        <section className="pp-card pp-included">
          <h2>Included on every plan</h2>
          <p>One wallet for UGC ads, product shots, voiceover, captions and the editor.</p>
          <ul>{INCLUDED.map(t => <li key={t}><CheckIcon />{t}</li>)}</ul>
        </section>

        <section className="pp-section">
          <h2 className="pp-h2">Frequently asked questions</h2>
          <div className="pp-faq">
            {faqs.map(({ q, a }, i) => (
              <details key={q} open={i === 0}><summary>{q}<span className="pm">+</span></summary><p>{a}</p></details>
            ))}
          </div>
        </section>

        <section className="pp-card pp-fit">
          <div>
            <div className="pp-eyebrow">Skip us if</div>
            <ul>
              <li>You&apos;re a filmmaker, try Runway</li>
              <li>You run Fortune 500 marketing, try Higgsfield</li>
              <li>You do corporate training, try Synthesia</li>
              <li>You want a full timeline editor, try CapCut</li>
              <li>Your product isn&apos;t a physical thing</li>
            </ul>
          </div>
          <div>
            <div className="pp-eyebrow accent">We&apos;re for you if</div>
            <ul className="strong">
              <li>You sell physical products anywhere: Shopify, TikTok Shop, Amazon, Etsy, DMs</li>
              <li>You&apos;ve got a product URL or just a product photo, either works</li>
              <li>You&apos;re a founder, a marketer, an agency operator, or a one-person brand</li>
              <li>You test ad hooks weekly, not one perfect ad per quarter</li>
              <li>You want one wallet, not four subscriptions</li>
            </ul>
          </div>
        </section>

        <section className="pp-card pp-contact">
          <div>
            <h3>Higher volume, multiple seats, or white-label?</h3>
            <p>Custom pricing for real usage, no shelf tier.</p>
          </div>
          <a href="mailto:contentflow.web@gmail.com?subject=Custom%20plan%20inquiry" className="pp-btn pp-btn-ghost">Contact us <span className="arr"><ArrowIcon /></span></a>
        </section>

        <section className="pp-cta">
          <h2>Try it on <em>your own product</em></h2>
          <p>Paste a product URL and see a preview ad. No card, no signup.</p>
          <div className="pp-cta-row">
            <Link href="/try" className="pp-btn pp-btn-light">Try it free <span className="arr"><ArrowIcon /></span></Link>
            <Link href="/auth/signup" className="pp-btn pp-btn-outline">Create free account</Link>
          </div>
        </section>
      </main>

      <footer className="pp-footer">
        <Link href="/" className="pp-logo"><Logo size={22} /><span>Content<em>flow</em></span></Link>
        <nav>
          <Link href="/teardown">Free ad teardown</Link><Link href="/help">Docs</Link><Link href="/about">About</Link><Link href="/blog">Blog</Link><Link href="/contact">Contact</Link>
          <Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/refunds">Refund policy</Link><Link href="/cookies">Cookies</Link>
        </nav>
        <span>© 2026 ContentFlow</span>
      </footer>

      <style>{PRICING_CSS}</style>
    </div>
  )
}

const PRICING_CSS = `
.pp{--bg:#F5F2EC;--paper:#FBFAF7;--card:#FFFFFF;--sand:#ECE7DE;--ink:#1A1714;--ink-2:#4A443D;--ink-3:#857D72;--line:#E2DCD1;--accent:#A3231F;--peach:#F3C9A3;
  --surface:#FBFAF7;--border:#E2DCD1;--ink-dim:#4A443D;--ink-mute:#857D72;--ink-fade:#857D72;--font-serif:"Instrument Serif",Georgia,serif;
  background:var(--bg);color:var(--ink);font-family:"Geist",system-ui,sans-serif;font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased;min-height:100vh;overflow-x:hidden}
.pp *{box-sizing:border-box}
.pp a{color:inherit;text-decoration:none}
.pp em{font-family:"Instrument Serif",Georgia,serif;font-style:italic;font-weight:400;letter-spacing:-.01em}
.pp .mono{font-family:"Geist Mono",ui-monospace,monospace}
.pp-wrap{max-width:1240px;margin:0 auto;padding:0 24px 40px}

.pp-nav{display:flex;align-items:center;justify-content:space-between;gap:16px;max-width:1240px;margin:0 auto;padding:22px 24px}
.pp-logo{display:flex;align-items:center;gap:10px;font-weight:600;font-size:18px;letter-spacing:-.02em}
.pp-logo em{font-size:21px;color:var(--ink-3);margin-left:1px}
.pp-links{display:flex;gap:4px;padding:5px;border-radius:999px;background:rgba(26,23,20,.05);border:1px solid var(--line)}
.pp-links a{font-size:14px;padding:8px 16px;border-radius:999px;color:var(--ink-2)}
.pp-links a:hover{background:rgba(255,255,255,.8)}
.pp-links a.on{background:var(--card);color:var(--ink);box-shadow:0 1px 3px rgba(0,0,0,.08)}
.pp-nav-cta{display:flex;align-items:center;gap:14px}
.pp-signin{font-size:14px;color:var(--ink-2)}

.pp-btn{display:inline-flex;align-items:center;justify-content:space-between;gap:10px;height:48px;padding:0 8px 0 22px;border-radius:999px;font-weight:500;font-size:15px;cursor:pointer;border:0;font-family:inherit;transition:transform .4s cubic-bezier(.22,1,.36,1),background .3s}
.pp-btn:hover{transform:translateY(-2px)}
.pp-btn:disabled{opacity:.6;cursor:default}
.pp-btn .arr{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;transition:transform .4s cubic-bezier(.22,1,.36,1)}
.pp-btn:hover .arr{transform:rotate(-45deg)}
.pp .pp-btn-dark{background:var(--ink);color:#fff}.pp .pp-btn-dark .arr{background:#fff;color:var(--ink)}
.pp .pp-btn-light{background:#FFFDF9;color:var(--ink)}.pp .pp-btn-light .arr{background:var(--ink);color:#fff}
.pp .pp-btn-ghost{background:transparent;color:var(--ink);border:1px solid var(--line);background:var(--card)}.pp .pp-btn-ghost .arr{background:var(--ink);color:#fff}
.pp .pp-btn-outline{padding:0 24px;background:transparent;color:#fff;border:1px solid rgba(255,255,255,.35)}
.pp-btn-sm{height:42px;font-size:14px;padding:0 6px 0 18px}.pp-btn-sm .arr{width:30px;height:30px}

.pp-hero{text-align:center;padding:56px 0 8px}
.pp-eyebrow{font-family:"Geist Mono",monospace;font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3)}
.pp-eyebrow.accent{color:var(--accent)}
.pp-hero h1{font-size:clamp(40px,6vw,72px);font-weight:400;letter-spacing:-.04em;line-height:1.04;margin:16px 0}
.pp-hero h1 em{color:var(--accent)}
.pp-hero>p{font-size:18px;color:var(--ink-2);max-width:560px;margin:0 auto 26px}
.pp-pills{display:flex;width:fit-content;margin:0 auto;flex-wrap:wrap;gap:8px 20px;justify-content:center;padding:10px 20px;border-radius:999px;background:var(--sand);font-size:13.5px;color:var(--ink-2)}
.pp-pills span{display:inline-flex;align-items:center;gap:7px}.pp-pills svg{color:var(--accent)}
.pp-toggle{display:flex;width:fit-content;margin:24px auto 0;padding:4px;border-radius:999px;background:var(--sand);font-size:14px}
.pp-toggle button{padding:8px 18px;border-radius:999px;color:var(--ink-2);border:0;background:none;cursor:pointer;font-family:inherit;font-size:14px;transition:background .3s}
.pp-toggle button.on{background:var(--card);color:var(--ink);box-shadow:0 1px 3px rgba(0,0,0,.08)}
.pp-toggle small{color:var(--accent);font-weight:500;margin-left:4px}
.pp-sub{margin-top:12px;font-size:12.5px;color:var(--ink-3)}

.pp-plans{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px;margin-top:40px;align-items:stretch}
.pp-plan{position:relative;background:var(--paper);border:1px solid var(--line);border-radius:28px;padding:28px 24px;display:flex;flex-direction:column}
.pp-plan.dark{background:var(--ink);color:#fff;border-color:var(--ink)}
.pp-tag{position:absolute;top:18px;right:18px;font-size:11px;padding:4px 10px;border-radius:999px;background:var(--peach);color:var(--ink);font-weight:500;white-space:nowrap}
.pp-plan h3{font-weight:500;font-size:18px;margin:0}
.pp-desc{color:var(--ink-3);font-size:13.5px;margin:4px 0 0;min-height:40px;line-height:1.4}
.pp-plan.dark .pp-desc{color:rgba(255,255,255,.6)}
.pp-price{display:flex;align-items:baseline;gap:6px;margin:22px 0 2px;line-height:1}
.pp-price span{font-size:52px;letter-spacing:-.05em;font-weight:300}
.pp-price small{font-size:14px;color:var(--ink-3)}.pp-plan.dark .pp-price small{color:rgba(255,255,255,.6)}
.pp-price s{font-size:16px;color:var(--ink-3);margin-right:2px}
.pp-cr{font-family:"Geist Mono",monospace;font-size:12px;color:var(--ink-3)}.pp-plan.dark .pp-cr{color:rgba(255,255,255,.6)}
.pp-bill{font-size:11.5px;color:var(--ink-3);margin-top:2px}.pp-plan.dark .pp-bill{color:rgba(255,255,255,.55)}
.pp-value-line{margin-top:14px;padding:9px 12px;border-radius:12px;background:var(--sand);font-size:12.5px;color:var(--ink-2);line-height:1.35}
.pp-value-line b{font-family:"Geist Mono",monospace;font-weight:500;color:var(--ink)}
.pp-plan.dark .pp-value-line{background:rgba(255,255,255,.08);color:rgba(255,255,255,.75)}.pp-plan.dark .pp-value-line b{color:#fff}
.pp-plan ul{list-style:none;margin:20px 0 26px;padding:0;display:grid;gap:10px;font-size:14px}
.pp-plan li{display:flex;gap:9px;align-items:flex-start;color:var(--ink-2)}.pp-plan.dark li{color:rgba(255,255,255,.82)}
.pp-plan li svg{margin-top:4px;color:var(--accent);flex-shrink:0}.pp-plan.dark li svg{color:var(--peach)}
.pp-plan .pp-btn{margin-top:auto;width:100%}

.pp-card{background:var(--paper);border:1px solid var(--line);border-radius:28px;padding:26px 28px;min-width:0}
.pp-card-h{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:18px;flex-wrap:wrap}
.pp-card-h h2,.pp-packs h2,.pp-included h2{margin:0;font-size:20px;font-weight:500;letter-spacing:-.02em}
.pp-card-h p{margin:4px 0 0;font-size:13.5px;color:var(--ink-3)}
.pp-two{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:14px;margin-top:56px}
.pp-best{display:flex;flex-direction:column;align-items:flex-end;font-size:12px;color:var(--ink-3)}
.pp-best b{font-family:"Geist Mono",monospace;font-weight:500;font-size:14px;color:var(--ink)}

.pp-vt{display:grid;gap:0}
.pp-vt-head,.pp-vt-row{display:grid;grid-template-columns:1.1fr .9fr .9fr 1fr 1fr 1.5fr;gap:12px;align-items:center;padding:12px 10px;font-size:13.5px}
.pp-vt-head{font-family:"Geist Mono",monospace;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);border-bottom:1px solid var(--line);padding-top:0}
.pp-vt-row{border-bottom:1px solid var(--line)}.pp-vt-row:last-child{border-bottom:0}
.pp-vt-row.best{background:var(--accent-soft,#F6E4E1);border-radius:14px;border-bottom-color:transparent}
.pp-vt-name{font-weight:500;display:flex;align-items:center;gap:8px}
.pp-vt-name em{font-family:"Geist",sans-serif;font-style:normal;font-size:10.5px;padding:2px 8px;border-radius:999px;background:var(--accent);color:#fff;letter-spacing:0}
.pp-vt-row small{color:var(--ink-3);margin-left:2px}
.pp-vt-ad{display:flex;align-items:center;gap:10px}
.pp-vt-ad i{display:block;height:8px;border-radius:99px;background:var(--ink);opacity:.8;flex:none;min-width:6px;max-width:70%}
.pp-vt-row.best .pp-vt-ad i{background:var(--accent);opacity:1}
.pp-vt-ad b{font-family:"Geist Mono",monospace;font-weight:500;white-space:nowrap}
.pp-notes{margin:16px 0 0;padding:14px 0 0 18px;border-top:1px solid var(--line);font-size:13px;color:var(--ink-2);display:grid;gap:6px}

.pp-budget-n{font-family:"Geist Mono",monospace;font-size:34px;font-weight:500;letter-spacing:-.04em;line-height:1}.pp-budget-n small{font-size:13px;color:var(--ink-3);font-weight:400}
.pp-range{width:100%;accent-color:var(--accent);margin:6px 0 0}
.pp-range-scale{display:flex;justify-content:space-between;font-family:"Geist Mono",monospace;font-size:10.5px;color:var(--ink-3);margin-top:4px}
.pp-results{display:grid;gap:10px;margin-top:20px}
.pp-res{padding:14px 16px;border-radius:18px;background:var(--sand);display:flex;flex-direction:column;gap:2px}
.pp-res small{font-family:"Geist Mono",monospace;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3)}
.pp-res b{font-size:20px;font-weight:500;letter-spacing:-.02em}
.pp-res span{font-size:13px;color:var(--ink-2)}
.pp-none{margin-top:20px;padding:16px;border-radius:18px;background:var(--sand);font-size:13.5px;color:var(--ink-2)}

.pp-section{margin-top:56px}
.pp-h2{font-size:28px;font-weight:400;letter-spacing:-.03em;margin:0 0 22px}
.pp-packs{display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;padding:26px 28px;border:1px dashed var(--line);border-radius:28px}
.pp-packs p{margin:6px 0 0;font-size:14px;color:var(--ink-2);max-width:640px}
.pp-included{margin-top:56px}
.pp-included p{margin:4px 0 16px;font-size:13.5px;color:var(--ink-3)}
.pp-included ul{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
.pp-included li{display:flex;gap:9px;align-items:flex-start;font-size:14px;color:var(--ink-2)}.pp-included li svg{margin-top:4px;color:var(--accent);flex-shrink:0}

.pp-faq{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 40px}
.pp-faq details{border-top:1px solid var(--line);padding:16px 0}
.pp-faq summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;gap:16px;font-weight:500;font-size:15px}
.pp-faq summary::-webkit-details-marker{display:none}
.pp-faq .pm{color:var(--ink-3);font-size:20px;line-height:1;transition:transform .3s}
.pp-faq details[open] .pm{transform:rotate(45deg)}
.pp-faq p{margin:10px 0 0;font-size:14px;color:var(--ink-2);line-height:1.6}

.pp-fit{margin-top:56px;display:grid;grid-template-columns:1fr 1fr;gap:40px}
.pp-fit ul{list-style:none;margin:14px 0 0;padding:0;display:grid;gap:9px;font-size:14px;color:var(--ink-3);line-height:1.5}
.pp-fit ul.strong{color:var(--ink)}
.pp-contact{margin-top:14px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.pp-contact h3{margin:0 0 4px;font-size:17px;font-weight:500}.pp-contact p{margin:0;font-size:14px;color:var(--ink-3)}

.pp-cta{margin-top:56px;text-align:center;padding:64px 28px;border-radius:32px;background:var(--ink);color:#fff;background-image:radial-gradient(60% 80% at 50% 0%,rgba(163,35,31,.35),transparent 70%)}
.pp-cta h2{font-size:clamp(30px,4.5vw,52px);font-weight:400;letter-spacing:-.035em;margin:0 0 12px;line-height:1.1}
.pp-cta h2 em{color:#F3C9A3}
.pp-cta p{margin:0 0 28px;color:rgba(255,255,255,.7);font-size:16px}
.pp-cta-row{display:inline-flex;gap:12px;flex-wrap:wrap;justify-content:center}

.pp-footer{display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;max-width:1240px;margin:0 auto;padding:28px 24px 40px;color:var(--ink-3);font-size:14px}
.pp-footer .pp-logo{font-size:16px;color:var(--ink)}
.pp-footer nav{display:flex;gap:8px 22px;flex-wrap:wrap}
.pp-footer nav a:hover{color:var(--ink)}

@media (max-width:1180px){.pp-plans{grid-template-columns:repeat(3,minmax(0,1fr))}.pp-two{grid-template-columns:1fr}}
@media (max-width:860px){.pp-links{display:none}.pp-plans{grid-template-columns:repeat(2,minmax(0,1fr))}.pp-faq{grid-template-columns:1fr}.pp-fit{grid-template-columns:1fr;gap:28px}
  .pp-vt-head,.pp-vt-row{grid-template-columns:1.1fr .9fr .9fr 1.4fr}.pp-vt-head span:nth-child(3),.pp-vt-row span:nth-child(3),.pp-vt-head span:nth-child(5),.pp-vt-row span:nth-child(5){display:none}}
@media (max-width:560px){.pp-vt-name em{display:none}.pp-plans{grid-template-columns:1fr}.pp-wrap{padding:0 16px 32px}.pp-nav{padding:16px}.pp-signin{display:none}.pp-card{padding:20px}}
`
