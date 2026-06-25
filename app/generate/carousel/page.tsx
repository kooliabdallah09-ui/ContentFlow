'use client'

import { useState, useCallback } from 'react'
import { getSupabase } from '@/lib/auth'
import { useCredits } from '@/lib/useCredits'
import { Loader2, Download, ChevronLeft, ChevronRight, Image as ImageIcon, X } from 'lucide-react'
import { showError, showSuccess } from '@/lib/notifications'

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'linkedin',  label: 'LinkedIn' },
]

const TONES = [
  { id: 'bold',         label: 'Bold' },
  { id: 'informative',  label: 'Informative' },
  { id: 'playful',      label: 'Playful' },
  { id: 'professional', label: 'Professional' },
]

const SLIDE_COUNTS = [3, 5, 7, 10]

const CREDIT_PER_SLIDE = 5

interface Slide {
  headline: string
  body: string
  cta: string
  imageBase64: string | null
  mimeType: string
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const words = text.split(' ')
  let line = ''
  let currentY = y
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, currentY)
      line = word
      currentY += lineHeight
    } else {
      line = test
    }
  }
  if (line) ctx.fillText(line, x, currentY)
  return currentY
}

export default function CarouselGeneratorPage() {
  const [topic, setTopic] = useState('')
  const [platform, setPlatform] = useState('instagram')
  const [slideCount, setSlideCount] = useState(5)
  const [tone, setTone] = useState('bold')
  const [reference, setReference] = useState<{ base64: string; mimeType: string; preview: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [slides, setSlides] = useState<Slide[]>([])
  const [activeSlide, setActiveSlide] = useState(0)
  const { balance: rawBalance, refresh: refreshCredits } = useCredits()
  const balance = rawBalance ?? 0

  const totalCost = slideCount * CREDIT_PER_SLIDE
  const canGenerate = topic.trim().length >= 3 && balance >= totalCost && !loading

  // Instagram: 4:5 (portrait), LinkedIn: 1:1 (square)
  const isSquare = platform === 'linkedin'
  const previewW = 360
  const previewH = isSquare ? 360 : 450

  function pickReference(file: File | null) {
    if (!file) { setReference(null); return }
    if (file.size > 5 * 1024 * 1024) { showError('Reference image must be under 5MB'); return }
    const reader = new FileReader()
    reader.onload = ev => {
      const result = ev.target?.result as string
      setReference({ base64: result.split(',')[1] ?? '', mimeType: file.type, preview: result })
    }
    reader.readAsDataURL(file)
  }

  async function generate() {
    if (!canGenerate) return
    setLoading(true)
    setSlides([])
    setActiveSlide(0)
    try {
      const supabase = getSupabase()
      if (!supabase) throw new Error('Auth not ready')
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) throw new Error('Not signed in')

      const res = await fetch('/api/content/generate/carousel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          topic: topic.trim(),
          platform,
          slideCount,
          tone,
          referenceImageBase64: reference?.base64 ?? null,
          referenceImageMimeType: reference?.mimeType ?? null,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setSlides(data.slides)
      refreshCredits()
      showSuccess('Carousel ready', `${data.slides.length} slides generated`)
    } catch (e) {
      showError('Generation failed', e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const renderSlideToCanvas = useCallback((slide: Slide): Promise<HTMLCanvasElement> => {
    return new Promise((resolve, reject) => {
      const W = isSquare ? 1080 : 1080
      const H = isSquare ? 1080 : 1350
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d', { alpha: false })!
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      const draw = () => {
        // Gradient overlay — bottom 55%
        const grad = ctx.createLinearGradient(0, H * 0.35, 0, H)
        grad.addColorStop(0, 'rgba(0,0,0,0)')
        grad.addColorStop(0.6, 'rgba(0,0,0,0.72)')
        grad.addColorStop(1, 'rgba(0,0,0,0.92)')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, W, H)

        const PAD = 64
        const hasCta = slide.cta?.trim()

        // Headline
        ctx.fillStyle = '#ffffff'
        ctx.font = `bold 72px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
        ctx.textAlign = 'left'
        const headlineY = H - (hasCta ? 330 : 230)
        const lastHeadY = wrapText(ctx, slide.headline, PAD, headlineY, W - PAD * 2, 84)

        // Body
        if (slide.body?.trim()) {
          ctx.font = `400 40px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
          ctx.globalAlpha = 0.82
          wrapText(ctx, slide.body, PAD, lastHeadY + 52, W - PAD * 2, 52)
          ctx.globalAlpha = 1
        }

        // CTA button
        if (hasCta) {
          const btnY = H - 120
          const btnH = 80
          const btnW = W - PAD * 2
          ctx.fillStyle = '#ffffff'
          ctx.beginPath()
          ctx.roundRect(PAD, btnY, btnW, btnH, 16)
          ctx.fill()
          ctx.fillStyle = '#000000'
          ctx.font = `bold 36px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
          ctx.textAlign = 'center'
          ctx.fillText(slide.cta, W / 2, btnY + 52)
        }

        resolve(canvas)
      }

      if (slide.imageBase64) {
        const img = new Image()
        img.onload = () => {
          // Cover crop
          const imgAspect = img.width / img.height
          const canvasAspect = W / H
          let sx = 0, sy = 0, sw = img.width, sh = img.height
          if (imgAspect > canvasAspect) {
            sw = img.height * canvasAspect
            sx = (img.width - sw) / 2
          } else {
            sh = img.width / canvasAspect
            sy = (img.height - sh) / 2
          }
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H)
          draw()
        }
        img.onerror = reject
        img.src = `data:${slide.mimeType};base64,${slide.imageBase64}`
      } else {
        ctx.fillStyle = '#111'
        ctx.fillRect(0, 0, W, H)
        draw()
      }
    })
  }, [isSquare])

  async function downloadSlide(slide: Slide, index: number) {
    try {
      const canvas = await renderSlideToCanvas(slide)
      const link = document.createElement('a')
      link.download = `carousel-slide-${index + 1}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch {
      showError('Download failed')
    }
  }

  async function downloadAll() {
    for (let i = 0; i < slides.length; i++) {
      await downloadSlide(slides[i], i)
      await new Promise(r => setTimeout(r, 120))
    }
  }

  const prev = () => setActiveSlide(s => Math.max(0, s - 1))
  const next = () => setActiveSlide(s => Math.min(slides.length - 1, s + 1))

  return (
    <main style={{ maxWidth: 1120, margin: '0 auto', padding: '42px 40px 90px' }}>
      <header style={{ marginBottom: 28 }}>
        <h1 style={{
          fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 54,
          lineHeight: 1.05, letterSpacing: '-0.01em', margin: 0,
        }}>
          Carousel
        </h1>
        <p style={{ fontSize: 15.5, color: 'var(--ink-dim)', margin: '14px 0 0', maxWidth: 520, lineHeight: 1.55 }}>
          AI-generated slide carousels for Instagram and LinkedIn. One topic, a full set of slides ready to post.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: slides.length ? '1fr 1fr' : '1fr', gap: 24, alignItems: 'start' }}>
        {/* Composer */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 18, padding: 22,
          display: 'flex', flexDirection: 'column', gap: 20,
        }}>
          {/* Topic */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-mute)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
              Topic or product
            </label>
            <textarea
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g. 5 reasons our collagen serum outperforms competitors"
              disabled={loading}
              rows={3}
              style={{
                width: '100%', resize: 'vertical', minHeight: 80,
                border: '1px solid var(--border)', borderRadius: 10, outline: 'none',
                background: 'var(--bg-elev)', fontFamily: 'inherit',
                fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink)',
                padding: '10px 12px', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Platform */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-mute)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
              Platform
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {PLATFORMS.map(p => {
                const active = platform === p.id
                return (
                  <button key={p.id} type="button" onClick={() => setPlatform(p.id)} disabled={loading}
                    style={{
                      padding: '9px 20px', borderRadius: 999,
                      background: active ? 'var(--ink)' : 'var(--surface)',
                      border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                      color: active ? '#fff' : 'var(--ink-2)',
                      fontSize: 13, fontWeight: 600,
                      cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                    }}>
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Slide count */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-mute)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
              Slides
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {SLIDE_COUNTS.map(n => {
                const active = slideCount === n
                return (
                  <button key={n} type="button" onClick={() => setSlideCount(n)} disabled={loading}
                    style={{
                      width: 48, height: 40, borderRadius: 10,
                      background: active ? 'var(--ink)' : 'var(--surface)',
                      border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                      color: active ? '#fff' : 'var(--ink-2)',
                      fontFamily: 'var(--font-mono)', fontSize: 13.5, fontWeight: 600,
                      cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                    }}>
                    {n}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tone */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-mute)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
              Tone
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {TONES.map(t => {
                const active = tone === t.id
                return (
                  <button key={t.id} type="button" onClick={() => setTone(t.id)} disabled={loading}
                    style={{
                      padding: '8px 18px', borderRadius: 999,
                      background: active ? 'var(--ink)' : 'var(--surface)',
                      border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                      color: active ? '#fff' : 'var(--ink-2)',
                      fontSize: 13, fontWeight: 600,
                      cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                    }}>
                    {t.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Reference image */}
          {reference ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
              borderRadius: 12, background: 'var(--bg-elev)', border: '1px solid var(--border)',
            }}>
              <img src={reference.preview} alt="reference"
                style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>Reference image attached</p>
                <p style={{ fontSize: 11.5, color: 'var(--ink-mute)', margin: '2px 0 0' }}>AI will carry this visual through all slides.</p>
              </div>
              <button type="button" onClick={() => setReference(null)} disabled={loading}
                aria-label="Remove reference"
                style={{ background: 'transparent', border: 'none', color: 'var(--ink-mute)', cursor: 'pointer', padding: 4, display: 'flex' }}>
                <X size={16} />
              </button>
            </div>
          ) : (
            <label style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
              borderRadius: 12, border: '1.5px dashed var(--border-strong)', background: 'var(--bg-elev)',
              cursor: loading ? 'not-allowed' : 'pointer', color: 'var(--ink-mute)', fontSize: 13,
              alignSelf: 'flex-start',
            }}>
              <ImageIcon size={16} />
              <span>Add product / reference image <span style={{ color: 'var(--ink-faint)', fontSize: 11.5, marginLeft: 4 }}>(optional)</span></span>
              <input type="file" accept="image/jpeg,image/png,image/webp"
                onChange={e => pickReference(e.target.files?.[0] ?? null)}
                disabled={loading} style={{ display: 'none' }} />
            </label>
          )}

          {/* Generate */}
          <button onClick={generate} disabled={!canGenerate}
            style={{
              padding: '13px 28px', borderRadius: 999,
              background: !canGenerate ? 'var(--ink-faint)' : 'var(--ink)',
              color: '#fff', border: 'none', fontSize: 14.5, fontWeight: 600,
              cursor: !canGenerate ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background 0.15s',
            }}>
            {loading
              ? <><Loader2 size={15} className="animate-spin" /> Generating {slideCount} slides…</>
              : `Generate ${slideCount} slides`}
          </button>

          {/* Cost line */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: 12, color: 'var(--ink-mute)',
            paddingTop: 6, borderTop: '1px solid var(--border-soft)',
          }}>
            <span>{totalCost} credits · {slideCount} slides × {CREDIT_PER_SLIDE} cr each</span>
            <span>Balance: <strong style={{ color: balance >= totalCost ? 'var(--good)' : 'var(--danger)' }}>{balance}</strong></span>
          </div>
        </div>

        {/* Preview panel */}
        {slides.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Slide viewer */}
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 18, padding: 20, display: 'flex', flexDirection: 'column', gap: 16,
            }}>
              {/* Slide counter + nav */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={prev} disabled={activeSlide === 0}
                  style={{
                    width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--bg-elev)', border: '1px solid var(--border)',
                    cursor: activeSlide === 0 ? 'not-allowed' : 'pointer', opacity: activeSlide === 0 ? 0.4 : 1,
                    color: 'var(--ink)',
                  }}>
                  <ChevronLeft size={16} />
                </button>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-mute)', flex: 1, textAlign: 'center' }}>
                  {activeSlide + 1} / {slides.length}
                </span>
                <button onClick={next} disabled={activeSlide === slides.length - 1}
                  style={{
                    width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--bg-elev)', border: '1px solid var(--border)',
                    cursor: activeSlide === slides.length - 1 ? 'not-allowed' : 'pointer',
                    opacity: activeSlide === slides.length - 1 ? 0.4 : 1, color: 'var(--ink)',
                  }}>
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Slide card */}
              {(() => {
                const slide = slides[activeSlide]
                return (
                  <div style={{
                    position: 'relative', width: '100%', paddingBottom: isSquare ? '100%' : '125%',
                    borderRadius: 14, overflow: 'hidden', background: '#111',
                  }}>
                    {slide.imageBase64 && (
                      <img
                        src={`data:${slide.mimeType};base64,${slide.imageBase64}`}
                        alt={slide.headline}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    )}
                    {/* Gradient */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.78) 70%, rgba(0,0,0,0.93) 100%)',
                    }} />
                    {/* Text overlay */}
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      padding: '20px 22px 22px',
                    }}>
                      <p style={{
                        margin: 0, color: '#fff', fontSize: 18, fontWeight: 700,
                        lineHeight: 1.3, letterSpacing: '-0.01em',
                      }}>{slide.headline}</p>
                      {slide.body && (
                        <p style={{
                          margin: '6px 0 0', color: 'rgba(255,255,255,0.82)',
                          fontSize: 13, lineHeight: 1.5,
                        }}>{slide.body}</p>
                      )}
                      {slide.cta && (
                        <div style={{
                          marginTop: 14, background: '#fff', borderRadius: 8,
                          padding: '9px 0', textAlign: 'center',
                          color: '#000', fontSize: 13, fontWeight: 700,
                        }}>{slide.cta}</div>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* Dot navigation */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                {slides.map((_, i) => (
                  <button key={i} onClick={() => setActiveSlide(i)}
                    style={{
                      width: i === activeSlide ? 18 : 7, height: 7, borderRadius: 4,
                      background: i === activeSlide ? 'var(--ink)' : 'var(--border-strong)',
                      border: 'none', padding: 0, cursor: 'pointer',
                      transition: 'all 0.2s',
                    }} />
                ))}
              </div>

              {/* Download this slide */}
              <button onClick={() => downloadSlide(slides[activeSlide], activeSlide)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  padding: '10px 0', borderRadius: 10,
                  background: 'var(--bg-elev)', border: '1px solid var(--border)',
                  fontSize: 13, fontWeight: 600, color: 'var(--ink)', cursor: 'pointer',
                }}>
                <Download size={14} />
                Download slide {activeSlide + 1}
              </button>
            </div>

            {/* Download all */}
            <button onClick={downloadAll}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '13px 0', borderRadius: 12,
                background: 'var(--ink)', color: '#fff', border: 'none',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>
              <Download size={15} />
              Download all {slides.length} slides
            </button>

            {/* Slide list */}
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 14, overflow: 'hidden',
            }}>
              {slides.map((slide, i) => (
                <button key={i} onClick={() => setActiveSlide(i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    width: '100%', padding: '12px 16px', border: 'none',
                    borderBottom: i < slides.length - 1 ? '1px solid var(--border-soft)' : 'none',
                    background: i === activeSlide ? 'var(--bg-elev)' : 'transparent',
                    cursor: 'pointer', textAlign: 'left',
                  }}>
                  {/* Thumbnail */}
                  <div style={{
                    width: 40, height: isSquare ? 40 : 50, borderRadius: 6,
                    background: '#111', flexShrink: 0, overflow: 'hidden', position: 'relative',
                  }}>
                    {slide.imageBase64 && (
                      <img src={`data:${slide.mimeType};base64,${slide.imageBase64}`}
                        alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    <div style={{
                      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(0,0,0,0.35)',
                    }}>
                      <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>{i + 1}</span>
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {slide.headline}
                    </p>
                    {slide.body && (
                      <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--ink-mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {slide.body}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
