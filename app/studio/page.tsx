'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Session {
  id: string
  name: string
  createdAt: number
  messages: Message[]
  canvasItems: CanvasItem[]
}

// ─── Session persistence (localStorage) ──────────────────────────────────────

const SESSION_STORAGE_KEY = 'cf-studio-sessions'
const MAX_SESSIONS = 15

function genId() { return Math.random().toString(36).slice(2, 10) }

function loadSessions(): Session[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? '[]') } catch { return [] }
}

function persistSessions(sessions: Session[]) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)))
}

function sessionNameFrom(messages: Message[]): string {
  const first = messages.find(m => m.role === 'user')?.content
  if (!first) return 'New session'
  return first.length > 36 ? first.slice(0, 36) + '…' : first
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EXAMPLE_PROMPTS = [
  'Generate a product photo for Instagram',
  'Write captions for my new collection drop',
  'Create a voiceover for a 30-second ad',
  'Plan a UGC video for TikTok',
]

const SOCIAL_LABELS: Record<string, string> = {
  instagram: 'IG',
  facebook: 'FB',
  twitter: 'X',
  linkedin: 'LI',
}

// ─── Canvas Item Cards ────────────────────────────────────────────────────────

function ImageCanvasCard({ item }: { item: Extract<CanvasItem, { kind: 'image' }> }) {
  const ratioMap: Record<string, string> = { '1:1': '100%', '4:5': '125%', '9:16': '177.78%', '16:9': '56.25%' }
  const pb = ratioMap[item.ratio] || '100%'
  return (
    <div className="canvas-card canvas-card-animate">
      <div style={{ position: 'relative', width: '100%', paddingBottom: pb, borderRadius: 12, overflow: 'hidden', background: 'var(--bg)', marginBottom: 10 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.url} alt={item.prompt} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <p style={{ flex: 1, fontSize: 11.5, color: 'var(--ink-mute)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.prompt}</p>
        <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: 'var(--ink-dim)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px' }}>{item.credits} cr</span>
        <a href={item.url} target="_blank" rel="noreferrer" style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px' }}>↓</a>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {platforms.map(p => (
            <button key={p} onClick={() => setActiveTab(p)} style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', background: activeTab === p ? 'var(--ink)' : 'transparent', color: activeTab === p ? 'var(--on-ink)' : 'var(--ink-dim)', transition: 'all 0.12s' }}>
              {SOCIAL_LABELS[p] ?? p.toUpperCase()}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-dim)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px' }}>{item.credits} cr</span>
          <button onClick={copy} style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>{copied ? '✓' : 'Copy'}</button>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: 'var(--ink)', fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', minHeight: 70 }}>
        {item.posts[activeTab] ?? ''}
      </p>
      <p style={{ margin: '6px 0 0', fontSize: 10.5, color: 'var(--ink-mute)' }}>Topic: {item.topic}</p>
    </div>
  )
}

function VoiceCanvasCard({ item }: { item: Extract<CanvasItem, { kind: 'voice' }> }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="canvas-card canvas-card-animate">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-dim)' }}>Voiceover</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-dim)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px' }}>{item.credits} cr</span>
      </div>
      <audio controls src={item.audioUrl} style={{ width: '100%', height: 36, borderRadius: 8, marginBottom: 8 }} />
      {item.duration && <p style={{ margin: '0 0 6px', fontSize: 10.5, color: 'var(--ink-mute)' }}>~{item.duration}s</p>}
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: 'var(--ink-dim)', WebkitLineClamp: expanded ? undefined : 3, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: expanded ? 'visible' : 'hidden' }}>
        {item.text}
      </p>
      {item.text.length > 120 && (
        <button onClick={() => setExpanded(e => !e)} style={{ marginTop: 4, fontSize: 11, color: 'var(--ink-mute)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}

function BriefCanvasCard({ item }: { item: Extract<CanvasItem, { kind: 'brief' }> }) {
  return (
    <div className="canvas-card canvas-card-animate">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--font-serif)' }}>{item.title}</h3>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-mute)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px' }}>{item.platform}</span>
      </div>
      <div style={{ marginBottom: 10 }}>
        <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>Hook</p>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: 'var(--ink)', fontStyle: 'italic' }}>{item.hook}</p>
      </div>
      {item.scenes.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>Scenes</p>
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            {item.scenes.map((s, i) => <li key={i} style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--ink-dim)', marginBottom: 4 }}>{s}</li>)}
          </ol>
        </div>
      )}
      <div style={{ marginBottom: 12 }}>
        <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>CTA</p>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{item.cta}</p>
      </div>
      <a href="/generate/ugc" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}>Open in Video Studio →</a>
    </div>
  )
}

