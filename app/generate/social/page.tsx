'use client'

import { useState, useEffect, useCallback } from 'react'
import { readPrefill } from '@/lib/calendar-prefill'
import { getSupabase } from '@/lib/auth'
import { useCredits } from '@/lib/useCredits'
import { Loader2, Copy, Check, Download, ChevronLeft, ChevronRight, Image as ImageIcon, X } from 'lucide-react'
import { showError, showSuccess } from '@/lib/notifications'
import { Icon } from '@/components/Icons'

// ─── Constants ───────────────────────────────────────────────────────────────

const CAPTION_PLATFORMS = [
  { id: 'instagram', label: 'Instagram',  color: '#E1306C' },
  { id: 'facebook',  label: 'Facebook',   color: '#1877F2' },
  { id: 'twitter',   label: 'X / Twitter', color: '#000000' },
]

const CAROUSEL_PLATFORMS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook',  label: 'Facebook' },
]

const MUSIC_MOODS = [
  { id: 'none',      label: 'No music' },
  { id: 'upbeat',    label: 'Upbeat' },
  { id: 'chill',     label: 'Chill' },
  { id: 'cinematic', label: 'Cinematic' },
  { id: 'bold',      label: 'Bold / dramatic' },
  { id: 'trending',  label: 'Trending audio' },
]

const TONES = [
  { id: 'bold',          label: 'Bold' },
  { id: 'conversational',label: 'Conversational' },
  { id: 'professional',  label: 'Professional' },
  { id: 'storytelling',  label: 'Storytelling' },
]

const CAROUSEL_TONES = [
  { id: 'bold',         label: 'Bold' },
  { id: 'informative',  label: 'Informative' },
  { id: 'playful',      label: 'Playful' },
  { id: 'professional', label: 'Professional' },
]

const SLIDE_COUNTS = [3, 5, 7, 10]
const CAPTION_COST = 5
const CAROUSEL_CREDIT_PER_SLIDE = 5

type ContentType = 'caption' | 'carousel'

