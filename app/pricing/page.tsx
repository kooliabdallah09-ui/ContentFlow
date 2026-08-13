'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/auth'

const plans = [
  {
    name: 'Free',
    price: { monthly: '$0', annual: '$0' },
    annualTotal: null,
    credits: '30 one-time signup credits',
    priceId: { monthly: '', annual: '' },
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
    price: { monthly: '$6', annual: '$5' },
    annualTotal: '$60/yr',
    credits: '200 credits / month',
    priceId: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_LITE ?? '',
      annual: process.env.NEXT_PUBLIC_STRIPE_PRICE_LITE_ANNUAL ?? '',
    },
    planKey: 'lite',
    features: [
      'Product photos & images',
      'AI Influencer Studio',
      'Social captions',
      'Voiceover',
      'Carousel maker',
      'Business card generator',
      'No UGC or AI video',
    ],
    cta: 'Get Lite',
  },
  {
    name: 'Starter',
    price: { monthly: '$19', annual: '$16' },
    annualTotal: '$190/yr',
    credits: '800 credits / month',
    priceId: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER ?? '',
      annual: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER_ANNUAL ?? '',
    },
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
    credits: '2,000 credits / month',
    priceId: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO ?? '',
      annual: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_ANNUAL ?? '',
    },
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
    credits: '6,500 credits / month',
    priceId: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_AGENCY ?? '',
      annual: process.env.NEXT_PUBLIC_STRIPE_PRICE_AGENCY_ANNUAL ?? '',
    },
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
]

const comparison = [
  ['Starting price',    '$19/mo', '$110/mo', '$39/mo',  '$29/mo',  '$15/mo'],
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
    // Pricing page always defaults to dark to match landing page feel
    document.documentElement.setAttribute('data-theme', 'dark')
  }, [])

  async function handleCta(plan: typeof plans[number]) {
    if (!plan.priceId.monthly) {
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
            <span style={{ width: 28, height: 28, borderRadius: 6, overflow: 'hidden', background: '#000', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><img src="/logo.png" alt="Contentflow" style={{ width: 22, height: 22, objectFit: 'contain' }} /></span>
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
        </div>

        {/* Plan cards */}
        <div className="pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 64 }}>
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
          @media (max-width: 1100px) { .pricing-grid { grid-template-columns: repeat(3, 1fr) !important; } }
          @media (max-width: 700px)  { .pricing-grid { grid-template-columns: repeat(2, 1fr) !important; } }
          @media (max-width: 480px)  { .pricing-grid { grid-template-columns: 1fr !important; } }
        `}</style>

        {/* Credit packs */}
        <div style={{ marginBottom: 64 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 6 }}>Pay as you go</h2>
          <p style={{ fontSize: 14, color: 'var(--ink-dim, #666)', marginBottom: 24, marginTop: 0 }}>One-off credit packs. No subscription required. Never expire.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {[
              { credits: 250,  price: '$8',   perCr: '$0.032/cr' },
              { credits: 500,  price: '$15',  perCr: '$0.030/cr' },
              { credits: 1500, price: '$45',  perCr: '$0.030/cr' },
              { credits: 5000, price: '$120', perCr: '$0.024/cr' },
            ].map(pack => (
              <div key={pack.credits} style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 14, padding: '18px 20px', background: 'var(--surface, #fff)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{pack.credits.toLocaleString()} credits</div>
                <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>{pack.price}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-mute, #999)', marginBottom: 10 }}>{pack.perCr}</div>
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
