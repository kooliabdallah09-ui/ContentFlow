'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { getSupabase } from '@/lib/auth'
import { useCredits } from '@/lib/CreditsContext'
import { Logo } from '@/components/Logo'

// ─── Types ────────────────────────────────────────────────────────────────────

type ProgressStep = {
  label: string
  icon: 'think' | 'image' | 'social' | 'voice' | 'brief' | 'check'
  status: 'active' | 'done'
}

type CanvasItem =
  | { kind: 'image'; id: string; url: string; prompt: string; ratio: string; credits: number }
  | { kind: 'social'; id: string; posts: Record<string, string>; topic: string; credits: number }
  | { kind: 'voice'; id: string; audioUrl: string; text: string; duration?: number; credits: number }
  | { kind: 'brief'; id: string; title: string; hook: string; scenes: string[]; cta: string; platform: string }
  | { kind: 'carousel'; id: string; topic: string; platform: string; slides: Array<{ headline: string; body: string; cta: string; imageUrl: string }>; credits: number }
  | { kind: 'error'; id: string; message: string }

type CanvasNode = {
  id: string
  items: CanvasItem[]  // 1 item = single card; >1 = horizontal batch group
  x: number
  y: number
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  imagePreview?: string
  question?: { prompt: string; options: string[] }
}

interface Session {
  id: string
  name: string
  createdAt: number
  messages: Message[]
  canvasNodes: CanvasNode[]
}

interface AttachedImage {
  dataUrl: string
  mimeType: string
  name: string
}

// ─── Session persistence ──────────────────────────────────────────────────────

const SESSION_KEY = 'cf-studio-sessions'
const MAX_SESSIONS = 15

function genId() { return Math.random().toString(36).slice(2, 10) }

function loadSessions(): Session[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) ?? '[]') } catch { return [] }
}

function persistSessions(sessions: Session[]) {
  // Strip base64 imagePreview from messages before persisting — those can be
  // several MB each and will blow the 5MB localStorage quota.
  const slim = sessions.slice(0, MAX_SESSIONS).map(s => ({
    ...s,
    messages: s.messages.map(({ imagePreview: _, ...m }) => m),
  }))
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(slim))
  } catch {
    // Quota still exceeded (e.g. too many sessions) — trim aggressively and retry
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(slim.slice(0, 5)))
    } catch {
      localStorage.removeItem(SESSION_KEY)
    }
  }
}

function sessionNameFrom(messages: Message[]): string {
  const first = messages.find(m => m.role === 'user')?.content
  if (!first) return 'New session'
  return first.length > 40 ? first.slice(0, 40) + '…' : first
}

// ─── Blob download helper (cross-origin Supabase URLs need fetch→blob) ───────
async function downloadBlob(url: string, filename: string) {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(blobUrl)
  } catch {
    window.open(url, '_blank')
  }
}

// ─── Carousel slide download with text overlay baked in via Canvas ────────────
function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number): number {
  const words = text.split(' ')
  let line = ''
  let cy = y
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, cy)
      line = word
      cy += lineH
    } else {
      line = test
    }
  }
  if (line) { ctx.fillText(line, x, cy); cy += lineH }
  return cy
}

async function downloadCarouselSlide(slide: { headline: string; body: string; cta: string; imageUrl: string }, index: number) {
  const W = 1080, H = 1350  // 4:5 Instagram
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!

  // Draw background image
  if (slide.imageUrl) {
    await new Promise<void>(resolve => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => { ctx.drawImage(img, 0, 0, W, H); resolve() }
      img.onerror = () => resolve()
      img.src = slide.imageUrl
    })
  } else {
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H)
  }

  // Gradient overlay — bottom 60%
  const grad = ctx.createLinearGradient(0, H * 0.40, 0, H)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(0.5, 'rgba(0,0,0,0.65)')
  grad.addColorStop(1, 'rgba(0,0,0,0.95)')
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H)

  const PAD = 72
  const hasCta = slide.cta?.trim()
  const HEADLINE_SIZE = 58
  const BODY_SIZE = 34
  const LINE_H_HEAD = 72
  const LINE_H_BODY = 48
  const BOTTOM_PAD = hasCta ? 220 : 100

  // Measure headline height to position correctly
  ctx.font = `800 ${HEADLINE_SIZE}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
  const headlineWords = slide.headline.split(' ')
  let headlineLines = 1, testLine = ''
  for (const word of headlineWords) {
    const test = testLine ? `${testLine} ${word}` : word
    if (ctx.measureText(test).width > W - PAD * 2 && testLine) { headlineLines++; testLine = word } else { testLine = test }
  }
  const headlineH = headlineLines * LINE_H_HEAD

  const bodyLines = slide.body?.trim() ? 3 : 0  // estimate
  const bodyH = bodyLines * LINE_H_BODY
  const ctaH = hasCta ? 100 : 0
  const blockH = headlineH + (bodyH > 0 ? 28 + bodyH : 0) + (ctaH > 0 ? 36 + ctaH : 0)
  const startY = H - BOTTOM_PAD - blockH

  // Headline
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 12
  ctx.fillStyle = '#fff'
  ctx.font = `800 ${HEADLINE_SIZE}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
  ctx.textAlign = 'left'
  const afterHead = wrapText(ctx, slide.headline, PAD, startY, W - PAD * 2, LINE_H_HEAD)

  // Body
  let afterBody = afterHead
  if (slide.body?.trim()) {
    ctx.font = `400 ${BODY_SIZE}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    afterBody = wrapText(ctx, slide.body, PAD, afterHead + 28, W - PAD * 2, LINE_H_BODY)
  }

  // CTA button — auto-size to text
  if (hasCta) {
    ctx.shadowBlur = 0
    const btnFontSize = 30
    ctx.font = `700 ${btnFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
    const textW = ctx.measureText(hasCta).width
    const btnW = textW + 80
    const btnH = 80
    const btnX = PAD
    const btnY = afterBody + 36

    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 40); ctx.fill()
    ctx.fillStyle = '#000'
    ctx.textAlign = 'left'
    ctx.fillText(hasCta, btnX + 40, btnY + btnFontSize + (btnH - btnFontSize) / 2 - 2)
  }

  ctx.shadowBlur = 0
  canvas.toBlob(blob => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `slide-${index + 1}.png`
    document.body.appendChild(a); a.click()
    document.body.removeChild(a); URL.revokeObjectURL(url)
  }, 'image/png')
}

// ─── SVG icons ───────────────────────────────────────────────────────────────

const Icon = {
  Image: (s = 13) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>,
  Caption: (s = 13) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Voice: (s = 13) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>,
  Brief: (s = 13) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  Logo: (s = 13) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/><path d="M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/></svg>,
  Carousel: (s = 13) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="8" height="14" rx="1.5"/><rect x="12" y="5" width="8" height="14" rx="1.5"/><path d="M1 12h1M22 12h1"/></svg>,
  Post: (s = 13) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="14" y2="13"/></svg>,
}

// ─── Content mode pills ────────────────────────────────────────────────────────
// Each pill sets a sticky mode. The mode is sent as a hidden directive alongside
// the user's message — no prompt pre-filling, just context under the hood.

type ContentMode = 'image' | 'logo' | 'carousel' | 'post' | 'captions' | 'voice' | 'brief'

