'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/auth'
import { useParams, useRouter } from 'next/navigation'
import { canAccessBrandLaunch } from '@/lib/pov-access'
import Link from 'next/link'

interface BrandColors {
  primary: string
  accent: string
  bg: string
  text: string
}

interface BrandVoice {
  tagline: string
  bio: string
  tone: string[]
  personality: string
}

interface Product {
  name: string
  description: string
  category: string
  price: number
  margin: number
}

interface SocialPost { label: string; caption: string }
interface LaunchContent {
  social: SocialPost[]
  ad: { headline: string; primary_text: string; cta: string }
  email: { subject: string; preview: string; body: string }
}

interface Brand {
  id: string
  niche: string
  niche_angle: string
  name: string
  logo_url: string | null
  colors: BrandColors | null
  voice: BrandVoice | null
  products: Product[]
  content: LaunchContent | null
  status: string
  wizard_step: number
  created_at: string
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      style={{ fontSize: 11, color: 'var(--ink-dim)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

type Tab = 'identity' | 'products' | 'content'

export default function BrandDashboardPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [brand, setBrand] = useState<Brand | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('identity')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    (async () => {
      const supa = getSupabase()
      if (!supa) return
      const { data: sess } = await supa.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) { router.replace('/auth/login'); return }

      const email = sess?.session?.user?.email
      if (!canAccessBrandLaunch(email)) { router.replace('/dashboard'); return }

      const res = await fetch(`/api/brand-launch/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) { router.replace('/brand-launch'); return }
      const data = await res.json()
      setBrand(data.brand)
      setLoading(false)
    })()
  }, [id, router])

  const handleDelete = async () => {
    if (!confirm(`Delete ${brand?.name || 'this brand'}? This cannot be undone.`)) return
    setDeleting(true)
    const supa = getSupabase()
    if (!supa) return
    const { data: sess } = await supa.auth.getSession()
    const token = sess?.session?.access_token
    if (!token) return
    await fetch(`/api/brand-launch/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    router.replace('/brand-launch')
  }

  const downloadKit = () => {
    if (!brand) return
    const kit = {
      brand: { name: brand.name, niche: brand.niche, tagline: brand.voice?.tagline, bio: brand.voice?.bio, tone: brand.voice?.tone },
      colors: brand.colors,
      logo: brand.logo_url,
      products: brand.products,
      content: brand.content,
    }
    const blob = new Blob([JSON.stringify(kit, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(brand.name || 'brand').replace(/\s+/g, '-').toLowerCase()}-brand-kit.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return null

  if (!brand) return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 14, color: 'var(--ink-dim)' }}>Brand not found.</div>
      <Link href="/brand-launch" style={{ fontSize: 13, color: 'var(--ink-dim)' }}>← Back to brands</Link>
    </div>
  )

  if (brand.status !== 'complete') {
    return (
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Brand setup not finished</div>
        <div style={{ fontSize: 13, color: 'var(--ink-dim)', marginBottom: 20 }}>Complete the wizard to view your brand dashboard.</div>
        <Link href={`/brand-launch/new?id=${brand.id}`} className="btn-primary" style={{ padding: '10px 20px', display: 'inline-block' }}>
          Continue wizard →
        </Link>
      </div>
    )
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'identity', label: 'Identity' },
    { key: 'products', label: `Products (${brand.products?.length || 0})` },
    { key: 'content', label: 'Content' },
  ]

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 20px 60px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Link href="/brand-launch" style={{ fontSize: 12, color: 'var(--ink-dim)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
          ← All brands
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {brand.logo_url ? (
            <img src={brand.logo_url} alt="Logo" style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 10, border: '1px solid var(--border)', background: '#fff', padding: 6 }} />
          ) : (
            <div style={{ width: 56, height: 56, borderRadius: 10, background: brand.colors?.primary || 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{brand.name.charAt(0)}</span>
            </div>
          )}
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: '0 0 2px', fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink)' }}>{brand.name}</h1>
            <div style={{ fontSize: 13, color: 'var(--ink-dim)' }}>{brand.niche}{brand.niche_angle ? ` · ${brand.niche_angle}` : ''}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={downloadKit} className="btn" style={{ fontSize: 13, padding: '8px 14px' }}>↓ Brand kit</button>
            <button onClick={handleDelete} disabled={deleting} style={{ fontSize: 13, padding: '8px 14px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', color: 'var(--danger)' }}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>

        {brand.voice?.tagline && (
          <div style={{ marginTop: 12, fontSize: 15, fontStyle: 'italic', fontFamily: 'var(--font-serif)', color: 'var(--ink-2)' }}>
            &ldquo;{brand.voice.tagline}&rdquo;
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: tab === t.key ? 600 : 400, cursor: 'pointer',
              background: 'none', border: 'none',
              color: tab === t.key ? 'var(--ink)' : 'var(--ink-dim)',
              borderBottom: `2px solid ${tab === t.key ? 'var(--ink)' : 'transparent'}`,
              marginBottom: -1, transition: 'color 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Identity tab */}
      {tab === 'identity' && brand.colors && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink-mute)', marginBottom: 12 }}>Color palette</div>
            <div style={{ display: 'flex', gap: 20 }}>
              {([['primary', 'Primary'], ['accent', 'Accent'], ['bg', 'Background'], ['text', 'Text']] as const).map(([key, label]) => (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 8, background: brand.colors![key], border: '1px solid var(--border)' }} />
                  <span style={{ fontSize: 10, color: 'var(--ink-dim)', fontFamily: 'var(--font-mono)' }}>{brand.colors![key]}</span>
                  <span style={{ fontSize: 10, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {brand.voice && (
            <div style={{ padding: '20px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink-mute)', marginBottom: 12 }}>Brand voice</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-serif)', color: 'var(--ink)', marginBottom: 8 }}>&ldquo;{brand.voice.tagline}&rdquo;</div>
              <div style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 12 }}>{brand.voice.bio}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 10 }}>{brand.voice.personality}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {brand.voice.tone.map(t => (
                  <span key={t} style={{ fontSize: 11, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px', color: 'var(--ink-dim)' }}>{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Generate more content shortcuts */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink-mute)', marginBottom: 12 }}>Generate more</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link href="/generate/social" style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 13, color: 'var(--ink)', textDecoration: 'none' }}>Social posts</Link>
              <Link href="/generate/vox" style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 13, color: 'var(--ink)', textDecoration: 'none' }}>Brand video</Link>
              <Link href="/generate/image" style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 13, color: 'var(--ink)', textDecoration: 'none' }}>Product images</Link>
              <Link href="/generate/podcast-ad" style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 13, color: 'var(--ink)', textDecoration: 'none' }}>Podcast ad</Link>
            </div>
          </div>
        </div>
      )}

      {/* Products tab */}
      {tab === 'products' && (
        <div>
          {(!brand.products || brand.products.length === 0) ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink-dim)' }}>No products saved.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {brand.products.map(p => (
                <div key={p.name} style={{ padding: '16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)' }}>
                  <div style={{ fontSize: 11, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{p.category}</div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 6 }}>{p.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5, marginBottom: 12 }}>{p.description}</div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>${p.price}</div>
                      <div style={{ fontSize: 10, color: 'var(--ink-mute)' }}>retail</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--good)' }}>{p.margin}%</div>
                      <div style={{ fontSize: 10, color: 'var(--ink-mute)' }}>margin</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Content tab */}
      {tab === 'content' && (
        <div>
          {!brand.content ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink-dim)' }}>No content generated yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink-mute)', marginBottom: 10 }}>Social Media Posts</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {brand.content.social?.map(post => (
                    <div key={post.label} style={{ padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{post.label}</span>
                        <CopyButton text={post.caption} />
                      </div>
                      <div style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{post.caption}</div>
                    </div>
                  ))}
                </div>
              </div>

              {brand.content.ad && (
                <div style={{ padding: '16px 20px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink-mute)' }}>Paid Ad (Meta)</div>
                    <CopyButton text={`${brand.content.ad.headline}\n\n${brand.content.ad.primary_text}\n\n${brand.content.ad.cta}`} />
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>{brand.content.ad.headline}</div>
                  <div style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 10 }}>{brand.content.ad.primary_text}</div>
                  <span style={{ fontSize: 12, fontWeight: 600, background: 'var(--ink)', color: 'var(--on-ink)', borderRadius: 6, padding: '4px 10px' }}>{brand.content.ad.cta}</span>
                </div>
              )}

              {brand.content.email && (
                <div style={{ padding: '16px 20px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink-mute)' }}>Launch Email</div>
                    <CopyButton text={`Subject: ${brand.content.email.subject}\nPreview: ${brand.content.email.preview}\n\n${brand.content.email.body}`} />
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink-mute)', marginBottom: 2 }}>Subject</div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 8 }}>{brand.content.email.subject}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-mute)', marginBottom: 2 }}>Preview text</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-dim)', marginBottom: 10 }}>{brand.content.email.preview}</div>
                  <div style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{brand.content.email.body}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
