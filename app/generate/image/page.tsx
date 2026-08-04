'use client'

import { useEffect, useState } from 'react'
import { DriveConnectBanner } from '@/components/DriveConnectBanner'
import { getSupabase } from '@/lib/auth'
import { readPrefill } from '@/lib/calendar-prefill'
import { readChatPrefill } from '@/lib/chat-prefill'
import { useCredits } from '@/lib/useCredits'
import { Loader2, Download, Image as ImageIcon, X } from 'lucide-react'
import { useImageDrop } from '@/hooks/useImageDrop'
import { showError, showSuccess } from '@/lib/notifications'
import { canAccessPovStudio } from '@/lib/pov-access'

// Editorial image generator matching the Claude Design export.
// Single composer card with prompt textarea + style chips + ratio + count
// + Generate, followed by a grid of 4 result placeholders that fill in
// as images render. Hits the existing /api/content/generate/image route.

// Raw mode only: the prompt goes to Nano Banana verbatim — no style
// wrapping, no AI preprocessing. Full manual control.
const STYLES = [
  { id: 'raw', label: 'Direct prompt' },
]

const IMAGE_MODELS = [
  { id: 'pro' as const, label: 'NB Pro', note: 'best quality' },
  { id: 'nb2' as const, label: 'NB2',    note: 'cheaper · less accurate' },
]

const RATIOS = [
  { id: '1:1',  label: '1:1',  size: '1024x1024' },
  { id: '4:5',  label: '4:5',  size: '1024x1280' },
  { id: '9:16', label: '9:16', size: '720x1280' },
  { id: '16:9', label: '16:9', size: '1280x720' },
]

const COUNTS = [1, 2, 4]

// NB2 \$0.075 raw → 5cr · Pro 2K \$0.139 → 10cr · Pro 4K \$0.24 → 18cr (1.8×).
function perImageCr(model: 'pro' | 'nb2', resolution: '2K' | '4K'): number {
  if (model === 'nb2') return 5
  return resolution === '4K' ? 18 : 10
}

