'use client'

import { useState } from 'react'
import { getSupabase } from '@/lib/auth'
import { useCredits } from '@/lib/useCredits'
import { Loader2, Download, Image as ImageIcon, X } from 'lucide-react'
import { showError, showSuccess } from '@/lib/notifications'

// Editorial image generator matching the Claude Design export.
// Single composer card with prompt textarea + style chips + ratio + count
// + Generate, followed by a grid of 4 result placeholders that fill in
// as images render. Hits the existing /api/content/generate/image route.

const STYLES = [
  { id: 'realistic',    label: 'Product photo' },
  { id: 'artistic',     label: 'Lifestyle' },
  { id: 'professional', label: 'Studio' },
  { id: 'minimalist',   label: 'Flat lay' },
]

const RATIOS = [
  { id: '1:1',  label: '1:1',  size: '1024x1024' },
  { id: '4:5',  label: '4:5',  size: '1024x1280' },
  { id: '9:16', label: '9:16', size: '720x1280' },
  { id: '16:9', label: '16:9', size: '1280x720' },
]

const COUNTS = [1, 2, 4]

const CREDIT_PER_IMAGE = 3

export default function ImageGeneratorPage() {
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState(STYLES[0].id)
  const [ratio, setRatio] = useState(RATIOS[1].id) // default 4:5 to match the design
  const [count, setCount] = useState<number>(4)
  const [images, setImages] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { balance: creditBalance, refresh: refreshCredits } = useCredits()
  // Reference image — optional. When set, the API runs Nano Banana 2 image-to-image
  // so the user's photo (e.g. their actual product) carries through to the output.
  const [reference, setReference] = useState<{ base64: string; mimeType: string; preview: string } | null>(null)

  function pickReference(file: File | null) {
    if (!file) { setReference(null); return }
    if (file.size > 5 * 1024 * 1024) { setError('Reference image must be under 5MB'); return }
    const reader = new FileReader()
    reader.onload = ev => {
      const result = ev.target?.result as string
      const base64 = result.split(',')[1] ?? ''
      setReference({ base64, mimeType: file.type, preview: result })
    }
    reader.readAsDataURL(file)
  }

  const totalCost = count * CREDIT_PER_IMAGE
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
          ratio,
          size,
          quantity: count,
          referenceImageBase64: reference?.base64,
          referenceImageMimeType: reference?.mimeType,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')

      setImages(Array.isArray(data.images) ? data.images : [])
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

  // Placeholder cells visualize the upcoming render slots so the page never
  // feels empty before generation. They share the same diagonal-stripe pattern
  // used on the dashboard recent thumbnails.
  const slots = Math.max(count, images.length, 4)

  return (
    <main style={{ maxWidth: 1080, margin: '0 auto', padding: '42px 40px 90px' }} className="img-page">
      <header style={{ marginBottom: 28 }}>
        <h1 style={{
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
              <p style={{ fontSize: 11.5, color: 'var(--ink-mute)', margin: '2px 0 0' }}>Nano Banana will preserve this subject in the output.</p>
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
          <label style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 12,
            border: '1.5px dashed var(--border-strong)', background: 'var(--bg-elev)',
            cursor: loading ? 'not-allowed' : 'pointer',
            color: 'var(--ink-mute)', fontSize: 13,
            alignSelf: 'flex-start',
          }}>
            <ImageIcon size={16} />
            <span>Add a reference image <span style={{ color: 'var(--ink-faint)', fontSize: 11.5, marginLeft: 4 }}>(optional)</span></span>
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
                  color: active ? '#fff' : 'var(--ink-2)',
                  fontSize: 13, fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                }}>
                {s.label}
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
                    color: active ? '#fff' : 'var(--ink-2)',
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
                    color: active ? '#fff' : 'var(--ink-2)',
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
              color: '#fff', border: 'none',
              fontSize: 14, fontWeight: 600,
              cursor: !canGenerate || loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
            {loading ? <><Loader2 size={14} className="animate-spin" /> Generating…</> : 'Generate'}
          </button>
        </div>

        {/* Cost line */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--ink-mute)', paddingTop: 4, borderTop: '1px solid var(--border-soft)' }}>
          <span>{totalCost} credits · {count} × {CREDIT_PER_IMAGE} cr</span>
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

      {/* Result grid */}
      <div style={{
        marginTop: 24,
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18,
      }} className="img-grid">
        {Array.from({ length: slots }).map((_, i) => {
          const url = images[i]
          if (url) {
            return (
              <div key={i} style={{
                aspectRatio: '1', borderRadius: 13, overflow: 'hidden',
                border: '1px solid var(--border)', background: 'var(--surface)',
                position: 'relative',
              }}>
                <img src={url} alt={`generation ${i + 1}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <a href={url} download={`image-${Date.now()}-${i}.png`} target="_blank" rel="noopener noreferrer"
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
            )
          }
          return (
            <div key={i} style={{
              aspectRatio: '1', borderRadius: 13,
              background: loading
                ? 'repeating-linear-gradient(135deg, var(--surface-2) 0 10px, var(--surface-3) 10px 20px)'
                : 'repeating-linear-gradient(135deg, var(--surface-2) 0 10px, var(--surface-3) 10px 20px)',
              border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
            }}>
              {loading && i < count ? (
                <Loader2 size={20} className="animate-spin" color="var(--ink-mute)" />
              ) : (
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11,
                  letterSpacing: '0.14em', textTransform: 'uppercase',
                  color: 'var(--ink-faint)',
                }}>
                  Product photo
                </span>
              )}
            </div>
          )
        })}
      </div>

      <style>{`
        @media (max-width: 900px) {
          .img-page { padding: 24px 16px 90px !important; }
          .img-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </main>
  )
}