interface CarouselSlide {
  headline: string
  body: string
  cta: string
  imageBase64: string | null
  mimeType: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string, x: number, y: number,
  maxWidth: number, lineHeight: number,
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function SocialPage() {
  const { balance: rawBalance, refresh: refreshCredits } = useCredits()
  const balance = rawBalance ?? 0

  const [contentType, setContentType] = useState<ContentType>('caption')

  // ── Caption state ──
  const [capTopic, setCapTopic]     = useState('')
  const [selPlatforms, setSelPlats] = useState<string[]>(['instagram'])
  const [capTone, setCapTone]       = useState('bold')
  const [postType, setPostType]     = useState<'text' | 'image'>('image')
  const [imagePrompt, setImagePrompt] = useState('')
  const [musicMood, setMusicMood]   = useState('none')
  const [capLoading, setCapLoading] = useState(false)
  const [posts, setPosts]           = useState<Record<string, string>>({})
  const [postImage, setPostImage]   = useState<string | null>(null)
  const [activeTab, setActiveTab]   = useState('')
  const [copied, setCopied]         = useState<string | null>(null)

  // ── Brand context (loaded once) ──
  interface BrandInfo {
    company_name?: string
    description?: string
    product_type?: string
    unique_value_prop?: string
    target_audience?: string
    tone_of_voice?: string
  }
  const [brand, setBrand] = useState<BrandInfo | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = getSupabase()
      if (!supabase) return
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) return
      const res = await fetch('/api/brand/load', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) return
      const data = await res.json()
      if (!cancelled) setBrand(data.brand ?? data)
    })()
    return () => { cancelled = true }
  }, [])

  // Prefill from a calendar suggestion (Create now button)
  useEffect(() => {
    const suggestion = readPrefill('social')
    if (!suggestion) return
    const topic = `${suggestion.title}\n\n${suggestion.description}`.trim()
    setCapTopic(topic)
    setCarTopic(topic)
    const igOrTwFb = (suggestion.platforms ?? [])
      .map(p => p.toLowerCase())
      .filter(p => ['instagram', 'facebook', 'twitter', 'x'].includes(p))
      .map(p => p === 'x' ? 'twitter' : p)
    if (igOrTwFb.length) setSelPlats(igOrTwFb)
  }, [])

  // ── Carousel state ──
  const [carTopic, setCarTopic]     = useState('')
  const [carPlatform, setCarPlatform] = useState('instagram')
  const [slideCount, setSlideCount] = useState(5)
  const [carTone, setCarTone]       = useState('bold')
  const [illustrationDesc, setIllustrationDesc] = useState('')
  const [reference, setReference]   = useState<{ base64: string; mimeType: string; preview: string } | null>(null)
  const [carLoading, setCarLoading] = useState(false)
  const [slides, setSlides]         = useState<CarouselSlide[]>([])
  const [activeSlide, setActiveSlide] = useState(0)

  // ── Derived ──
  const IMAGE_COST  = 3
  const includeImage = postType === 'image'
  const capCost     = CAPTION_COST + (includeImage ? IMAGE_COST : 0)
  const carCost     = slideCount * CAROUSEL_CREDIT_PER_SLIDE
  const isSquare    = false // Only Instagram now (4:5)

  const canCaption  = capTopic.trim().length >= 3 && selPlatforms.length > 0 && balance >= capCost && !capLoading
  const canCarousel = carTopic.trim().length >= 3 && balance >= carCost && !carLoading

  function togglePlatform(id: string) {
    setSelPlats(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  // ── Caption generate ──
  async function generateCaption() {
    if (!canCaption) return
    setCapLoading(true)
    setPosts({})
    setPostImage(null)
    setActiveTab('')
    try {
      const supabase = getSupabase()
      const { data: sess } = await supabase!.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) throw new Error('Not signed in')

      // 1. Generate caption(s)
      const capRes = await fetch('/api/content/generate/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ topic: capTopic.trim(), platforms: selPlatforms, tone: capTone }),
      })
      const capData = await capRes.json()
      if (!capRes.ok) throw new Error(capData.error || 'Generation failed')
      setPosts(capData.posts)
      setActiveTab(selPlatforms[0])

      // 2. Generate image in parallel (if requested)
      if (includeImage) {
        try {
          // Build a brand-aware image prompt.
          // Rule: user description is ALWAYS a style/mood modifier, never the subject.
          // Subject is locked to brand + topic so the visual stays on-context.
          const brandParts: string[] = []
          if (brand?.company_name) brandParts.push(`Brand: ${brand.company_name}`)
          if (brand?.product_type) brandParts.push(`Product type: ${brand.product_type}`)
          if (brand?.description) brandParts.push(`What it does: ${brand.description}`)
          if (brand?.target_audience) brandParts.push(`Audience: ${brand.target_audience}`)
          const brandLine = brandParts.length > 0 ? `BRAND CONTEXT — ${brandParts.join('. ')}.\n\n` : ''

          const userStyle = imagePrompt.trim()
          const styleLine = userStyle
            ? `STYLE / MOOD DIRECTION (from user — apply as visual style only, NOT as the subject): ${userStyle}\n\n`
            : ''

          const fullImagePrompt = `${brandLine}${styleLine}SUBJECT (this is what the image MUST show): A social media visual for the post topic "${capTopic.trim()}". The visual must clearly represent the brand's product/service above. Do NOT show unrelated items like candles, food, skincare, or lifestyle scenes unless the brand is actually in that industry. If the topic mentions growth, results, or metrics — visualize that concept (phone screens, dashboards, charts, before/after) in a way that matches the brand.\n\nHigh-quality, editorial, scroll-stopping. Absolutely no text, letters, logos, or words in the image.`

          const imgRes = await fetch('/api/content/generate/image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              prompt: fullImagePrompt,
              style: 'realistic',
              ratio: '4:5',
              quantity: 1,
            }),
          })
          const imgData = await imgRes.json()
          if (imgRes.ok && imgData.images?.[0]) {
            setPostImage(imgData.images[0])
          } else if (!imgRes.ok) {
            console.error('Image gen failed:', imgData.error)
          }
        } catch { /* image failure shouldn't block caption */ }
      }

      refreshCredits()
      showSuccess('Post ready', includeImage ? 'Caption + image generated' : 'Caption generated')
    } catch (e) {
      showError('Generation failed', e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setCapLoading(false)
    }
  }

  async function copyPost(platformId: string) {
    const text = posts[platformId]
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopied(platformId)
    setTimeout(() => setCopied(null), 2000)
  }

  // ── Carousel generate ──
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

  async function generateCarousel() {
    if (!canCarousel) return
    setCarLoading(true)
    setSlides([])
    setActiveSlide(0)
    try {
      const supabase = getSupabase()
      const { data: sess } = await supabase!.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) throw new Error('Not signed in')

      const res = await fetch('/api/content/generate/carousel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          topic: carTopic.trim(),
          platform: carPlatform,
          slideCount,
          tone: carTone,
          illustrationDesc: illustrationDesc.trim() || null,
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
      setCarLoading(false)
    }
  }

  const renderSlideToCanvas = useCallback((slide: CarouselSlide): Promise<HTMLCanvasElement> => {
    return new Promise((resolve, reject) => {
      const W = 1080
      const H = isSquare ? 1080 : 1350
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d', { alpha: false })!
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      const draw = () => {
        // Softer, lighter gradient — starts higher up but only reaches ~55% opacity at the bottom
        // so the image stays visible while text still reads cleanly.
        const grad = ctx.createLinearGradient(0, H * 0.45, 0, H)
        grad.addColorStop(0, 'rgba(0,0,0,0)')
        grad.addColorStop(0.55, 'rgba(0,0,0,0.28)')
        grad.addColorStop(1, 'rgba(0,0,0,0.62)')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, W, H)

        const PAD = 72
        const hasCta = !!slide.cta?.trim()
        const hasBody = !!slide.body?.trim()

        // Subtle text shadow for legibility without dark background
        ctx.shadowColor = 'rgba(0,0,0,0.5)'
        ctx.shadowBlur = 20
        ctx.shadowOffsetY = 2

        // HEADLINE — tighter tracking, serif-like weight
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'left'
        const headlineSize = 74
        const headlineLH = 86
        ctx.font = `700 ${headlineSize}px -apple-system, "SF Pro Display", "Helvetica Neue", "Segoe UI", sans-serif`
        // Slight negative letter-spacing feel via canvas — approximated by using bold weight
        const headlineY = H - (hasCta ? 340 : hasBody ? 260 : 200)
        const lastY = wrapText(ctx, slide.headline, PAD, headlineY, W - PAD * 2, headlineLH)

        // BODY — lighter weight, softer color
        if (hasBody) {
          ctx.font = `400 38px -apple-system, "SF Pro Display", "Helvetica Neue", "Segoe UI", sans-serif`
          ctx.globalAlpha = 0.92
          wrapText(ctx, slide.body, PAD, lastY + 58, W - PAD * 2, 52)
          ctx.globalAlpha = 1
        }

        // Kill shadow before drawing the CTA pill
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
        ctx.shadowOffsetY = 0

        // CTA — pill-shaped, slightly narrower than full-width for a modern feel
        if (hasCta) {
          const btnH = 82
          const btnY = H - 120
          const btnW = Math.min(W - PAD * 2, 720)
          const btnX = (W - btnW) / 2
          ctx.fillStyle = '#ffffff'
          ctx.beginPath()
          ctx.roundRect(btnX, btnY, btnW, btnH, btnH / 2)
          ctx.fill()
          ctx.fillStyle = '#111111'
          ctx.font = `600 34px -apple-system, "SF Pro Display", "Helvetica Neue", "Segoe UI", sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(slide.cta, W / 2, btnY + btnH / 2 + 1)
          ctx.textBaseline = 'alphabetic'
        }

        resolve(canvas)
      }

      if (slide.imageBase64) {
        const img = new Image()
        img.onload = () => {
          const imgAspect = img.width / img.height
          const canvasAspect = W / H
          let sx = 0, sy = 0, sw = img.width, sh = img.height
          if (imgAspect > canvasAspect) { sw = img.height * canvasAspect; sx = (img.width - sw) / 2 }
          else { sh = img.width / canvasAspect; sy = (img.height - sh) / 2 }
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

  async function downloadSlide(slide: CarouselSlide, index: number) {
    try {
      const canvas = await renderSlideToCanvas(slide)
      const link = document.createElement('a')
      link.download = `carousel-slide-${index + 1}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch { showError('Download failed') }
  }

  async function downloadAll() {
    for (let i = 0; i < slides.length; i++) {
      await downloadSlide(slides[i], i)
      await new Promise(r => setTimeout(r, 120))
    }
  }

  const hasPosts    = Object.keys(posts).length > 0
  const hasSlides   = slides.length > 0

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '42px 40px 90px' }}>
      <header style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 54, lineHeight: 1.05, letterSpacing: '-0.01em', margin: 0 }}>
          Social
        </h1>
        <p style={{ fontSize: 15.5, color: 'var(--ink-dim)', margin: '14px 0 0', maxWidth: 520, lineHeight: 1.55 }}>
          Platform-native captions and image carousels — everything social, in one place.
        </p>
      </header>

      {/* Mode switcher */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }}>
        {([
          { id: 'caption',  label: 'Caption / Post', desc: 'Platform-native captions + hashtags', cost: `${CAPTION_COST} cr` },
          { id: 'carousel', label: 'Image Carousel',  desc: 'AI-generated image per slide',        cost: `${CAROUSEL_CREDIT_PER_SLIDE} cr / slide` },
        ] as const).map(ct => {
          const active = contentType === ct.id
          return (
            <button key={ct.id} type="button" onClick={() => setContentType(ct.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '16px 20px', borderRadius: 14,
                background: active ? 'var(--ink)' : 'var(--surface)',
                border: `1.5px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
              }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: active ? 'var(--on-ink-subtle)' : 'var(--bg-elev)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: active ? 'var(--on-ink)' : 'var(--ink-2)',
              }}>
                {ct.id === 'caption' ? <Icon.Social style={{ width: 20, height: 20 }} /> : <Icon.Carousel style={{ width: 20, height: 20 }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: active ? 'var(--on-ink)' : 'var(--ink)' }}>{ct.label}</div>
                <div style={{ fontSize: 12.5, color: active ? 'var(--on-ink-mute)' : 'var(--ink-mute)', marginTop: 2 }}>
                  {ct.desc} · <strong style={{ color: active ? 'var(--on-ink-dim)' : 'var(--ink-2)' }}>{ct.cost}</strong>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* ── CAPTION MODE ─────────────────────────────────────────────────────── */}
      {contentType === 'caption' && (
        <div style={{ display: 'grid', gridTemplateColumns: hasPosts ? '400px 1fr' : '1fr', gap: 20, alignItems: 'start' }}>
          {/* Composer */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 22, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-mute)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Topic or product</label>
              <textarea
                value={capTopic} onChange={e => setCapTopic(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) generateCaption() }}
                placeholder="e.g. Our skincare serum just hit 10,000 five-star reviews…"
                disabled={capLoading} rows={3}
                style={{ width: '100%', resize: 'vertical', minHeight: 84, border: '1px solid var(--border)', borderRadius: 10, outline: 'none', background: 'var(--bg-elev)', fontFamily: 'inherit', fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink)', padding: '10px 12px', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-mute)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Platforms</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {CAPTION_PLATFORMS.map(p => {
                  const selected = selPlatforms.includes(p.id)
                  return (
                    <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, cursor: 'pointer', background: selected ? 'var(--bg-elev)' : 'transparent', border: `1px solid ${selected ? 'var(--border)' : 'transparent'}`, transition: 'all 0.12s' }}>
                      <input type="checkbox" checked={selected} onChange={() => togglePlatform(p.id)} disabled={capLoading} style={{ width: 15, height: 15, accentColor: p.color, cursor: 'pointer' }} />
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{p.label}</span>
                      {selected && (
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-mute)', background: 'var(--border-soft)', borderRadius: 4, padding: '2px 6px' }}>
                          {p.id === 'instagram' ? '2200 chars' : p.id === 'linkedin' ? '3000 chars' : p.id === 'twitter' ? '280 chars' : '300 chars'}
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-mute)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Tone</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {TONES.map(t => {
                  const active = capTone === t.id
                  return (
                    <button key={t.id} type="button" onClick={() => setCapTone(t.id)} disabled={capLoading}
                      style={{ padding: '8px 16px', borderRadius: 999, background: active ? 'var(--ink)' : 'var(--surface)', border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`, color: active ? 'var(--on-ink)' : 'var(--ink-2)', fontSize: 12.5, fontWeight: 600, cursor: capLoading ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}>
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Post type selector */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-mute)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Post type</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {([
                  { id: 'text',  label: 'Text only',    desc: 'Caption + hashtags only', extra: '' },
                  { id: 'image', label: 'Text + image', desc: 'Caption + AI visual',     extra: `+${IMAGE_COST} cr` },
                ] as const).map(pt => {
                  const active = postType === pt.id
                  return (
                    <button key={pt.id} type="button" onClick={() => setPostType(pt.id)} disabled={capLoading}
                      style={{
                        padding: '12px 14px', borderRadius: 12, textAlign: 'left',
                        background: active ? 'var(--ink)' : 'var(--surface)',
                        border: `1.5px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                        color: active ? 'var(--on-ink)' : 'var(--ink)',
                        cursor: capLoading ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{pt.label}</span>
                        {pt.extra && <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.75 }}>{pt.extra}</span>}
                      </div>
                      <div style={{ fontSize: 11.5, color: active ? 'var(--on-ink-mute)' : 'var(--ink-mute)' }}>{pt.desc}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Image description (only when Text + image selected) */}
            {includeImage && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-mute)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                  Image style / mood <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--ink-faint)' }}>(optional)</span>
                </label>
                <textarea
                  value={imagePrompt}
                  onChange={e => setImagePrompt(e.target.value)}
                  disabled={capLoading}
                  rows={2}
                  placeholder="e.g. Aesthetic, clean, soft lighting / Bold with neon accents / Minimal flat-lay"
                  style={{
                    width: '100%', resize: 'vertical', minHeight: 60,
                    border: '1px solid var(--border)', borderRadius: 10, outline: 'none',
                    background: 'var(--bg-elev)', fontFamily: 'inherit', fontSize: 13.5,
                    lineHeight: 1.55, color: 'var(--ink)', padding: '9px 12px', boxSizing: 'border-box',
                  }}
                />
                <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', marginTop: 6, lineHeight: 1.5 }}>
                  Describe the <strong>style</strong> — the subject stays locked to your brand + topic so the visual stays on-context.
                </div>
              </div>
            )}

            {/* Music mood */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-mute)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Background music (optional)</label>
              <select
                value={musicMood}
                onChange={e => setMusicMood(e.target.value)}
                disabled={capLoading}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--bg-elev)',
                  color: 'var(--ink)', fontSize: 13.5, outline: 'none', fontFamily: 'inherit',
                  cursor: capLoading ? 'not-allowed' : 'pointer',
                }}
              >
                {MUSIC_MOODS.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
              {musicMood !== 'none' && (
                <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', marginTop: 6, lineHeight: 1.5 }}>
                  Saved with the post as a music note for when you upload it to Reels or TikTok.
                </div>
              )}
            </div>

            <button onClick={generateCaption} disabled={!canCaption}
              style={{ padding: '13px 28px', borderRadius: 999, background: !canCaption ? 'var(--ink-faint)' : 'var(--ink)', color: 'var(--on-ink)', border: 'none', fontSize: 14.5, fontWeight: 600, cursor: !canCaption ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.15s' }}>
              {capLoading ? <><Loader2 size={15} className="animate-spin" /> Writing posts…</> : `Generate${selPlatforms.length > 1 ? ` (${selPlatforms.length} platforms)` : ''}`}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--ink-mute)', paddingTop: 6, borderTop: '1px solid var(--border-soft)' }}>
              <span>{capCost} credits · all platforms in one generation</span>
              <span>Balance: <strong style={{ color: balance >= capCost ? 'var(--good)' : 'var(--danger)' }}>{balance}</strong></span>
            </div>
          </div>

          {/* Results */}
          {hasPosts && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
                {selPlatforms.filter(p => posts[p]).map(p => {
                  const platform = CAPTION_PLATFORMS.find(pl => pl.id === p)!
                  const active = activeTab === p
                  return (
                    <button key={p} onClick={() => setActiveTab(p)}
                      style={{ padding: '12px 20px', border: 'none', cursor: 'pointer', background: 'transparent', flexShrink: 0, fontSize: 13, fontWeight: 700, color: active ? 'var(--ink)' : 'var(--ink-mute)', borderBottom: `2px solid ${active ? 'var(--ink)' : 'transparent'}`, transition: 'all 0.15s' }}>
                      {platform.label}
                    </button>
                  )
                })}
              </div>

              {selPlatforms.filter(p => posts[p]).map(p => {
                const platform = CAPTION_PLATFORMS.find(pl => pl.id === p)!
                const content = posts[p] ?? ''
                const isCopied = copied === p
                return (
                  <div key={p} style={{ display: activeTab === p ? 'flex' : 'none', flexDirection: 'column', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: platform.color }} />
                        <span style={{ fontSize: 12, color: 'var(--ink-mute)', fontWeight: 500 }}>{content.length} chars</span>
                        {musicMood !== 'none' && (
                          <span style={{ fontSize: 11, color: 'var(--ink-mute)', background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 5, padding: '2px 7px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                            {MUSIC_MOODS.find(m => m.id === musicMood)?.label}
                          </span>
                        )}
                      </div>
                      <button onClick={() => copyPost(p)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, background: isCopied ? 'var(--good-bg, #f0fdf4)' : 'var(--bg-elev)', border: `1px solid ${isCopied ? 'var(--good, #16a34a)' : 'var(--border)'}`, color: isCopied ? 'var(--good, #16a34a)' : 'var(--ink)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
                        {isCopied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
                      </button>
                    </div>

                    {postImage && (
                      <div style={{ padding: '14px 20px 0' }}>
                        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-elev)' }}>
                          <img src={postImage} alt="Post visual" style={{ width: '100%', display: 'block', maxHeight: 380, objectFit: 'cover' }} />
                          <a
                            href={postImage}
                            download="post-image.png"
                            style={{
                              position: 'absolute', top: 10, right: 10,
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '6px 10px', borderRadius: 8,
                              background: 'rgba(0,0,0,0.72)', color: '#fff',
                              fontSize: 11.5, fontWeight: 600, textDecoration: 'none',
                            }}
                          >
                            <Download size={12} /> Save
                          </a>
                        </div>
                      </div>
                    )}

                    <textarea
                      value={content} onChange={e => setPosts(prev => ({ ...prev, [p]: e.target.value }))}
                      style={{ flex: 1, minHeight: 240, resize: 'vertical', border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 14.5, lineHeight: 1.7, color: 'var(--ink)', padding: '14px 20px 20px' }}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── CAROUSEL MODE ────────────────────────────────────────────────────── */}
      {contentType === 'carousel' && (
        <div style={{ display: 'grid', gridTemplateColumns: hasSlides ? '380px 1fr' : '1fr', gap: 20, alignItems: 'start' }}>
          {/* Carousel composer */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 22, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-mute)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Topic or product</label>
              <textarea
                value={carTopic} onChange={e => setCarTopic(e.target.value)}
                placeholder="e.g. 5 reasons our collagen serum outperforms competitors"
                disabled={carLoading} rows={3}
                style={{ width: '100%', resize: 'vertical', minHeight: 84, border: '1px solid var(--border)', borderRadius: 10, outline: 'none', background: 'var(--bg-elev)', fontFamily: 'inherit', fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink)', padding: '10px 12px', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-mute)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Platform</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {CAROUSEL_PLATFORMS.map(p => {
                  const active = carPlatform === p.id
                  return (
                    <button key={p.id} type="button" onClick={() => setCarPlatform(p.id)} disabled={carLoading}
                      style={{ padding: '9px 20px', borderRadius: 999, background: active ? 'var(--ink)' : 'var(--surface)', border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`, color: active ? 'var(--on-ink)' : 'var(--ink-2)', fontSize: 13, fontWeight: 600, cursor: carLoading ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}>
                      {p.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-mute)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Slides</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {SLIDE_COUNTS.map(n => {
                  const active = slideCount === n
                  return (
                    <button key={n} type="button" onClick={() => setSlideCount(n)} disabled={carLoading}
                      style={{ width: 48, height: 40, borderRadius: 10, background: active ? 'var(--ink)' : 'var(--surface)', border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`, color: active ? 'var(--on-ink)' : 'var(--ink-2)', fontFamily: 'var(--font-mono)', fontSize: 13.5, fontWeight: 600, cursor: carLoading ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}>
                      {n}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-mute)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Tone</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {CAROUSEL_TONES.map(t => {
                  const active = carTone === t.id
                  return (
                    <button key={t.id} type="button" onClick={() => setCarTone(t.id)} disabled={carLoading}
                      style={{ padding: '8px 16px', borderRadius: 999, background: active ? 'var(--ink)' : 'var(--surface)', border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`, color: active ? 'var(--on-ink)' : 'var(--ink-2)', fontSize: 12.5, fontWeight: 600, cursor: carLoading ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}>
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Illustration description */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-mute)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                Illustration description <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--ink-faint)' }}>(optional)</span>
              </label>
              <textarea
                value={illustrationDesc}
                onChange={e => setIllustrationDesc(e.target.value)}
                disabled={carLoading}
                rows={2}
                placeholder="e.g. Minimalist flat-lay of the product on marble. Warm lighting, pastel palette."
                style={{
                  width: '100%', resize: 'vertical', minHeight: 60,
                  border: '1px solid var(--border)', borderRadius: 10, outline: 'none',
                  background: 'var(--bg-elev)', fontFamily: 'inherit', fontSize: 13.5,
                  lineHeight: 1.55, color: 'var(--ink)', padding: '9px 12px', boxSizing: 'border-box',
                }}
              />
              <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', marginTop: 6, lineHeight: 1.5 }}>
                Describe the visual style, subject, mood, or setting for all slides. Leave blank to let AI decide per slide.
              </div>
            </div>

            {/* Reference image */}
            {reference ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12, background: 'var(--bg-elev)', border: '1px solid var(--border)' }}>
                <img src={reference.preview} alt="reference" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>Reference image attached</p>
                  <p style={{ fontSize: 11.5, color: 'var(--ink-mute)', margin: '2px 0 0' }}>AI will carry this visual through all slides.</p>
                </div>
                <button type="button" onClick={() => setReference(null)} disabled={carLoading}
                  style={{ background: 'transparent', border: 'none', color: 'var(--ink-mute)', cursor: 'pointer', padding: 4, display: 'flex' }}>
                  <X size={16} />
                </button>
              </div>
            ) : (
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, border: '1.5px dashed var(--border-strong)', background: 'var(--bg-elev)', cursor: carLoading ? 'not-allowed' : 'pointer', color: 'var(--ink-mute)', fontSize: 13, alignSelf: 'flex-start' }}>
                <ImageIcon size={16} />
                <span>Add product / reference image <span style={{ color: 'var(--ink-faint)', fontSize: 11.5, marginLeft: 4 }}>(optional)</span></span>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => pickReference(e.target.files?.[0] ?? null)} disabled={carLoading} style={{ display: 'none' }} />
              </label>
            )}

            <button onClick={generateCarousel} disabled={!canCarousel}
              style={{ padding: '13px 28px', borderRadius: 999, background: !canCarousel ? 'var(--ink-faint)' : 'var(--ink)', color: 'var(--on-ink)', border: 'none', fontSize: 14.5, fontWeight: 600, cursor: !canCarousel ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.15s' }}>
              {carLoading ? <><Loader2 size={15} className="animate-spin" /> Generating {slideCount} slides…</> : `Generate ${slideCount} slides`}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--ink-mute)', paddingTop: 6, borderTop: '1px solid var(--border-soft)' }}>
              <span>{carCost} credits · {slideCount} slides × {CAROUSEL_CREDIT_PER_SLIDE} cr each</span>
              <span>Balance: <strong style={{ color: balance >= carCost ? 'var(--good)' : 'var(--danger)' }}>{balance}</strong></span>
            </div>
          </div>

          {/* Carousel preview */}
          {hasSlides && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Viewer */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Nav */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button onClick={() => setActiveSlide(s => Math.max(0, s - 1))} disabled={activeSlide === 0}
                    style={{ width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-elev)', border: '1px solid var(--border)', cursor: activeSlide === 0 ? 'not-allowed' : 'pointer', opacity: activeSlide === 0 ? 0.4 : 1, color: 'var(--ink)' }}>
                    <ChevronLeft size={16} />
                  </button>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-mute)', flex: 1, textAlign: 'center' }}>{activeSlide + 1} / {slides.length}</span>
                  <button onClick={() => setActiveSlide(s => Math.min(slides.length - 1, s + 1))} disabled={activeSlide === slides.length - 1}
                    style={{ width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-elev)', border: '1px solid var(--border)', cursor: activeSlide === slides.length - 1 ? 'not-allowed' : 'pointer', opacity: activeSlide === slides.length - 1 ? 0.4 : 1, color: 'var(--ink)' }}>
                    <ChevronRight size={16} />
                  </button>
                </div>

                {/* Slide card */}
                {(() => {
                  const slide = slides[activeSlide]
                  return (
                    <div style={{ position: 'relative', width: '100%', paddingBottom: isSquare ? '100%' : '125%', borderRadius: 14, overflow: 'hidden', background: '#111' }}>
                      {slide.imageBase64 && (
                        <img src={`data:${slide.mimeType};base64,${slide.imageBase64}`} alt={slide.headline}
                          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      )}
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.78) 70%, rgba(0,0,0,0.93) 100%)' }} />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px 22px 22px' }}>
                        <p style={{ margin: 0, color: '#fff', fontSize: 18, fontWeight: 700, lineHeight: 1.3, letterSpacing: '-0.01em' }}>{slide.headline}</p>
                        {slide.body && <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.82)', fontSize: 13, lineHeight: 1.5 }}>{slide.body}</p>}
                        {slide.cta && <div style={{ marginTop: 14, background: '#fff', borderRadius: 8, padding: '9px 0', textAlign: 'center', color: '#000', fontSize: 13, fontWeight: 700 }}>{slide.cta}</div>}
                      </div>
                    </div>
                  )
                })()}

                {/* Dots */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                  {slides.map((_, i) => (
                    <button key={i} onClick={() => setActiveSlide(i)}
                      style={{ width: i === activeSlide ? 18 : 7, height: 7, borderRadius: 4, background: i === activeSlide ? 'var(--ink)' : 'var(--border-strong)', border: 'none', padding: 0, cursor: 'pointer', transition: 'all 0.2s' }} />
                  ))}
                </div>

                <button onClick={() => downloadSlide(slides[activeSlide], activeSlide)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 0', borderRadius: 10, background: 'var(--bg-elev)', border: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--ink)', cursor: 'pointer' }}>
                  <Download size={14} /> Download slide {activeSlide + 1}
                </button>
              </div>

              <button onClick={downloadAll}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 0', borderRadius: 12, background: 'var(--ink)', color: 'var(--on-ink)', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                <Download size={15} /> Download all {slides.length} slides
              </button>

              {/* Slide list */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
                {slides.map((slide, i) => (
                  <button key={i} onClick={() => setActiveSlide(i)}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '12px 16px', border: 'none', borderBottom: i < slides.length - 1 ? '1px solid var(--border-soft)' : 'none', background: i === activeSlide ? 'var(--bg-elev)' : 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ width: 40, height: isSquare ? 40 : 50, borderRadius: 6, background: '#111', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
                      {slide.imageBase64 && <img src={`data:${slide.mimeType};base64,${slide.imageBase64}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)' }}>
                        <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>{i + 1}</span>
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slide.headline}</p>
                      {slide.body && <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--ink-mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slide.body}</p>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