export default function ImageGeneratorPage() {
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState('raw')
  const [imgModel, setImgModel] = useState<'pro' | 'nb2'>('pro')
  const [imgResolution, setImgResolution] = useState<'2K' | '4K'>('2K')
  const [ratio, setRatio] = useState(RATIOS[1].id) // default 4:5 to match the design
  const [count, setCount] = useState<number>(4)
  const [images, setImages] = useState<string[]>([])
  // Persistent gallery — every image ever generated here, like the studios.
  const [gallery, setGallery] = useState<Array<{ url: string; prompt: string }>>([])
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [zoomed, setZoomed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { balance: rawBalance, refresh: refreshCredits } = useCredits()
  const creditBalance = rawBalance ?? 0
  // Reference image — optional. When set, the API runs Nano Banana 2 image-to-image
  // so the user's photo (e.g. their actual product) carries through to the output.
  const [reference, setReference] = useState<{ base64: string; mimeType: string; preview: string } | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const suggestion = readPrefill('image')
    if (suggestion) {
      setPrompt(`${suggestion.title}. ${suggestion.description}`.trim())
      return
    }
    const chat = readChatPrefill()
    if (chat) setPrompt(chat)
  }, [])

  useEffect(() => {
    (async () => {
      const supabase = getSupabase()
      if (!supabase) return
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) return
      const email = sess?.session?.user?.email
      if (canAccessPovStudio(email)) setIsAdmin(true)
      try {
        const res = await fetch('/api/content/generate/image', { headers: { Authorization: `Bearer ${token}` } })
        const data = await res.json()
        if (res.ok && Array.isArray(data.images)) setGallery(data.images)
      } catch { /* gallery is best-effort */ }
    })()
  }, [])

  function pickReference(file: File | null) {
    if (!file) { setReference(null); return }
    const maxBytes = isAdmin ? 20 * 1024 * 1024 : 5 * 1024 * 1024
    const maxLabel = isAdmin ? '20MB' : '5MB'
    if (file.size > maxBytes) { setError(`Reference image must be under ${maxLabel}`); return }
    const reader = new FileReader()
    reader.onload = ev => {
      const result = ev.target?.result as string
      const preview = result
      // Resize client-side to max 1280px so the base64 payload stays under
      // Vercel's 4.5MB function body limit regardless of original file size.
      const img = new Image()
      img.onload = () => {
        const MAX = 1280
        let { width, height } = img
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX }
          else { width = Math.round(width * MAX / height); height = MAX }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
        const resized = canvas.toDataURL('image/jpeg', 0.88)
        setReference({ base64: resized.split(',')[1] ?? '', mimeType: 'image/jpeg', preview })
      }
      img.src = result
    }
    reader.readAsDataURL(file)
  }
  const referenceDrop = useImageDrop({
    multiple: false,
    onFiles: files => pickReference(files[0]),
    disabled: loading,
  })

  const totalCost = count * perImageCr(imgModel, imgResolution)
  const canGenerate = prompt.trim().length >= 5 && creditBalance >= totalCost

  async function generate() {
    if (!canGenerate || loading) return
    setLoading(true)
    setError('')
    setImages([])
    try {
      const supabase = getSupabase()
      if (!supabase) throw new Error('Auth not ready')
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) throw new Error('Not signed in')

      const size = RATIOS.find(r => r.id === ratio)?.size ?? '1024x1024'

      const res = await fetch('/api/content/generate/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          prompt: prompt.trim(),
          style,
          model: imgModel,
          resolution: imgResolution,
          ratio,
          size,
          quantity: count,
          referenceImageBase64: reference?.base64,
          referenceImageMimeType: reference?.mimeType,
        }),
      })
      const text = await res.text()
      let data: Record<string, unknown>
      try { data = JSON.parse(text) } catch { throw new Error(text.slice(0, 120) || 'Generation failed') }
      if (!res.ok) throw new Error((data.error as string) || 'Generation failed')

      const fresh: string[] = Array.isArray(data.images) ? data.images : []
      setImages(fresh)
      setGallery(g => [...fresh.map(url => ({ url, prompt: prompt.trim() })), ...g])
      refreshCredits()
      showSuccess('Images ready', `${count} image${count > 1 ? 's' : ''} generated`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed'
      setError(msg)
      showError('Generation failed', msg)
    } finally {
      setLoading(false)
    }
  }


  return (
    <main style={{ maxWidth: 1080, margin: '0 auto', padding: '42px 40px 90px' }} className="img-page">
      <DriveConnectBanner />
      <header style={{ marginBottom: 28 }}>
        <h1 className="img-h1" style={{
          fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 54,
          lineHeight: 1.05, letterSpacing: '-0.01em', margin: 0,
        }}>
          Image
        </h1>
        <p style={{ fontSize: 15.5, color: 'var(--ink-dim)', margin: '14px 0 0', maxWidth: 520, lineHeight: 1.55 }}>
          AI product photos and creative imagery. Describe the shot you want.
        </p>
      </header>

      {/* Composer */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 18, padding: 20,
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="A matte amber serum bottle on wet stone, soft morning light, shallow depth of field…"
          disabled={loading}
          rows={3}
          style={{
            width: '100%', resize: 'vertical', minHeight: 76,
            border: 'none', outline: 'none', background: 'transparent',
            fontFamily: 'inherit', fontSize: 15, lineHeight: 1.55,
            color: 'var(--ink)', padding: '4px 2px',
          }}
        />

        {/* Reference image — optional */}
        {reference ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '8px 12px', borderRadius: 12,
            background: 'var(--bg-elev)', border: '1px solid var(--border)',
          }}>
            <img src={reference.preview} alt="reference"
              style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>Reference image attached</p>
              <p style={{ fontSize: 11.5, color: 'var(--ink-mute)', margin: '2px 0 0' }}>Our AI will preserve this subject in the output.</p>
            </div>
            <button type="button" onClick={() => setReference(null)} disabled={loading}
              aria-label="Remove reference"
              style={{
                background: 'transparent', border: 'none',
                color: 'var(--ink-mute)', cursor: 'pointer',
                padding: 4, display: 'flex',
              }}>
              <X size={16} />
            </button>
          </div>
        ) : (
          <label {...referenceDrop.dropzoneProps} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 12,
            border: `1.5px dashed ${referenceDrop.isDragging ? 'var(--ink)' : 'var(--border-strong)'}`,
            background: referenceDrop.isDragging ? 'var(--hover)' : 'var(--bg-elev)',
            cursor: loading ? 'not-allowed' : 'pointer',
            color: referenceDrop.isDragging ? 'var(--ink)' : 'var(--ink-mute)', fontSize: 13,
            alignSelf: 'flex-start',
            transition: 'background 120ms, border-color 120ms, color 120ms',
          }}>
            <ImageIcon size={16} />
            <span>{referenceDrop.isDragging ? 'Drop to add reference' : <>Add a reference image <span style={{ color: 'var(--ink-faint)', fontSize: 11.5, marginLeft: 4 }}>(optional · drag & drop works)</span></>}</span>
            <input type="file" accept="image/jpeg,image/png,image/webp"
              onChange={e => pickReference(e.target.files?.[0] ?? null)}
              disabled={loading}
              style={{ display: 'none' }} />
          </label>
        )}

        {/* Style chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {STYLES.map(s => {
            const active = style === s.id
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStyle(s.id)}
                disabled={loading}
                style={{
                  padding: '9px 18px', borderRadius: 999,
                  background: active ? 'var(--ink)' : 'var(--surface)',
                  border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                  color: active ? 'var(--on-ink)' : 'var(--ink-2)',
                  fontSize: 13, fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                }}>
                {s.label}
              </button>
            )
          })}

          <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)', margin: '0 4px' }} />

          {/* Model */}
          {IMAGE_MODELS.map(m => {
            const active = imgModel === m.id
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setImgModel(m.id)}
                disabled={loading}
                title={m.note}
                style={{
                  padding: '9px 16px', borderRadius: 999,
                  background: active ? 'var(--ink)' : 'var(--surface)',
                  border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                  color: active ? 'var(--on-ink)' : 'var(--ink-2)',
                  fontSize: 12.5, fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                }}>
                {m.label} <span style={{ fontWeight: 400, opacity: 0.7 }}>· {m.note}</span>
              </button>
            )
          })}

          {/* Resolution — NB Pro only */}
          {imgModel === 'pro' && (['2K', '4K'] as const).map(r => {
            const active = imgResolution === r
            return (
              <button
                key={r}
                type="button"
                onClick={() => setImgResolution(r)}
                disabled={loading}
                style={{
                  padding: '9px 14px', borderRadius: 999,
                  background: active ? 'var(--ink)' : 'var(--surface)',
                  border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                  color: active ? 'var(--on-ink)' : 'var(--ink-2)',
                  fontSize: 12.5, fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                }}>
                {r}{r === '4K' ? ' · 18 cr' : ''}
              </button>
            )
          })}
        </div>

        {/* Ratio + count + Generate */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--ink-mute)', fontWeight: 500 }}>Ratio</span>
            {RATIOS.map(r => {
              const active = ratio === r.id
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRatio(r.id)}
                  disabled={loading}
                  style={{
                    width: 48, height: 36, borderRadius: 999,
                    background: active ? 'var(--ink)' : 'var(--surface)',
                    border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                    color: active ? 'var(--on-ink)' : 'var(--ink-2)',
                    fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500,
                    cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                  }}>
                  {r.label}
                </button>
              )
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--ink-mute)', fontWeight: 500 }}>Count</span>
            {COUNTS.map(n => {
              const active = count === n
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  disabled={loading}
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: active ? 'var(--ink)' : 'var(--surface)',
                    border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                    color: active ? 'var(--on-ink)' : 'var(--ink-2)',
                    fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 500,
                    cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                  }}>
                  {n}
                </button>
              )
            })}
          </div>

          <button
            onClick={generate}
            disabled={!canGenerate || loading}
            style={{
              marginLeft: 'auto',
              padding: '11px 26px', borderRadius: 999,
              background: !canGenerate || loading ? 'var(--ink-faint)' : 'var(--ink)',
              color: 'var(--on-ink)', border: 'none',
              fontSize: 14, fontWeight: 600,
              cursor: !canGenerate || loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
            {loading ? <><Loader2 size={14} className="animate-spin" /> Generating…</> : 'Generate'}
          </button>
        </div>

        {/* Cost line */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--ink-mute)', paddingTop: 4, borderTop: '1px solid var(--border-soft)' }}>
          <span>{totalCost} credits · {count} × {perImageCr(imgModel, imgResolution)} cr</span>
          <span>Balance: <strong style={{ color: creditBalance >= totalCost ? 'var(--good)' : 'var(--danger)' }}>{creditBalance}</strong></span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          marginTop: 14, padding: '10px 14px', borderRadius: 11,
          background: 'rgba(184,58,53,0.08)', border: '1px solid var(--danger)',
          color: 'var(--danger)', fontSize: 13,
        }}>{error}</div>
      )}

      {/* Persistent gallery — masonry, like the studios. New renders appear
          on top; history survives reloads. */}
      <div style={{ marginTop: 24, columns: '4 220px', columnGap: 14 }} className="img-grid">
        {loading && Array.from({ length: count }).map((_, i) => (
          <div key={`ph-${i}`} style={{
            breakInside: 'avoid', marginBottom: 14, borderRadius: 13,
            aspectRatio: ratio === '16:9' ? '16/9' : ratio === '1:1' ? '1' : ratio === '9:16' ? '9/16' : '4/5',
            background: 'repeating-linear-gradient(135deg, var(--surface-2) 0 10px, var(--surface-3) 10px 20px)',
            border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Loader2 size={20} className="animate-spin" color="var(--ink-mute)" />
          </div>
        ))}
        {gallery.map((img, i) => (
          <div key={`${img.url}-${i}`} style={{
            breakInside: 'avoid', marginBottom: 14, borderRadius: 13, overflow: 'hidden',
            border: '1px solid var(--border)', background: 'var(--surface)', position: 'relative', cursor: 'zoom-in',
          }} onClick={() => { setLightbox(img.url); setZoomed(false) }}>
            <img src={img.url} alt={img.prompt || 'generated image'} loading="lazy"
              style={{ width: '100%', display: 'block' }} />
            <a href={img.url} download target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{
                position: 'absolute', top: 8, right: 8,
                width: 32, height: 32, borderRadius: 8,
                background: 'rgba(20,18,12,0.75)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(4px)',
              }}>
              <Download size={14} />
            </a>
          </div>
        ))}
        {!loading && !gallery.length && (
          <div style={{
            breakInside: 'avoid', borderRadius: 13, aspectRatio: '4/5',
            border: '1px dashed var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--ink-faint)', fontFamily: 'var(--font-mono)', fontSize: 11,
            letterSpacing: '0.14em', textTransform: 'uppercase',
          }}>
            Your images live here
          </div>
        )}
      </div>

      {/* Lightbox with click-to-zoom */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{
          position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(12,10,8,0.88)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'auto', padding: zoomed ? 0 : 32,
        }}>
          <button onClick={() => setLightbox(null)} style={{
            position: 'fixed', top: 16, right: 16, width: 36, height: 36, borderRadius: 10,
            background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 201,
          }}><X size={18} /></button>
          <img src={lightbox} alt="preview"
            onClick={e => { e.stopPropagation(); setZoomed(z => !z) }}
            style={zoomed
              ? { width: 'auto', maxWidth: 'none', cursor: 'zoom-out', margin: 'auto' }
              : { maxWidth: '92vw', maxHeight: '92vh', borderRadius: 12, cursor: 'zoom-in' }} />
        </div>
      )}

      <style>{`
        @media (max-width: 900px) {
          .img-page { padding: 24px 16px 90px !important; }
          .img-grid { columns: 2 150px !important; }
        }
        @media (max-width: 640px) {
          .img-h1 { font-size: 36px !important; }
        }
      `}</style>
    </main>
  )
}
