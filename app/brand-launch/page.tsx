'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { canAccessBrandLaunch } from '@/lib/pov-access'

interface Brand {
  id: string
  niche: string
  niche_angle: string
  name: string | null
  logo_url: string | null
  colors: { primary?: string } | null
  status: string
  wizard_step: number
  created_at: string
}

export default function BrandLaunchPage() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const router = useRouter()

  useEffect(() => {
    (async () => {
      const supa = getSupabase()
      if (!supa) return
      const { data: sess } = await supa.auth.getSession()
      const token = sess?.session?.access_token
      const email = sess?.session?.user?.email
      if (!token || !canAccessBrandLaunch(email)) { setLoading(false); return }

      const res = await fetch('/api/brand-launch', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setBrands(data.brands ?? [])
      setLoading(false)
    })()
  }, [])

  const startNew = async () => {
    setCreating(true)
    const supa = getSupabase()
    if (!supa) return
    const { data: sess } = await supa.auth.getSession()
    const token = sess?.session?.access_token
    if (!token) return

    const res = await fetch('/api/brand-launch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ niche: '' }),
    })
    const data = await res.json()
    if (data.brandId) router.push(`/brand-launch/new?id=${data.brandId}`)
    setCreating(false)
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 20px 60px' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-serif)', letterSpacing: '-0.03em' }}>
          Launch <em>Your Brand.</em>
        </h1>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--ink-dim)', lineHeight: 1.6 }}>
          AI builds your brand identity, product strategy, and launch content — ready for Shopify in minutes.
        </p>

        <button onClick={startNew} disabled={creating} className="btn-primary" style={{ padding: '11px 24px' }}>
          {creating ? 'Creating…' : '+ Start new brand'}
        </button>
      </div>

      {/* What you get */}
      {!loading && brands.length === 0 && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 40 }}>
            {[
              { icon: '🎯', label: 'Niche discovery', desc: 'AI finds a profitable niche for you' },
              { icon: '🎨', label: 'Brand identity', desc: 'Name, logo, colors, and voice' },
              { icon: '📦', label: 'Product strategy', desc: '8 winning products with margins' },
              { icon: '📢', label: 'Launch content', desc: 'Ads, social posts, email — done' },
              { icon: '🛒', label: 'Shopify ready', desc: 'Download a brand kit and import' },
            ].map(item => (
              <div key={item.label} style={{ padding: '20px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{item.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-dim)', lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', padding: '40px 20px', borderRadius: 16, border: '1px solid var(--border-soft)', background: 'var(--surface)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🚀</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Build your first brand</div>
            <div style={{ fontSize: 13, color: 'var(--ink-dim)', marginBottom: 20 }}>Takes about 5 minutes. 17 credits total.</div>
            <button onClick={startNew} disabled={creating} className="btn-primary" style={{ padding: '12px 28px' }}>
              {creating ? 'Creating…' : 'Get started →'}
            </button>
          </div>
        </div>
      )}

      {/* Existing brands */}
      {brands.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink-mute)', marginBottom: 12 }}>Your brands</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {brands.map(brand => (
              <Link
                key={brand.id}
                href={brand.status === 'complete' ? `/brand-launch/${brand.id}` : `/brand-launch/new?id=${brand.id}`}
                style={{ textDecoration: 'none' }}
              >
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', borderRadius: 12,
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  cursor: 'pointer', transition: 'border-color 0.15s',
                }}>
                  {brand.logo_url ? (
                    <img src={brand.logo_url} alt="" style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--border)', background: '#fff', padding: 4 }} />
                  ) : (
                    <div style={{ width: 44, height: 44, borderRadius: 8, background: brand.colors?.primary || 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{(brand.name || brand.niche || '?').charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{brand.name || brand.niche || 'New brand'}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-dim)' }}>{brand.niche}{brand.niche_angle ? ` · ${brand.niche_angle}` : ''}</div>
                  </div>
                  <div>
                    {brand.status === 'complete' ? (
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--good)', background: 'rgba(47,122,78,0.08)', border: '1px solid rgba(47,122,78,0.2)', borderRadius: 6, padding: '3px 8px' }}>Complete</span>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-mute)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px' }}>Step {brand.wizard_step}/5</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
