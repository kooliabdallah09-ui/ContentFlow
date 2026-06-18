'use client'

import Link from 'next/link'
import { Check } from 'lucide-react'

// In-app pricing page matching the Claude Design editorial style.
// Standalone page (no sidebar wrapper) accessible from /pricing.

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    unit: 'forever',
    credits: '60 credits at signup',
    features: ['Standard tier only', 'Watermarked output', 'Community support'],
    cta: 'Get started',
    href: '/auth/signup',
  },
  {
    name: 'Starter',
    price: '$19',
    unit: '/month',
    credits: '800 credits/month',
    features: ['Standard + Hero tier', 'No watermark', '~9 UGC videos/month', '30-day history'],
    cta: 'Start free trial',
    href: '/auth/signup',
  },
  {
    name: 'Pro',
    popular: true,
    price: '$49',
    unit: '/month',
    credits: '2,000 credits/month',
    features: ['Everything in Starter', '~23 UGC videos/month', 'Long-form durations', 'Priority queue', 'Priority support'],
    cta: 'Upgrade to Pro',
    href: '/auth/signup',
  },
  {
    name: 'Agency',
    price: '$149',
    unit: '/month',
    credits: '6,500 credits/month',
    features: ['Everything in Pro', '~77 UGC videos/month', 'Team seats', 'Bulk variants', 'Dedicated manager'],
    cta: 'Contact us',
    href: '/auth/signup',
  },
]

const PACKS = [
  { credits: 500, price: 15, perCredit: 0.030 },
  { credits: 1500, price: 40, perCredit: 0.027, bonus: '+11%' },
  { credits: 5000, price: 120, perCredit: 0.024, bonus: '+20%' },
]

export default function PricingPage() {
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
      </div>

      <div className="pricing-grid" style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16,
        marginTop: 42, alignItems: 'start',
      }}>
        {PLANS.map(plan => {
          const popular = !!plan.popular
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
                }}>Most popular</span>
              )}
              <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>{plan.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 10 }}>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 40, lineHeight: 1 }}>{plan.price}</span>
                <span style={{ fontSize: 13, color: 'var(--ink-mute)' }}>{plan.unit}</span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-dim)', marginTop: 8 }}>{plan.credits}</div>

              <Link href={plan.href} style={{
                display: 'block', textAlign: 'center', width: '100%',
                marginTop: 16, padding: 11, borderRadius: 9,
                background: popular ? 'var(--ink)' : 'var(--surface)',
                color: popular ? '#fff' : 'var(--ink)',
                border: popular ? 'none' : '1px solid var(--border)',
                fontWeight: 600, fontSize: 13,
              }}>{plan.cta}</Link>

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
                {pack.bonus && (
                  <span style={{
                    fontSize: 10, fontWeight: 600,
                    background: 'var(--ink)', color: '#fff',
                    borderRadius: 999, padding: '2px 8px',
                  }}>{pack.bonus}</span>
                )}
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-dim)' }}>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)' }}>${pack.price}</span>
                <span style={{ marginLeft: 6, color: 'var(--ink-mute)' }}>· ${pack.perCredit.toFixed(3)}/cr</span>
              </div>
              <Link href="/auth/signup" style={{
                marginTop: 4, display: 'block', textAlign: 'center',
                padding: '9px 14px', borderRadius: 9,
                background: 'var(--surface)', border: '1px solid var(--border)',
                color: 'var(--ink)', fontWeight: 600, fontSize: 12.5,
              }}>Buy credits</Link>
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
