'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/auth'
import { useCredits } from '@/lib/CreditsContext'

// ─── Types ────────────────────────────────────────────────────────────────────

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

function ImageCard({ item }: { item: Extract<CanvasItem, { kind: 'image' }> }) {
  const ratioStyle: Record<string, string> = {
    '1:1': '100%',
    '4:5': '125%',
    '9:16': '177.78%',
    '16:9': '56.25%',
  }
  const paddingBottom = ratioStyle[item.ratio] || '100%'

  return (
    <div style={{ position: 'relative', width: '100%', paddingBottom, borderRadius: 12, overflow: 'hidden', background: 'var(--bg)', marginBottom: 12 }}>
      <img
        src={item.url}
        alt={item.prompt}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }}
      />
    </div>
  )
}

function ImageCanvasCard({ item }: { item: Extract<CanvasItem, { kind: 'image' }> }) {
  return (
    <div className="canvas-card canvas-card-animate">
      <ImageCard item={item} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
        <p style={{ flex: 1, fontSize: 12, color: 'var(--ink-mute)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.prompt}</p>
        <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: 'var(--ink-dim)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px' }}>{item.credits} cr</span>
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px' }}
        >
          ↓ Download
        </a>
      </div>
    </div>
  )
}

function SocialCanvasCard({ item }: { item: Extract<CanvasItem, { kind: 'social' }> }) {
  const platforms = Object.keys(item.posts)
  const [activeTab, setActiveTab] = useState(platforms[0] ?? 'instagram')
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    const text = item.posts[activeTab] ?? ''
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="canvas-card canvas-card-animate">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {platforms.map(p => (
            <button
              key={p}
              onClick={() => setActiveTab(p)}
              style={{
                fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', letterSpacing: '0.04em',
                background: activeTab === p ? 'var(--ink)' : 'transparent',
                color: activeTab === p ? 'var(--on-ink)' : 'var(--ink-dim)',
                transition: 'all 0.15s',
              }}
            >
              {SOCIAL_LABELS[p] ?? p.toUpperCase()}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-dim)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px' }}>{item.credits} cr</span>
          <button
            onClick={copy}
            style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: 'var(--ink)', fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', minHeight: 80 }}>
        {item.posts[activeTab] ?? ''}
      </p>
      <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--ink-mute)' }}>Topic: {item.topic}</p>
    </div>
  )
}

