'use client'

import { useState, useCallback } from 'react'
import { getSupabase } from '@/lib/auth'
import { useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Niche {
  name: string
  angle: string
  why: string
  target_audience: string
  example_products: string[]
}

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
  cost: number
  margin: number
  why: string
  selected?: boolean
}

interface SocialPost {
  label: string
  caption: string
}

interface LaunchContent {
  social: SocialPost[]
  ad: { headline: string; primary_text: string; cta: string }
  email: { subject: string; preview: string; body: string }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getToken(): Promise<string | null> {
  const supa = getSupabase()
  if (!supa) return null
  const { data } = await supa.auth.getSession()
  return data.session?.access_token ?? null
}

async function apiFetch(path: string, body: Record<string, unknown>) {
  const token = await getToken()
  if (!token) throw new Error('Not authenticated')
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

async function apiPatch(path: string, body: Record<string, unknown>) {
  const token = await getToken()
  if (!token) throw new Error('Not authenticated')
  const res = await fetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

function ColorSwatch({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 40, height: 40, borderRadius: 8, background: color, border: '1px solid var(--border)' }} />
      <span style={{ fontSize: 10, color: 'var(--ink-dim)', fontFamily: 'var(--font-mono)' }}>{color}</span>
      <span style={{ fontSize: 10, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
    </div>
  )
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

// ─── Step Components ──────────────────────────────────────────────────────────

function StepNiche({ brandId, onDone }: { brandId: string; onDone: (niche: string, angle: string, audience: string) => void }) {
  const [topic, setTopic] = useState('')
  const [niches, setNiches] = useState<Niche[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Niche | null>(null)

  const generate = async () => {
    setLoading(true); setError('')
    try {
      const data = await apiFetch('/api/brand-launch/niche', { topic })
      setNiches(data.niches)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  const confirm = async () => {
    if (!selected) return
    await apiPatch(`/api/brand-launch/${brandId}`, {
      niche: selected.name,
      niche_angle: selected.angle,
      wizard_step: 2,
    })
    onDone(selected.name, selected.angle, selected.target_audience)
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-serif)', letterSpacing: '-0.02em' }}>
        What&apos;s your niche?
      </h2>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--ink-dim)' }}>
        Describe your passion or interest, and AI will suggest 3 winning niches. Or leave blank to get trending ideas.
      </p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <input
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder="e.g. fitness, home decor, pets, travel..."
          className="input"
          style={{ flex: 1 }}
          onKeyDown={e => e.key === 'Enter' && generate()}
        />
        <button
          onClick={generate}
          disabled={loading}
          className="btn-primary"
          style={{ padding: '0 20px', whiteSpace: 'nowrap' }}
        >
          {loading ? 'Finding niches…' : 'Find niches'}
        </button>
      </div>

      {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {niches.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {niches.map((n) => (
            <div
              key={n.name}
              onClick={() => setSelected(n)}
              style={{
                padding: '16px 20px',
                borderRadius: 12,
                border: `2px solid ${selected?.name === n.name ? 'var(--ink)' : 'var(--border)'}`,
                background: selected?.name === n.name ? 'var(--accent-soft)' : 'var(--surface)',
                cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 2 }}>{n.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-dim)', fontStyle: 'italic', marginBottom: 8 }}>for {n.angle}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 6 }}>{n.why}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {n.example_products.map(p => (
                      <span key={p} style={{ fontSize: 11, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px', color: 'var(--ink-dim)' }}>{p}</span>
                    ))}
                  </div>
                </div>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${selected?.name === n.name ? 'var(--ink)' : 'var(--border)'}`,
                  background: selected?.name === n.name ? 'var(--ink)' : 'transparent',
                  marginTop: 2,
                }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <button onClick={confirm} className="btn-primary" style={{ width: '100%', padding: '13px' }}>
          Continue with {selected.name} →
        </button>
      )}
    </div>
  )
}

function StepIdentity({
  brandId, niche, angle, targetAudience,
  onDone,
}: {
  brandId: string; niche: string; angle: string; targetAudience: string
  onDone: (name: string, colors: BrandColors, voice: BrandVoice) => void
}) {
  const [identity, setIdentity] = useState<{ names: string[]; colors: BrandColors; voice: BrandVoice } | null>(null)
  const [selectedName, setSelectedName] = useState('')
  const [loading, setLoading] = useState(false)
  const [logoLoading, setLogoLoading] = useState(false)
  const [logoUrl, setLogoUrl] = useState('')
  const [error, setError] = useState('')
  const [logoError, setLogoError] = useState('')

  const generate = async () => {
    setLoading(true); setError('')
    try {
      const data = await apiFetch('/api/brand-launch/identity', { niche, angle, targetAudience })
      setIdentity(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  const generateLogo = async () => {
    if (!selectedName || !identity) return
    setLogoLoading(true); setLogoError('')
    try {
      const data = await apiFetch('/api/brand-launch/logo', {
        name: selectedName, primaryColor: identity.colors.primary, niche,
      })
      setLogoUrl(data.logoUrl)
    } catch (e) {
      setLogoError(e instanceof Error ? e.message : 'Logo generation failed')
    } finally {
      setLogoLoading(false)
    }
  }

  const confirm = async () => {
    if (!identity || !selectedName) return
    await apiPatch(`/api/brand-launch/${brandId}`, {
      name: selectedName,
      logo_url: logoUrl || null,
      colors: identity.colors,
      voice: identity.voice,
      wizard_step: 3,
    })
    onDone(selectedName, identity.colors, identity.voice)
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-serif)', letterSpacing: '-0.02em' }}>
        Build your brand identity
      </h2>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--ink-dim)' }}>
        AI generates your name options, color palette, and brand voice for <strong>{niche}</strong>.
      </p>

      {!identity && (
        <button onClick={generate} disabled={loading} className="btn-primary" style={{ width: '100%', padding: '13px' }}>
          {loading ? 'Generating identity…' : 'Generate brand identity'}
        </button>
      )}

      {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 12 }}>{error}</p>}

      {identity && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Name picker */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink-mute)', marginBottom: 10 }}>Pick a name</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {identity.names.map(n => (
                <button
                  key={n}
                  onClick={() => { setSelectedName(n); setLogoUrl('') }}
                  style={{
                    padding: '8px 16px', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer',
                    border: `2px solid ${selectedName === n ? 'var(--ink)' : 'var(--border)'}`,
                    background: selectedName === n ? 'var(--ink)' : 'var(--surface)',
                    color: selectedName === n ? 'var(--on-ink)' : 'var(--ink)',
                    transition: 'all 0.15s',
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Color palette */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink-mute)', marginBottom: 10 }}>Color palette</div>
            <div style={{ display: 'flex', gap: 20 }}>
              <ColorSwatch color={identity.colors.primary} label="Primary" />
              <ColorSwatch color={identity.colors.accent} label="Accent" />
              <ColorSwatch color={identity.colors.bg} label="Background" />
              <ColorSwatch color={identity.colors.text} label="Text" />
            </div>
          </div>

          {/* Brand voice */}
          <div style={{ padding: '16px 20px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink-mute)', marginBottom: 10 }}>Brand voice</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-serif)', color: 'var(--ink)', marginBottom: 8 }}>
              &ldquo;{identity.voice.tagline}&rdquo;
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--ink-3)', marginBottom: 10, lineHeight: 1.6 }}>{identity.voice.bio}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {identity.voice.tone.map(t => (
                <span key={t} style={{ fontSize: 11, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px', color: 'var(--ink-dim)' }}>{t}</span>
              ))}
            </div>
          </div>

          {/* Logo */}
          {selectedName && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink-mute)', marginBottom: 10 }}>Logo <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--ink-mute)', fontSize: 11 }}>(optional)</span></div>
              {logoUrl ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <img src={logoUrl} alt="Brand logo" style={{ width: 120, height: 120, objectFit: 'contain', borderRadius: 10, border: '1px solid var(--border)', background: '#fff', padding: 8 }} />
                  <button onClick={generateLogo} disabled={logoLoading} className="btn" style={{ fontSize: 13 }}>
                    {logoLoading ? 'Regenerating…' : 'Regenerate'}
                  </button>
                </div>
              ) : (
                <button onClick={generateLogo} disabled={logoLoading} className="btn" style={{ padding: '10px 20px' }}>
                  {logoLoading ? 'Generating logo… (15s)' : `Generate logo for ${selectedName}`}
                </button>
              )}
              {logoError && <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 8, marginBottom: 0 }}>{logoError}</p>}
            </div>
          )}

          {selectedName && identity && (
            <button onClick={confirm} className="btn-primary" style={{ width: '100%', padding: '13px' }}>
              Continue with {selectedName} →
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function StepProducts({
  brandId, niche, angle, brandName,
  onDone,
}: {
  brandId: string; niche: string; angle: string; brandName: string
  onDone: (products: Product[]) => void
}) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const generate = async () => {
    setLoading(true); setError('')
    try {
      const data = await apiFetch('/api/brand-launch/products', { niche, angle, brandName })
      setProducts(data.products.map((p: Product) => ({ ...p, selected: false })))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  const toggle = (idx: number) => setProducts(prev => prev.map((p, i) => i === idx ? { ...p, selected: !p.selected } : p))

  const selectedProducts = products.filter(p => p.selected)

  const confirm = async () => {
    const picked = selectedProducts.length > 0 ? selectedProducts : products.slice(0, 3)
    await apiPatch(`/api/brand-launch/${brandId}`, { products: picked, wizard_step: 4 })
    onDone(picked)
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-serif)', letterSpacing: '-0.02em' }}>
        Choose your products
      </h2>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--ink-dim)' }}>
        AI generates 8 winning products for <strong>{niche}</strong>. Pick 2-3 to launch with.
      </p>

      {!products.length && (
        <button onClick={generate} disabled={loading} className="btn-primary" style={{ width: '100%', padding: '13px' }}>
          {loading ? 'Generating products…' : 'Generate product ideas'}
        </button>
      )}

      {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 12 }}>{error}</p>}

      {products.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginBottom: 20 }}>
            {products.map((p, i) => (
              <div
                key={p.name}
                onClick={() => toggle(i)}
                style={{
                  padding: '14px 16px',
                  borderRadius: 12,
                  border: `2px solid ${p.selected ? 'var(--ink)' : 'var(--border)'}`,
                  background: p.selected ? 'var(--accent-soft)' : 'var(--surface)',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                  position: 'relative',
                }}
              >
                {p.selected && (
                  <div style={{ position: 'absolute', top: 10, right: 10, width: 18, height: 18, borderRadius: '50%', background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="var(--on-ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                )}
                <div style={{ fontSize: 12, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{p.category}</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 6 }}>{p.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5, marginBottom: 10 }}>{p.description}</div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>${p.price}</div>
                    <div style={{ fontSize: 10, color: 'var(--ink-mute)' }}>retail</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--good)' }}>{p.margin}%</div>
                    <div style={{ fontSize: 10, color: 'var(--ink-mute)' }}>margin</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 13, color: 'var(--ink-dim)', marginBottom: 16 }}>
            {selectedProducts.length === 0 ? 'Pick 2-3 products to launch with, or continue with top 3' : `${selectedProducts.length} product${selectedProducts.length > 1 ? 's' : ''} selected`}
          </div>

          <button onClick={confirm} className="btn-primary" style={{ width: '100%', padding: '13px' }}>
            {selectedProducts.length > 0 ? `Continue with ${selectedProducts.length} product${selectedProducts.length > 1 ? 's' : ''} →` : 'Continue with top 3 →'}
          </button>
        </>
      )}
    </div>
  )
}

function StepContent({
  brandId, brandName, niche, voice, products,
  onDone,
}: {
  brandId: string; brandName: string; niche: string
  voice: BrandVoice | null; products: Product[]
  onDone: (content: LaunchContent) => void
}) {
  const [content, setContent] = useState<LaunchContent | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const generate = async () => {
    setLoading(true); setError('')
    try {
      const data = await apiFetch('/api/brand-launch/content', {
        brandName, niche,
        tagline: voice?.tagline || '',
        tone: voice?.tone || [],
        products,
      })
      setContent(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  const confirm = async () => {
    if (!content) return
    await apiPatch(`/api/brand-launch/${brandId}`, { content, wizard_step: 5 })
    onDone(content)
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-serif)', letterSpacing: '-0.02em' }}>
        Generate launch content
      </h2>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--ink-dim)' }}>
        3 social posts, a paid ad, and a launch email — ready to copy and publish.
      </p>

      {!content && (
        <button onClick={generate} disabled={loading} className="btn-primary" style={{ width: '100%', padding: '13px' }}>
          {loading ? 'Writing content…' : 'Generate launch content pack'}
        </button>
      )}

      {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 12 }}>{error}</p>}

      {content && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Social posts */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink-mute)', marginBottom: 10 }}>Social Media Posts</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {content.social.map((post) => (
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

          {/* Ad */}
          <div style={{ padding: '16px 20px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink-mute)' }}>Paid Ad (Meta)</div>
              <CopyButton text={`${content.ad.headline}\n\n${content.ad.primary_text}\n\n${content.ad.cta}`} />
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>{content.ad.headline}</div>
            <div style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 10 }}>{content.ad.primary_text}</div>
            <span style={{ fontSize: 12, fontWeight: 600, background: 'var(--ink)', color: 'var(--on-ink)', borderRadius: 6, padding: '4px 10px' }}>{content.ad.cta}</span>
          </div>

          {/* Email */}
          <div style={{ padding: '16px 20px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink-mute)' }}>Launch Email</div>
              <CopyButton text={`Subject: ${content.email.subject}\nPreview: ${content.email.preview}\n\n${content.email.body}`} />
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-mute)', marginBottom: 2 }}>Subject</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 8 }}>{content.email.subject}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-mute)', marginBottom: 2 }}>Preview text</div>
            <div style={{ fontSize: 13, color: 'var(--ink-dim)', marginBottom: 10 }}>{content.email.preview}</div>
            <div style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{content.email.body}</div>
          </div>

          <button onClick={confirm} className="btn-primary" style={{ width: '100%', padding: '13px' }}>
            Continue to brand kit →
          </button>
        </div>
      )}
    </div>
  )
}

function StepExport({
  brandId, brandName, niche, colors, voice, logoUrl, products, content,
}: {
  brandId: string; brandName: string; niche: string
  colors: BrandColors | null; voice: BrandVoice | null
  logoUrl: string; products: Product[]; content: LaunchContent | null
}) {
  const router = useRouter()

  const downloadKit = () => {
    const kit = {
      brand: { name: brandName, niche, tagline: voice?.tagline, bio: voice?.bio, tone: voice?.tone, personality: voice?.personality },
      colors,
      logo: logoUrl || null,
      products: products.map(p => ({ name: p.name, description: p.description, price: p.price, margin: p.margin })),
      content,
    }
    const blob = new Blob([JSON.stringify(kit, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${brandName.replace(/\s+/g, '-').toLowerCase()}-brand-kit.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const finish = async () => {
    await apiPatch(`/api/brand-launch/${brandId}`, { status: 'complete', wizard_step: 5 })
    router.push(`/brand-launch/${brandId}`)
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-serif)', letterSpacing: '-0.02em' }}>
        Your brand is ready. 🎉
      </h2>
      <p style={{ margin: '0 0 28px', fontSize: 14, color: 'var(--ink-dim)' }}>
        Everything you need to launch <strong>{brandName}</strong> on Shopify or any platform.
      </p>

      {/* Brand summary card */}
      <div style={{
        padding: '24px',
        borderRadius: 16,
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" style={{ width: 64, height: 64, objectFit: 'contain', borderRadius: 10, border: '1px solid var(--border)', background: '#fff', padding: 6 }} />
          ) : (
            <div style={{ width: 64, height: 64, borderRadius: 10, background: colors?.primary || 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{brandName.charAt(0)}</span>
            </div>
          )}
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{brandName}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-dim)' }}>{niche}</div>
          </div>
          {colors && (
            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
              {[colors.primary, colors.accent, colors.bg].map(c => (
                <div key={c} style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: '1px solid var(--border)' }} />
              ))}
            </div>
          )}
        </div>

        {voice && (
          <div style={{ fontSize: 15, fontStyle: 'italic', fontFamily: 'var(--font-serif)', color: 'var(--ink-2)', marginBottom: 12 }}>
            &ldquo;{voice.tagline}&rdquo;
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ padding: '6px 12px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--ink-dim)' }}>
            {products.length} product{products.length !== 1 ? 's' : ''}
          </div>
          <div style={{ padding: '6px 12px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--ink-dim)' }}>
            {content ? '6 content pieces' : 'no content yet'}
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-mute)', marginBottom: 8 }}>Next steps for Shopify</div>
          {[
            'Create a Shopify store at shopify.com',
            'Upload your logo from the brand kit below',
            'Apply your brand colors in Shopify Theme Editor',
            'Add your products with the descriptions from this kit',
            'Publish your social posts and run your first ad',
          ].map((step, i) => (
            <div key={step} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--ink-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
              <span style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5 }}>{step}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={downloadKit} className="btn" style={{ flex: 1, padding: '12px', fontSize: 14 }}>
          ↓ Download brand kit
        </button>
        <button onClick={finish} className="btn-primary" style={{ flex: 1, padding: '12px', fontSize: 14 }}>
          Go to brand dashboard →
        </button>
      </div>
    </div>
  )
}

// ─── Wizard Shell ─────────────────────────────────────────────────────────────

const STEPS = ['Niche', 'Identity', 'Products', 'Content', 'Launch']

export default function BrandLaunchWizard({ brandId }: { brandId: string }) {
  const [step, setStep] = useState(1)

  const [niche, setNiche] = useState('')
  const [angle, setAngle] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [brandName, setBrandName] = useState('')
  const [colors, setColors] = useState<BrandColors | null>(null)
  const [voice, setVoice] = useState<BrandVoice | null>(null)
  const [logoUrl, setLogoUrl] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [content, setContent] = useState<LaunchContent | null>(null)

  const handleNicheDone = useCallback((n: string, a: string, audience: string) => {
    setNiche(n); setAngle(a); setTargetAudience(audience); setStep(2)
  }, [])

  const handleIdentityDone = useCallback((name: string, c: BrandColors, v: BrandVoice) => {
    setBrandName(name); setColors(c); setVoice(v); setStep(3)
  }, [])

  const handleProductsDone = useCallback((p: Product[]) => {
    setProducts(p); setStep(4)
  }, [])

  const handleContentDone = useCallback((c: LaunchContent) => {
    setContent(c); setStep(5)
  }, [])

  return (
    <div>
      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 36 }}>
        {STEPS.map((label, i) => {
          const num = i + 1
          const isActive = num === step
          const isDone = num < step
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', fontSize: 12, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isDone ? 'var(--ink)' : isActive ? 'var(--ink)' : 'var(--surface-2)',
                  color: isDone || isActive ? 'var(--on-ink)' : 'var(--ink-mute)',
                  border: `2px solid ${isDone || isActive ? 'var(--ink)' : 'var(--border)'}`,
                  transition: 'all 0.2s',
                }}>
                  {isDone ? <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="var(--on-ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg> : num}
                </div>
                <span style={{ fontSize: 10, color: isActive ? 'var(--ink)' : 'var(--ink-mute)', fontWeight: isActive ? 600 : 400, whiteSpace: 'nowrap' }}>{label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ width: 32, height: 2, background: isDone ? 'var(--ink)' : 'var(--border)', margin: '0 4px', marginBottom: 16, transition: 'background 0.2s' }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Step content */}
      <div style={{ minHeight: 400 }}>
        {step === 1 && <StepNiche brandId={brandId} onDone={handleNicheDone} />}
        {step === 2 && <StepIdentity brandId={brandId} niche={niche} angle={angle} targetAudience={targetAudience} onDone={handleIdentityDone} />}
        {step === 3 && <StepProducts brandId={brandId} niche={niche} angle={angle} brandName={brandName} onDone={handleProductsDone} />}
        {step === 4 && <StepContent brandId={brandId} brandName={brandName} niche={niche} voice={voice} products={products} onDone={handleContentDone} />}
        {step === 5 && <StepExport brandId={brandId} brandName={brandName} niche={niche} colors={colors} voice={voice} logoUrl={logoUrl} products={products} content={content} />}
      </div>
    </div>
  )
}
