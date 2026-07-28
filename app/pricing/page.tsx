'use client'

import Link from 'next/link'
import { Check } from 'lucide-react'
import { useState, useEffect } from 'react'
import { getSupabase } from '@/lib/auth'
const PLANS = [
  {
    name: 'Free',
    monthlyPrice: '$0',
    annualPrice: '$0',
    annualTotal: null,
    unit: 'forever',
    credits: '60 credits at signup',
    monthlyProductKey: '',
    annualProductKey: '',
    features: ['~12 product images', '~7 AI influencer / product photos', 'Try every studio', 'Business card generator', 'Video editor (Beta)', 'No UGC videos (cheapest is 95cr)'],
    cta: 'Get started',
    href: '/auth/signup',
  },
  {
    name: 'Starter',
    monthlyPrice: '$19',
    annualPrice: '$16',
    annualTotal: '$190/yr',
    unit: '/month',
    credits: '800 credits/month',
    monthlyProductKey: 'starter',
    annualProductKey: 'starterAnnual',
    features: ['~6 UGC videos/mo at 5s · ~4 at 10s (720p)', '~8 budget UGC videos (Seedance Mini)', '~160 images · ~100 influencer/product photos', 'AI Influencer & Product studios · CineMotion', 'No watermark · Video editor · Priority support'],
    cta: 'Get Starter',
    href: '/auth/signup?plan=starter',
  },
  {
    name: 'Pro',
    popular: true,
    monthlyPrice: '$49',
    annualPrice: '$41',
    annualTotal: '$490/yr',
    unit: '/month',
    credits: '2,000 credits/month',
    monthlyProductKey: 'pro',
    annualProductKey: 'proAnnual',
    features: ['~16 UGC videos/mo at 5s · ~10 at 10s (720p)', '~21 budget UGC videos (Seedance Mini)', '~400 images · ~250 influencer/product photos', 'Everything in Starter', 'Shopify product import'],
    cta: 'Get Pro',
    href: '/auth/signup?plan=pro',
  },
  {
    name: 'Agency',
    monthlyPrice: '$149',
    annualPrice: '$124',
    annualTotal: '$1,490/yr',
    unit: '/month',
    credits: '6,500 credits/month',
    monthlyProductKey: 'agency',
    annualProductKey: 'agencyAnnual',
    features: ['~52 UGC videos/mo at 5s · ~35 at 10s · ~27 at 15s', '~1,300 images · ~800 influencer/product photos', 'Everything in Pro', 'Multiple brand profiles · Dedicated support'],
    cta: 'Get Agency',
    href: '/auth/signup?plan=agency',
  },
]

const PACKS = [
  { credits: 500, price: 15, perCredit: 0.030, packKey: 'pack500' },
  { credits: 1500, price: 45, perCredit: 0.030, packKey: 'pack1500' },
  { credits: 5000, price: 120, perCredit: 0.024, packKey: 'pack5000' },
]

