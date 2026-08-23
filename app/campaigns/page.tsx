'use client'

// Campaigns list + New Campaign form. Planning is server-side (Sonnet call at
// /api/campaigns/plan) so this page just collects inputs and redirects into
// the shot table on success.
//
// The Format Mix panel lets the user pre-allocate how many shots come from
// each category bucket. Sonnet respects that distribution when it writes the
// shot list. Total shots = sum of the mix.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabase } from '@/lib/auth'
import { showError, showSuccess } from '@/lib/notifications'
import { Loader2, Sparkles, Plus, ChevronRight, Coins, User2, Users, Camera, Wand2, Image as ImageIcon, Minus, CheckCircle2 } from 'lucide-react'

// Premium planning indicator — SVG arc that sweeps around while a
// ticker of stage labels cycles through what the server is actually
// doing (brand load → inspiration → trend discovery → Sonnet draft).
// The server call is one blocking request so we can't stream real
// progress; the ticker gives the user something to read while they
// wait and hides that latency behind a felt-fast animation.
function PlanningIndicator({ shotCount }: { shotCount: number }) {
  const stages = useMemo(() => [
    'Reading your brand voice',
    'Scanning inspiration',
    'Discovering trend sources',
    'Sonnet is drafting hooks',
    'Balancing your format mix',
    `Composing ${shotCount} shot${shotCount === 1 ? '' : 's'}`,
    'Finalizing the shot list',
  ], [shotCount])
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI(x => (x + 1) % stages.length), 2200)
    return () => clearInterval(t)
  }, [stages.length])
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <span style={{
        width: 16, height: 16, position: 'relative',
        display: 'inline-block',
      }}>
        <svg width="16" height="16" viewBox="0 0 16 16" style={{ animation: 'cf-plan-spin 900ms linear infinite' }}>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.22" strokeWidth="2" />
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2"
            strokeDasharray="10 30" strokeLinecap="round" />
        </svg>
      </span>
      <span key={i} style={{
        display: 'inline-block',
        fontVariantNumeric: 'tabular-nums',
        animation: 'cf-plan-fade 2200ms ease-in-out',
      }}>{stages[i]}…</span>
      <style>{`
        @keyframes cf-plan-spin { to { transform: rotate(360deg); } }
        @keyframes cf-plan-fade {
          0%   { opacity: 0; transform: translateY(4px); }
          15%  { opacity: 1; transform: translateY(0); }
          85%  { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-4px); }
        }
      `}</style>
    </span>
  )
}

const PLAN_COST = 5

interface Campaign {
  id: string
  name: string
  brief: string | null
  goal: string | null
  duration_label: string | null
  status: string
  shot_count: number
  created_at: string
  meta: { product_name?: string | null; product_image_url?: string | null }
}

interface Product { id: string; name: string; image_url: string | null }

interface Brand {
  companyName?: string
  description?: string
  uniqueValueProp?: string
  targetAudience?: string
  toneOfVoice?: string
}

// Format bucket == CampaignFormat.category. Sonnet only picks format_keys
// from the buckets the user allocated a count to.
interface Bucket {
  key: string      // matches CampaignFormat.category
  label: string
  blurb: string
  icon: React.ReactNode
  suggested: number
}
const BUCKETS: Bucket[] = [
  { key: 'solo',           label: 'UGC — solo',       blurb: 'One person on camera. Selfie, testimonial, hot take, review.',         icon: <User2 size={16} />,    suggested: 6 },
  { key: 'two-person',     label: 'UGC — two-person', blurb: 'Interview, couple, roommate. Two actors, natural banter.',              icon: <Users size={16} />,    suggested: 2 },
  { key: 'motion',         label: 'Product motion',   blurb: 'B-roll, ASMR unbox, kinetic bursts. No dialogue.',                       icon: <Wand2 size={16} />,    suggested: 3 },
  { key: 'transformation', label: 'Transformations',  blurb: 'Before/after, mess-to-fresh, tutorials.',                                icon: <Sparkles size={16} />, suggested: 1 },
  { key: 'photo',          label: 'Photos & stills',  blurb: 'Hero editorial, lifestyle-in-scene, studio still.',                      icon: <ImageIcon size={16} />, suggested: 2 },
  { key: 'social',         label: 'Social posts',     blurb: 'Multi-slide carousels, single feed posts, meme reactions.',              icon: <Camera size={16} />,   suggested: 2 },
]

