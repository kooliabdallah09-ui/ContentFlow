'use client'

import { useEffect, useRef, useState } from 'react'
import { getSupabase } from '@/lib/auth'
import { useCredits } from '@/lib/useCredits'
import { showError, showSuccess } from '@/lib/notifications'
import { Download, Play, Upload, X } from 'lucide-react'
import PublishToYouTube from '@/components/PublishToYouTube'

type Model = 'sora-2' | 'kling-v3'

interface ShopifyProduct {
  id: number
  title: string
  body_html: string
  price: string
  images: string[]
}

const MODELS: {
  id: Model
  name: string
  badge: string
  tagline: string
  excels: string[]
  caveat: string
  durations: number[]
  credits: Record<number, number>
}[] = [
  {
    id: 'sora-2',
    name: 'Cinematic',
    badge: '',
    tagline: 'Cinematic storytelling & physics',
    excels: [
      'Fluid camera moves — dolly, crane, tracking shots',
      'Real-world physics: water, cloth, fire, smoke',
      'Diverse scene composition & depth of field',
      'Consistent characters across a single scene',
    ],
    caveat: 'No native audio · 2–4 min generation time',
    durations: [5, 10, 15, 20],
    // Sora 2: $0.10/s → 4cr/s at cost → 7.2cr/s at 1.8× → round to nearest integer per duration
    credits: { 5: 36, 10: 72, 15: 108, 20: 144 },
  },
  {
    id: 'kling-v3',
    name: 'Talking Head',
    badge: '',
    tagline: 'Talking heads & native audio',
    excels: [
      'Lip-sync & expressive faces out of the box',
      'Native audio — voice, ambient sound, music',
      'Fast generation: ~60–90 seconds',
      'UGC-style realism: handheld feel, skin texture',
    ],
    caveat: 'Max 15s per clip · best for faces & audio',
    durations: [5, 10, 15],
    // Kling v3 omni standard-audio: $0.224/s → 8.96 cr/s at cost → 16 cr/s at 1.8×
    credits: { 5: 80, 10: 160, 15: 240 },
  },
]

interface VideoState {
  predictionId: string
  provider: 'sora-2-replicate' | 'kling-v3'
  status: 'processing' | 'completed' | 'failed'
  videoUrl?: string
  error?: string
}

