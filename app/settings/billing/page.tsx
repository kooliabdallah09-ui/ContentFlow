'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/auth'

const ADMIN_EMAILS = new Set(['abdallah.kooli@icloud.com', 'abdallah@icloud.com', 'kooliabdallah09@gmail.com'])

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
  const [recGoals, setRecGoals] = useState<string[]>([])
  const [recVolume, setRecVolume] = useState<string>('')
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    loadCreditsInfo()
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === '1') setTimeout(() => loadCreditsInfo(), 2500)
  }, [])

  async function getToken() {
    const { data } = await getSupabase()!.auth.getSession()
    return data?.session?.access_token ?? null
  }

  async function handleUpgrade(planKey: string) {
    if (!planKey || planKey === 'free') return
    setUpgradeLoading(planKey)
    try {
      const token = await getToken()
      if (!token) { window.location.href = '/auth/login'; return }
      const res = await fetch('/api/dodo/checkout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey, annual }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Checkout failed')
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
      const token = await getToken()
      if (!token) { window.location.href = '/auth/login'; return }
      const res = await fetch('/api/dodo/checkout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey: packKey, annual: false }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Checkout failed')
      window.location.href = json.url
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Checkout failed')
    } finally {
      setPackLoading(null)
    }
  }

  async function handleManageSubscription() {
    try {
      setUpgradeLoading('portal')
      const token = await getToken()
      if (!token) { window.location.href = '/auth/login'; return }
      const res = await fetch('/api/dodo/portal', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else alert('Could not open subscription portal. Please contact support.')
    } catch {
      alert('Could not open subscription portal. Please contact support.')
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
      if (sessionData.session.user?.email) setUserEmail(sessionData.session.user.email)
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

  // ─── Plan Recommender logic ───────────────────────────────────────────────
  function getRecommendedPlan(goals: string[], volume: string): string {
    if (goals.includes('ugc') && (volume === 'heavy' || goals.length >= 3)) return 'agency'
    if (goals.includes('ugc') || volume === 'heavy') return 'pro'
    if (goals.length >= 2 || volume === 'medium') return 'starter'
    return 'free'
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
  const isAdmin = ADMIN_EMAILS.has(userEmail.toLowerCase())

  const plans = [
    {
      name: 'Free', price: { monthly: '$0', annual: '$0' }, annualTotal: null,
      credits: '0/month · +30 signup',
      features: ['30 one-time signup credits', '~6 product images', '~3 AI influencer / product photos', 'Try every studio', 'Business card generator', 'No UGC videos (cheapest is 95cr)'],
      planKey: 'free',
    },
    {
      name: 'Starter', price: { monthly: '$19', annual: '$16' }, annualTotal: '$190/yr',
      credits: '800/month',
      features: ['~6 UGC videos/mo at 5s · ~4 at 10s', '~8 budget UGC videos (Seedance Mini)', '~160 images · ~100 influencer/product photos', 'AI Influencer Studio & Product Studio', 'No watermark · Video editor · Priority support'],
      planKey: 'starter',
    },
    {
      name: 'Pro', price: { monthly: '$49', annual: '$41' }, annualTotal: '$490/yr',
      credits: '2,000/month',
      features: ['~16 UGC videos/mo at 5s · ~10 at 10s', '~21 budget UGC videos (Seedance Mini)', '~400 images · ~250 influencer/product photos', 'Everything in Starter', 'Shopify product import'],
      planKey: 'pro',
      popular: true,
    },
    {
      name: 'Agency', price: { monthly: '$149', annual: '$124' }, annualTotal: '$1,490/yr',
      credits: '6,500/month',
      features: ['~52 UGC videos/mo at 5s · ~35 at 10s', '~1,300 images · ~800 influencer/product photos', 'Everything in Pro', 'Multiple brand profiles · Dedicated support'],
      planKey: 'agency',
    },
    {
      name: 'Enterprise', price: { monthly: '$605', annual: '$500' }, annualTotal: '$6,000/yr',
      credits: '25,000/month',
      features: ['~200 UGC videos/mo at 5s · ~130 at 10s', '~5,000 images · ~3,000 influencer/product photos', 'Everything in Agency', 'API access · White-label (no ContentFlow branding)', '5 team seats · Priority render queue · Dedicated Slack'],
      planKey: 'enterprise',
    },
  ]

  const creditPacks = [
    { credits: 350,  price: '$8',   perCr: '$0.023/cr', packKey: 'pack_250' },
    { credits: 700,  price: '$15',  perCr: '$0.021/cr', packKey: 'pack_500' },
    { credits: 2000, price: '$45',  perCr: '$0.023/cr', packKey: 'pack_1500' },
    { credits: 6000, price: '$130', perCr: '$0.022/cr', packKey: 'pack_5000' },
  ]

  const isLitePlan = currentPlan === 'lite'

  return (
    <div className="content">
      {/* Settings nav tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 28, borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        {['brand', 'account', 'billing', 'integrations'].map(s => (
          <a key={s} href={`/settings/${s}`} style={{
            padding: '8px 14px', fontSize: 13, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap',
            color: s === 'billing' ? 'var(--ink)' : 'var(--ink-mute)',
            borderBottom: s === 'billing' ? '2px solid var(--ink)' : '2px solid transparent',
            marginBottom: -1, transition: 'color 0.15s',
          }}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </a>
        ))}
      </div>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 400, letterSpacing: '-0.02em', margin: '0 0 4px' }}>
          Billing &amp; <em>Credits</em>
        </h1>
        <p style={{ fontSize: 13, color: 'var(--ink-dim)', margin: 0 }}>Manage your subscription and purchase additional credits.</p>
      </div>

      {/* Credits banner — amber warm gradient */}
      <div style={{
        background: 'linear-gradient(120deg, #FBF7EC, #F3EBD6)',
        border: '1px solid #EADFBB',
        borderRadius: 18,
        padding: '20px 26px',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        flexWrap: 'wrap',
        color: '#2C1F0A',
      }}>
        <div style={{ paddingRight: 28 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A6420', marginBottom: 4 }}>Available credits</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 32, letterSpacing: '-0.02em', lineHeight: 1, color: '#2C1F0A' }}>{(creditsInfo?.balance ?? 0).toLocaleString()}</div>
        </div>
        <div style={{ width: 1, height: 44, background: '#E4D2A0', marginRight: 28, flexShrink: 0 }} />
        <div style={{ paddingRight: 28 }}>
          <div style={{ fontSize: 10.5, color: '#8A8264', marginBottom: 4 }}>Monthly allocation</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#2C1F0A' }}>{(creditsInfo?.monthlyCredits ?? 0).toLocaleString()} · {creditsInfo?.plan ?? 'Free plan'}</div>
        </div>
        <div style={{ width: 1, height: 44, background: '#E4D2A0', marginRight: 28, flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 10.5, color: '#8A8264', marginBottom: 4 }}>Reset date</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#2C1F0A' }}>
            {creditsInfo?.resetDate ? new Date(creditsInfo.resetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
          </div>
        </div>
        {creditsInfo?.hasSubscription && (
          <button onClick={handleManageSubscription} disabled={upgradeLoading === 'portal'} style={{
            marginLeft: 'auto', padding: '9px 18px', borderRadius: 9,
            border: '1px solid #D4B97A', background: 'rgba(255,255,255,0.6)',
            fontSize: 13, fontWeight: 600, color: '#6E4E17', cursor: 'pointer',
            opacity: upgradeLoading === 'portal' ? 0.5 : 1, flexShrink: 0,
          }}>
            {upgradeLoading === 'portal' ? 'Opening…' : (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
                Manage subscription
              </span>
            )}
          </button>
        )}
      </div>

      {/* Plans */}
      <div style={{ marginBottom: 32 }}>
        {/* Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: annual ? 400 : 700, color: 'var(--ink)', transition: 'font-weight 0.15s' }}>Monthly</span>
          <button
            onClick={() => setAnnual(a => !a)}
            aria-label="Toggle annual billing"
            style={{
              position: 'relative', width: 40, height: 22, borderRadius: 999,
              border: 'none', cursor: 'pointer',
              background: annual ? 'var(--ink)' : 'var(--surface-3)',
              transition: 'background 0.2s', flexShrink: 0,
            }}
          >
            <span style={{
              position: 'absolute', top: 3, left: annual ? 21 : 3,
              width: 16, height: 16, borderRadius: '50%',
              background: annual ? '#fff' : 'var(--ink-mute)',
              transition: 'left 0.2s', display: 'block',
            }} />
          </button>
          <span style={{ fontSize: 13, fontWeight: annual ? 700 : 400, color: 'var(--ink)', transition: 'font-weight 0.15s' }}>Annual</span>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
            background: '#F1E6C9', color: '#8A6420',
            borderRadius: 6, padding: '3px 9px',
          }}>2 months free</span>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
            background: 'linear-gradient(90deg,#111,#333)', color: '#fff',
            borderRadius: 6, padding: '3px 9px',
          }}>Early launch pricing</span>
          <span style={{ fontSize: 11, color: 'var(--ink-mute)', marginLeft: 'auto' }}>All prices include taxes &amp; payment fees</span>
        </div>

        {/* ── Lite plan — restricted micro-tier ────────────────────────────── */}
        <div style={{
          border: isLitePlan ? '2px solid #111' : '1.5px solid var(--border)',
          borderRadius: 16, marginBottom: 16, overflow: 'hidden',
          background: 'var(--surface)', position: 'relative',
        }}>
          {isLitePlan && (
            <span style={{ position: 'absolute', top: -10, left: 24, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: '#111', color: '#fff', borderRadius: 999, padding: '3px 10px' }}>
              Current plan
            </span>
          )}
          {/* Top row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '18px 22px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Lite</span>
              {annual && <span style={{ fontSize: 14, color: 'var(--ink-mute)', textDecoration: 'line-through', fontWeight: 600 }}>$8</span>}
              <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>{annual ? '$7' : '$8'}</span>
              <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>/mo</span>
              {annual && <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>billed $80/yr</span>}
              <span style={{ fontSize: 11, color: 'var(--ink-dim)', marginLeft: 4 }}>· 300 cr/month</span>
            </div>

            {/* Included */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {['Product photos', 'AI Influencer Studio', 'Social captions', 'Voiceover', 'Carousel', 'Business card'].map(f => (
                <span key={f} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#15803d', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 7, padding: '3px 9px' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                  {f}
                </span>
              ))}
            </div>

            {/* CTA */}
            {isLitePlan ? (
              <div style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: 9, border: '1px solid var(--border)', fontSize: 13, fontWeight: 500, color: 'var(--ink-mute)', flexShrink: 0 }}>Current plan</div>
            ) : isAdmin ? (
              <button onClick={() => handleUpgrade('lite')} disabled={upgradeLoading === 'lite'}
                style={{ marginLeft: 'auto', padding: '8px 20px', borderRadius: 9, border: 'none', background: '#111', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', flexShrink: 0, opacity: upgradeLoading === 'lite' ? 0.5 : 1 }}>
                {upgradeLoading === 'lite' ? 'Redirecting…' : 'Get Lite'}
              </button>
            ) : (
              <div style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: 9, border: '1px solid var(--border)', fontSize: 13, fontWeight: 500, color: 'var(--ink-mute)', flexShrink: 0 }}>Coming soon</div>
            )}
          </div>

        </div>

        {/* Plan cards */}
        <div className="billing-plan-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {plans.map((plan) => {
            const isCurrent = currentPlan === plan.planKey
            const isLoading = upgradeLoading === plan.planKey
            const displayPrice = annual ? plan.price.annual : plan.price.monthly
            const showPopular = plan.popular && !isCurrent
            return (
              <div key={plan.name} style={{
                position: 'relative',
                background: 'var(--surface)',
                border: `1.5px solid ${isCurrent || plan.popular ? '#111' : 'var(--border)'}`,
                borderRadius: 16,
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
              }}>
                {(isCurrent || showPopular) && (
                  <span style={{
                    position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                    background: '#111', color: '#fff',
                    borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap',
                  }}>
                    {isCurrent ? 'Current plan' : 'Most popular'}
                  </span>
                )}
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{plan.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 2, flexWrap: 'wrap' }}>
                  {annual && plan.planKey !== 'free' && (
                    <span style={{ fontSize: 15, color: 'var(--ink-mute)', textDecoration: 'line-through', fontWeight: 600 }}>{plan.price.monthly}</span>
                  )}
                  <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>{displayPrice}</span>
                  <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>{plan.planKey === 'free' ? '' : '/mo'}</span>
                </div>
                {annual && plan.annualTotal && (
                  <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginBottom: 2 }}>billed {plan.annualTotal}</div>
                )}
                <div style={{ fontSize: 11.5, color: 'var(--ink-dim)', marginBottom: 14 }}>{plan.credits}</div>

                {isCurrent ? (
                  <div style={{ padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border)', textAlign: 'center', fontSize: 13, fontWeight: 500, color: 'var(--ink-mute)' }}>
                    Current plan
                  </div>
                ) : plan.planKey !== 'free' && isAdmin ? (
                  <button
                    onClick={() => handleUpgrade(plan.planKey)}
                    disabled={isLoading}
                    style={{
                      display: 'block', width: '100%', padding: '9px 12px', borderRadius: 9,
                      border: 'none', background: '#111', color: '#fff',
                      fontWeight: 600, fontSize: 13, cursor: 'pointer',
                      opacity: isLoading ? 0.5 : 1,
                    }}
                  >
                    {isLoading ? 'Redirecting…' : 'Upgrade'}
                  </button>
                ) : plan.planKey !== 'free' ? (
                  <div style={{ padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border)', textAlign: 'center', fontSize: 13, fontWeight: 500, color: 'var(--ink-mute)' }}>
                    Coming soon
                  </div>
                ) : (
                  <div style={{ padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border)', textAlign: 'center', fontSize: 13, fontWeight: 500, color: 'var(--ink-mute)' }}>
                    Free forever
                  </div>
                )}

              </div>
            )
          })}
        </div>
        <style>{`
          @media (max-width: 1100px) { .billing-plan-grid { grid-template-columns: repeat(2, 1fr) !important; } }
          @media (max-width: 640px)  { .billing-plan-grid { grid-template-columns: 1fr !important; } }
        `}</style>
      </div>

      {/* Plan Recommender */}
      <PlanRecommender
        goals={recGoals} setGoals={setRecGoals}
        volume={recVolume} setVolume={setRecVolume}
        currentPlan={currentPlan}
        annual={annual}
        plans={plans}
        onUpgrade={handleUpgrade}
        upgradeLoading={upgradeLoading}
        isAdmin={isAdmin}
      />

      {/* Credits policy */}
      <div style={{ marginBottom: 24, border: '1px solid var(--border)', borderRadius: 16, background: 'var(--surface)', padding: '20px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px 32px' }}>
        {[
          { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>, title: 'Upgrading', body: "Your balance resets to the new plan's full monthly allowance. Pack credits are preserved on top." },
          { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>, title: 'Downgrading', body: "Your current credits are kept and the new plan's credits are added. Nothing is taken away." },
          { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15"/></svg>, title: 'Monthly renewal', body: "Balance resets to your plan's allowance. Pack credits never expire and always carry over." },
          { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>, title: 'Credit packs', body: 'Stack on top of your subscription. Survive plan changes and monthly resets — they never disappear.' },
        ].map(({ icon, title, body }) => (
          <div key={title} style={{ display: 'flex', gap: 12 }}>
            <span style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{icon}</span>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{title}</p>
              <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--ink-dim)', lineHeight: 1.5 }}>{body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Pay as you go */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 3 }}>Need more credits?</div>
          <p style={{ fontSize: 13, color: 'var(--ink-dim)', margin: 0 }}>One-off credit boosts for Starter and above. Credits never expire and survive plan changes.</p>
        </div>
        {(currentPlan === 'free' || currentPlan === 'lite') ? (
          <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: '24px 20px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Credit packs are available on Starter and above</div>
            <p style={{ fontSize: 13, color: 'var(--ink-dim)', margin: 0, maxWidth: 340 }}>Upgrade to Starter to unlock one-off credit boosts — more credits, no subscription commitment.</p>
            <a href="/settings/billing" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ marginTop: 4, padding: '9px 22px', borderRadius: 9, background: '#111', color: '#fff', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
              Upgrade to Starter →
            </a>
          </div>
        ) : (
          <>
            <div className="billing-pack-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {creditPacks.map((pack) => (
                <div key={pack.credits} style={{
                  border: '1px solid var(--border)', borderRadius: 14,
                  padding: '16px 18px', background: 'var(--surface)',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>{pack.credits.toLocaleString()} credits</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-dim)' }}>{pack.price}</div>
                  </div>
                  {isAdmin ? (
                    <button
                      onClick={() => handlePackCheckout(pack.packKey)}
                      disabled={packLoading === pack.packKey}
                      style={{
                        padding: '8px 16px', borderRadius: 8,
                        border: 'none', background: '#111', color: '#fff',
                        fontWeight: 600, fontSize: 13, cursor: 'pointer', flexShrink: 0,
                        opacity: packLoading === pack.packKey ? 0.5 : 1,
                      }}
                    >
                      {packLoading === pack.packKey ? '…' : 'Buy'}
                    </button>
                  ) : (
                    <div style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--ink-mute)', flexShrink: 0 }}>Soon</div>
                  )}
                </div>
              ))}
            </div>
            <style>{`@media (max-width: 700px) { .billing-pack-grid { grid-template-columns: 1fr !important; } }`}</style>
          </>
        )}
      </div>

      {/* Competitor comparison table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 24px', overflowX: 'auto' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4, marginTop: 0, letterSpacing: '-0.01em' }}>How we compare</h3>
        <p style={{ fontSize: 12.5, color: 'var(--ink-mute)', marginTop: 0, marginBottom: 16 }}>ContentFlow vs. the alternatives — more features, taxes included, a fraction of the price.</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Feature', 'ContentFlow', 'Arcads', 'Creatify', 'HeyGen', 'Higgsfield'].map((h, i) => (
                <th key={h} style={{ padding: '8px 10px', textAlign: i === 0 ? 'left' : 'center', fontWeight: 700, color: i === 1 ? 'var(--ink)' : 'var(--ink-mute)', whiteSpace: 'nowrap', background: i === 1 ? 'rgba(0,0,0,0.03)' : 'transparent' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ['Starting price (taxes incl.)', '$21/mo', '$110/mo', '$39/mo', '$29/mo', '$15/mo'],
              ['Monthly credits', '800 cr', 'Pay per video', '~100 cr', '200 cr', '200 cr'],
              ['UGC video', '✓', '✓', '✓', '~', '✓'],
              ['Product photos', '✓', '✗', '✗', '✗', '✗'],
              ['Social copy + email', '✓', '✗', '✗', '✗', '✗'],
              ['Blog + carousel', '✓', '✗', '✗', '✗', '✗'],
              ['Brand persistence', '✓', '✗', '✗', '✗', '✗'],
              ['URL → ad', '✓', '~', '✓', '✗', '✓'],
              ['Batch variations', '✓', '✓', '✓', '✗', '✓'],
              ['Background music', '✓', '✗', '✗', '✗', '✓'],
            ].map(([feature, cf, arcads, creatify, heygen, higgsfield]) => (
              <tr key={feature} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                <td style={{ padding: '8px 10px', color: 'var(--ink-2)', fontWeight: 500 }}>{feature}</td>
                {[cf, arcads, creatify, heygen, higgsfield].map((v, i) => (
                  <td key={i} style={{ padding: '8px 10px', textAlign: 'center', background: i === 0 ? 'rgba(0,0,0,0.03)' : 'transparent', color: v === '✓' ? '#16a34a' : v === '✗' ? '#dc2626' : 'var(--ink-mute)', fontWeight: i === 0 ? 700 : 400 }}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* FAQ */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 24px' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 16, marginTop: 0, letterSpacing: '-0.01em' }}>Frequently asked questions</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { q: 'What are credits used for?', a: 'Credits are consumed when you generate content — images, UGC videos, influencer photos, voiceovers, and more. Each type has a fixed credit cost.' },
            { q: 'Do unused monthly credits roll over?', a: 'Monthly plan credits reset each billing period. One-time pack credits never expire and survive plan changes and renewals.' },
            { q: 'Can I change my plan anytime?', a: 'Yes — upgrade or downgrade at any time. Changes take effect immediately.' },
          ].map(({ q, a }) => (
            <div key={q} style={{ paddingBottom: 14, borderBottom: '1px solid var(--border-soft)' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 4, marginTop: 0 }}>{q}</p>
              <p style={{ fontSize: 13, color: 'var(--ink-dim)', lineHeight: 1.55, margin: 0 }}>{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Plan Recommender Widget ────────────────────────────────────────────────
type CTOption = { key: string; choices: string[]; default: string }
type ContentType = {
  key: string; label: string; sub: string; color: string
  crBase: number
  opts?: CTOption[]
  crMod?: (selections: Record<string, string>) => number
}

// Seedance 2.0 BytePlus token pricing. tokens = duration × W × H × fps / 1024.
// Unit prices per resolution tier (from BytePlus calculator):
//   720p  $7.00/M · 1080p $7.70/M · 4K $4.00/M · 480p est.$5.50/M
const _SD_PER_S_480P  = (480  * 854   * 24) / 1024 / 1_000_000 * 5.5  // ~$0.0529/s
const _SD_PER_S_720P  = (720  * 1280  * 24) / 1024 / 1_000_000 * 7    // $0.1512/s
const _SD_PER_S_1080P = (1080 * 1920  * 24) / 1024 / 1_000_000 * 7.7  // $0.3742/s
const _SD_PER_S_4K    = (2160 * 3840  * 24) / 1024 / 1_000_000 * 4.0  // $0.7776/s
const _NBPRO_USD      = 0.075
const _CLAUDE_USD     = 0.010
const _MARKUP         = 1.4
const _CR_VALUE       = 0.025

function sdCr(durationSec: number, resPerS: number) {
  return Math.ceil(((resPerS * durationSec) + _NBPRO_USD + _CLAUDE_USD) * _MARKUP / _CR_VALUE)
}

const DUR_SECS: Record<string, number> = { '5s': 5, '10s': 10, '15s': 15, '30s': 30 }

const CONTENT_TYPES: ContentType[] = [
  {
    key: 'ugc', label: 'UGC Video', sub: 'Talking-head · 9:16', color: '#D97706',
    crBase: 48,
    opts: [
      { key: 'duration', choices: ['5s', '10s', '15s', '30s'], default: '5s' },
      { key: 'quality',  choices: ['480p', '720p', '1080p', '4K'], default: '720p' },
    ],
    crMod: (s) => {
      const perS = s.quality === '4K' ? _SD_PER_S_4K : s.quality === '1080p' ? _SD_PER_S_1080P : s.quality === '480p' ? _SD_PER_S_480P : _SD_PER_S_720P
      return sdCr(DUR_SECS[s.duration] ?? 5, perS)
    },
  },
  {
    key: 'budget-ugc', label: 'Budget UGC', sub: 'Seedance Mini · 9:16', color: '#7C3AED',
    crBase: 40,
    opts: [
      { key: 'duration', choices: ['5s', '8s', '10s'], default: '5s' },
    ],
    crMod: (s) => s.duration === '10s' ? 72 : s.duration === '8s' ? 60 : 40,
  },
  {
    key: 'image', label: 'Product Image', sub: 'AI photo · studio shot', color: '#0EA5E9',
    crBase: 5,
    opts: [
      { key: 'quality', choices: ['Budget (NB2)', 'Standard (NBPro 2K)', '4K (NBPro 4K)'], default: 'Budget (NB2)' },
    ],
    crMod: (s) => s.quality === '4K (NBPro 4K)' ? 18 : s.quality === 'Standard (NBPro 2K)' ? 9 : 5,
  },
  {
    key: 'influencer', label: 'AI Influencer', sub: 'Lifestyle · portrait', color: '#EC4899',
    crBase: 8,
    opts: [
      { key: 'quality', choices: ['Budget (NB2)', 'Standard (NBPro 2K)', '4K (NBPro 4K)'], default: 'Budget (NB2)' },
    ],
    crMod: (s) => s.quality === '4K (NBPro 4K)' ? 26 : s.quality === 'Standard (NBPro 2K)' ? 14 : 8,
  },
  {
    key: 'cinematic', label: 'Cinematic Video', sub: 'Kling · scene video', color: '#10B981',
    crBase: 140,
    opts: [
      { key: 'duration', choices: ['5s', '10s', '15s'], default: '5s' },
      { key: 'quality',  choices: ['720p', '1080p', '4K'], default: '720p' },
    ],
    crMod: (s) => {
      const durMul = s.duration === '15s' ? 2 : s.duration === '10s' ? 1.5 : 1
      const resMul = s.quality === '4K' ? 2.2 : s.quality === '1080p' ? 1.35 : 1
      return Math.round(140 * durMul * resMul)
    },
  },
  {
    key: 'voiceover', label: 'Voiceover', sub: 'ElevenLabs · per clip', color: '#6366F1',
    crBase: 10,
    opts: [
      { key: 'duration', choices: ['30s', '60s', '90s', '120s'], default: '30s' },
    ],
    crMod: (s) => s.duration === '120s' ? 28 : s.duration === '90s' ? 22 : s.duration === '60s' ? 16 : 10,
  },
  {
    key: 'social', label: 'Social Post', sub: 'AI copywriting', color: '#F59E0B',
    crBase: 5,
  },
  {
    key: 'carousel', label: 'Carousel', sub: 'AI slides · per carousel', color: '#EC4899',
    crBase: 30,
    opts: [
      { key: 'slides', choices: ['4', '6', '8', '10'], default: '6' },
      { key: 'model', choices: ['Budget (NB2)', 'Standard (NBPro)'], default: 'Standard (NBPro)' },
    ],
    crMod: (s) => (parseInt(s.slides) || 6) * (s.model === 'Budget (NB2)' ? 3 : 5),
  },
]

function getCrEach(type: ContentType, sel: Record<string, string>): number {
  if (type.crMod) {
    const defaults = Object.fromEntries((type.opts ?? []).map(o => [o.key, o.default]))
    return type.crMod({ ...defaults, ...sel })
  }
  return type.crBase
}

const PLAN_CAPS: Record<string, number> = { free: 30, lite: 300, starter: 800, pro: 2000, agency: 6500, enterprise: 25000 }

function PlanRecommender({
  goals, setGoals, currentPlan, annual, plans, onUpgrade, upgradeLoading, isAdmin,
}: {
  goals: string[], setGoals: (g: string[]) => void,
  volume?: string, setVolume?: (v: string) => void,
  currentPlan: string, annual: boolean,
  plans: { name: string, price: { monthly: string, annual: string }, credits: string, planKey: string, popular?: boolean, annualTotal?: string | null }[],
  onUpgrade: (id: string) => void, upgradeLoading: string | null,
  isAdmin?: boolean,
}) {
  const [qty, setQty] = useState<Record<string, number>>({})
  const [typeOpts, setTypeOpts] = useState<Record<string, Record<string, string>>>({})
  const [step, setStep] = useState(1)

  function getOpts(key: string): Record<string, string> {
    const type = CONTENT_TYPES.find(t => t.key === key)!
    const defaults = Object.fromEntries((type.opts ?? []).map(o => [o.key, o.default]))
    return { ...defaults, ...(typeOpts[key] ?? {}) }
  }

  const selected = CONTENT_TYPES.filter(t => goals.includes(t.key))
  const totalCr = selected.reduce((sum, t) => sum + (qty[t.key] ?? 1) * getCrEach(t, getOpts(t.key)), 0)

  function toggleType(key: string) {
    const next = goals.includes(key) ? goals.filter(g => g !== key) : [...goals, key]
    setGoals(next)
    if (!qty[key]) setQty(q => ({ ...q, [key]: 1 }))
  }

  function setOpt(typeKey: string, optKey: string, val: string) {
    setTypeOpts(prev => ({ ...prev, [typeKey]: { ...getOpts(typeKey), [optKey]: val } }))
  }

  function bump(key: string, delta: number) {
    setQty(q => ({ ...q, [key]: Math.max(1, (q[key] ?? 1) + delta) }))
  }

  function getRecKey(): string {
    if (!selected.length) return ''
    if (totalCr > PLAN_CAPS.agency) return 'enterprise'
    if (totalCr > PLAN_CAPS.pro) return 'agency'
    if (totalCr > PLAN_CAPS.starter) return 'pro'
    if (totalCr > PLAN_CAPS.lite) return 'starter'
    if (totalCr > PLAN_CAPS.free) return 'lite'
    return 'free'
  }

  const recKey = getRecKey()
  const recPlan = plans.find(p => p.planKey === recKey)
  const planCap = recKey ? PLAN_CAPS[recKey] : 0
  const usagePct = planCap ? Math.min((totalCr / planCap) * 100, 100) : 0

  return (
    <div style={{ marginBottom: 24, borderRadius: 20, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' }}>
      {/* Header */}
      <div style={{ padding: '22px 28px', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 3 }}>Find the right plan for you</div>
          <div style={{ fontSize: 13, color: 'var(--ink-dim)' }}>Select what you create — we'll calculate the credits you need.</div>
        </div>
        {selected.length > 0 && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep(1)} style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
              background: step === 1 ? '#111' : 'var(--surface-2)', color: step === 1 ? '#fff' : 'var(--ink-mute)',
            }}>1 · Content</button>
            <button onClick={() => setStep(2)} style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
              background: step === 2 ? '#111' : 'var(--surface-2)', color: step === 2 ? '#fff' : 'var(--ink-mute)',
            }}>2 · Volume</button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px' }}>
        {/* Left */}
        <div style={{ padding: '24px 28px', borderRight: '1px solid var(--border-soft)' }}>
          {step === 1 ? (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 14 }}>
                What do you want to create?
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
                {CONTENT_TYPES.map(t => {
                  const active = goals.includes(t.key)
                  const opts = getOpts(t.key)
                  const crNow = getCrEach(t, opts)
                  return (
                    <div key={t.key} style={{
                      borderRadius: 12, border: `1.5px solid ${active ? t.color : 'var(--border)'}`,
                      background: active ? `${t.color}12` : 'var(--surface-2)',
                      transition: 'border-color 0.15s, background 0.15s',
                      overflow: 'hidden',
                    }}>
                      {/* Top row — clickable to toggle */}
                      <button onClick={() => toggleType(t.key)} style={{
                        width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12,
                        padding: '12px 14px 10px', textAlign: 'left', cursor: 'pointer',
                        background: 'transparent', border: 'none', position: 'relative',
                      }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, flexShrink: 0, marginTop: 4 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{t.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{t.sub}</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: t.color, marginTop: 4, fontFamily: 'var(--font-mono)' }}>{crNow} cr each</div>
                        </div>
                        {active && (
                          <div style={{ width: 16, height: 16, borderRadius: '50%', background: t.color, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                          </div>
                        )}
                      </button>
                      {/* Options row — only when selected */}
                      {active && t.opts && t.opts.length > 0 && (
                        <div style={{ padding: '0 12px 10px', display: 'flex', flexWrap: 'wrap', gap: 6 }}
                          onClick={e => e.stopPropagation()}>
                          {t.opts.map(opt => (
                            <div key={opt.key} style={{ display: 'flex', gap: 3 }}>
                              {opt.choices.map(choice => {
                                const sel = opts[opt.key] === choice
                                return (
                                  <button key={choice}
                                    onClick={e => { e.stopPropagation(); setOpt(t.key, opt.key, choice) }}
                                    style={{
                                      padding: '3px 8px', borderRadius: 5, fontSize: 10.5, fontWeight: 600,
                                      cursor: 'pointer', transition: 'all 0.12s',
                                      border: `1px solid ${sel ? t.color : 'var(--border)'}`,
                                      background: sel ? t.color : 'transparent',
                                      color: sel ? '#fff' : 'var(--ink-mute)',
                                    }}>
                                    {choice}
                                  </button>
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
              {selected.length > 0 && (
                <button onClick={() => setStep(2)} style={{
                  marginTop: 18, padding: '9px 20px', borderRadius: 9, fontSize: 13, fontWeight: 600,
                  background: '#111', color: '#fff', border: 'none', cursor: 'pointer',
                }}>
                  Set quantities →
                </button>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 14 }}>
                How many per month?
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selected.map(t => {
                  const q = qty[t.key] ?? 1
                  const crNow = getCrEach(t, getOpts(t.key))
                  const subtotal = q * crNow
                  const opts = getOpts(t.key)
                  const optSummary = t.opts ? t.opts.map(o => opts[o.key]).join(' · ') : ''
                  return (
                    <div key={t.key} style={{
                      display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                      borderRadius: 12, border: `1px solid var(--border)`, background: 'var(--surface-2)',
                    }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{t.label}{optSummary ? <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--ink-mute)', marginLeft: 6 }}>{optSummary}</span> : null}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{crNow} cr × {q} = <span style={{ fontWeight: 700, color: t.color }}>{subtotal} cr</span></div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                        <button onClick={() => bump(t.key, -1)} style={{ width: 32, height: 32, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                        <span style={{ minWidth: 28, textAlign: 'center', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{q}</span>
                        <button onClick={() => bump(t.key, 1)} style={{ width: 32, height: 32, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 12, background: 'var(--surface-3)', border: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--ink-mute)' }}>Estimated monthly credits</span>
                <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em', fontFamily: 'var(--font-mono)' }}>{totalCr.toLocaleString()} cr</span>
              </div>
            </>
          )}
        </div>

        {/* Right — live recommendation */}
        <div style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column' }}>
          {!selected.length ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-mute)', textAlign: 'center', gap: 10 }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 12h6M12 9v6"/></svg>
              <span style={{ fontSize: 13 }}>Select content types<br/>to see a recommendation</span>
            </div>
          ) : !recPlan ? null : (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 14 }}>We recommend</div>

              {/* Plan card */}
              <div style={{ background: 'var(--surface-2)', borderRadius: 14, padding: '18px 18px', border: '1.5px solid #111', marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{recPlan.name}</div>
                  {currentPlan === recPlan.planKey && (
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: '#111', color: '#fff', borderRadius: 999, padding: '2px 8px' }}>Current</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 10 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>
                    {annual ? recPlan.price.annual : recPlan.price.monthly}
                  </span>
                  {recPlan.planKey !== 'free' && <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>/mo</span>}
                </div>

                {/* Usage bar */}
                <div style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-mute)', marginBottom: 5 }}>
                    <span>Expected usage</span>
                    <span style={{ fontWeight: 700, color: usagePct > 80 ? '#EF4444' : usagePct > 60 ? '#F59E0B' : '#10B981' }}>
                      {totalCr.toLocaleString()} / {planCap.toLocaleString()} cr
                    </span>
                  </div>
                  <div style={{ height: 5, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 99, transition: 'width 0.35s ease',
                      width: `${usagePct}%`,
                      background: usagePct > 80 ? '#EF4444' : usagePct > 60 ? '#F59E0B' : '#10B981',
                    }} />
                  </div>
                </div>
              </div>

              {/* Breakdown by type */}
              {step === 2 && selected.length > 0 && (
                <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {selected.slice(0, 4).map(t => (
                    <div key={t.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink-dim)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.color, display: 'inline-block', flexShrink: 0 }} />
                        {qty[t.key] ?? 1}× {t.label}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{((qty[t.key] ?? 1) * getCrEach(t, getOpts(t.key))).toLocaleString()} cr</span>
                    </div>
                  ))}
                  {selected.length > 4 && <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>+{selected.length - 4} more types</div>}
                </div>
              )}

              {/* CTA */}
              {currentPlan === recPlan.planKey ? (
                <div style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--ink-mute)', fontWeight: 500, padding: '10px 0' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', marginRight: 5 }}><path d="M20 6L9 17l-5-5"/></svg>
                  You're already on this plan
                </div>
              ) : recPlan.planKey !== 'free' ? (
                <button
                  onClick={() => onUpgrade(recPlan.planKey)}
                  disabled={!!upgradeLoading}
                  style={{
                    width: '100%', padding: '11px', borderRadius: 10, marginTop: 'auto',
                    border: 'none', background: '#111', color: '#fff',
                    fontWeight: 600, fontSize: 13, cursor: 'pointer',
                    opacity: upgradeLoading ? 0.5 : 1, letterSpacing: '-0.01em',
                  }}
                >
                  {upgradeLoading ? 'Redirecting…' : `Get ${recPlan.name} →`}
                </button>
              ) : (
                <div style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--ink-mute)', padding: '10px 0' }}>Free forever</div>
              )}
            </>
          )}
        </div>
      </div>
      <style>{`
        @media (max-width: 800px) {
          .rec-layout { grid-template-columns: 1fr !important; }
          .rec-right { border-left: none !important; border-top: 1px solid var(--border-soft) !important; }
        }
      `}</style>
    </div>
  )
}
