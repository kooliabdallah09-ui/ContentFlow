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
  const [recGoals, setRecGoals] = useState<string[]>([])
  const [recVolume, setRecVolume] = useState<string>('')

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
            {upgradeLoading === 'portal' ? 'Opening…' : '⚙ Manage subscription'}
          </button>
        )}
      </div>

      {/* Plans */}
      <div style={{ marginBottom: 32 }}>
        {/* Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
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
        </div>

        {/* Plan cards */}
        <div className="billing-plan-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {plans.map((plan) => {
            const isCurrent = currentPlan === plan.planKey
            const activePriceId = annual ? plan.priceId.annual : plan.priceId.monthly
            const isLoading = upgradeLoading === activePriceId
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
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 4 }}>
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
                ) : activePriceId ? (
                  <button
                    onClick={() => handleUpgrade(activePriceId)}
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
      />

      {/* Credits policy */}
      <div style={{ marginBottom: 24, border: '1px solid var(--border)', borderRadius: 16, background: 'var(--surface)', padding: '20px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px 32px' }}>
        {[
          { icon: '↑', title: 'Upgrading', body: "Your balance resets to the new plan's full monthly allowance. Pack credits are preserved on top." },
          { icon: '↓', title: 'Downgrading', body: "Your current credits are kept and the new plan's credits are added. Nothing is taken away." },
          { icon: '↻', title: 'Monthly renewal', body: "Balance resets to your plan's allowance. Pack credits never expire and always carry over." },
          { icon: '＋', title: 'Credit packs', body: 'Stack on top of your subscription. Survive plan changes and monthly resets — they never disappear.' },
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
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 3 }}>Prefer to pay as you go?</div>
          <p style={{ fontSize: 13, color: 'var(--ink-dim)', margin: 0 }}>One-off credit packs. No subscription, never expire.</p>
        </div>
        <div className="billing-pack-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {creditPacks.map((pack) => (
            <div key={pack.credits} style={{
              border: '1px solid var(--border)', borderRadius: 14,
              padding: '16px 18px', background: 'var(--surface)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>{pack.credits.toLocaleString()} credits</div>
                <div style={{ fontSize: 12, color: 'var(--ink-dim)' }}>{pack.price} · {pack.perCr}</div>
              </div>
              <button
                onClick={() => handlePackCheckout(pack.priceId)}
                disabled={packLoading === pack.priceId}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  border: 'none', background: '#111', color: '#fff',
                  fontWeight: 600, fontSize: 13, cursor: 'pointer', flexShrink: 0,
                  opacity: packLoading === pack.priceId ? 0.5 : 1,
                }}
              >
                {packLoading === pack.priceId ? '…' : 'Buy'}
              </button>
            </div>
          ))}
        </div>
        <style>{`@media (max-width: 700px) { .billing-pack-grid { grid-template-columns: 1fr !important; } }`}</style>
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
const CONTENT_TYPES = [
  { key: 'ugc',        label: 'UGC Video',         sub: 'Talking-head · 9:16',    crEach: 95,  color: '#D97706' },
  { key: 'budget-ugc', label: 'Budget UGC',         sub: 'Seedance Mini',          crEach: 40,  color: '#7C3AED' },
  { key: 'image',      label: 'Product Image',      sub: 'AI photo · studio shot', crEach: 5,   color: '#0EA5E9' },
  { key: 'influencer', label: 'AI Influencer',      sub: 'Lifestyle · portrait',   crEach: 8,   color: '#EC4899' },
  { key: 'cinematic',  label: 'Cinematic Video',    sub: 'Kling · scene video',    crEach: 140, color: '#10B981' },
  { key: 'voiceover',  label: 'Voiceover',          sub: 'ElevenLabs · per clip',  crEach: 10,  color: '#6366F1' },
  { key: 'social',     label: 'Social Caption',     sub: 'AI copywriting',         crEach: 2,   color: '#F59E0B' },
]

const PLAN_CAPS: Record<string, number> = { free: 60, starter: 800, pro: 2000, agency: 6500 }

function PlanRecommender({
  goals, setGoals, currentPlan, annual, plans, onUpgrade, upgradeLoading,
}: {
  goals: string[], setGoals: (g: string[]) => void,
  volume?: string, setVolume?: (v: string) => void,
  currentPlan: string, annual: boolean,
  plans: { name: string, price: { monthly: string, annual: string }, credits: string, priceId: { monthly: string, annual: string }, planKey: string, popular?: boolean, annualTotal?: string | null }[],
  onUpgrade: (id: string) => void, upgradeLoading: string | null,
}) {
  const [qty, setQty] = useState<Record<string, number>>({})
  const [step, setStep] = useState(1)

  const selected = CONTENT_TYPES.filter(t => goals.includes(t.key))
  const totalCr = selected.reduce((sum, t) => sum + (qty[t.key] ?? 1) * t.crEach, 0)

  function toggleType(key: string) {
    const next = goals.includes(key) ? goals.filter(g => g !== key) : [...goals, key]
    setGoals(next)
    if (!qty[key]) setQty(q => ({ ...q, [key]: 1 }))
  }

  function bump(key: string, delta: number) {
    setQty(q => ({ ...q, [key]: Math.max(1, (q[key] ?? 1) + delta) }))
  }

  function getRecKey(): string {
    if (!selected.length) return ''
    if (totalCr > PLAN_CAPS.pro) return 'agency'
    if (totalCr > PLAN_CAPS.starter) return 'pro'
    if (totalCr > PLAN_CAPS.free) return 'starter'
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                {CONTENT_TYPES.map(t => {
                  const active = goals.includes(t.key)
                  return (
                    <button key={t.key} onClick={() => toggleType(t.key)} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px',
                      borderRadius: 12, textAlign: 'left', cursor: 'pointer',
                      border: `1.5px solid ${active ? t.color : 'var(--border)'}`,
                      background: active ? `${t.color}14` : 'var(--surface-2)',
                      transition: 'all 0.15s',
                      position: 'relative',
                    }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, flexShrink: 0, marginTop: 4 }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{t.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{t.sub}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: t.color, marginTop: 4, fontFamily: 'var(--font-mono)' }}>{t.crEach} cr each</div>
                      </div>
                      {active && (
                        <div style={{ position: 'absolute', top: 8, right: 10, width: 16, height: 16, borderRadius: '50%', background: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                        </div>
                      )}
                    </button>
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
                  const subtotal = q * t.crEach
                  return (
                    <div key={t.key} style={{
                      display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                      borderRadius: 12, border: `1px solid var(--border)`, background: 'var(--surface-2)',
                    }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{t.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{t.crEach} cr × {q} = <span style={{ fontWeight: 700, color: t.color }}>{subtotal} cr</span></div>
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
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
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
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{((qty[t.key] ?? 1) * t.crEach).toLocaleString()} cr</span>
                    </div>
                  ))}
                  {selected.length > 4 && <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>+{selected.length - 4} more types</div>}
                </div>
              )}

              {/* CTA */}
              {currentPlan === recPlan.planKey ? (
                <div style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--ink-mute)', fontWeight: 500, padding: '10px 0' }}>
                  ✓ You're already on this plan
                </div>
              ) : recPlan.priceId.monthly ? (
                <button
                  onClick={() => onUpgrade(annual ? recPlan.priceId.annual : recPlan.priceId.monthly)}
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
