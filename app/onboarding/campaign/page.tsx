'use client'

// Onboarding step: "Plan your first campaign" — a lightweight preview that
// generates 6 shot ideas so the user sees ContentFlow's output within seconds
// of finishing signup. From the dashboard they can expand this into a full
// 24-shot campaign whenever they're ready.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabase } from '@/lib/auth'
import { showError } from '@/lib/notifications'
import { Loader2, Sparkles, ArrowRight, SkipForward } from 'lucide-react'

interface PreviewShot {
  position: number
  format_key: string
  format_label: string
  hook: string
  setting: string
  caption: string
  aspect?: string
  duration?: number
}

interface Product { id: string; name: string; image_url: string | null }

async function getToken(): Promise<string | null> {
  const supabase = getSupabase()
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

export default function OnboardingCampaignPage() {
  const router = useRouter()
  const [brief, setBrief] = useState('')
  const [productId, setProductId] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [planning, setPlanning] = useState(false)
  const [preview, setPreview] = useState<{ id: string; shots: PreviewShot[] } | null>(null)

  useEffect(() => {
    void (async () => {
      const token = await getToken()
      if (!token) return
      const res = await fetch('/api/brand/products', { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const data = await res.json()
        setProducts(data.products ?? [])
      }
    })()
  }, [])

  async function generatePreview() {
    setPlanning(true)
    const token = await getToken()
    if (!token) { setPlanning(false); return }
    try {
      const res = await fetch('/api/campaigns/plan-lite', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief: brief.trim() || undefined, productId: productId || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { showError(data.error ?? 'Preview failed'); return }
      setPreview({ id: data.id, shots: data.shots ?? [] })
    } finally {
      setPlanning(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, background: 'var(--surface-2, #fafaf9)' }}>
      <div style={{ maxWidth: 780, width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 36, boxShadow: '0 20px 60px rgba(0,0,0,0.06)' }}>

        {!preview ? (
          <>
            <div style={{ marginBottom: 8, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>Step 3 of 3</div>
            <h1 style={{ fontFamily: 'var(--font-serif, serif)', fontSize: 36, lineHeight: 1.1, margin: '0 0 10px' }}>
              Let&apos;s see what ContentFlow can do for you.
            </h1>
            <p style={{ fontSize: 14.5, color: 'var(--ink-2)', lineHeight: 1.55, margin: '0 0 26px' }}>
              We&apos;ll draft six sample content ideas from your brand — hooks, settings, formats, all editable. This takes about 10 seconds. You can expand it into a full 24-shot campaign later.
            </p>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 0.5, color: 'var(--ink-2)', marginBottom: 6, textTransform: 'uppercase' }}>What&apos;s the campaign about? (optional)</div>
              <textarea
                value={brief}
                onChange={e => setBrief(e.target.value)}
                placeholder="e.g. Launch push for our summer flavor. Gen Z audience, feels bright and spontaneous."
                rows={3}
                style={{ width: '100%', padding: '11px 14px', fontSize: 14, fontFamily: 'inherit', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', color: 'var(--ink)', resize: 'vertical', minHeight: 76 }}
              />
            </div>

            {products.length > 0 && (
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 0.5, color: 'var(--ink-2)', marginBottom: 6, textTransform: 'uppercase' }}>Product (optional)</div>
                <select value={productId} onChange={e => setProductId(e.target.value)} style={{ width: '100%', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', color: 'var(--ink)' }}>
                  <option value="">— use my brand generally —</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                onClick={() => router.replace('/dashboard')}
                className="btn btn-ghost"
                style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <SkipForward size={14} /> Skip for now
              </button>
              <button
                onClick={generatePreview}
                disabled={planning}
                className="btn btn-primary"
                style={{ fontSize: 14, padding: '12px 22px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                {planning ? <><Loader2 size={15} className="animate-spin" /> Drafting…</> : <><Sparkles size={15} /> Show me the preview</>}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 8, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#166534' }}>Preview ready</div>
            <h1 style={{ fontFamily: 'var(--font-serif, serif)', fontSize: 30, lineHeight: 1.15, margin: '0 0 10px' }}>
              Here are six ideas for your first campaign.
            </h1>
            <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.55, margin: '0 0 22px' }}>
              This is a sample of what ContentFlow can generate. You can edit any of these, expand to a full 24-shot campaign, or send them straight to the Builder.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
              {preview.shots.map(s => (
                <div key={s.position} style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface-2, #fafaf9)' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)' }}>#{s.position}</span>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{s.format_label}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-2)' }}>{s.aspect ?? '9:16'} · {s.duration ? `${s.duration}s` : 'photo'}</span>
                  </div>
                  <div style={{ fontSize: 13.5, lineHeight: 1.5, marginBottom: 4 }}>
                    <strong>Hook:</strong> {s.hook}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                    <strong>Setting:</strong> {s.setting}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Link href="/dashboard" className="btn btn-ghost" style={{ fontSize: 13 }}>Go to dashboard</Link>
              <Link href={`/campaigns/${preview.id}`} className="btn btn-primary" style={{ fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                Open this campaign <ArrowRight size={14} />
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
