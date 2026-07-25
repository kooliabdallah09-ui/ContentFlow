'use client'

// Campaigns list + New Campaign form. Planning is server-side (Sonnet call
// at /api/campaigns/plan) so this page just collects inputs and redirects
// into the shot table on success.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabase } from '@/lib/auth'
import { showError, showSuccess } from '@/lib/notifications'
import { Loader2, Sparkles, Plus, ChevronRight } from 'lucide-react'

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
  const [influencers, setInfluencers] = useState<Array<{ id: string; name: string }>>([])
  const [scenes, setScenes] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)

  // Form state.
  const [name, setName] = useState('')
  const [brief, setBrief] = useState('')
  const [productId, setProductId] = useState('')
  const [goal, setGoal] = useState<'launch' | 'awareness' | 'conversion' | 'evergreen'>('awareness')
  const [durationLabel, setDurationLabel] = useState<'1 week' | '2 weeks' | '1 month'>('2 weeks')
  const [influencerId, setInfluencerId] = useState('')
  const [sceneId, setSceneId] = useState('')
  const [targetCount, setTargetCount] = useState(24)
  const [inspiration, setInspiration] = useState('')
  const [planning, setPlanning] = useState(false)
  const [inlineProductName, setInlineProductName] = useState('')
  const [addingProduct, setAddingProduct] = useState(false)

  async function quickAddProduct() {
    const name = inlineProductName.trim()
    if (!name) return
    setAddingProduct(true)
    const token = await getToken()
    if (!token) { setAddingProduct(false); return }
    try {
      const newProduct: Product = { id: crypto.randomUUID(), name, image_url: null }
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
      showSuccess(`Added ${name}`)
    } finally {
      setAddingProduct(false)
    }
  }

  useEffect(() => { void load() }, [])
  async function load() {
    setLoading(true)
    const token = await getToken()
    if (!token) { setLoading(false); return }
    const [c, p, inf, sc] = await Promise.all([
      fetch('/api/campaigns', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({ campaigns: [] })),
      fetch('/api/brand/products', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({ products: [] })),
      fetch('/api/influencers', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({ influencers: [] })),
      fetch('/api/scenes', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({ scenes: [] })),
    ])
    setCampaigns(c.campaigns ?? [])
    setProducts(p.products ?? [])
    setInfluencers(inf.influencers ?? inf.list ?? [])
    setScenes(sc.scenes ?? sc.list ?? [])
    setLoading(false)
  }

  async function submit() {
    if (!name.trim()) { showError('Give the campaign a name'); return }
    setPlanning(true)
    const token = await getToken()
    if (!token) { setPlanning(false); return }
    try {
      const res = await fetch('/api/campaigns/plan', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, brief, productId: productId || undefined, goal, durationLabel,
          influencerId: influencerId || undefined, sceneId: sceneId || undefined, targetCount,
          inspiration: inspiration || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Planner failed' }))
        showError(err.error ?? 'Planner failed')
        setPlanning(false)
        return
      }
      const data = await res.json()
      showSuccess(`Planned ${data.count} shots`)
      router.push(`/campaigns/${data.id}`)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Planner failed')
    } finally {
      setPlanning(false)
    }
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 700, margin: '0 0 4px' }}>Campaigns</h1>
          <div style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>One product, one brief → an editable shot list for a full week or month of content.</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(v => !v)} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> New campaign
        </button>
      </div>

      {showNew && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 22 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={14} /> Plan a new campaign
          </div>

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

          <Field label="Brief">
            <textarea
              value={brief}
              onChange={e => setBrief(e.target.value)}
              placeholder="Launch campaign for HiGG Watermelon. Gen Z audience, feels summery + spontaneous. Hooks with humor. Mix of vlogs, hero photos, and street interviews."
              rows={4}
              style={{ ...fieldInput, resize: 'vertical', minHeight: 90, marginTop: 12 }}
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginTop: 12 }}>
            <Field label="Goal">
              <select value={goal} onChange={e => setGoal(e.target.value as typeof goal)} style={fieldInput}>
                <option value="launch">Launch</option>
                <option value="awareness">Awareness</option>
                <option value="conversion">Conversion</option>
                <option value="evergreen">Evergreen</option>
              </select>
            </Field>
            <Field label="Duration">
              <select value={durationLabel} onChange={e => setDurationLabel(e.target.value as typeof durationLabel)} style={fieldInput}>
                <option value="1 week">1 week</option>
                <option value="2 weeks">2 weeks</option>
                <option value="1 month">1 month</option>
              </select>
            </Field>
            <Field label="Target shot count">
              <input type="number" min={10} max={40} value={targetCount} onChange={e => setTargetCount(Number(e.target.value))} style={fieldInput} />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 12 }}>
            <Field label="Default actor (optional)">
              <select value={influencerId} onChange={e => setInfluencerId(e.target.value)} style={fieldInput}>
                <option value="">— none —</option>
                {influencers.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </Field>
            <Field label="Default scene (optional)">
              <select value={sceneId} onChange={e => setSceneId(e.target.value)} style={fieldInput}>
                <option value="">— none —</option>
                {scenes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Inspiration notes (optional)">
            <textarea
              value={inspiration}
              onChange={e => setInspiration(e.target.value)}
              placeholder="Paste competitor URLs, hooks you've seen work, references, TikTok trends worth stealing… anything. Sonnet uses this to anchor the shot list to what's actually working right now."
              rows={4}
              style={{ ...fieldInput, resize: 'vertical', minHeight: 90, marginTop: 12 }}
            />
          </Field>

          <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setShowNew(false)} disabled={planning}>Cancel</button>
            <button className="btn btn-primary" onClick={submit} disabled={planning} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {planning ? <><Loader2 size={14} className="spin" /> Planning…</> : <><Sparkles size={14} /> Plan campaign</>}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, display: 'flex', gap: 10, alignItems: 'center', color: 'var(--ink-2)' }}><Loader2 size={16} className="spin" /> Loading…</div>
      ) : campaigns.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-2)', border: '1px dashed var(--border)', borderRadius: 12 }}>
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
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
                textDecoration: 'none', color: 'inherit',
              }}
            >
              {c.meta?.product_image_url ? (
                <img src={c.meta.product_image_url} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--surface-2)' }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{c.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 2 }}>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: 0.4, color: 'var(--ink-2)', marginBottom: 5, textTransform: 'uppercase' }}>{label}</div>
      {children}
    </div>
  )
}

const fieldInput: React.CSSProperties = {
  width: '100%',
  padding: '8px 11px',
  fontSize: 13,
  fontFamily: 'inherit',
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--surface)',
  color: 'var(--ink)',
}