async function getToken(): Promise<string | null> {
  const supabase = getSupabase()
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

export default function CampaignsPage() {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [brand, setBrand] = useState<Brand | null>(null)
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)

  // Form state.
  const [name, setName] = useState('')
  const [brief, setBrief] = useState('')
  const [productId, setProductId] = useState('')
  const [goal, setGoal] = useState<'launch' | 'awareness' | 'conversion' | 'evergreen'>('awareness')
  const [durationLabel, setDurationLabel] = useState<'1 week' | '2 weeks' | '1 month'>('2 weeks')
  const [inspiration, setInspiration] = useState('')
  const [planning, setPlanning] = useState(false)
  const [inlineProductName, setInlineProductName] = useState('')
  const [addingProduct, setAddingProduct] = useState(false)
  const [mix, setMix] = useState<Record<string, number>>(() =>
    Object.fromEntries(BUCKETS.map(b => [b.key, b.suggested])),
  )

  const totalShots = useMemo(() => Object.values(mix).reduce((a, b) => a + b, 0), [mix])
  const bumpMix = (key: string, delta: number) =>
    setMix(m => ({ ...m, [key]: Math.max(0, Math.min(20, (m[key] ?? 0) + delta)) }))

  async function quickAddProduct() {
    const productName = inlineProductName.trim()
    if (!productName) return
    setAddingProduct(true)
    const token = await getToken()
    if (!token) { setAddingProduct(false); return }
    try {
      const newProduct: Product = { id: crypto.randomUUID(), name: productName, image_url: null }
      const next = [...products, newProduct]
      const res = await fetch('/api/brand/products', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: next }),
      })
      if (!res.ok) { showError('Could not save product'); return }
      setProducts(next)
      setProductId(newProduct.id)
      setInlineProductName('')
      showSuccess(`Added ${productName}`)
    } finally {
      setAddingProduct(false)
    }
  }

  useEffect(() => { void load() }, [])
  async function load() {
    setLoading(true)
    const token = await getToken()
    if (!token) { setLoading(false); return }
    const [c, p, b] = await Promise.all([
      fetch('/api/campaigns', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({ campaigns: [] })),
      fetch('/api/brand/products', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({ products: [] })),
      fetch('/api/brand/load', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({})),
    ])
    setCampaigns(c.campaigns ?? [])
    setProducts(p.products ?? [])
    // /api/brand/load returns { profile: row } with snake_case columns.
    const rawBrand = (b?.profile ?? b?.brand ?? b) ?? {}
    setBrand({
      companyName:     rawBrand.company_name ?? rawBrand.companyName ?? undefined,
      description:     rawBrand.description ?? undefined,
      uniqueValueProp: rawBrand.unique_value_prop ?? rawBrand.uniqueValueProp ?? undefined,
      targetAudience:  rawBrand.target_audience ?? rawBrand.targetAudience ?? undefined,
      toneOfVoice:     rawBrand.tone_of_voice ?? rawBrand.toneOfVoice ?? undefined,
    })
    setLoading(false)
  }

  function fillBriefFromBrand() {
    if (!brand) return
    const product = products.find(p => p.id === productId)
    const lines: string[] = []
    const goalPhrase = ({
      launch: 'Launch campaign',
      awareness: 'Awareness campaign',
      conversion: 'Conversion-focused campaign',
      evergreen: 'Evergreen content series',
    } as const)[goal]
    lines.push(`${goalPhrase} for ${brand.companyName ?? 'our brand'}${product ? ` — featuring ${product.name}` : ''}.`)
    if (brand.targetAudience) lines.push(`Audience: ${brand.targetAudience}.`)
    if (brand.toneOfVoice)    lines.push(`Tone: ${brand.toneOfVoice}.`)
    if (brand.uniqueValueProp) lines.push(`What makes it worth talking about: ${brand.uniqueValueProp}.`)
    if (brand.description && !brand.uniqueValueProp) lines.push(brand.description)
    setBrief(lines.join(' '))
  }

  async function submit() {
    if (!name.trim()) { showError('Give the campaign a name'); return }
    if (totalShots < 3) { showError('Pick at least 3 shots across the format mix'); return }
    setPlanning(true)
    const token = await getToken()
    if (!token) { setPlanning(false); return }
    try {
      const res = await fetch('/api/campaigns/plan', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, brief, productId: productId || undefined, goal, durationLabel,
          targetCount: totalShots,
          formatMix: mix,
          inspiration: inspiration || undefined,
        }),
      })
      const raw = await res.text()
      let data: { id?: string; count?: number; error?: string } = {}
      try { data = raw ? JSON.parse(raw) : {} } catch {
        if (res.status === 504) throw new Error('Planner timed out. Try again — usually works on retry.')
        if (res.status === 413) throw new Error('Request too large. Trim the brief and try again.')
        throw new Error(`Server returned an unexpected response (${res.status}).`)
      }
      if (!res.ok) throw new Error(data.error ?? 'Planner failed')
      showSuccess(`Planned ${data.count} shots · charged ${PLAN_COST} cr`)
      router.push(`/campaigns/${data.id}`)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Planner failed')
    } finally {
      setPlanning(false)
    }
  }

  return (
    <div style={{ padding: '32px 32px 80px', maxWidth: 1180, margin: '0 auto' }}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 6px', letterSpacing: -0.5 }}>Campaigns</h1>
          <div style={{ fontSize: 14, color: 'var(--ink-2)', maxWidth: 620, lineHeight: 1.5 }}>
            One product, one brief → an editable shot list for a full week or month of content. Pick the format mix, we plan the calendar.
          </div>
        </div>
        {!showNew && (
          <button className="btn btn-primary" onClick={() => setShowNew(true)} style={{ fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px' }}>
            <Plus size={15} /> New campaign
          </button>
        )}
      </div>

      {/* ── New campaign form ─────────────────────────────────── */}
      {showNew && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 0,
          marginBottom: 28,
          overflow: 'hidden',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02), 0 8px 24px rgba(0,0,0,0.04)',
        }}>
          {/* Form header */}
          <div style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-2, var(--surface))',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--ink)', color: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={16} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Plan a new campaign</div>
                <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>Sonnet drafts every shot from your brief + format mix.</div>
              </div>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px',
              fontSize: 12, fontWeight: 600,
              background: 'var(--hover, rgba(0,0,0,0.04))',
              color: 'var(--ink)',
              borderRadius: 999,
            }}>
              <Coins size={13} /> {PLAN_COST} cr to plan
            </div>
          </div>

          {/* ── Brand context banner ─────────────────── */}
          {brand?.companyName && (
            <div style={{
              padding: '10px 24px',
              display: 'flex', alignItems: 'center', gap: 10,
              fontSize: 12.5, color: 'var(--ink-2)',
              background: 'var(--surface-2, rgba(0,0,0,0.02))',
              borderBottom: '1px solid var(--border)',
            }}>
              <CheckCircle2 size={14} style={{ color: 'var(--success, #059669)', flexShrink: 0 }} />
              <span>
                Using your <strong style={{ color: 'var(--ink)' }}>Brand</strong> — Sonnet already knows{' '}
                <strong style={{ color: 'var(--ink)' }}>{brand.companyName}</strong>
                {brand.toneOfVoice ? `, your ${brand.toneOfVoice.split(/[,.]/)[0].toLowerCase().trim()} tone` : ''}
                {brand.targetAudience ? `, and your audience` : ''}.
                No need to repeat it in the brief.
              </span>
              <Link href="/brand" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink-2)', textDecoration: 'underline', whiteSpace: 'nowrap' }}>Edit brand</Link>
            </div>
          )}

          {/* ── SECTION: Basics ───────────────────────── */}
          <Section title="Basics" subtitle="Name it, tag a product, tell Sonnet what this campaign is for.">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Name">
                <input value={name} onChange={e => setName(e.target.value)} placeholder="HiGG summer launch" style={fieldInput} />
              </Field>
              <Field label="Product">
                {products.length > 0 ? (
                  <select value={productId} onChange={e => setProductId(e.target.value)} style={fieldInput}>
                    <option value="">— none —</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                ) : (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      value={inlineProductName}
                      onChange={e => setInlineProductName(e.target.value)}
                      placeholder="Type a product name to add it"
                      style={{ ...fieldInput, flex: 1 }}
                    />
                    <button
                      className="btn btn-ghost"
                      onClick={quickAddProduct}
                      disabled={!inlineProductName.trim() || addingProduct}
                      style={{ fontSize: 12, padding: '8px 12px', whiteSpace: 'nowrap' }}
                    >
                      {addingProduct ? '…' : '+ Add'}
                    </button>
                  </div>
                )}
              </Field>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: 0.4, color: 'var(--ink-2)', textTransform: 'uppercase' }}>Brief</div>
                {brand?.companyName && (
                  <button
                    type="button"
                    onClick={fillBriefFromBrand}
                    style={{
                      fontSize: 11.5, color: 'var(--ink)', background: 'transparent',
                      border: '1px solid var(--border)', borderRadius: 6,
                      padding: '4px 10px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}
                  >
                    <Sparkles size={12} /> Draft from brand
                  </button>
                )}
              </div>
              <textarea
                value={brief}
                onChange={e => setBrief(e.target.value)}
                placeholder="Launch campaign for HiGG Watermelon. Gen Z audience, feels summery + spontaneous. Hooks with humor. Mix of vlogs, hero photos, and street interviews."
                rows={4}
                style={{ ...fieldInput, resize: 'vertical', minHeight: 96 }}
              />
              <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 6 }}>
                Audience, tone, angle, and anything specific about what should feel unique.
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Goal">
                <select value={goal} onChange={e => setGoal(e.target.value as typeof goal)} style={fieldInput}>
                  <option value="launch">Launch — introduce the product</option>
                  <option value="awareness">Awareness — build recognition</option>
                  <option value="conversion">Conversion — drive purchases</option>
                  <option value="evergreen">Evergreen — always-on content</option>
                </select>
              </Field>
              <Field label="Duration">
                <select value={durationLabel} onChange={e => setDurationLabel(e.target.value as typeof durationLabel)} style={fieldInput}>
                  <option value="1 week">1 week</option>
                  <option value="2 weeks">2 weeks</option>
                  <option value="1 month">1 month</option>
                </select>
              </Field>
            </div>
          </Section>

          {/* ── SECTION: Format Mix ───────────────────── */}
          <Section
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                Format mix
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-2)' }}>· <strong style={{ color: 'var(--ink)' }}>{totalShots}</strong> shot{totalShots === 1 ? '' : 's'} total</span>
              </span>
            }
            subtitle="Pick how many shots you want from each bucket. Sonnet will match this distribution."
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {BUCKETS.map(b => {
                const count = mix[b.key] ?? 0
                const active = count > 0
                return (
                  <div
                    key={b.key}
                    style={{
                      border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                      background: active ? 'var(--surface)' : 'var(--bg-elev, var(--surface))',
                      borderRadius: 12,
                      padding: 14,
                      display: 'flex', flexDirection: 'column', gap: 12,
                      transition: 'border-color 120ms, background 120ms',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 26, height: 26, borderRadius: 6,
                          background: active ? 'var(--ink)' : 'var(--hover, rgba(0,0,0,0.06))',
                          color: active ? 'var(--surface)' : 'var(--ink)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>{b.icon}</div>
                        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{b.label}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5, minHeight: 34 }}>{b.blurb}</div>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '6px 6px 6px 12px',
                      background: 'var(--hover, rgba(0,0,0,0.03))',
                      borderRadius: 8,
                    }}>
                      <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>Shots</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button
                          type="button"
                          onClick={() => bumpMix(b.key, -1)}
                          disabled={count === 0}
                          style={stepperBtn}
                          aria-label={`Decrease ${b.label}`}
                        ><Minus size={13} /></button>
                        <span style={{ minWidth: 22, textAlign: 'center', fontVariantNumeric: 'tabular-nums', fontSize: 14, fontWeight: 600 }}>{count}</span>
                        <button
                          type="button"
                          onClick={() => bumpMix(b.key, +1)}
                          disabled={count >= 20}
                          style={stepperBtn}
                          aria-label={`Increase ${b.label}`}
                        ><Plus size={13} /></button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            {totalShots > 40 && (
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--warning, #b45309)' }}>
                40 shots max — Sonnet will cap the plan there.
              </div>
            )}
          </Section>

          {/* ── SECTION: Inspiration ──────────────────── */}
          <Section title="Inspiration" subtitle="Optional. Paste competitor URLs, TikTok links, or trends worth stealing. Sonnet reads them and anchors hooks to what's actually working right now.">
            <textarea
              value={inspiration}
              onChange={e => setInspiration(e.target.value)}
              placeholder="Paste competitor URLs, hooks you've seen work, references, TikTok trends worth stealing… anything."
              rows={4}
              style={{ ...fieldInput, resize: 'vertical', minHeight: 96 }}
            />
          </Section>

          {/* ── Footer / actions ─────────────────────── */}
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            background: 'var(--surface-2, var(--surface))',
          }}>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Camera size={13} /> {totalShots} shot{totalShots === 1 ? '' : 's'} planned · then render each one on the shot table
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setShowNew(false)} disabled={planning}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={submit}
                disabled={planning || totalShots < 3}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  minWidth: planning ? 300 : undefined,
                  justifyContent: 'center',
                  transition: 'min-width 200ms ease',
                }}
              >
                {planning
                  ? <PlanningIndicator shotCount={totalShots} />
                  : <><Sparkles size={14} /> Plan campaign · {PLAN_COST} cr</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Campaigns list ─────────────────────────────────────── */}
      {loading ? (
        <div style={{ padding: 40, display: 'flex', gap: 10, alignItems: 'center', color: 'var(--ink-2)' }}><Loader2 size={16} className="animate-spin" /> Loading…</div>
      ) : campaigns.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-2)', border: '1px dashed var(--border)', borderRadius: 14 }}>
          No campaigns yet. Click <strong>New campaign</strong> to draft your first shot list.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {campaigns.map(c => (
            <Link
              key={c.id}
              href={`/campaigns/${c.id}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '14px 16px',
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
                textDecoration: 'none', color: 'inherit',
                transition: 'border-color 120ms',
              }}
            >
              {c.meta?.product_image_url ? (
                <img src={c.meta.product_image_url} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--surface-2)' }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{c.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 3 }}>
                  {c.shot_count} shots · {c.goal ?? '—'} · {c.duration_label ?? '—'}
                  {c.meta?.product_name ? ` · ${c.meta.product_name}` : ''}
                </div>
              </div>
              <ChevronRight size={16} style={{ color: 'var(--ink-2)' }} />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function Section({ title, subtitle, children }: { title: React.ReactNode; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 4 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 16, lineHeight: 1.5 }}>{subtitle}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: 0.4, color: 'var(--ink-2)', marginBottom: 6, textTransform: 'uppercase' }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 6 }}>{hint}</div>}
    </div>
  )
}

const fieldInput: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: 13,
  fontFamily: 'inherit',
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--surface)',
  color: 'var(--ink)',
}

const stepperBtn: React.CSSProperties = {
  width: 26, height: 26, borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--ink)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
  padding: 0,
}