function ErrorCanvasCard({ item }: { item: Extract<CanvasItem, { kind: 'error' }> }) {
  return (
    <div className="canvas-card canvas-card-animate" style={{ background: '#fff5f5', borderColor: '#fecaca' }}>
      <p style={{ margin: 0, fontSize: 12, color: '#b91c1c', fontWeight: 500 }}>⚠ {item.message}</p>
    </div>
  )
}

function CanvasItemRenderer({ item }: { item: CanvasItem }) {
  if (item.kind === 'image') return <ImageCanvasCard item={item} />
  if (item.kind === 'social') return <SocialCanvasCard item={item} />
  if (item.kind === 'voice') return <VoiceCanvasCard item={item} />
  if (item.kind === 'brief') return <BriefCanvasCard item={item} />
  if (item.kind === 'error') return <ErrorCanvasCard item={item} />
  return null
}

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '16px 16px 16px 4px', maxWidth: '84%', minWidth: 200 }}>
      {steps.map((step, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          {/* Icon / spinner */}
          <div style={{
            width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
            background: step.status === 'done' ? 'var(--ink)' : 'var(--surface)',
            border: step.status === 'active' ? '1.5px solid var(--border)' : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: step.status === 'done' ? 'var(--on-ink)' : 'var(--ink-dim)',
          }}>
            {step.status === 'active'
              ? <span style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid var(--ink-mute)', borderTopColor: 'var(--ink)', display: 'block', animation: 'studio-spin 0.8s linear infinite' }} />
              : step.status === 'done'
                ? STEP_ICONS.check
                : STEP_ICONS[step.icon]
            }
          </div>
          {/* Label */}
          <span style={{
            fontSize: 12.5,
            fontWeight: step.status === 'active' ? 600 : 400,
            color: step.status === 'active' ? 'var(--ink)' : step.status === 'done' ? 'var(--ink-mute)' : 'var(--ink-dim)',
            lineHeight: 1.3,
          }}>
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
  const [canvasItems, setCanvasItems] = useState<CanvasItem[]>([])
  const [sessionName, setSessionName] = useState('New session')
  const [showSessionList, setShowSessionList] = useState(false)

  // UI state
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [steps, setSteps] = useState<ProgressStep[]>([])
  const [brandName, setBrandName] = useState<string | null>(null)
  const [authToken, setAuthToken] = useState<string | null>(null)

  // Canvas pan state
  const [panX, setPanX] = useState(24)
  const [panY, setPanY] = useState(24)
  const [isPanning, setIsPanning] = useState(false)
  const panOrigin = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const canvasRef = useRef<HTMLDivElement>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

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
      setCanvasItems(last.canvasItems)
      setSessionName(last.name)
    }
  }, [])

  // ── Auto-save session on every change ─────────────────────────────────────
  useEffect(() => {
    if (messages.length === 0 && canvasItems.length === 0) return
    const name = sessionNameFrom(messages)
    setSessionName(name)
    const session: Session = { id: currentSessionId, name, createdAt: Date.now(), messages, canvasItems }
    const all = loadSessions().filter(s => s.id !== currentSessionId)
    persistSessions([session, ...all])
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== currentSessionId)
      return [session, ...filtered]
    })
  }, [messages, canvasItems, currentSessionId])

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

  // ── Send message (reads SSE stream for live progress) ─────────────────────
  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading || !authToken) return
    const userMsg: Message = { role: 'user', content: text.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setSteps([])
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setLoading(true)

    try {
      const res = await fetch('/api/studio/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ message: text.trim(), history: messages }),
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
                const existing = prev.findIndex(s => s.label === event.label)
                if (existing >= 0) {
                  const next = [...prev]
                  next[existing] = { label: event.label, icon: event.icon, status: event.status }
                  return next
                }
                return [...prev, { label: event.label, icon: event.icon, status: event.status }]
              })
            } else if (event.type === 'result') {
              if (event.reply) setMessages(prev => [...prev, { role: 'assistant', content: event.reply }])
              if (event.canvasItems?.length) {
                setCanvasItems(prev => [...[...event.canvasItems].reverse(), ...prev])
                refreshCredits()
                setPanX(24); setPanY(24)
              }
              setSteps([])
            } else if (event.type === 'error') {
              setMessages(prev => [...prev, { role: 'assistant', content: event.message ?? 'Something went wrong.' }])
              setSteps([])
            }
          } catch { /* skip malformed SSE line */ }
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please try again.' }])
      setSteps([])
    } finally {
      setLoading(false)
    }
  }, [loading, authToken, messages, refreshCredits])

  // ── New session ────────────────────────────────────────────────────────────
  const newSession = () => {
    setCurrentSessionId(genId())
    setMessages([])
    setCanvasItems([])
    setSessionName('New session')
    setPanX(24); setPanY(24)
    setShowSessionList(false)
  }

  // ── Load session ───────────────────────────────────────────────────────────
  const loadSession = (s: Session) => {
    setCurrentSessionId(s.id)
    setMessages(s.messages)
    setCanvasItems(s.canvasItems)
    setSessionName(s.name)
    setPanX(24); setPanY(24)
    setShowSessionList(false)
  }

  // ── Canvas pan handlers ────────────────────────────────────────────────────
  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.canvas-card')) return
    setIsPanning(true)
    panOrigin.current = { x: e.clientX, y: e.clientY, panX, panY }
    e.preventDefault()
  }

  const onCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return
    const dx = e.clientX - panOrigin.current.x
    const dy = e.clientY - panOrigin.current.y
    setPanX(panOrigin.current.panX + dx)
    setPanY(panOrigin.current.panY + dy)
  }

  const onCanvasMouseUp = () => setIsPanning(false)

  // Touch pan for mobile
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
  }

  const displayBalance = balance ?? 0

  return (
    <>
      <style>{`
        @keyframes studio-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes studio-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes studio-slide-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .canvas-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 16px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
        .canvas-card-animate { animation: studio-slide-in 0.22s ease forwards; }
        .studio-send-btn:hover:not(:disabled) { opacity: 0.8; }
        .studio-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .studio-prompt-chip:hover { background: var(--surface) !important; border-color: var(--ink-mute) !important; }
        .studio-session-item:hover { background: var(--surface); }
      `}</style>

      {/* Root fills exactly the available space below the app TopBar (60px) */}
      <div style={{ height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>

        {/* ── Thin sub-header ─────────────────────────────────────────────── */}
        <div style={{ height: 40, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10, borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          {/* Session picker */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowSessionList(s => !s)}
              style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '3px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{sessionName}</span>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
            </button>

            {showSessionList && (
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 50, minWidth: 260, maxHeight: 320, overflowY: 'auto', padding: 6 }}>
                <button onClick={newSession} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 600, color: 'var(--ink)', background: 'none', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>+</span> New session
                </button>
                {sessions.length > 0 && <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />}
                {sessions.map(s => (
                  <button
                    key={s.id}
                    className="studio-session-item"
                    onClick={() => loadSession(s)}
                    style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--ink-dim)', background: s.id === currentSessionId ? 'var(--bg)' : 'none', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: s.id === currentSessionId ? 600 : 400 }}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Brand pill */}
          {brandName && (
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-dim)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 20, padding: '2px 10px' }}>
              ✦ {brandName}
            </span>
          )}

          <div style={{ flex: 1 }} />

          {/* Credits */}
          <span style={{ fontSize: 11, color: 'var(--ink-mute)', fontWeight: 500 }}>
            <span style={{ color: 'var(--ink)', fontWeight: 700 }}>{displayBalance.toLocaleString()}</span> credits
          </span>

          {/* New session shortcut */}
          <button onClick={newSession} style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-dim)', background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '3px 10px', cursor: 'pointer' }}>
            + New
          </button>
        </div>

        {/* ── Main split ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* ── Left: Chat panel ─────────────────────────────────────────── */}
          <div style={{ width: 380, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)', background: 'var(--surface)', overflow: 'hidden' }}>

            {/* Messages — fills remaining height, scrollable */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {messages.length === 0 && !loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14, padding: '0 4px' }}>
                  <p style={{ fontSize: 19, fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--font-serif)', textAlign: 'center', lineHeight: 1.3, margin: 0 }}>
                    What do you want<br />to create today?
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                    {EXAMPLE_PROMPTS.map(p => (
                      <button key={p} className="studio-prompt-chip" onClick={() => send(p)} style={{ fontSize: 12, color: 'var(--ink-dim)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', textAlign: 'left', fontWeight: 500 }}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      <div style={{ maxWidth: '84%', padding: '8px 12px', borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: msg.role === 'user' ? 'var(--ink)' : 'var(--bg)', color: msg.role === 'user' ? 'var(--on-ink)' : 'var(--ink)', fontSize: 13, lineHeight: 1.55, border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {(loading || steps.length > 0) && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                      {steps.length > 0
                        ? <ProgressSteps steps={steps} />
                        : <div style={{ display: 'flex', gap: 4, padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '16px 16px 16px 4px' }}>
                            {[0,1,2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ink-mute)', display: 'block', animation: `studio-bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
                          </div>
                      }
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input — always anchored to the bottom */}
            <div style={{ flexShrink: 0, padding: '10px 12px', borderTop: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => { setInput(e.target.value); autoResize() }}
                onKeyDown={handleKeyDown}
                placeholder="Describe what you want to create…"
                disabled={loading || !authToken}
                rows={1}
                style={{ flex: 1, resize: 'none', border: '1.5px solid var(--border)', borderRadius: 12, padding: '8px 12px', fontSize: 13, lineHeight: 1.5, fontFamily: 'inherit', background: 'var(--bg)', color: 'var(--ink)', outline: 'none', maxHeight: 96, overflowY: 'auto', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--ink)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,0,0,0.07)' }}
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

          {/* ── Right: Pannable canvas ───────────────────────────────────── */}
          <div
            ref={canvasRef}
            onMouseDown={onCanvasMouseDown}
            onMouseMove={onCanvasMouseMove}
            onMouseUp={onCanvasMouseUp}
            onMouseLeave={onCanvasMouseUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onCanvasMouseUp}
            style={{
              flex: 1,
              overflow: 'hidden',
              position: 'relative',
              cursor: isPanning ? 'grabbing' : 'grab',
              userSelect: 'none',
              background: 'var(--bg)',
              backgroundImage: 'radial-gradient(circle, var(--border, rgba(0,0,0,0.1)) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          >
            {/* Panning surface */}
            <div style={{ position: 'absolute', top: 0, left: 0, transform: `translate(${panX}px, ${panY}px)`, willChange: 'transform', transition: isPanning ? 'none' : 'transform 0.12s ease' }}>
              {canvasItems.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 300, height: 200, gap: 10, marginTop: 60, marginLeft: 60 }}>
                  <span style={{ fontSize: 28, opacity: 0.25 }}>✦</span>
                  <p style={{ fontSize: 12.5, color: 'var(--ink-mute)', margin: 0, opacity: 0.5, textAlign: 'center', lineHeight: 1.5 }}>Generated content<br />appears here</p>
                  <p style={{ fontSize: 11, color: 'var(--ink-mute)', margin: 0, opacity: 0.35, textAlign: 'center' }}>Drag to pan the canvas</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 380 }}>
                  {canvasItems.map(item => (
                    <CanvasItemRenderer key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>

            {/* Pan hint overlay — top right */}
            {canvasItems.length > 0 && (
              <div style={{ position: 'absolute', bottom: 12, right: 12, fontSize: 10.5, color: 'var(--ink-mute)', opacity: 0.5, pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M12 12v.01"/></svg>
                Drag to pan
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Click-outside to close session list */}
      {showSessionList && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowSessionList(false)} />
      )}
    </>
  )
}