const TOOL_PILLS: Array<{ icon: (s?: number) => React.ReactElement; label: string; mode: ContentMode; placeholder: string }> = [
  { icon: Icon.Image,    label: 'Image',    mode: 'image',    placeholder: 'Describe the image you want…' },
  { icon: Icon.Logo,     label: 'Logo',     mode: 'logo',     placeholder: 'What brand or concept is the logo for?' },
  { icon: Icon.Carousel, label: 'Carousel', mode: 'carousel', placeholder: 'What\'s the carousel about?' },
  { icon: Icon.Post,     label: 'Post',     mode: 'post',     placeholder: 'What\'s the post about?' },
  { icon: Icon.Caption,  label: 'Captions', mode: 'captions', placeholder: 'What should the captions be for?' },
  { icon: Icon.Voice,    label: 'Voice',    mode: 'voice',    placeholder: 'What should the voiceover say?' },
  { icon: Icon.Brief,    label: 'Brief',    mode: 'brief',    placeholder: 'What product / campaign is this brief for?' },
]

// Hidden directive prepended to the user's message when a mode is active
const MODE_DIRECTIVES: Record<ContentMode, string> = {
  image:    '[Mode: Image] Generate an image for the following:',
  logo:     '[Mode: Logo] Generate a logo in 1:1 square format for the following:',
  carousel: '[Mode: Carousel] Create a multi-slide Instagram carousel using generate_carousel for the following topic:',
  post:     '[Mode: Post] Create a single-slide post using generate_carousel with slideCount=1 for the following:',
  captions: '[Mode: Captions] Write social media captions for the following:',
  voice:    '[Mode: Voice] Create a voiceover script and generate audio for the following:',
  brief:    '[Mode: Brief] Plan a UGC video brief for the following:',
}

const SLASH_COMMANDS = [
  { id: 'color', label: '/color', description: 'Pick a color and insert its hex code' },
]

const PRESET_COLORS = [
  '#000000', '#FFFFFF', '#FF3B30', '#FF9500', '#FFCC00', '#34C759',
  '#007AFF', '#5856D6', '#AF52DE', '#FF2D55', '#A2845E', '#636366',
]

const EXAMPLE_PROMPTS = [
  { icon: Icon.Image,   label: 'Product photo', text: 'Generate a lifestyle product photo for Instagram, 4:5 ratio, warm tones' },
  { icon: Icon.Caption, label: 'Caption pack',  text: 'Write Instagram, Facebook and Twitter captions for a new product launch' },
  { icon: Icon.Voice,   label: 'Ad voiceover',  text: 'Create an energetic 30-second voiceover script for a summer campaign' },
  { icon: Icon.Brief,   label: 'UGC brief',     text: 'Plan a TikTok UGC video brief for a skincare product launch' },
]

// Strip markdown artifacts from stored/old messages
function cleanMessageText(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const SOCIAL_LABELS: Record<string, string> = { instagram: 'IG', facebook: 'FB', twitter: 'X', linkedin: 'LI' }

// ─── Canvas Item Cards ────────────────────────────────────────────────────────

function ImageCanvasCard({
  item,
  onOpen,
}: {
  item: Extract<CanvasItem, { kind: 'image' }>
  onOpen: (url: string, prompt: string) => void
}) {
  const ratioMap: Record<string, string> = { '1:1': '100%', '4:5': '125%', '9:16': '177.78%', '16:9': '56.25%' }
  const pb = ratioMap[item.ratio] || '100%'
  const [hovered, setHovered] = useState(false)

  return (
    <div className="canvas-card canvas-card-animate">
      <div
        style={{ position: 'relative', width: '100%', paddingBottom: pb, borderRadius: 14, overflow: 'hidden', background: 'var(--bg)', marginBottom: 12, cursor: 'zoom-in' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => onOpen(item.url, item.prompt)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.url} alt={item.prompt} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 14, transition: 'transform 0.3s ease', transform: hovered ? 'scale(1.02)' : 'scale(1)' }} />
        {/* Hover overlay */}
        <div style={{ position: 'absolute', inset: 0, borderRadius: 14, background: 'rgba(0,0,0,0.45)', opacity: hovered ? 1 : 0, transition: 'opacity 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 22, color: '#fff', opacity: 0.9 }}>⊕</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <p style={{ flex: 1, fontSize: 11.5, color: 'var(--ink-mute)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>{item.prompt}</p>
        <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: 'var(--ink-dim)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px' }}>{item.credits} cr</span>
        <button onClick={() => downloadBlob(item.url, `studio-image-${item.id}.png`)} style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: 'var(--ink)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', transition: 'background 0.12s' }}>↓</button>
      </div>
    </div>
  )
}

function SocialCanvasCard({ item }: { item: Extract<CanvasItem, { kind: 'social' }> }) {
  const platforms = Object.keys(item.posts)
  const [activeTab, setActiveTab] = useState(platforms[0] ?? 'instagram')
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(item.posts[activeTab] ?? '')
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="canvas-card canvas-card-animate">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {platforms.map(p => (
            <button key={p} onClick={() => setActiveTab(p)} style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 7, border: '1px solid var(--border)', cursor: 'pointer', background: activeTab === p ? 'var(--ink)' : 'transparent', color: activeTab === p ? 'var(--on-ink)' : 'var(--ink-dim)', transition: 'all 0.12s' }}>
              {SOCIAL_LABELS[p] ?? p.toUpperCase()}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-dim)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px' }}>{item.credits} cr</span>
          <button onClick={copy} style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 9px', cursor: 'pointer', transition: 'all 0.12s' }}>{copied ? '✓ Copied' : 'Copy'}</button>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: 'var(--ink)', fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', minHeight: 80 }}>
        {item.posts[activeTab] ?? ''}
      </p>
      <p style={{ margin: '7px 0 0', fontSize: 10.5, color: 'var(--ink-mute)' }}>Topic: {item.topic}</p>
    </div>
  )
}

