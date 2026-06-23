'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/auth'
import { Icon } from '@/components/Icons'
import Link from 'next/link'

const PRICE_IDS = {
  starter: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER ?? '',
  pro: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO ?? '',
  agency: process.env.NEXT_PUBLIC_STRIPE_PRICE_AGENCY ?? '',
  pack_500: process.env.NEXT_PUBLIC_STRIPE_PRICE_PACK_500 ?? '',
  pack_1500: process.env.NEXT_PUBLIC_STRIPE_PRICE_PACK_1500 ?? '',
  pack_5000: process.env.NEXT_PUBLIC_STRIPE_PRICE_PACK_5000 ?? '',
}

interface CreditsInfo {
  balance: number
  plan: string
  monthlyCredits: number
  resetDate: string
  hasSubscription: boolean
}

export default function BillingPage() {
  const [creditsInfo, setCreditsInfo] = useState<CreditsInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null)

  useEffect(() => {
    loadCreditsInfo()
    // Handle return from Stripe Checkout
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === '1') {
      setTimeout(() => loadCreditsInfo(), 2000) // Give webhook time to fire
    }
  }, [])

  async function getToken() {
    const supabase = getSupabase()
    if (!supabase) return null
    const { data } = await supabase.auth.getSession()
    return data?.session?.access_token ?? null
  }

  async function handleUpgrade(priceId: string, mode: 'subscription' | 'payment') {
    if (!priceId) { alert('Stripe price not configured. Add env vars.'); return }
    setUpgradeLoading(priceId)
    try {
      const token = await getToken()
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ priceId, mode }),
      })
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      window.location.href = url
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Checkout failed')
    } finally {
      setUpgradeLoading(null)
    }
  }

  async function handleManageSubscription() {
    setUpgradeLoading('portal')
    try {
      const token = await getToken()
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      window.location.href = url
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Portal failed')
    } finally {
      setUpgradeLoading(null)
    }
  }

  const loadCreditsInfo = async () => {
    try {
      const supabase = getSupabase()
      if (!supabase) return

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session?.access_token) return

      const response = await fetch('/api/credits/balance', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setCreditsInfo({
          balance: data.balance || 0,
          plan: data.plan || 'free',
          monthlyCredits: data.monthlyCredits || 50,
          resetDate: data.resetDate || '',
          hasSubscription: !!(data.plan && data.plan !== 'free'),
        })
      }
    } catch (error) {
      console.error('Failed to load credits info:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '4px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--ink-dim)', fontSize: '14px' }}>Loading billing info...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    )
  }

  const plans = [
    {
      name: 'Free',
      price: '$0',
      credits: '0/month',
      bonus: '+ 60 signup',
      priceId: '',
      features: [
        '60 one-time signup credits',
        'UGC video ads (watermarked)',
        'AI image generator',
        'AI voiceover',
        'Business card generator',
        'Video editor',
      ],
      current: creditsInfo?.plan === 'free',
      cta: 'Current Plan',
      ctaDisabled: true,
    },
    {
      name: 'Starter',
      price: '$19',
      credits: '800/month',
      priceId: PRICE_IDS.starter,
      features: [
        '800 monthly credits / month',
        'UGC video ads — no watermark',
        'AI image generator',
        'AI voiceover (ElevenLabs)',
        'Actor library',
        'Video editor',
        'Priority support',
      ],
      current: creditsInfo?.plan === 'starter',
      cta: creditsInfo?.plan === 'starter' ? 'Current Plan' : 'Upgrade — $19/mo',
      ctaDisabled: creditsInfo?.plan === 'starter',
      pricePerCredit: '$0.024/cr',
    },
    {
      name: 'Pro',
      price: '$49',
      credits: '2,000/month',
      priceId: PRICE_IDS.pro,
      features: [
        '2,000 monthly credits / month',
        'Everything in Starter',
        'Software / app product mode',
        'Custom actor photo upload',
        'Script preview & editing',
        'Shopify product import',
        'Priority support',
      ],
      current: creditsInfo?.plan === 'pro',
      cta: creditsInfo?.plan === 'pro' ? 'Current Plan' : 'Upgrade — $49/mo',
      ctaDisabled: creditsInfo?.plan === 'pro',
      pricePerCredit: '$0.025/cr',
    },
    {
      name: 'Agency',
      price: '$149',
      credits: '6,500/month',
      priceId: PRICE_IDS.agency,
      features: [
        '6,500 monthly credits / month',
        'Everything in Pro',
        'Multiple brand profiles',
        'Dedicated support',
      ],
      current: creditsInfo?.plan === 'agency',
      cta: creditsInfo?.plan === 'agency' ? 'Current Plan' : 'Upgrade — $149/mo',
      ctaDisabled: creditsInfo?.plan === 'agency',
      pricePerCredit: '$0.023/cr',
    },
  ]

  const creditPacks = [
    {
      credits: 500,
      price: '$15',
      priceId: PRICE_IDS.pack_500,
      pricePerCredit: '$0.030/cr',
      discount: null,
      popular: false,
    },
    {
      credits: 1500,
      price: '$40',
      priceId: PRICE_IDS.pack_1500,
      pricePerCredit: '$0.027/cr',
      discount: '-10%',
      popular: false,
    },
  ]

  return (
    <div className="content">
      <div className="page-head">
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px', overflowX: 'auto' }}>
          <a href="/settings/brand" style={{ padding: '8px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--ink-dim)', textDecoration: 'none', whiteSpace: 'nowrap' }}>Brand</a>
          <a href="/settings/account" style={{ padding: '8px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--ink-dim)', textDecoration: 'none', whiteSpace: 'nowrap' }}>Account</a>
          <a href="/settings/billing" style={{ padding: '8px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--accent)', borderBottom: '2px solid var(--accent)', textDecoration: 'none', whiteSpace: 'nowrap' }}>Billing</a>
          <a href="/settings/integrations" style={{ padding: '8px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--ink-dim)', textDecoration: 'none', whiteSpace: 'nowrap' }}>Integrations</a>
        </div>
        <h1 className="page-title">Billing & <em>Credits</em></h1>
        <p className="page-sub">Manage your subscription and purchase additional credits.</p>
      </div>

      {/* Current Credits */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: 'var(--r-lg)', padding: '24px', marginBottom: '32px' }}>
        <p className="eyebrow" style={{ marginBottom: '16px' }}>Current Balance</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
          <div>
            <div style={{ fontSize: '32px', fontWeight: 600, color: 'var(--accent)', marginBottom: '4px' }}>
              {creditsInfo?.balance || 0}
            </div>
            <p className="eyebrow">Available Credits</p>
          </div>
          <div>
            <div style={{ fontSize: '32px', fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>
              {creditsInfo?.monthlyCredits || 0}
            </div>
            <p className="eyebrow">Monthly Allocation</p>
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>
              {creditsInfo?.resetDate ? new Date(creditsInfo.resetDate).toLocaleDateString() : '–'}
            </div>
            <p className="eyebrow">Reset Date</p>
          </div>
        </div>
        {creditsInfo?.hasSubscription && (
          <button
            onClick={handleManageSubscription}
            disabled={upgradeLoading === 'portal'}
            className="btn"
            style={{ marginTop: '16px', fontSize: '13px', padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--ink-dim)', cursor: 'pointer' }}
          >
            {upgradeLoading === 'portal' ? 'Opening…' : '⚙ Manage subscription'}
          </button>
        )}
      </div>

      {/* Plans */}
      <div style={{ marginBottom: '48px' }}>
        <div className="section-head" style={{ marginBottom: '24px' }}>
          <h2 className="section-title">Monthly <em>Plans</em></h2>
          <p style={{ fontSize: '13px', color: 'var(--ink-dim)', marginTop: '8px' }}>Renewable monthly credits + 60 one-time bonus at signup</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {plans.map((plan) => (
            <div
              key={plan.name}
              style={{
                background: 'var(--surface)',
                border: plan.current ? '2px solid var(--accent)' : '1px solid var(--border)',
                borderRadius: 'var(--r-lg)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
              }}
            >
              {plan.current && (
                <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'var(--accent)', color: 'var(--bg)', fontSize: '11px', fontWeight: 600, padding: '4px 8px', borderRadius: 'var(--r-sm)' }}>
                  Current
                </div>
              )}
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>
                {plan.name}
              </h3>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--accent)' }}>
                  {plan.price}
                </div>
                <p className="eyebrow" style={{ color: 'var(--ink-fade)' }}>{plan.credits}</p>
                {plan.bonus && <p className="eyebrow" style={{ color: 'var(--good)' }}>{plan.bonus}</p>}
                {plan.pricePerCredit && <p className="eyebrow" style={{ color: 'var(--ink-mute)', fontSize: '11px' }}>{plan.pricePerCredit}</p>}
              </div>
              <div style={{ flex: 1, marginBottom: '16px' }}>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {plan.features.map((feature, i) => (
                    <li key={i} style={{ fontSize: '13px', color: 'var(--ink-dim)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14, color: 'var(--good)', flexShrink: 0 }}>
                        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <button
                disabled={plan.ctaDisabled || upgradeLoading === plan.priceId}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  opacity: plan.ctaDisabled ? 0.5 : 1,
                  cursor: plan.ctaDisabled ? 'default' : 'pointer',
                }}
                onClick={() => !plan.ctaDisabled && plan.priceId && handleUpgrade(plan.priceId, 'subscription')}
              >
                {upgradeLoading === plan.priceId ? 'Redirecting…' : plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Credit Packs */}
      <div style={{ marginBottom: '48px' }}>
        <div className="section-head" style={{ marginBottom: '24px' }}>
          <h2 className="section-title">Credit <em>Packs</em></h2>
          <p style={{ fontSize: '13px', color: 'var(--ink-dim)', marginTop: '8px' }}>One-time purchase — cheaper per credit than plans</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          {creditPacks.map((pack) => (
            <div
              key={pack.credits}
              style={{
                background: 'var(--surface)',
                border: pack.popular ? '2px solid var(--accent)' : '1px solid var(--border)',
                borderRadius: 'var(--r-lg)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
              }}
            >
              {pack.popular && (
                <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: 'var(--accent)', color: 'var(--bg)', fontSize: '11px', fontWeight: 600, padding: '4px 12px', borderRadius: 'var(--r-sm)' }}>
                  Best Value
                </div>
              )}
              <h4 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent)', marginBottom: '4px' }}>
                {pack.credits}
              </h4>
              <p className="eyebrow" style={{ color: 'var(--ink-dim)', marginBottom: '12px' }}>credits</p>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--ink)' }}>
                  {pack.price}
                </div>
                <p className="eyebrow" style={{ color: 'var(--ink-mute)' }}>{pack.pricePerCredit}</p>
                {pack.discount && (
                  <p className="eyebrow" style={{ color: 'var(--good)', marginTop: '4px' }}>
                    {pack.discount} vs 200cr
                  </p>
                )}
              </div>
              <button
                className="btn btn-primary"
                style={{ width: '100%', opacity: upgradeLoading === pack.priceId ? 0.6 : 1 }}
                onClick={() => pack.priceId && handleUpgrade(pack.priceId, 'payment')}
                disabled={upgradeLoading === pack.priceId}
              >
                {upgradeLoading === pack.priceId ? 'Redirecting…' : 'Buy Pack'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: '16px' }}>Frequently Asked Questions</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>What are credits used for?</p>
            <p style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.5 }}>
              Credits are consumed when you generate content using our AI services. Different content types cost different amounts based on complexity and processing time.
            </p>
          </div>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>Do unused credits roll over?</p>
            <p style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.5 }}>
              No, monthly credits reset on the date shown above. Purchase additional credits anytime to extend beyond your monthly allocation.
            </p>
          </div>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>Can I change my plan anytime?</p>
            <p style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.5 }}>
              Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately and are prorated.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