export default function VideoGeneratorPage() {
  const [model, setModel] = useState<Model>('sora-2')
  const [prompt, setPrompt] = useState('')
  const [duration, setDuration] = useState(10)
  const [aspect, setAspect] = useState<'portrait' | 'square' | 'landscape'>('portrait')
  const [refImage, setRefImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(null)
  const [generating, setGenerating] = useState(false)
  const [video, setVideo] = useState<VideoState | null>(null)
  const [error, setError] = useState('')
  const [contentId, setContentId] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { balance: rawBalance, refresh: refreshCredits } = useCredits()
  const creditBalance = rawBalance ?? 0

  // Shopify state
  const [shopifyUrl, setShopifyUrl] = useState('')
  const [shopifyProducts, setShopifyProducts] = useState<ShopifyProduct[] | null>(null)
  const [shopifyLoading, setShopifyLoading] = useState(false)
  const [shopifyError, setShopifyError] = useState<string | null>(null)
  const [selectedShopifyProduct, setSelectedShopifyProduct] = useState<ShopifyProduct | null>(null)
  const [shopifyOpen, setShopifyOpen] = useState(false)
  const [shopifyImageLoaded, setShopifyImageLoaded] = useState(false)

  const cfg = MODELS.find(m => m.id === model)!
  const cost = cfg.credits[duration] ?? 60
  const canGenerate = prompt.trim().length >= 5 && creditBalance >= cost

  // Reset duration when switching models if current duration isn't valid
  useEffect(() => {
    if (!cfg.durations.includes(duration)) {
      setDuration(cfg.durations[1] ?? cfg.durations[0])
    }
  }, [model])

  // Poll status while processing
  useEffect(() => {
    if (!video?.predictionId || video.status !== 'processing') return
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/ugc/video-status?videoId=${video.predictionId}&provider=${video.provider}`)
        const data = await res.json()
        const v = data.video
        if (v?.status === 'completed' || v?.status === 'failed') {
          setVideo(prev => prev ? { ...prev, status: v.status, videoUrl: v.videoUrl, error: v.error } : prev)
          if (v.status === 'completed') showSuccess('Video ready', 'Your video has been generated')
          clearInterval(pollRef.current!)

          // Call /api/video/complete
          try {
            const supabase = getSupabase()
            if (supabase) {
              const { data: sess } = await supabase.auth.getSession()
              const token = sess?.session?.access_token
              if (token && contentId) {
                await fetch('/api/video/complete', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ contentId, videoUrl: v.videoUrl, status: v.status, error: v.error }),
                })
              }
            }
          } catch {}
        }
      } catch {}
    }, 5000)
    return () => clearInterval(pollRef.current!)
  }, [video?.predictionId, video?.status, contentId])

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('Reference image must be under 5MB'); return }
    const reader = new FileReader()
    reader.onload = ev => {
      const result = ev.target?.result as string
      setRefImage({ base64: result.split(',')[1], mimeType: file.type, preview: result })
    }
    reader.readAsDataURL(file)
    setSelectedShopifyProduct(null)
    setShopifyImageLoaded(false)
  }

  async function fetchShopifyProducts() {
    if (!shopifyUrl.trim()) return
    setShopifyLoading(true)
    setShopifyError(null)
    setShopifyProducts(null)
    setSelectedShopifyProduct(null)
    try {
      const res = await fetch(`/api/shopify/products?store=${encodeURIComponent(shopifyUrl.trim())}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setShopifyProducts(data.products)
    } catch (e) {
      setShopifyError(e instanceof Error ? e.message : 'Failed to fetch products')
    } finally {
      setShopifyLoading(false)
    }
  }

  async function applyShopifyProduct(product: ShopifyProduct) {
    setSelectedShopifyProduct(product)
    setShopifyImageLoaded(false)

    const imageUrl = product.images[0]
    if (imageUrl) {
      try {
        const res = await fetch(imageUrl)
        const blob = await res.blob()
        const reader = new FileReader()
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string
          setRefImage({ base64: dataUrl.split(',')[1], mimeType: blob.type || 'image/jpeg', preview: imageUrl })
          setShopifyImageLoaded(true)
        }
        reader.readAsDataURL(blob)
      } catch {
        setShopifyImageLoaded(false)
      }
    }
  }

  async function generate() {
    if (!canGenerate || generating) return
    setError('')
    setGenerating(true)
    setVideo(null)
    setContentId(null)
    try {
      const supabase = getSupabase()
      if (!supabase) throw new Error('Auth not ready')
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) throw new Error('Not signed in')

      const res = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          prompt: prompt.trim(),
          model,
          duration,
          aspect,
          referenceImageBase64: refImage?.base64,
          referenceImageMimeType: refImage?.mimeType,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')

      if (data.contentId) setContentId(data.contentId)

      setVideo({
        predictionId: data.predictionId,
        provider: model === 'sora-2' ? 'sora-2-replicate' : 'kling-v3',
        status: 'processing',
      })
      refreshCredits()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed'
      setError(msg)
      showError('Generation failed', msg)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <main style={{ maxWidth: 860, margin: '0 auto', padding: '42px 40px 90px' }} className="vid-page">
      <header style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-dim)', marginBottom: 8 }}>
          Create
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 48, lineHeight: 1.05, letterSpacing: '-0.01em', margin: 0 }}>
          Video
        </h1>
        <p style={{ fontSize: 14.5, color: 'var(--ink-dim)', margin: '10px 0 0', lineHeight: 1.55 }}>
          Two AI models, two strengths. Pick the one that fits your shot.
        </p>
      </header>

      {/* Model picker */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 28 }}>
        {MODELS.map(m => {
          const active = model === m.id
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setModel(m.id)}
              style={{
                textAlign: 'left',
                padding: '20px 22px',
                borderRadius: 14,
                border: `2px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                background: active ? 'var(--surface)' : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{m.name}</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                  padding: '2px 7px', borderRadius: 999,
                  background: active ? 'var(--ink)' : 'var(--border)',
                  color: active ? '#fff' : 'var(--ink-dim)',
                }}>{m.badge}</span>
                {active && (
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-dim)', fontWeight: 600 }}>✓ Selected</span>
                )}
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-dim)', fontWeight: 500, marginBottom: 12 }}>{m.tagline}</div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {m.excels.map((e, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 12.5, color: 'var(--ink)' }}>
                    <span style={{ color: 'var(--good, #10b981)', flexShrink: 0, marginTop: 1 }}>✓</span>
                    {e}
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--ink-dim)', fontStyle: 'italic' }}>{m.caveat}</div>
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Duration */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-dim)', marginBottom: 14 }}>Duration</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {cfg.durations.map(sec => {
              const cr = cfg.credits[sec]
              const active = duration === sec
              return (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setDuration(sec)}
                  disabled={generating}
                  style={{
                    flex: 1, padding: '14px 8px', borderRadius: 10, textAlign: 'center',
                    border: `1.5px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                    background: active ? 'var(--ink)' : 'transparent',
                    color: active ? '#fff' : 'var(--ink)',
                    cursor: generating ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s',
                    display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 18, fontWeight: 700 }}>{sec}s</span>
                  <span style={{ fontSize: 11, opacity: active ? 0.75 : 1, color: active ? '#fff' : 'var(--ink-dim)', fontWeight: 600 }}>{cr} cr</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Format */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-dim)', marginBottom: 14 }}>Format</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {([
              { id: 'portrait',  label: 'Portrait',  sub: '9:16',  icon: '▯' },
              { id: 'square',    label: 'Square',    sub: '1:1',   icon: '□' },
              { id: 'landscape', label: 'Landscape', sub: '16:9',  icon: '▭' },
            ] as const).map(f => {
              const active = aspect === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setAspect(f.id)}
                  disabled={generating}
                  style={{
                    flex: 1, padding: '14px 8px', borderRadius: 10, textAlign: 'center',
                    border: `1.5px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                    background: active ? 'var(--ink)' : 'transparent',
                    color: active ? '#fff' : 'var(--ink)',
                    cursor: generating ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s',
                    display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 20 }}>{f.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{f.label}</span>
                  <span style={{ fontSize: 10.5, opacity: active ? 0.7 : 1, color: active ? '#fff' : 'var(--ink-dim)', fontFamily: 'var(--font-mono)' }}>{f.sub}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Prompt */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
          <label style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-dim)', display: 'block', marginBottom: 10 }}>
            Prompt <span style={{ color: 'var(--danger, #e84a4a)' }}>*</span>
          </label>
          <p style={{ fontSize: 12, color: 'var(--ink-dim)', margin: '0 0 10px', lineHeight: 1.55 }}>
            {model === 'sora-2'
              ? 'Describe the camera move, scene, lighting and mood. Be specific about the shot type for the best cinematic result.'
              : 'Describe the character, expression, action and setting. Mention tone of voice or emotion if you want it in the audio.'}
          </p>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value.slice(0, 4000))}
            disabled={generating}
            rows={6}
            placeholder={model === 'sora-2'
              ? 'Example: Slow cinematic crane shot rising above a misty forest at dawn, golden hour light breaking through the canopy, a lone figure walking a path below, film grain, 35mm anamorphic lens.'
              : 'Example: A confident woman in her 30s looking directly at camera, saying "This changed everything for me" with a warm smile. Lived-in home office background, soft window light, handheld camera feel.'}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '10px 12px', borderRadius: 9,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--ink)', fontSize: 13.5,
              fontFamily: 'inherit', outline: 'none',
              resize: 'vertical', minHeight: 140,
              lineHeight: 1.55,
            }}
          />
          <p style={{ fontSize: 10.5, color: 'var(--ink-dim)', textAlign: 'right', margin: '4px 0 0', fontFamily: 'var(--font-mono)' }}>
            {prompt.length} / 4000
          </p>
        </div>

        {/* Import from Shopify */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          {/* Collapsible header */}
          <button
            type="button"
            onClick={() => setShopifyOpen(o => !o)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Import from Shopify</span>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'var(--border)', color: 'var(--ink-dim)', fontWeight: 600 }}>optional</span>
            {selectedShopifyProduct && (
              <span style={{ fontSize: 12, color: 'var(--good, #10b981)', fontWeight: 600, marginLeft: 4 }}>
                ✓ {selectedShopifyProduct.title}
              </span>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--ink-dim)', lineHeight: 1 }}>
              {shopifyOpen ? '▲' : '▼'}
            </span>
          </button>

          {shopifyOpen && (
            <div style={{ padding: '0 20px 20px' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input
                  type="text"
                  placeholder="yourstore.myshopify.com"
                  value={shopifyUrl}
                  onChange={e => setShopifyUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchShopifyProducts()}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--ink)', fontSize: 13, outline: 'none' }}
                />
                <button
                  type="button"
                  onClick={fetchShopifyProducts}
                  disabled={!shopifyUrl.trim() || shopifyLoading}
                  style={{
                    padding: '8px 14px', borderRadius: 8, border: 'none',
                    background: 'var(--ink)', color: '#fff',
                    fontSize: 13, fontWeight: 600,
                    cursor: shopifyUrl.trim() && !shopifyLoading ? 'pointer' : 'not-allowed',
                    opacity: shopifyUrl.trim() && !shopifyLoading ? 1 : 0.4,
                    whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {shopifyLoading
                    ? <><span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', display: 'inline-block', animation: 'vid-spin 0.7s linear infinite' }} />Loading...</>
                    : 'Fetch Products'}
                </button>
              </div>

              {shopifyError && (
                <div style={{ marginBottom: 8, fontSize: 12, color: '#e84a4a', padding: '6px 10px', borderRadius: 6, background: 'rgba(232,74,74,0.08)', border: '1px solid rgba(232,74,74,0.2)' }}>
                  {shopifyError}. Make sure the URL is correct (e.g. yourstore.myshopify.com).
                </div>
              )}

              {shopifyProducts && shopifyProducts.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--ink-dim)' }}>No products found in this store.</div>
              )}

              {shopifyProducts && shopifyProducts.length > 0 && !selectedShopifyProduct && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-dim)', marginBottom: 8 }}>
                    {shopifyProducts.length} products — pick one
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
                    {shopifyProducts.map(product => (
                      <div
                        key={product.id}
                        onClick={() => applyShopifyProduct(product)}
                        style={{
                          display: 'flex', gap: 10, alignItems: 'center',
                          padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                          border: '1px solid var(--border)', background: 'transparent',
                          transition: 'all 0.15s',
                        }}
                      >
                        {product.images[0]
                          ? <img src={product.images[0]} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                          : <div style={{ width: 40, height: 40, borderRadius: 6, background: 'var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📦</div>
                        }
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.title}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-dim)' }}>${product.price}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedShopifyProduct && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--good, #10b981)', background: 'rgba(16,185,129,0.06)' }}>
                  {selectedShopifyProduct.images[0] && (
                    <img src={selectedShopifyProduct.images[0]} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      ✓ {selectedShopifyProduct.title}
                    </div>
                    {shopifyImageLoaded && (
                      <div style={{ fontSize: 11, color: 'var(--good, #10b981)', fontWeight: 600 }}>✓ Product image loaded</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedShopifyProduct(null); setShopifyImageLoaded(false); setRefImage(null) }}
                    style={{ background: 'none', border: 'none', color: 'var(--ink-dim)', cursor: 'pointer', padding: 4, display: 'flex' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Reference image */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-dim)', marginBottom: 6 }}>
            Reference Image <span style={{ fontSize: 10, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink-dim)', margin: '0 0 12px', lineHeight: 1.55 }}>
            Seeds the first frame. {model === 'sora-2' ? 'Great for product shots or character references.' : 'Used as the starting face or scene.'}
          </p>
          {refImage ? (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 10, background: 'var(--bg-elev, rgba(0,0,0,0.03))', borderRadius: 9, border: '1px solid var(--border)' }}>
              <img src={refImage.preview} alt="ref" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 7 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                  {selectedShopifyProduct ? selectedShopifyProduct.title : 'Reference uploaded'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-dim)' }}>{refImage.mimeType}</div>
              </div>
              <button onClick={() => { setRefImage(null); setSelectedShopifyProduct(null); setShopifyImageLoaded(false) }} disabled={generating} style={{ background: 'none', border: 'none', color: 'var(--ink-dim)', cursor: 'pointer', padding: 4, display: 'flex' }}>
                <X size={16} />
              </button>
            </div>
          ) : (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 9, border: '1.5px dashed var(--border)', color: 'var(--ink-dim)', fontSize: 13, cursor: generating ? 'not-allowed' : 'pointer' }}>
              <Upload size={14} />
              <span>Upload reference (max 5MB)</span>
              <input type="file" accept="image/*" onChange={handleImageChange} disabled={generating} style={{ display: 'none' }} />
            </label>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(184,58,53,0.08)', border: '1px solid var(--danger, #e84a4a)', color: 'var(--danger, #e84a4a)', fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Generate */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink-dim)' }}>
            <span>Cost: <strong style={{ color: 'var(--ink)' }}>{cost} credits</strong></span>
            <span>Balance: <strong style={{ color: creditBalance >= cost ? 'var(--good, #10b981)' : 'var(--danger, #e84a4a)' }}>{creditBalance}</strong></span>
          </div>
          <button
            onClick={generate}
            disabled={!canGenerate || generating}
            style={{
              width: '100%', padding: '14px 0', borderRadius: 12,
              background: !canGenerate || generating ? 'var(--border)' : 'var(--ink)',
              color: !canGenerate || generating ? 'var(--ink-dim)' : '#fff',
              border: 'none', fontSize: 15, fontWeight: 700,
              cursor: !canGenerate || generating ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background 0.15s',
            }}
          >
            {generating ? (
              <>
                <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%', animation: 'vid-spin 0.8s linear infinite' }} />
                Submitting…
              </>
            ) : `Generate with ${cfg.name} · ${cost} credits`}
          </button>
          {prompt.trim().length < 5 && (
            <p style={{ fontSize: 12, color: 'var(--ink-dim)', textAlign: 'center', margin: 0 }}>Enter a prompt to generate</p>
          )}
        </div>

        {/* Output */}
        {video && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-dim)', marginBottom: 16 }}>
              Generated Video
            </div>

            {video.status === 'processing' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '20px 0' }}>
                <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--ink)', borderRadius: '50%', animation: 'vid-spin 0.8s linear infinite' }} />
                <p style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 600, margin: 0 }}>
                  {model === 'sora-2' ? 'Generating your video — usually 2–4 min' : 'Generating your video — usually 60–90 sec'}
                </p>
                <p style={{ fontSize: 12, color: 'var(--ink-dim)', margin: 0 }}>Polling every 5 seconds…</p>
              </div>
            )}

            {video.status === 'failed' && (
              <div>
                <p style={{ fontSize: 13, color: 'var(--danger, #e84a4a)', fontWeight: 600, marginBottom: 8 }}>Generation failed</p>
                <p style={{ fontSize: 12, color: 'var(--ink-dim)', lineHeight: 1.5, wordBreak: 'break-word', margin: 0 }}>
                  {video.error ?? 'Unknown error. Check your API key balance and try again.'}
                </p>
              </div>
            )}

            {video.status === 'completed' && video.videoUrl && (
              <>
                <video controls src={video.videoUrl} style={{ width: '100%', borderRadius: 10, marginBottom: 14, maxHeight: 500, background: '#000' }} />
                <div style={{ display: 'flex', gap: 10 }}>
                  <a href={video.videoUrl} download={`video-${Date.now()}.mp4`} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', borderRadius: 9, background: 'var(--ink)', color: '#fff', fontSize: 13.5, fontWeight: 600, textDecoration: 'none' }}>
                    <Download size={14} /> Download
                  </a>
                  <a href={video.videoUrl} target="_blank" rel="noopener noreferrer" style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', borderRadius: 9, border: '1px solid var(--border)', color: 'var(--ink)', fontSize: 13.5, fontWeight: 600, textDecoration: 'none' }}>
                    <Play size={14} /> Open in tab
                  </a>
                </div>
                <div style={{ marginTop: 10 }}>
                  <PublishToYouTube videoUrl={video.videoUrl!} defaultTitle="AI Generated Video" />
                </div>
                <div style={{ textAlign: 'center', marginTop: 10 }}>
                  <a href="/library" style={{ fontSize: 12.5, color: 'var(--ink-dim)', textDecoration: 'none', fontWeight: 500 }}>
                    Saved to library →
                  </a>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes vid-spin { to { transform: rotate(360deg); } }
        @media (max-width: 680px) {
          .vid-page { padding: 24px 16px 80px !important; }
        }
      `}</style>
    </main>
  )
}