export default function PricingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null)
  const [packLoading, setPackLoading] = useState<string | null>(null)
  const [annual, setAnnual] = useState(false)

  useEffect(() => {
    getSupabase()?.auth.getSession().then((result: { data: { session: unknown } }) => {
      setIsLoggedIn(!!result.data?.session)
    })
  }, [])

  async function handleCheckout(productKey: string) {
    if (!productKey) { window.location.href = '/auth/signup'; return }
    setUpgradeLoading(productKey)
    try {
      const { data } = await getSupabase()!.auth.getSession()
      const token = data?.session?.access_token
      if (!token) { window.location.href = '/auth/signup'; return }
      const res = await fetch('/api/polar/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ productKey }),
      })
      const json = await res.json() as { url?: string; error?: string }
      if (!res.ok || !json.url) throw new Error(json.error ?? 'Checkout failed')
      window.location.href = json.url
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Checkout failed')
    } finally {
      setUpgradeLoading(null)
    }
  }

  async function handlePackCheckout(packKey: string) {
    setPackLoading(packKey)
    try {
      const { data } = await getSupabase()!.auth.getSession()
      const token = data?.session?.access_token
      if (!token) { window.location.href = '/auth/signup'; return }
      const res = await fetch('/api/polar/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ packKey }),
      })
      const json = await res.json() as { url?: string; error?: string }
      if (!res.ok || !json.url) throw new Error(json.error ?? 'Checkout failed')
      window.location.href = json.url
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Checkout failed')
    } finally {
      setPackLoading(null)
    }
  }

  return (
    <main style={{ maxWidth: 1140, margin: '0 auto', padding: '50px 40px 90px' }}>
      <div style={{ textAlign: 'center', maxWidth: 620, margin: '0 auto' }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 11.5,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          color: 'var(--ink-fade)',
        }}>
          Pricing
        </div>
        <h1 style={{
          fontFamily: 'var(--font-serif)', fontWeight: 400,
          fontSize: 48, lineHeight: 1.05, letterSpacing: '-0.01em',
          margin: '14px 0 0',
        }}>
          Premium UGC, <span style={{ fontStyle: 'italic' }}>indie</span> pricing.
        </h1>
        <p style={{ fontSize: 15, color: 'var(--ink-dim)', margin: '16px 0 0', lineHeight: 1.55 }}>
          Arcads quality at a fifth of the price. Every plan is credits-based — spend them on whatever you create.
        </p>

        {/* Billing toggle */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 12,
          marginTop: 32, background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: 999,
          padding: '5px 6px 5px 18px',
        }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: annual ? 'var(--ink-mute)' : 'var(--ink)' }}>
            Monthly
          </span>
          <button
            onClick={() => setAnnual(a => !a)}
            aria-label="Toggle annual billing"
            style={{
              position: 'relative', width: 40, height: 22,
              borderRadius: 999, border: 'none', cursor: 'pointer',
              background: annual ? 'var(--ink)' : 'var(--border)',
              transition: 'background 0.2s',
              flexShrink: 0,
            }}
          >
            <span style={{
              position: 'absolute', top: 3, left: annual ? 21 : 3,
              width: 16, height: 16, borderRadius: '50%', background: '#fff',
              transition: 'left 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </button>
          <span style={{ fontSize: 13, fontWeight: 500, color: annual ? 'var(--ink)' : 'var(--ink-mute)' }}>
            Annual
          </span>
          <span style={{
            fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em',
            textTransform: 'uppercase',
            background: annual ? 'var(--ink)' : 'var(--border-soft)',
            color: annual ? '#fff' : 'var(--ink-mute)',
            borderRadius: 999, padding: '4px 10px',
            transition: 'background 0.2s, color 0.2s',
          }}>
            2 months free
          </span>
        </div>
      </div>

      <div className="pricing-grid" style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16,
        marginTop: 42,
      }}>
        {PLANS.map(plan => {
          const popular = !!plan.popular
          const activeProductKey = annual ? plan.annualProductKey : plan.monthlyProductKey
          const displayPrice = annual ? plan.annualPrice : plan.monthlyPrice
          const isLoading = upgradeLoading === activeProductKey

          return (
            <div
              key={plan.name}
              style={{
                position: 'relative',
                background: 'var(--surface)',
                border: popular ? '2px solid var(--ink)' : '1px solid var(--border)',
                borderRadius: 15,
                padding: 28,
              }}
            >
              {popular && (
                <span style={{
                  position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)',
                  fontSize: 10.5, fontWeight: 600,
                  letterSpacing: '0.04em', textTransform: 'uppercase',
                  background: 'var(--ink)', color: '#fff',
                  borderRadius: 999, padding: '4px 12px',
                  whiteSpace: 'nowrap',
                }}>Most popular</span>
              )}
              <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>{plan.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 10 }}>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 40, lineHeight: 1, transition: 'opacity 0.15s' }}>
                  {displayPrice}
                </span>
                {plan.unit !== 'forever' && (
                  <span style={{ fontSize: 13, color: 'var(--ink-mute)' }}>/mo</span>
                )}
                {plan.unit === 'forever' && (
                  <span style={{ fontSize: 13, color: 'var(--ink-mute)' }}>forever</span>
                )}
              </div>
              {annual && plan.annualTotal ? (
                <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', marginTop: 3 }}>
                  billed {plan.annualTotal}
                </div>
              ) : null}
              <div style={{ fontSize: 12.5, color: 'var(--ink-dim)', marginTop: annual && plan.annualTotal ? 4 : 8 }}>
                {plan.credits}
              </div>

              {isLoggedIn && activeProductKey ? (
                <button
                  onClick={() => handleCheckout(activeProductKey)}
                  disabled={isLoading}
                  style={{
                    display: 'block', textAlign: 'center', width: '100%',
                    marginTop: 16, padding: 11, borderRadius: 9,
                    background: popular ? 'var(--ink)' : 'var(--surface)',
                    color: popular ? '#fff' : 'var(--ink)',
                    border: popular ? 'none' : '1px solid var(--border)',
                    fontWeight: 600, fontSize: 13, cursor: 'pointer',
                    opacity: isLoading ? 0.6 : 1,
                  }}
                >
                  {isLoading ? 'Redirecting…' : plan.cta}
                </button>
              ) : (
                <Link href={plan.href} style={{
                  display: 'block', textAlign: 'center', width: '100%',
                  marginTop: 16, padding: 11, borderRadius: 9,
                  background: popular ? 'var(--ink)' : 'var(--surface)',
                  color: popular ? '#fff' : 'var(--ink)',
                  border: popular ? 'none' : '1px solid var(--border)',
                  fontWeight: 600, fontSize: 13,
                }}>{plan.cta}</Link>
              )}

              <div style={{ height: 1, background: 'var(--border-soft)', margin: '18px 0' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.4 }}>
                    <Check size={14} strokeWidth={2.2} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Credits policy */}
      <div style={{
        marginTop: 32,
        border: '1px solid var(--border)', borderRadius: 14,
        background: 'var(--surface)', padding: '20px 24px',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px 32px',
      }}>
        {[
          { icon: '↑', title: 'Upgrading', body: 'Your balance resets to the new plan\'s full monthly allowance. Any one-time pack credits are preserved on top.' },
          { icon: '↓', title: 'Downgrading', body: 'Your current credits are kept and the new plan\'s monthly credits are added on top. Nothing is taken away.' },
          { icon: '↻', title: 'Monthly renewal', body: 'Your balance resets to your plan\'s monthly allowance. One-time pack credits never expire and always carry over.' },
          { icon: '＋', title: 'Credit packs', body: 'Stacked on top of your subscription balance. Survive plan changes and monthly resets — they never disappear.' },
        ].map(({ icon, title, body }) => (
          <div key={title} style={{ display: 'flex', gap: 12 }}>
            <span style={{
              flexShrink: 0, width: 28, height: 28, borderRadius: 8,
              background: 'var(--bg-elev)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: 'var(--ink)',
            }}>{icon}</span>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{title}</p>
              <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--ink-dim)', lineHeight: 1.5 }}>{body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Pay as you go */}
      <div style={{
        marginTop: 54,
        border: '1px solid var(--border)', borderRadius: 18,
        background: 'var(--surface)', padding: '30px 32px',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 style={{
              fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 400,
              margin: 0, letterSpacing: '-0.01em',
            }}>
              Prefer to <span style={{ fontStyle: 'italic' }}>pay as you go?</span>
            </h2>
            <p style={{ fontSize: 13.5, color: 'var(--ink-dim)', margin: '7px 0 0' }}>
              One-off credit packs. No subscription, never expire.
            </p>
          </div>
        </div>
        <div className="pack-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginTop: 22 }}>
          {PACKS.map(pack => (
            <div key={pack.credits} style={{
              border: '1px solid var(--border)', borderRadius: 13,
              padding: '18px 20px', background: 'var(--bg-elev)',
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 500, letterSpacing: '-0.03em' }}>
                  {pack.credits.toLocaleString()} <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>cr</span>
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-dim)' }}>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)' }}>${pack.price}</span>
                <span style={{ marginLeft: 6, color: 'var(--ink-mute)' }}>· ${pack.perCredit.toFixed(3)}/cr</span>
              </div>
              {isLoggedIn ? (
                <button
                  onClick={() => handlePackCheckout(pack.packKey)}
                  disabled={packLoading === pack.packKey}
                  style={{
                    marginTop: 4, display: 'block', textAlign: 'center', width: '100%',
                    padding: '9px 14px', borderRadius: 9,
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    color: 'var(--ink)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer',
                    opacity: packLoading === pack.packKey ? 0.6 : 1,
                  }}
                >
                  {packLoading === pack.packKey ? 'Redirecting…' : 'Buy credits'}
                </button>
              ) : (
                <Link href="/auth/signup" style={{
                  marginTop: 4, display: 'block', textAlign: 'center',
                  padding: '9px 14px', borderRadius: 9,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  color: 'var(--ink)', fontWeight: 600, fontSize: 12.5,
                }}>Buy credits</Link>
              )}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .pricing-grid { grid-template-columns: 1fr 1fr !important; }
          .pack-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 600px) {
          .pricing-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  )
}