function VoiceCanvasCard({ item }: { item: Extract<CanvasItem, { kind: 'voice' }> }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="canvas-card canvas-card-animate">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-dim)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Voiceover</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-dim)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px' }}>{item.credits} cr</span>
      </div>
      <audio controls src={item.audioUrl} style={{ width: '100%', height: 36, borderRadius: 8, marginBottom: 10 }} />
      {item.duration && (
        <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--ink-mute)' }}>~{item.duration}s</p>
      )}
      <p
        style={{
          margin: 0, fontSize: 12, lineHeight: 1.6, color: 'var(--ink-dim)',
          display: '-webkit-box', WebkitBoxOrient: 'vertical',
          WebkitLineClamp: expanded ? undefined : 3,
          overflow: expanded ? 'visible' : 'hidden',
        }}
      >
        {item.text}
      </p>
      {item.text.length > 120 && (
        <button
          onClick={() => setExpanded(e => !e)}
          style={{ marginTop: 4, fontSize: 11, color: 'var(--ink-mute)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
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
            {item.scenes.map((scene, i) => (
              <li key={i} style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--ink-dim)', marginBottom: 4 }}>{scene}</li>
            ))}
          </ol>
        </div>
      )}
      <div style={{ marginBottom: 12 }}>
        <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>CTA</p>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{item.cta}</p>
      </div>
      <a href="/generate/ugc" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        Open in Video Studio →
      </a>
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

// ─── Typing Indicator ────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '8px 12px', background: 'var(--surface)', borderRadius: '18px 18px 18px 4px', width: 'fit-content', alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          style={{
            width: 6, height: 6, borderRadius: '50%', background: 'var(--ink-mute)', display: 'block',
            animation: `studio-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StudioPage() {
  const router = useRouter()
  const { balance, refresh: refreshCredits } = useCredits()

  const [messages, setMessages] = useState<Message[]>([])
  const [canvasItems, setCanvasItems] = useState<CanvasItem[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [brandName, setBrandName] = useState<string | null>(null)
  const [authToken, setAuthToken] = useState<string | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // ── Auth gate + load ───────────────────────────────────────────────────────
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

      // Load brand name for header pill
      try {
        const res = await fetch('/api/brand/load', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const data = await res.json()
          if (data.profile?.company_name) setBrandName(data.profile.company_name)
        }
      } catch {
        // brand context is optional
      }
    })()
  }, [router])

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

  // ── Send message ───────────────────────────────────────────────────────────
  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading || !authToken) return

    const userMsg: Message = { role: 'user', content: text.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    setLoading(true)

    try {
      const res = await fetch('/api/studio/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          message: text.trim(),
          history: messages,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        const errMsg = errData.error ?? `Request failed (${res.status})`
        setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, something went wrong: ${errMsg}` }])
        return
      }

      const data = await res.json()
      const { reply, canvasItems: newItems } = data as { reply: string; canvasItems: CanvasItem[] }

      if (reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: reply }])
      }
      if (newItems?.length) {
        setCanvasItems(prev => [...newItems.reverse(), ...prev])
        refreshCredits()
      }
    } catch (err) {
      console.error('[studio] send error:', err)
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }, [loading, authToken, messages, refreshCredits])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  const clearSession = () => {
    setMessages([])
    setCanvasItems([])
    setInput('')
  }

  const displayBalance = balance ?? 0

  return (
    <>
      <style>{`
        @keyframes studio-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes studio-slide-in {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .canvas-card-animate {
          animation: studio-slide-in 0.25s ease forwards;
        }
        .studio-prompt-chip {
          transition: background 0.15s, border-color 0.15s;
        }
        .studio-prompt-chip:hover {
          background: var(--surface) !important;
          border-color: var(--ink-mute) !important;
        }
        .studio-send-btn:hover:not(:disabled) {
          opacity: 0.8;
        }
        .studio-send-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        @media (max-width: 767px) {
          .studio-layout { flex-direction: column !important; }
          .studio-canvas { height: 300px !important; min-height: 300px !important; }
          .studio-chat { height: auto !important; flex: 1 !important; }
          .dot-grid { display: none !important; }
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans, system-ui, sans-serif)' }}>

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <header style={{
          height: 48,
          background: '#1A1916',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: 12,
          flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          {/* Left: logo + title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <img src="/logo-icon.png" alt="ContentFlow" style={{ width: 22, height: 22, objectFit: 'contain', opacity: 0.9 }} />
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 15, color: '#fff', letterSpacing: '-0.01em' }}>
              Content<em style={{ fontStyle: 'italic', color: '#C8B87A' }}>flow</em> Studio
            </span>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#1e3a5f', background: '#dbeafe', border: '1px solid #bfdbfe', borderRadius: 4, padding: '1px 5px', lineHeight: 1.6 }}>Alpha</span>
          </div>

          {/* Center: brand pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              fontSize: 11, fontWeight: 500, color: brandName ? '#C8B87A' : 'rgba(255,255,255,0.4)',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 20, padding: '3px 10px',
            }}>
              {brandName ? `✦ ${brandName}` : 'No brand set'}
            </div>
          </div>

          {/* Right: credits + new session */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>
              <span style={{ color: '#C8B87A', fontWeight: 700 }}>{displayBalance.toLocaleString()}</span> credits
            </span>
            <button
              onClick={clearSession}
              style={{
                fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            >
              + New session
            </button>
          </div>
        </header>

        {/* ── Main split ───────────────────────────────────────────────────── */}
        <div className="studio-layout" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* ── Left: Chat panel ─────────────────────────────────────────── */}
          <div className="studio-chat" style={{ width: 400, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)', background: 'var(--surface)', height: '100%', overflow: 'hidden' }}>

            {/* Messages thread */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {messages.length === 0 && !loading ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '40px 12px' }}>
                  <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--font-serif)', textAlign: 'center', lineHeight: 1.3, margin: 0 }}>
                    What do you want<br />to create today?
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                    {EXAMPLE_PROMPTS.map(prompt => (
                      <button
                        key={prompt}
                        className="studio-prompt-chip"
                        onClick={() => send(prompt)}
                        style={{
                          fontSize: 12, color: 'var(--ink-dim)', background: 'var(--bg)',
                          border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px',
                          cursor: 'pointer', textAlign: 'left', fontWeight: 500,
                        }}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      <div
                        style={{
                          maxWidth: '82%',
                          padding: '8px 12px',
                          borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                          background: msg.role === 'user' ? 'var(--ink)' : 'var(--bg)',
                          color: msg.role === 'user' ? 'var(--on-ink)' : 'var(--ink)',
                          fontSize: 13,
                          lineHeight: 1.55,
                          border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                      <TypingIndicator />
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input area */}
            <div style={{
              flexShrink: 0, padding: '10px 12px', borderTop: '1px solid var(--border)',
              background: 'var(--surface)', display: 'flex', gap: 8, alignItems: 'flex-end',
            }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => { setInput(e.target.value); autoResize() }}
                onKeyDown={handleKeyDown}
                placeholder="Describe what you want to create…"
                disabled={loading || !authToken}
                rows={1}
                style={{
                  flex: 1, resize: 'none', border: '1.5px solid var(--border)', borderRadius: 12,
                  padding: '8px 12px', fontSize: 13, lineHeight: 1.5, fontFamily: 'inherit',
                  background: 'var(--bg)', color: 'var(--ink)', outline: 'none',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                  boxShadow: 'none',
                  maxHeight: 96, overflowY: 'auto',
                }}
                onFocus={e => {
                  e.currentTarget.style.borderColor = 'var(--ink)'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,0,0,0.08)'
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
              <button
                className="studio-send-btn"
                onClick={() => send(input)}
                disabled={loading || !input.trim() || !authToken}
                style={{
                  flexShrink: 0, width: 38, height: 38, borderRadius: 10,
                  background: 'var(--ink)', color: 'var(--on-ink)', border: 'none',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'opacity 0.15s',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13M22 2L15 22 11 13 2 9z"/>
                </svg>
              </button>
            </div>
          </div>

          {/* ── Right: Canvas panel ──────────────────────────────────────── */}
          <div className="studio-canvas" style={{ flex: 1, overflowY: 'auto', padding: 24, position: 'relative', background: 'var(--bg)' }}>
            {/* Dot grid */}
            <div
              className="dot-grid"
              style={{
                position: 'fixed',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 0,
                backgroundImage: 'radial-gradient(circle, var(--border, rgba(0,0,0,0.12)) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
                opacity: 0.6,
              }}
            />
            <div style={{ position: 'relative', zIndex: 1 }}>
              {canvasItems.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12 }}>
                  <span style={{ fontSize: 32, color: 'var(--ink-mute)', opacity: 0.4 }}>✦</span>
                  <p style={{ fontSize: 13, color: 'var(--ink-mute)', margin: 0, opacity: 0.6 }}>Generated content appears here</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600, margin: '0 auto' }}>
                  {canvasItems.map(item => (
                    <CanvasItemRenderer key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