function VoiceCanvasCard({ item }: { item: Extract<CanvasItem, { kind: 'voice' }> }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="canvas-card canvas-card-animate">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-dim)' }}>
          {Icon.Voice(14)}
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-dim)' }}>Voiceover</span>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-dim)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px' }}>{item.credits} cr</span>
      </div>
      <audio controls src={item.audioUrl} style={{ width: '100%', height: 36, borderRadius: 8, marginBottom: 10 }} />
      {item.duration && <p style={{ margin: '0 0 8px', fontSize: 10.5, color: 'var(--ink-mute)' }}>~{item.duration}s</p>}
      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.7, color: 'var(--ink-dim)', WebkitLineClamp: expanded ? undefined : 3, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: expanded ? 'visible' : 'hidden', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
        {item.text}
      </p>
      {item.text.length > 120 && (
        <button onClick={() => setExpanded(e => !e)} style={{ marginTop: 5, fontSize: 11, color: 'var(--ink-mute)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}

function BriefCanvasCard({ item }: { item: Extract<CanvasItem, { kind: 'brief' }> }) {
  return (
    <div className="canvas-card canvas-card-animate">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--font-serif)' }}>{item.title}</h3>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-mute)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 7px' }}>{item.platform}</span>
      </div>
      <div style={{ marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
        <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>Hook</p>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--ink)', fontStyle: 'italic' }}>{item.hook}</p>
      </div>
      {item.scenes.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>Scenes</p>
          <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {item.scenes.map((s, i) => <li key={i} style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--ink-dim)' }}>{s}</li>)}
          </ol>
        </div>
      )}
      <div style={{ marginBottom: 14, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
        <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>CTA</p>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{item.cta}</p>
      </div>
      <a href="/generate/ugc" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        Open in Video Studio <span style={{ opacity: 0.5 }}>→</span>
      </a>
    </div>
  )
}

function ErrorCanvasCard({ item }: { item: Extract<CanvasItem, { kind: 'error' }> }) {
  return (
    <div className="canvas-card canvas-card-animate" style={{ background: '#fff5f5', borderColor: '#fecaca' }}>
      <p style={{ margin: 0, fontSize: 12.5, color: '#b91c1c', fontWeight: 500 }}>⚠ {item.message}</p>
    </div>
  )
}

function CarouselCanvasCard({ item }: { item: Extract<CanvasItem, { kind: 'carousel' }> }) {
  const [activeSlide, setActiveSlide] = useState(0)
  const slide = item.slides[activeSlide]
  const total = item.slides.length

  if (!slide) return null

  const ratioMap: Record<string, string> = { instagram: '125%', linkedin: '100%', tiktok: '177.78%' }
  const pb = ratioMap[item.platform] ?? '125%'

  return (
    <div className="canvas-card canvas-card-animate">
      {/* Slide preview with text overlay */}
      <div style={{ position: 'relative', width: '100%', paddingBottom: pb, borderRadius: 14, overflow: 'hidden', background: '#111', marginBottom: 12 }}>
        {slide.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={slide.imageUrl} alt={slide.headline} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 14 }} />
        )}
        {/* Gradient overlay */}
        <div style={{ position: 'absolute', inset: 0, borderRadius: 14, background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.92) 100%)' }} />
        {/* Text overlay */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px 18px' }}>
          <p style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: '#fff', lineHeight: 1.25, letterSpacing: '-0.02em', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>{slide.headline}</p>
          {slide.body && <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>{slide.body}</p>}
          {slide.cta && <div style={{ marginTop: 10, display: 'inline-block', background: '#fff', color: '#000', fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '5px 14px', letterSpacing: '0.02em' }}>{slide.cta}</div>}
        </div>
        {/* Slide counter */}
        <div style={{ position: 'absolute', top: 12, right: 14, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: '#fff' }}>
          {activeSlide + 1} / {total}
        </div>
      </div>
      {/* Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <button onClick={() => setActiveSlide(s => Math.max(0, s - 1))} disabled={activeSlide === 0} style={{ fontSize: 16, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '3px 10px', cursor: activeSlide === 0 ? 'not-allowed' : 'pointer', opacity: activeSlide === 0 ? 0.35 : 1, color: 'var(--ink)' }}>&#8249;</button>
        <div style={{ flex: 1, display: 'flex', gap: 4, justifyContent: 'center' }}>
          {item.slides.map((_, i) => (
            <button key={i} onClick={() => setActiveSlide(i)} style={{ width: i === activeSlide ? 16 : 6, height: 6, borderRadius: 3, background: i === activeSlide ? 'var(--ink)' : 'var(--border)', border: 'none', cursor: 'pointer', transition: 'all 0.15s', padding: 0 }} />
          ))}
        </div>
        <button onClick={() => setActiveSlide(s => Math.min(total - 1, s + 1))} disabled={activeSlide === total - 1} style={{ fontSize: 16, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '3px 10px', cursor: activeSlide === total - 1 ? 'not-allowed' : 'pointer', opacity: activeSlide === total - 1 ? 0.35 : 1, color: 'var(--ink)' }}>&#8250;</button>
      </div>
      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <p style={{ flex: 1, fontSize: 11, color: 'var(--ink-mute)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.topic}</p>
        <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: 'var(--ink-dim)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px' }}>{item.credits} cr</span>
        {slide.imageUrl && (
          <button onClick={() => downloadCarouselSlide(slide, activeSlide)} style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: 'var(--ink)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>&#8595;</button>
        )}
      </div>
    </div>
  )
}

function CanvasItemRenderer({ item, onOpenImage }: { item: CanvasItem; onOpenImage: (url: string, prompt: string) => void }) {
  if (item.kind === 'image') return <ImageCanvasCard item={item} onOpen={onOpenImage} />
  if (item.kind === 'social') return <SocialCanvasCard item={item} />
  if (item.kind === 'voice') return <VoiceCanvasCard item={item} />
  if (item.kind === 'brief') return <BriefCanvasCard item={item} />
  if (item.kind === 'carousel') return <CarouselCanvasCard item={item} />
  if (item.kind === 'error') return <ErrorCanvasCard item={item} />
  return null
}

function BatchGroup({ node, onOpenImage }: { node: CanvasNode; onOpenImage: (url: string, prompt: string) => void }) {
  const imageCount = node.items.filter(i => i.kind === 'image').length
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: 14 }}>
      <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>
        {imageCount} image{imageCount !== 1 ? 's' : ''}
      </p>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto' }}>
        {node.items.map(item => (
          <div key={item.id} style={{ flexShrink: 0, width: 220 }}>
            <CanvasItemRenderer item={item} onOpenImage={onOpenImage} />
          </div>
        ))}
      </div>
    </div>
  )
}

function CanvasNodeWrapper({
  node,
  selected,
  onSelect,
  onPositionChange,
  onOpenImage,
}: {
  node: CanvasNode
  selected: boolean
  onSelect: (id: string) => void
  onPositionChange: (id: string, x: number, y: number) => void
  onOpenImage: (url: string, prompt: string) => void
}) {
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef({ mouseX: 0, mouseY: 0, nodeX: 0, nodeY: 0, moved: false })

  const onMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('button, a, input, audio, select')) return
    dragStart.current = { mouseX: e.clientX, mouseY: e.clientY, nodeX: node.x, nodeY: node.y, moved: false }
    setDragging(true)
    e.preventDefault()
    e.stopPropagation()
  }

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.current.mouseX
      const dy = e.clientY - dragStart.current.mouseY
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragStart.current.moved = true
      onPositionChange(node.id, dragStart.current.nodeX + dx, dragStart.current.nodeY + dy)
    }
    const onUp = () => {
      if (!dragStart.current.moved) onSelect(node.id)
      setDragging(false)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [dragging, node.id, onPositionChange, onSelect])

  const isBatch = node.items.length > 1
  const width = isBatch ? Math.min(node.items.length, 4) * 240 + 32 : 440

  return (
    <div
      className="canvas-node"
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width,
        cursor: dragging ? 'grabbing' : 'default',
        outline: selected ? '2px solid var(--ink)' : '2px solid transparent',
        outlineOffset: 4,
        borderRadius: 22,
        transition: 'outline 0.12s',
        userSelect: 'none',
      }}
    >
      {isBatch ? (
        <BatchGroup node={node} onOpenImage={onOpenImage} />
      ) : (
        node.items[0] && <CanvasItemRenderer item={node.items[0]} onOpenImage={onOpenImage} />
      )}
    </div>
  )
}

// ─── Question Card ────────────────────────────────────────────────────────────

const BAD_OPTION_TERMS = /nanobanana|dall-?e|midjourney|stable.?diffusion|flux|ideogram|firefly|imagen|gemini|gpt|openai/i

function QuestionCard({ data, onSelect }: { data: { prompt: string; options: string[] }; onSelect: (opt: string) => void }) {
  const cleanOptions = data.options.filter(o => !BAD_OPTION_TERMS.test(o))
  const [focused, setFocused] = useState(0)
  const [custom, setCustom] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'TEXTAREA') return
      if (e.key === 'ArrowDown') { e.preventDefault(); setFocused(f => Math.min(f + 1, cleanOptions.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setFocused(f => Math.max(f - 1, 0)) }
      if (e.key === 'Enter' && !custom) { e.preventDefault(); onSelect(cleanOptions[focused]) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [focused, cleanOptions, onSelect, custom])

  return (
    <div style={{ maxWidth: '92%', border: '1px solid var(--border)', borderRadius: '18px 18px 18px 4px', overflow: 'hidden', background: 'var(--bg)' }}>
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border)' }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4 }}>{data.prompt}</p>
      </div>
      {cleanOptions.map((opt, i) => (
        <button
          key={opt}
          onMouseEnter={() => setFocused(i)}
          onClick={() => onSelect(opt)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
            background: focused === i ? 'var(--surface)' : 'transparent',
            border: 'none', borderBottom: i < cleanOptions.length - 1 ? '1px solid var(--border)' : 'none',
            cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s',
          }}
        >
          <span style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, background: focused === i ? 'var(--ink)' : 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: focused === i ? 'var(--on-ink)' : 'var(--ink-dim)', transition: 'all 0.1s' }}>{i + 1}</span>
          <span style={{ flex: 1, fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{opt}</span>
          {focused === i && <span style={{ fontSize: 11, color: 'var(--ink-mute)', flexShrink: 0 }}>↵</span>}
        </button>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        <input
          ref={inputRef}
          value={custom}
          onChange={e => setCustom(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && custom.trim()) { e.preventDefault(); onSelect(custom.trim()) } }}
          placeholder="Or type a custom answer…"
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 12.5, color: 'var(--ink)', fontFamily: 'inherit' }}
        />
        {custom && (
          <button onClick={() => onSelect(custom.trim())} style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: 'var(--ink)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '3px 9px', cursor: 'pointer' }}>Send</button>
        )}
      </div>
      <div style={{ padding: '5px 14px 7px', background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
        <p style={{ margin: 0, fontSize: 10.5, color: 'var(--ink-mute)' }}>↑↓ navigate · Enter select</p>
      </div>
    </div>
  )
}

// ─── Progress Steps ───────────────────────────────────────────────────────────

const STEP_ICONS: Record<string, React.ReactNode> = {
  think: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>,
  image: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>,
  social: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  voice: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>,
  brief: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>,
  check: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
}

function ProgressSteps({ steps }: { steps: ProgressStep[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '14px 16px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '18px 18px 18px 4px', maxWidth: '86%', minWidth: 200 }}>
      {steps.map((step, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, background: step.status === 'done' ? 'var(--ink)' : 'var(--surface)', border: step.status === 'active' ? '1.5px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: step.status === 'done' ? 'var(--on-ink)' : 'var(--ink-dim)' }}>
            {step.status === 'active'
              ? <span style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid var(--ink-mute)', borderTopColor: 'var(--ink)', display: 'block', animation: 'studio-spin 0.8s linear infinite' }} />
              : step.status === 'done' ? STEP_ICONS.check : STEP_ICONS[step.icon]
            }
          </div>
          <span style={{ fontSize: 12.5, fontWeight: step.status === 'active' ? 600 : 400, color: step.status === 'active' ? 'var(--ink)' : step.status === 'done' ? 'var(--ink-mute)' : 'var(--ink-dim)', lineHeight: 1.3 }}>
            {step.label}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StudioPage() {
  const router = useRouter()
  const { balance, refresh: refreshCredits } = useCredits()

  // Session state
  const [sessions, setSessions] = useState<Session[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string>(genId)
  const [messages, setMessages] = useState<Message[]>([])
  const [canvasNodes, setCanvasNodes] = useState<CanvasNode[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [sessionName, setSessionName] = useState('New session')
  const [showSessionList, setShowSessionList] = useState(false)

  // UI state
  const [input, setInput] = useState('')
  const [activeMode, setActiveMode] = useState<ContentMode | null>(null)
  const [infoOpen, setInfoOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [steps, setSteps] = useState<ProgressStep[]>([])
  const [brandName, setBrandName] = useState<string | null>(null)
  const [authToken, setAuthToken] = useState<string | null>(null)

  // Model selector
  const [selectedModel, setSelectedModel] = useState<'lumen' | 'animus' | 'aether'>('animus')

  // Slash command menu
  const [slashMenuOpen, setSlashMenuOpen] = useState(false)
  const [slashQuery, setSlashQuery] = useState('')
  const [slashFocused, setSlashFocused] = useState(0)
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const [customColor, setCustomColor] = useState('#000000')

  // Reference image + drag-and-drop
  const [attachedImage, setAttachedImage] = useState<AttachedImage | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Lightbox
  const [lightbox, setLightbox] = useState<{ url: string; prompt: string } | null>(null)
  const [lightboxZoom, setLightboxZoom] = useState(false)

  // Canvas pan
  const [panX, setPanX] = useState(24)
  const [panY, setPanY] = useState(24)
  const [zoom, setZoom] = useState(1)
  const [isPanning, setIsPanning] = useState(false)
  const panOrigin = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const canvasRef = useRef<HTMLDivElement>(null)

  // Canvas sensitivity (stored in localStorage)
  const [panSensitivity, setPanSensitivity] = useState<number>(() => {
    if (typeof window === 'undefined') return 0.7
    return parseFloat(localStorage.getItem('cf-pan-sensitivity') ?? '0.7')
  })
  const [zoomSensitivity, setZoomSensitivity] = useState<number>(() => {
    if (typeof window === 'undefined') return 1
    return parseFloat(localStorage.getItem('cf-zoom-sensitivity') ?? '1')
  })
  const panSensRef = useRef(panSensitivity)
  const zoomSensRef = useRef(zoomSensitivity)
  useEffect(() => { panSensRef.current = panSensitivity; localStorage.setItem('cf-pan-sensitivity', String(panSensitivity)) }, [panSensitivity])
  useEffect(() => { zoomSensRef.current = zoomSensitivity; localStorage.setItem('cf-zoom-sensitivity', String(zoomSensitivity)) }, [zoomSensitivity])

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const sessionPickerRef = useRef<HTMLDivElement>(null)

  // ── Auth gate ──────────────────────────────────────────────────────────────
  useEffect(() => {
    ;(async () => {
      const supabase = getSupabase()
      if (!supabase) { router.push('/dashboard'); return }
      const { data: sessData } = await supabase.auth.getSession()
      const session = sessData?.session
      if (!session) { router.push('/dashboard'); return }
      const email = session.user?.email ?? ''
      const { isAdminEmail } = await import('@/lib/pov-access')
      if (!isAdminEmail(email)) { router.push('/dashboard'); return }
      setAuthToken(session.access_token)
      try {
        const res = await fetch('/api/brand/load', { headers: { Authorization: `Bearer ${session.access_token}` } })
        if (res.ok) { const d = await res.json(); if (d.profile?.company_name) setBrandName(d.profile.company_name) }
      } catch { /* optional */ }
    })()
  }, [router])

  // ── Load sessions from localStorage ───────────────────────────────────────
  useEffect(() => {
    const stored = loadSessions()
    setSessions(stored)
    if (stored.length > 0) {
      const last = stored[0]
      setCurrentSessionId(last.id)
      setMessages(last.messages)
      setCanvasNodes(last.canvasNodes ?? [])
      setSessionName(last.name)
    }
  }, [])

  // ── Auto-save session (debounced so messages + canvasNodes always flush together) ──
  useEffect(() => {
    if (messages.length === 0 && canvasNodes.length === 0) return
    const t = setTimeout(() => {
      const name = sessionNameFrom(messages)
      setSessionName(name)
      const session: Session = { id: currentSessionId, name, createdAt: Date.now(), messages, canvasNodes }
      const all = loadSessions().filter(s => s.id !== currentSessionId)
      persistSessions([session, ...all])
      setSessions(prev => [session, ...prev.filter(s => s.id !== currentSessionId)])
    }, 300)
    return () => clearTimeout(t)
  }, [messages, canvasNodes, currentSessionId])

  // ── Guard against accidental navigation ───────────────────────────────────
  // beforeunload → refresh / close tab / type new URL
  // wheelGuard   → horizontal trackpad swipe that triggers browser back/forward
  useEffect(() => {
    const hasContent = messages.length > 0 || canvasNodes.length > 0
    if (!hasContent) return

    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }

    // Horizontal wheel deltaX triggers the Mac "swipe to go back" gesture.
    // Preventing it on the whole document stops accidental back navigation.
    const wheelGuard = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 5) {
        e.preventDefault()
      }
    }

    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('wheel', wheelGuard, { passive: false })
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      document.removeEventListener('wheel', wheelGuard)
    }
  }, [messages.length, canvasNodes.length])

  // ── Close session list on outside click ───────────────────────────────────
  useEffect(() => {
    if (!showSessionList) return
    const handler = (e: MouseEvent) => {
      if (!sessionPickerRef.current?.contains(e.target as Node)) setShowSessionList(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showSessionList])

  // ── Auto-scroll chat ───────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // ── Auto-resize textarea ───────────────────────────────────────────────────
  const autoResize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 96) + 'px'
  }

  // ── Reference image picker ─────────────────────────────────────────────────
  const attachFile = (file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      setAttachedImage({ dataUrl, mimeType: file.type, name: file.name })
    }
    reader.readAsDataURL(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) { attachFile(file) }
    e.target.value = ''
  }

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true) }
  const handleDragLeave = (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false) }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) attachFile(file)
  }

  // ── Send message ───────────────────────────────────────────────────────────
  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading || !authToken) return

    const imagePreview = attachedImage?.dataUrl
    const userMsg: Message = { role: 'user', content: text.trim(), imagePreview }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setSteps([])
    const sentImage = attachedImage
    setAttachedImage(null)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setLoading(true)

    // Capture and clear active mode before the async work
    const sentMode = activeMode
    setActiveMode(null)

    try {
      // Prepend hidden mode directive so Claude knows what to generate
      const modePrefix = sentMode ? `${MODE_DIRECTIVES[sentMode]}\n` : ''
      const body: Record<string, unknown> = {
        message: modePrefix + text.trim(),
        history: messages.map(m => ({ role: m.role, content: m.content })),
        model: selectedModel as string,
      }
      if (sentImage) {
        body.referenceImageBase64 = sentImage.dataUrl.split(',')[1]
        body.referenceImageMimeType = sentImage.mimeType
      }
      if (selectedNodeId) {
        const node = canvasNodes.find(n => n.id === selectedNodeId)
        if (node) {
          const firstImage = node.items.find(i => i.kind === 'image') as Extract<CanvasItem, {kind:'image'}> | undefined
          const firstSocial = node.items.find(i => i.kind === 'social') as Extract<CanvasItem, {kind:'social'}> | undefined
          body.selectedItemContext = firstImage
            ? { kind: 'image', imageUrl: firstImage.url, prompt: firstImage.prompt }
            : firstSocial
            ? { kind: 'social', text: Object.values(firstSocial.posts).join('\n') }
            : { kind: node.items[0]?.kind ?? 'item' }
        }
      }

      const res = await fetch('/api/studio/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(body),
      })

      if (!res.ok || !res.body) {
        const e = await res.json().catch(() => ({}))
        setMessages(prev => [...prev, { role: 'assistant', content: e.error ?? 'Something went wrong.' }])
        setLoading(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'step') {
              setSteps(prev => {
                const idx = prev.findIndex(s => s.label === event.label)
                if (idx >= 0) { const n = [...prev]; n[idx] = { label: event.label, icon: event.icon, status: event.status }; return n }
                return [...prev, { label: event.label, icon: event.icon, status: event.status }]
              })
            } else if (event.type === 'question') {
              setMessages(prev => [...prev, { role: 'assistant', content: '', question: { prompt: event.prompt, options: event.options } }])
              setSteps([])
              setLoading(false)
            } else if (event.type === 'result') {
              if (event.reply) setMessages(prev => [...prev, { role: 'assistant', content: event.reply }])
              if (event.canvasItems?.length) {
                const nodeW = (items: CanvasItem[]) => items.length > 1 ? Math.min(items.length, 4) * 240 + 32 : 440
                const nextX = canvasNodes.length === 0 ? 24 : Math.max(...canvasNodes.map(n => n.x + nodeW(n.items))) + 40
                const nodeId = genId()
                const newNode: CanvasNode = { id: nodeId, items: event.canvasItems, x: nextX, y: 24 }
                setCanvasNodes(prev => [newNode, ...prev])
                setPanX(-nextX + 24); setPanY(24); setZoom(1)
              }
              refreshCredits()
              setSteps([])
            } else if (event.type === 'error') {
              setMessages(prev => [...prev, { role: 'assistant', content: event.message ?? 'Something went wrong.' }])
              setSteps([])
            }
          } catch { /* skip malformed line */ }
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please try again.' }])
      setSteps([])
    } finally {
      setLoading(false)
    }
  }, [loading, authToken, messages, refreshCredits, attachedImage, selectedNodeId, canvasNodes])

  // ── Session management ─────────────────────────────────────────────────────
  const newSession = () => {
    setCurrentSessionId(genId())
    setMessages([])
    setCanvasNodes([])
    setSelectedNodeId(null)
    setSessionName('New session')
    setPanX(24); setPanY(24); setZoom(1)
    setShowSessionList(false)
    setAttachedImage(null)
  }

  const loadSession = (s: Session) => {
    setCurrentSessionId(s.id)
    setMessages(s.messages)
    setCanvasNodes(s.canvasNodes ?? [])
    setSelectedNodeId(null)
    setSessionName(s.name)
    setPanX(24); setPanY(24); setZoom(1)
    setShowSessionList(false)
  }

  // ── Canvas pan ─────────────────────────────────────────────────────────────
  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.canvas-card, .canvas-node')) return
    setIsPanning(true)
    panOrigin.current = { x: e.clientX, y: e.clientY, panX, panY }
    e.preventDefault()
  }
  const onCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return
    setPanX(panOrigin.current.panX + e.clientX - panOrigin.current.x)
    setPanY(panOrigin.current.panY + e.clientY - panOrigin.current.y)
  }
  const onCanvasMouseUp = () => setIsPanning(false)

  const touchOrigin = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const onTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('.canvas-card')) return
    const t = e.touches[0]
    touchOrigin.current = { x: t.clientX, y: t.clientY, panX, panY }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    const t = e.touches[0]
    setPanX(touchOrigin.current.panX + t.clientX - touchOrigin.current.x)
    setPanY(touchOrigin.current.panY + t.clientY - touchOrigin.current.y)
  }

  // Native non-passive wheel listener — React's synthetic onWheel is passive in some browsers
  // which prevents preventDefault from stopping page scroll.
  // Two-finger scroll → pan; pinch (ctrlKey) → zoom. Both with reduced sensitivity.
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey) {
        setZoom(z => Math.min(3, Math.max(0.25, z * (1 - e.deltaY * 0.004 * zoomSensRef.current))))
      } else {
        setPanX(x => x - e.deltaX * panSensRef.current)
        setPanY(y => y - e.deltaY * panSensRef.current)
      }
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  const zoomIn  = () => setZoom(z => Math.min(3, parseFloat((z + 0.2).toFixed(2))))
  const zoomOut = () => setZoom(z => Math.max(0.25, parseFloat((z - 0.2).toFixed(2))))
  const resetView = () => { setPanX(24); setPanY(24); setZoom(1) }

  const fitToContent = () => {
    if (canvasNodes.length === 0) { resetView(); return }
    const NODE_W = 440, NODE_H = 320
    const minX = Math.min(...canvasNodes.map(n => n.x))
    const minY = Math.min(...canvasNodes.map(n => n.y))
    const maxX = Math.max(...canvasNodes.map(n => n.x)) + NODE_W
    const maxY = Math.max(...canvasNodes.map(n => n.y)) + NODE_H
    const el = canvasRef.current
    if (!el) return
    const vw = el.clientWidth, vh = el.clientHeight
    const contentW = maxX - minX, contentH = maxY - minY
    const newZoom = Math.min(0.95, Math.min(vw / (contentW + 80), vh / (contentH + 80)))
    setZoom(newZoom)
    setPanX((vw - contentW * newZoom) / 2 - minX * newZoom)
    setPanY((vh - contentH * newZoom) / 2 - minY * newZoom)
  }

  const handleSlashInput = (value: string) => {
    const slashMatch = value.match(/(^|\s)\/(\w*)$/)
    if (slashMatch) {
      setSlashMenuOpen(true)
      setSlashQuery(slashMatch[2].toLowerCase())
      setSlashFocused(0)
    } else {
      setSlashMenuOpen(false)
    }
  }

  const insertColor = (hex: string) => {
    const newVal = input.replace(/(^|\s)\/\w*$/, (_, pre) => pre + hex)
    setInput(newVal)
    setColorPickerOpen(false)
    setSlashMenuOpen(false)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  const selectSlashCommand = (id: string) => {
    if (id === 'color') {
      setSlashMenuOpen(false)
      setColorPickerOpen(true)
    }
  }

  const filteredSlashCommands = SLASH_COMMANDS.filter(c =>
    c.id.startsWith(slashQuery) || c.label.includes(slashQuery)
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashMenuOpen) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSlashFocused(f => Math.min(f + 1, filteredSlashCommands.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSlashFocused(f => Math.max(f - 1, 0)); return }
      if (e.key === 'Enter') { e.preventDefault(); if (filteredSlashCommands[slashFocused]) selectSlashCommand(filteredSlashCommands[slashFocused].id); return }
      if (e.key === 'Escape') { setSlashMenuOpen(false); return }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
  }

  const toggleMode = (mode: ContentMode) => {
    setActiveMode(prev => prev === mode ? null : mode)
    textareaRef.current?.focus()
  }

  const displayBalance = balance ?? 0

  return (
    <>
      <style>{`
        @keyframes studio-bounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.45; } 30% { transform: translateY(-4px); opacity: 1; } }
        @keyframes studio-spin { to { transform: rotate(360deg); } }
        @keyframes studio-fade-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .canvas-card { background: var(--surface); border: 1px solid var(--border); border-radius: 18px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.05), 0 2px 10px rgba(0,0,0,0.06); transition: box-shadow 0.2s ease, transform 0.2s ease; }
        .canvas-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.1), 0 1px 4px rgba(0,0,0,0.06); transform: translateY(-1px); }
        .canvas-card-animate { animation: studio-fade-up 0.24s ease forwards; }
        .studio-send-btn:hover:not(:disabled) { opacity: 0.8; }
        .studio-send-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .studio-tool-pill { transition: all 0.12s; }
        .studio-tool-pill:hover { background: var(--surface) !important; border-color: var(--ink-dim) !important; color: var(--ink) !important; }
        .studio-session-item:hover { background: var(--surface) !important; }
        .studio-example-card:hover { background: var(--surface) !important; border-color: var(--ink-mute) !important; }
        .studio-model-pill:not([data-active="true"]):hover { background: var(--surface) !important; color: var(--ink) !important; }
        .studio-model-info-btn:hover { border-color: var(--ink-dim) !important; }
        .canvas-node { transition: outline 0.12s; }
        .canvas-node:hover { cursor: grab; }
      `}</style>

      {/* Root — exactly fills below TopBar (60px) */}
      <div style={{ height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>

        {/* ── Sub-header ─────────────────────────────────────────────────── */}
        <div style={{ height: 46, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10, borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div ref={sessionPickerRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowSessionList(s => !s)}
              style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '3px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, maxWidth: 210, overflow: 'hidden' }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sessionName}</span>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
            </button>

            {showSessionList && (
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.14)', zIndex: 50, minWidth: 270, maxHeight: 320, overflowY: 'auto', padding: 6 }}>
                <button onClick={newSession} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', background: 'none', border: 'none', borderRadius: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 20, height: 20, borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>+</span>
                  New session
                </button>
                {sessions.length > 0 && <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />}
                {sessions.map(s => (
                  <button key={s.id} className="studio-session-item" onClick={() => loadSession(s)}
                    style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--ink-dim)', background: s.id === currentSessionId ? 'var(--bg)' : 'none', border: 'none', borderRadius: 9, cursor: 'pointer', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: s.id === currentSessionId ? 600 : 400 }}>
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {brandName && (
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-dim)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 20, padding: '2px 10px' }}>
              ✦ {brandName}
            </span>
          )}

          <div style={{ flex: 1 }} />

          {/* Model selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Brain icon */}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
              <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
            </svg>

            <div style={{ display: 'flex', gap: 2, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 9, padding: 2 }}>
              {([
                { key: 'lumen',  label: 'Lumen' },
                { key: 'animus', label: 'Animus' },
                { key: 'aether', label: 'Aether' },
              ] as const).map(m => (
                <button
                  key={m.key}
                  onClick={() => setSelectedModel(m.key)}
                  style={{
                    fontSize: 11, fontWeight: selectedModel === m.key ? 700 : 500,
                    padding: '3px 9px', borderRadius: 7, border: 'none', cursor: 'pointer',
                    background: selectedModel === m.key ? 'var(--ink)' : 'transparent',
                    color: selectedModel === m.key ? 'var(--on-ink)' : 'var(--ink-dim)',
                    transition: 'all 0.12s',
                  }}
                >{m.label}</button>
              ))}
            </div>

            {/* Info tooltip — click to open/close */}
            <div style={{ position: 'relative' }} className="studio-model-info">
              <button
                className="studio-model-info-btn"
                onClick={() => setInfoOpen(o => !o)}
                style={{ width: 18, height: 18, borderRadius: '50%', border: '1px solid var(--border)', background: infoOpen ? 'var(--ink)' : 'var(--bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, transition: 'all 0.12s' }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={infoOpen ? 'var(--on-ink)' : 'var(--ink-mute)'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
              </button>
              {infoOpen && <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
                boxShadow: '0 8px 24px rgba(0,0,0,0.14)', padding: '12px 14px',
                minWidth: 250, zIndex: 60,
              }}>
                {/* Model tiers */}
                {([
                  { name: 'Lumen',  sub: 'Fast',         desc: 'Quick tasks & drafts.',                credits: 1 },
                  { name: 'Animus', sub: 'Default',      desc: 'Best balance of quality & speed.',      credits: 3 },
                  { name: 'Aether', sub: 'Most capable', desc: 'Complex creative direction.',           credits: 10 },
                ]).map((m, i) => (
                  <div key={m.name} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: i < 2 ? '1px solid var(--border)' : 'none', alignItems: 'center' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ink)', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{m.name}</span>
                        <span style={{ fontSize: 10, color: 'var(--ink-mute)', fontWeight: 500 }}>{m.sub}</span>
                      </div>
                      <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--ink-dim)', lineHeight: 1.4 }}>{m.desc}</p>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-dim)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px', flexShrink: 0 }}>{m.credits} cr</span>
                  </div>
                ))}

                {/* Sensitivity sliders */}
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', pointerEvents: 'auto' }}>
                  <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, color: 'var(--ink-dim)' }}>Canvas sensitivity</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {([
                      { label: 'Scroll speed', value: panSensitivity, setter: setPanSensitivity, min: 0.2, max: 2, step: 0.1, key: 'pan' },
                      { label: 'Zoom speed',   value: zoomSensitivity, setter: setZoomSensitivity, min: 0.3, max: 3, step: 0.1, key: 'zoom' },
                    ] as const).map(s => (
                      <div key={s.key}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 11, color: 'var(--ink-dim)' }}>{s.label}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}>{s.value.toFixed(1)}×</span>
                        </div>
                        <input
                          type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                          onChange={e => s.setter(parseFloat(e.target.value))}
                          style={{ width: '100%', accentColor: 'var(--ink)', cursor: 'pointer' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>}
            </div>
          </div>

          <span style={{ fontSize: 11, color: 'var(--ink-mute)', fontWeight: 500 }}>
            <span style={{ color: 'var(--ink)', fontWeight: 700 }}>{displayBalance.toLocaleString()}</span> credits
          </span>
          <button onClick={newSession} style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-dim)', background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '3px 10px', cursor: 'pointer' }}>
            + New
          </button>
        </div>

        {/* ── Main split ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* ── Left: Chat panel ──────────────────────────────────────────── */}
          <div
            style={{ width: 400, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)', background: 'var(--surface)', overflow: 'hidden', position: 'relative' }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Drop overlay */}
            {isDragOver && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'rgba(0,0,0,0.04)', border: '2px dashed var(--ink-dim)', borderRadius: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, pointerEvents: 'none' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--ink-dim)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--ink-dim)' }}>Drop image to attach</p>
              </div>
            )}

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 22 }}>
              {messages.length === 0 && !loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 20, padding: '0 4px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--font-serif)', lineHeight: 1.25, margin: '0 0 6px' }}>
                      What do you want<br />to create today?
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--ink-mute)', margin: 0 }}>Describe it, or pick a starting point</p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%' }}>
                    {EXAMPLE_PROMPTS.map(p => (
                      <button key={p.label} className="studio-example-card" onClick={() => send(p.text)}
                        style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '13px 12px 11px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s' }}>
                        <span style={{ color: 'var(--ink-dim)' }}>{p.icon(16)}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{p.label}</span>
                        <span style={{ fontSize: 10.5, color: 'var(--ink-mute)', lineHeight: 1.4 }}>{p.text.slice(0, 48)}…</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: 10 }}>
                      {/* AI avatar */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {msg.role === 'assistant' && <Logo size={28} style={{ borderRadius: 8, flexShrink: 0, marginTop: 1 }} />}

                      <div style={{ flex: msg.role === 'assistant' ? 1 : undefined, maxWidth: msg.role === 'user' ? '78%' : undefined, minWidth: 0 }}>
                        {/* Attached image preview (user only) */}
                        {msg.role === 'user' && msg.imagePreview && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={msg.imagePreview} alt="Reference" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)', display: 'block', marginBottom: 6, marginLeft: 'auto' }} />
                        )}

                        {msg.question ? (
                          <QuestionCard data={msg.question} onSelect={(opt) => send(opt)} />
                        ) : msg.content ? (
                          msg.role === 'user' ? (
                            /* User bubble — subtle pill */
                            <div style={{
                              display: 'inline-block',
                              padding: '10px 15px',
                              borderRadius: '18px 4px 18px 18px',
                              background: 'var(--bg)',
                              border: '1px solid var(--border)',
                              color: 'var(--ink)',
                              fontSize: 14,
                              lineHeight: 1.65,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                            }}>
                              {msg.content}
                            </div>
                          ) : (
                            /* AI message — no background, just clean text */
                            <div style={{
                              fontSize: 14,
                              lineHeight: 1.75,
                              color: 'var(--ink)',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              paddingTop: 3,
                            }}>
                              {cleanMessageText(msg.content)}
                            </div>
                          )
                        ) : null}
                      </div>
                    </div>
                  ))}
                  {(loading || steps.length > 0) && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      {/* AI avatar for loading state */}
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--ink)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                        <svg width="14" height="14" viewBox="0 0 32 32" fill="none">
                          <path d="M16 2C8.268 2 2 8.268 2 16s6.268 14 14 14 14-6.268 14-14S23.732 2 16 2zm0 4c1.657 0 3 1.343 3 3s-1.343 3-3 3-3-1.343-3-3 1.343-3 3-3zm-7 14c0-3.866 3.134-7 7-7s7 3.134 7 7H9z" fill="white" opacity="0.9"/>
                        </svg>
                      </div>
                      <div style={{ paddingTop: 4 }}>
                        {steps.length > 0
                          ? <ProgressSteps steps={steps} />
                          : <div style={{ display: 'flex', gap: 5, alignItems: 'center', paddingTop: 6 }}>
                              {[0,1,2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ink-mute)', display: 'block', animation: `studio-bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
                            </div>
                        }
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input area */}
            <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
              {/* Selected node indicator */}
              {selectedNodeId && (() => {
                const node = canvasNodes.find(n => n.id === selectedNodeId)
                const firstImage = node?.items.find(i => i.kind === 'image') as Extract<CanvasItem, {kind:'image'}> | undefined
                if (!node) return null
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px 0' }}>
                    {firstImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={firstImage.url} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', flexShrink: 0 }} />
                    )}
                    <p style={{ margin: 0, flex: 1, fontSize: 11, color: 'var(--ink-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {node.items.length > 1 ? `${node.items.length} items selected` : firstImage ? firstImage.prompt.slice(0, 50) : 'Item selected'}
                    </p>
                    <button onClick={() => setSelectedNodeId(null)} style={{ flexShrink: 0, fontSize: 11, color: 'var(--ink-mute)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>×</button>
                  </div>
                )
              })()}
              {/* Tool pills — click to set active mode */}
              <div style={{ display: 'flex', gap: 5, padding: '10px 12px 0', overflowX: 'auto' }}>
                {TOOL_PILLS.map(t => {
                  const isActive = activeMode === t.mode
                  return (
                    <button key={t.label} className="studio-tool-pill" onClick={() => toggleMode(t.mode)}
                      style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600,
                        color: isActive ? 'var(--on-ink)' : 'var(--ink-dim)',
                        background: isActive ? 'var(--ink)' : 'var(--bg)',
                        border: `1px solid ${isActive ? 'var(--ink)' : 'var(--border)'}`,
                        borderRadius: 20, padding: '4px 10px', cursor: 'pointer', transition: 'all 0.12s' }}>
                      {t.icon(11)}{t.label}
                    </button>
                  )
                })}
              </div>

              {/* Reference image preview */}
              {attachedImage && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px 0' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={attachedImage.dataUrl} alt={attachedImage.name} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachedImage.name}</p>
                    <p style={{ margin: 0, fontSize: 10.5, color: 'var(--ink-mute)' }}>Reference image attached</p>
                  </div>
                  <button onClick={() => setAttachedImage(null)} style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--ink-dim)' }}>×</button>
                </div>
              )}

              {/* Slash command menu */}
              {slashMenuOpen && filteredSlashCommands.length > 0 && (
                <div style={{ margin: '0 12px 6px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}>
                  {filteredSlashCommands.map((cmd, i) => (
                    <button
                      key={cmd.id}
                      onMouseEnter={() => setSlashFocused(i)}
                      onMouseDown={e => { e.preventDefault(); selectSlashCommand(cmd.id) }}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: slashFocused === i ? 'var(--bg)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <span style={{ width: 28, height: 28, borderRadius: 8, background: slashFocused === i ? 'var(--ink)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, transition: 'background 0.1s' }}>
                        {cmd.id === 'color' ? <span style={{ fontSize: 14 }}>🎨</span> : null}
                      </span>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{cmd.label}</p>
                        <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-mute)' }}>{cmd.description}</p>
                      </div>
                      {slashFocused === i && <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>↵</span>}
                    </button>
                  ))}
                </div>
              )}

              {/* Color picker popup */}
              {colorPickerOpen && (
                <div style={{ margin: '0 12px 6px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>Pick a color</p>
                    <button onMouseDown={e => { e.preventDefault(); setColorPickerOpen(false) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-dim)', fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, marginBottom: 10 }}>
                    {PRESET_COLORS.map(hex => (
                      <button
                        key={hex}
                        onMouseDown={e => { e.preventDefault(); insertColor(hex) }}
                        title={hex}
                        style={{ width: '100%', aspectRatio: '1', borderRadius: 8, background: hex, border: hex === '#FFFFFF' ? '1.5px solid var(--border)' : '1.5px solid transparent', cursor: 'pointer', transition: 'transform 0.1s' }}
                        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.12)')}
                        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                      />
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="color"
                      value={customColor}
                      onChange={e => setCustomColor(e.target.value)}
                      style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid var(--border)', cursor: 'pointer', padding: 2, background: 'var(--bg)' }}
                    />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', fontFamily: 'monospace' }}>{customColor.toUpperCase()}</span>
                    <button
                      onMouseDown={e => { e.preventDefault(); insertColor(customColor.toUpperCase()) }}
                      style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Use
                    </button>
                  </div>
                </div>
              )}

              {/* Textarea row */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', padding: '8px 12px 10px' }}>
                {/* Attach button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach reference image"
                  style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 10, border: '1.5px solid var(--border)', background: attachedImage ? 'var(--ink)' : 'var(--bg)', color: attachedImage ? 'var(--on-ink)' : 'var(--ink-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.12s' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFileChange} />

                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => { setInput(e.target.value); autoResize(); handleSlashInput(e.target.value) }}
                  onKeyDown={handleKeyDown}
                  placeholder={activeMode ? TOOL_PILLS.find(p => p.mode === activeMode)?.placeholder ?? 'Describe what you want to create…' : 'Describe what you want to create…'}
                  disabled={loading || !authToken}
                  rows={1}
                  style={{ flex: 1, resize: 'none', border: '1.5px solid var(--border)', borderRadius: 12, padding: '8px 12px', fontSize: 13, lineHeight: 1.5, fontFamily: 'inherit', background: 'var(--bg)', color: 'var(--ink)', outline: 'none', maxHeight: 96, overflowY: 'auto', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--ink)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,0,0,0.06)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
                />
                <button
                  className="studio-send-btn"
                  onClick={() => send(input)}
                  disabled={loading || !input.trim() || !authToken}
                  style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, background: 'var(--ink)', color: 'var(--on-ink)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity 0.15s' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 2L11 13M22 2L15 22 11 13 2 9z"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* ── Right: Pannable canvas ─────────────────────────────────────── */}
          <div
            ref={canvasRef}
            onMouseDown={onCanvasMouseDown}
            onMouseMove={onCanvasMouseMove}
            onMouseUp={onCanvasMouseUp}
            onMouseLeave={onCanvasMouseUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onCanvasMouseUp}
            onClick={(e) => { if ((e.target as HTMLElement).closest('.canvas-node')) return; setSelectedNodeId(null) }}
            style={{
              flex: 1, overflow: 'hidden', position: 'relative',
              cursor: isPanning ? 'grabbing' : 'grab',
              userSelect: 'none',
              background: 'var(--bg)',
              backgroundImage: 'radial-gradient(circle, var(--border, rgba(0,0,0,0.1)) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, transformOrigin: '0 0', transform: `translate(${panX}px, ${panY}px) scale(${zoom})`, willChange: 'transform', transition: isPanning ? 'none' : 'transform 0.12s ease' }}>
              {canvasNodes.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 340, height: 220, gap: 10, marginTop: 60, marginLeft: 60 }}>
                  <span style={{ fontSize: 30, opacity: 0.2 }}>✦</span>
                  <p style={{ fontSize: 13, color: 'var(--ink-mute)', margin: 0, opacity: 0.45, textAlign: 'center', lineHeight: 1.5 }}>Your generations<br />appear here</p>
                  <p style={{ fontSize: 11, color: 'var(--ink-mute)', margin: 0, opacity: 0.3, textAlign: 'center' }}>Drag to pan · Click images to zoom</p>
                </div>
              ) : (
                canvasNodes.map(node => (
                  <CanvasNodeWrapper
                    key={node.id}
                    node={node}
                    selected={selectedNodeId === node.id}
                    onSelect={setSelectedNodeId}
                    onPositionChange={(id, x, y) => setCanvasNodes(prev => prev.map(n => n.id === id ? { ...n, x, y } : n))}
                    onOpenImage={(url, prompt) => { setLightbox({ url, prompt }); setLightboxZoom(false) }}
                  />
                ))
              )}
            </div>

            {/* Canvas controls */}
            <div style={{ position: 'absolute', bottom: 14, right: 14, display: 'flex', alignItems: 'center', gap: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '3px 4px', boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
              <button onClick={zoomOut} title="Zoom out" style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-dim)', fontSize: 16, fontWeight: 400, lineHeight: 1 }}>−</button>
              <button onClick={resetView} title="Reset view (100%)" style={{ minWidth: 42, height: 28, borderRadius: 7, border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--ink-dim)', lineHeight: 1 }}>{Math.round(zoom * 100)}%</button>
              <button onClick={zoomIn} title="Zoom in" style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-dim)', fontSize: 16, fontWeight: 400, lineHeight: 1 }}>+</button>
              <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 2px' }} />
              <button onClick={fitToContent} title="Fit content to view" style={{ height: 28, padding: '0 8px', borderRadius: 7, border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--ink-dim)', display: 'flex', alignItems: 'center', gap: 4, lineHeight: 1 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                Fit
              </button>
            </div>
          </div>

        </div>
      </div>


      {/* ── Lightbox portal ──────────────────────────────────────────────────── */}
      {lightbox && typeof window !== 'undefined' && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.88)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setLightbox(null)}
        >
          {/* Image */}
          <div
            style={{ maxWidth: lightboxZoom ? '95vw' : '70vw', maxHeight: lightboxZoom ? '90vh' : '75vh', cursor: lightboxZoom ? 'zoom-out' : 'zoom-in', transition: 'max-width 0.25s ease, max-height 0.25s ease' }}
            onClick={e => { e.stopPropagation(); setLightboxZoom(z => !z) }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.url}
              alt={lightbox.prompt}
              style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 16, boxShadow: '0 24px 80px rgba(0,0,0,0.5)', display: 'block' }}
            />
          </div>

          {/* Bottom bar */}
          <div
            style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, backdropFilter: 'blur(12px)' }}
            onClick={e => e.stopPropagation()}
          >
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.6)', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>{lightbox.prompt}</p>
            <button
              onClick={() => setLightboxZoom(z => !z)}
              style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: '#fff', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}
            >
              {lightboxZoom ? '⊖ Zoom out' : '⊕ Zoom in'}
            </button>
            <button
              onClick={() => downloadBlob(lightbox.url, 'studio-image.png')}
              style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: '#fff', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}
            >
              ↓ Download
            </button>
            <button
              onClick={() => setLightbox(null)}
              style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
