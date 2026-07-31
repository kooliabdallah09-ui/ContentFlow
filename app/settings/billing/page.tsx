'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/auth'
import { PADDLE_PRICES } from '@/lib/paddle'
import { openPaddleCheckout } from '@/lib/paddle-client'

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
  const [packLoading, setPackLoading] = useState<string | null>(null)
  const [annual, setAnnual] = useState(false)

  useEffect(() => {
    loadCreditsInfo()
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === '1') setTimeout(() => loadCreditsInfo(), 2500)
  }, [])

  async function getToken() {
    const { data } = await getSupabase()!.auth.getSession()
    return data?.session?.access_token ?? null
  }

  async function handleUpgrade(priceId: string) {
    if (!priceId) return
    setUpgradeLoading(priceId)
    try {
      const { data } = await getSupabase()!.auth.getSession()
      const user = data?.session?.user
      if (!user) { window.location.href = '/auth/login'; return }
      await openPaddleCheckout({ priceId, userId: user.id, email: user.email ?? undefined })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Checkout failed')
    } finally {
      setUpgradeLoading(null)
    }
  }

  async function handlePackCheckout(priceId: string) {
    setPackLoading(priceId)
    try {
      const { data } = await getSupabase()!.auth.getSession()
      const user = data?.session?.user
      if (!user) { window.location.href = '/auth/login'; return }
      await openPaddleCheckout({ priceId, userId: user.id, email: user.email ?? undefined })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Checkout failed')
    } finally {
      setPackLoading(null)
    }
  }

  async function handleManageSubscription() {
    setUpgradeLoading('portal')
    try {
      const token = await getToken()
      const res = await fetch('/api/paddle/portal', {
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
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setCreditsInfo({
          balance: data.balance || 0,
          plan: data.plan || 'free',
          monthlyCredits: data.monthlyCredits || 0,
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
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--ink)', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const currentPlan = creditsInfo?.plan ?? 'free'

  const plans = [
    {
      name: 'Free', price: { monthly: '$0', annual: '$0' }, annualTotal: null,
      credits: '0/month · +60 signup',
      priceId: { monthly: '', annual: '' },
      features: ['60 one-time signup credits', '~12 product images', '~7 AI influencer / product photos', 'Try every studio', 'Business card generator', 'No UGC videos (cheapest is 95cr)'],
      planKey: 'free',
    },
    {
      name: 'Starter', price: { monthly: '$19', annual: '$16' }, annualTotal: '$190/yr',
      credits: '800/month · $0.024/cr',
      priceId: { monthly: PADDLE_PRICES.starter, annual: PADDLE_PRICES.starterAnnual },
      features: ['~6 UGC videos/mo at 5s · ~4 at 10s', '~8 budget UGC videos (Seedance Mini)', '~160 images · ~100 influencer/product photos', 'AI Influencer Studio & Product Studio', 'No watermark · Video editor · Priority support'],
      planKey: 'starter',
    },
    {
      name: 'Pro', price: { monthly: '$49', annual: '$41' }, annualTotal: '$490/yr',
      credits: '2,000/month · $0.025/cr',
      priceId: { monthly: PADDLE_PRICES.pro, annual: PADDLE_PRICES.proAnnual },
      features: ['~16 UGC videos/mo at 5s · ~10 at 10s', '~21 budget UGC videos (Seedance Mini)', '~400 images · ~250 influencer/product photos', 'Everything in Starter', 'Shopify product import'],
      planKey: 'pro',
      popular: true,
    },
    {
      name: 'Agency', price: { monthly: '$149', annual: '$124' }, annualTotal: '$1,490/yr',
      credits: '6,500/month · $0.023/cr',
      priceId: { monthly: PADDLE_PRICES.agency, annual: PADDLE_PRICES.agencyAnnual },
      features: ['~52 UGC videos/mo at 5s · ~35 at 10s', '~1,300 images · ~800 influencer/product photos', 'Everything in Pro', 'Multiple brand profiles · Dedicated support'],
      planKey: 'agency',
    },
  ]

  const creditPacks = [
    { credits: 500,  price: '$15',  perCr: '$0.030/cr', priceId: PADDLE_PRICES.pack500 },
    { credits: 1500, price: '$45',  perCr: '$0.030/cr', priceId: PADDLE_PRICES.pack1500 },
    { credits: 5000, price: '$120', perCr: '$0.024/cr', priceId: PADDLE_PRICES.pack5000 },
  ]

  return (
    <div className="content">
      <div className="page-head">
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 16, overflowX: 'auto' }}>
          {['brand', 'account', 'billing', 'integrations'].map(s => (
            <a key={s} href={`/settings/${s}`} style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap', color: s === 'billing' ? 'var(--ink)' : 'var(--ink-dim)', borderBottom: s === 'billing' ? '2px solid var(--ink)' : '2px solid transparent', marginBottom: -1 }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </a>
          ))}
        </div>
        <h1 className="page-title">Billing & <em>Credits</em></h1>
        <p className="page-sub">Manage your subscription and purchase additional credits.</p>
      </div>

      {/* Current Balance */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, marginBottom: 32 }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-mute)', margin: '0 0 16px' }}>Current Balance</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 40, lineHeight: 1.1, color: 'var(--ink)', marginBottom: 4 }}>{(creditsInfo?.balance ?? 0).toLocaleString()}</div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-mute)', margin: 0 }}>Available Credits</p>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 40, lineHeight: 1.1, color: 'var(--ink)', marginBottom: 4 }}>{(creditsInfo?.monthlyCredits ?? 0).toLocaleString()}</div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-mute)', margin: 0 }}>Monthly Allocation</p>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, lineHeight: 1.6, color: 'var(--ink)', marginBottom: 4 }}>
              {creditsInfo?.resetDate ? new Date(creditsInfo.resetDate).toLocaleDateString() : '–'}
            </div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-mute)', margin: 0 }}>Reset Date</p>
          </div>
        </div>
        {creditsInfo?.hasSubscription && (
          <button onClick={handleManageSubscription} disabled={upgradeLoading === 'portal'}
            style={{ marginTop: 16, fontSize: 13, padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--ink-dim)', cursor: 'pointer' }}>
            {upgradeLoading === 'portal' ? 'Opening…' : '⚙ Manage subscription'}
          </button>
        )}
      </div>

      {/* Plans */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 400, margin: 0, letterSpacing: '-0.01em' }}>
              {annual ? 'Annual' : 'Monthly'} <em>Plans</em>
            </h2>
            <p style={{ fontSize: 13, color: 'var(--ink-dim)', margin: '6px 0 0' }}>Renewable monthly credits + 60 one-time bonus at signup</p>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 999, padding: '5px 6px 5px 16px' }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: annual ? 'var(--ink-mute)' : 'var(--ink)' }}>Monthly</span>
            <button onClick={() => setAnnual(a => !a)} aria-label="Toggle annual billing"
              style={{ position: 'relative', width: 36, height: 20, borderRadius: 999, border: 'none', cursor: 'pointer', background: annual ? 'var(--ink)' : 'var(--border)', transition: 'background 0.2s', flexShrink: 0 }}>
              <span style={{ position: 'absolute', top: 2, left: annual ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: annual ? 'var(--bg)' : '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
            </button>
            <span style={{ fontSize: 13, fontWeight: 500, color: annual ? 'var(--ink)' : 'var(--ink-mute)' }}>Annual</span>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', background: annual ? 'var(--ink)' : 'var(--border-soft)', color: annual ? 'var(--bg)' : 'var(--ink-mute)', borderRadius: 999, padding: '3px 9px', transition: 'background 0.2s, color 0.2s' }}>
              2 mo free
            </span>
          </div>
        </div>

        <div className="billing-plan-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {plans.map((plan) => {
            const isCurrent = currentPlan === plan.planKey
            const activePriceId = annual ? plan.priceId.annual : plan.priceId.monthly
            const isLoading = upgradeLoading === activePriceId
            const displayPrice = annual ? plan.price.annual : plan.price.monthly
            return (
              <div key={plan.name} style={{ position: 'relative', background: 'var(--surface)', border: isCurrent ? '2px solid var(--ink)' : '1px solid var(--border)', borderRadius: 14, padding: 22 }}>
                {isCurrent && (
                  <span style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: 'var(--ink)', color: 'var(--bg)', borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' }}>
                    Current plan
                  </span>
                )}
                {plan.popular && !isCurrent && (
                  <span style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: 'var(--border)', color: 'var(--ink-dim)', borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' }}>
                    Most popular
                  </span>
                )}
                <div style={{ fontSize: 14, fontWeight: 600 }}>{plan.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 8 }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: 36, lineHeight: 1 }}>{displayPrice}</span>
                  <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>{plan.planKey === 'free' ? 'forever' : '/mo'}</span>
                </div>
                {annual && plan.annualTotal && <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>billed {plan.annualTotal}</div>}
                <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 6 }}>{plan.credits}</div>
                {isCurrent ? (
                  <div style={{ marginTop: 14, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', textAlign: 'center', fontSize: 12.5, fontWeight: 500, color: 'var(--ink-mute)' }}>Current plan</div>
                ) : activePriceId ? (
                  <button onClick={() => handleUpgrade(activePriceId)} disabled={isLoading}
                    style={{ marginTop: 14, display: 'block', width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--ink)', background: 'transparent', color: 'var(--ink)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', opacity: isLoading ? 0.5 : 1 }}>
                    {isLoading ? 'Redirecting…' : 'Upgrade'}
                  </button>
                ) : (
                  <div style={{ marginTop: 14, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', textAlign: 'center', fontSize: 12.5, fontWeight: 500, color: 'var(--ink-mute)' }}>Free forever</div>
                )}
                <div style={{ height: 1, background: 'var(--border-soft)', margin: '16px 0' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {plan.features.map((f, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.4 }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 13, height: 13, flexShrink: 0, marginTop: 1 }}><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        <style>{`
          @media (max-width: 1100px) { .billing-plan-grid { grid-template-columns: repeat(2, 1fr) !important; } }
          @media (max-width: 640px)  { .billing-plan-grid { grid-template-columns: 1fr !important; } }
        `}</style>
      </div>

      {/* Credits policy */}
      <div style={{ marginBottom: 28, border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', padding: '20px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px 32px' }}>
        {[
          { icon: '↑', title: 'Upgrading', body: "Your balance resets to the new plan's full monthly allowance. Pack credits are preserved on top." },
          { icon: '↓', title: 'Downgrading', body: "Your current credits are kept and the new plan's credits are added. Nothing is taken away." },
          { icon: '↻', title: 'Monthly renewal', body: "Balance resets to your plan's allowance. Pack credits never expire and always carry over." },
          { icon: '＋', title: 'Credit packs', body: 'Stack on top of your subscription. Survive plan changes and monthly resets — they never disappear.' },
        ].map(({ icon, title, body }) => (
          <div key={title} style={{ display: 'flex', gap: 12 }}>
            <span style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 8, background: 'var(--bg-elev)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{icon}</span>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{title}</p>
              <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--ink-dim)', lineHeight: 1.5 }}>{body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Pay as you go */}
      <div style={{ marginBottom: 48, border: '1px solid var(--border)', borderRadius: 18, background: 'var(--surface)', padding: '28px 30px' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 400, margin: 0, letterSpacing: '-0.01em' }}>
          Prefer to <span style={{ fontStyle: 'italic' }}>pay as you go?</span>
        </h2>
        <p style={{ fontSize: 13.5, color: 'var(--ink-dim)', margin: '6px 0 0' }}>One-off credit packs. No subscription, never expire.</p>
        <div className="billing-pack-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 20 }}>
          {creditPacks.map((pack) => (
            <div key={pack.credits} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', background: 'var(--bg-elev)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 500, letterSpacing: '-0.03em' }}>
                {pack.credits.toLocaleString()} <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>cr</span>
              </div>
              <div>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)' }}>{pack.price}</span>
                <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--ink-mute)' }}>· {pack.perCr}</span>
              </div>
              <button onClick={() => handlePackCheckout(pack.priceId)} disabled={packLoading === pack.priceId}
                style={{ marginTop: 4, display: 'block', width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--ink)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', opacity: packLoading === pack.priceId ? 0.5 : 1 }}>
                {packLoading === pack.priceId ? 'Redirecting…' : 'Buy credits'}
              </button>
            </div>
          ))}
        </div>
        <style>{`@media (max-width: 700px) { .billing-pack-grid { grid-template-columns: 1fr !important; } }`}</style>
      </div>

      {/* FAQ */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 16, marginTop: 0 }}>Frequently Asked Questions</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { q: 'What are credits used for?', a: 'Credits are consumed when you generate content — images, UGC videos, influencer photos, voiceovers, and more. Each type has a fixed credit cost.' },
            { q: 'Do unused monthly credits roll over?', a: 'Monthly plan credits reset each billing period. One-time pack credits never expire and survive plan changes and renewals.' },
            { q: 'Can I change my plan anytime?', a: 'Yes — upgrade or downgrade at any time. Changes take effect immediately.' },
          ].map(({ q, a }) => (
            <div key={q}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 4, marginTop: 0 }}>{q}</p>
              <p style={{ fontSize: 13, color: 'var(--ink-dim)', lineHeight: 1.5, margin: 0 }}>{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
