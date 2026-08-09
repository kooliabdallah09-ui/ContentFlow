'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { getSupabase } from '@/lib/auth'
import { useCredits } from '@/lib/CreditsContext'

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

// ─── SVG icons ───────────────────────────────────────────────────────────────

const Icon = {
  Image: (s = 13) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>,
  Caption: (s = 13) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Voice: (s = 13) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>,
  Brief: (s = 13) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
}

// ─── Tool quick-starters ──────────────────────────────────────────────────────

const TOOL_PILLS = [
  { icon: Icon.Image,   label: 'Image',    starter: 'Generate a product photo for Instagram — ' },
  { icon: Icon.Caption, label: 'Captions', starter: 'Write social captions for ' },
  { icon: Icon.Voice,   label: 'Voice',    starter: 'Create a 30-second voiceover for ' },
  { icon: Icon.Brief,   label: 'Brief',    starter: 'Plan a UGC video brief for ' },
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
        <a href={item.url} download target="_blank" rel="noreferrer" style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', transition: 'background 0.12s' }}>↓</a>
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

function CanvasItemRenderer({ item, onOpenImage }: { item: CanvasItem; onOpenImage: (url: string, prompt: string) => void }) {
  if (item.kind === 'image') return <ImageCanvasCard item={item} onOpen={onOpenImage} />
  if (item.kind === 'social') return <SocialCanvasCard item={item} />
  if (item.kind === 'voice') return <VoiceCanvasCard item={item} />
  if (item.kind === 'brief') return <BriefCanvasCard item={item} />
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

function QuestionCard({ data, onSelect }: { data: { prompt: string; options: string[] }; onSelect: (opt: string) => void }) {
  const [focused, setFocused] = useState(0)
  const [custom, setCustom] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'TEXTAREA') return
      if (e.key === 'ArrowDown') { e.preventDefault(); setFocused(f => Math.min(f + 1, data.options.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setFocused(f => Math.max(f - 1, 0)) }
      if (e.key === 'Enter' && !custom) { e.preventDefault(); onSelect(data.options[focused]) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [focused, data.options, onSelect, custom])

  return (
    <div style={{ maxWidth: '92%', border: '1px solid var(--border)', borderRadius: '18px 18px 18px 4px', overflow: 'hidden', background: 'var(--bg)' }}>
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border)' }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4 }}>{data.prompt}</p>
      </div>
      {data.options.map((opt, i) => (
        <button
          key={opt}
          onMouseEnter={() => setFocused(i)}
          onClick={() => onSelect(opt)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
            background: focused === i ? 'var(--surface)' : 'transparent',
            border: 'none', borderBottom: i < data.options.length - 1 ? '1px solid var(--border)' : 'none',
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
  const [loading, setLoading] = useState(false)
  const [steps, setSteps] = useState<ProgressStep[]>([])
  const [brandName, setBrandName] = useState<string | null>(null)
  const [authToken, setAuthToken] = useState<string | null>(null)

  // Model selector
  const [selectedModel, setSelectedModel] = useState<'lumen' | 'animus' | 'aether'>('animus')

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
      const email = session.user?.email?.toLowerCase() ?? ''
      const adminEmails = new Set(['abdallah.kooli@icloud.com', 'abdallah@icloud.com', 'kooliabdallah09@gmail.com'])
      if (!adminEmails.has(email)) { router.push('/dashboard'); return }
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

  // ── Auto-save session ──────────────────────────────────────────────────────
  useEffect(() => {
    if (messages.length === 0 && canvasNodes.length === 0) return
    const name = sessionNameFrom(messages)
    setSessionName(name)
    const session: Session = { id: currentSessionId, name, createdAt: Date.now(), messages, canvasNodes }
    const all = loadSessions().filter(s => s.id !== currentSessionId)
    persistSessions([session, ...all])
    setSessions(prev => [session, ...prev.filter(s => s.id !== currentSessionId)])
  }, [messages, canvasNodes, currentSessionId])

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

    try {
      const body: Record<string, unknown> = {
        message: text.trim(),
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
                setCanvasNodes(prev => {
                  const nodeId = genId()
                  const newNode: CanvasNode = {
                    id: nodeId,
                    items: event.canvasItems,
                    x: 24 + (prev.length % 3) * 30,
                    y: 24 + (prev.length % 3) * 30,
                  }
                  return [newNode, ...prev]
                })
                refreshCredits()
                setPanX(24); setPanY(24); setZoom(1)
              }
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

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.08 : 0.08
    setZoom(z => Math.min(3, Math.max(0.25, z + delta)))
  }

  const zoomIn  = () => setZoom(z => Math.min(3, parseFloat((z + 0.2).toFixed(2))))
  const zoomOut = () => setZoom(z => Math.max(0.25, parseFloat((z - 0.2).toFixed(2))))
  const resetView = () => { setPanX(24); setPanY(24); setZoom(1) }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
  }

  const applyToolPill = (starter: string) => {
    setInput(starter)
    textareaRef.current?.focus()
    setTimeout(autoResize, 0)
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
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                    <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 4 }}>
                      {msg.role === 'user' && msg.imagePreview && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={msg.imagePreview} alt="Reference" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }} />
                      )}
                      {msg.question ? (
                        <QuestionCard data={msg.question} onSelect={(opt) => send(opt)} />
                      ) : msg.content ? (
                        <div style={{
                          maxWidth: '86%',
                          padding: msg.role === 'user' ? '9px 13px' : '10px 13px',
                          borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                          background: msg.role === 'user' ? 'var(--ink)' : 'var(--bg)',
                          color: msg.role === 'user' ? 'var(--on-ink)' : 'var(--ink)',
                          fontSize: 13,
                          lineHeight: 1.6,
                          border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}>
                          {msg.role === 'assistant' ? cleanMessageText(msg.content) : msg.content}
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {(loading || steps.length > 0) && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                      {steps.length > 0
                        ? <ProgressSteps steps={steps} />
                        : <div style={{ display: 'flex', gap: 4, padding: '11px 15px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '18px 18px 18px 4px' }}>
                            {[0,1,2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ink-mute)', display: 'block', animation: `studio-bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
                          </div>
                      }
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
              {/* Tool pills */}
              <div style={{ display: 'flex', gap: 5, padding: '10px 12px 0', overflowX: 'auto' }}>
                {TOOL_PILLS.map(t => (
                  <button key={t.label} className="studio-tool-pill" onClick={() => applyToolPill(t.starter)}
                    style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: 'var(--ink-dim)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 10px', cursor: 'pointer' }}>
                    {t.icon(11)}{t.label}
                  </button>
                ))}
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
                  onChange={e => { setInput(e.target.value); autoResize() }}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe what you want to create…"
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
            onWheel={onWheel}
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
              <button onClick={resetView} title="Reset view" style={{ minWidth: 42, height: 28, borderRadius: 7, border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--ink-dim)', lineHeight: 1 }}>{Math.round(zoom * 100)}%</button>
              <button onClick={zoomIn} title="Zoom in" style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-dim)', fontSize: 16, fontWeight: 400, lineHeight: 1 }}>+</button>
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
            <a
              href={lightbox.url}
              download
              target="_blank"
              rel="noreferrer"
              style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: '#fff', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', textDecoration: 'none' }}
            >
              ↓ Download
            </a>
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
