'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Send, ArrowUpRight, Loader2, RefreshCcw } from 'lucide-react'
import { getSupabase } from '@/lib/auth'
import { canAccessMultiAgentChat } from '@/lib/pov-access'
import { CHAT_AGENTS, findAgent } from '@/lib/chat-agents'

type ChatResult =
  | { kind: 'image'; url: string; prompt: string; credits: number }
  | { kind: 'social'; posts: Record<string, string>; topic: string; credits: number }
  | { kind: 'error'; message: string }

interface Message {
  role: 'user' | 'assistant'
  content: string
  action?: { href: string; label: string }
  results?: ChatResult[]
}

// Suggestions surface on empty state. Grouped by topic so users see we cover
// different intents — not just "how do I use the app".
const SUGGESTION_GROUPS: { title: string; prompts: string[] }[] = [
  {
    title: 'Get started',
    prompts: [
      'How do I make a UGC video?',
      'What duration should I pick?',
      'How do I write a good custom instruction?',
    ],
  },
  {
    title: 'Plans & credits',
    prompts: [
      'How much does each tier cost?',
      'What\'s the difference between Standard and Hero?',
      'How do credit packs work?',
    ],
  },
  {
    title: 'Troubleshooting',
    prompts: [
      'Why does my product look wrong in the B-roll?',
      'Why is the video shorter than the script?',
      'My video generation failed — what now?',
    ],
  },
  {
    title: 'Behind the scenes',
    prompts: [
      'What AI models power ContentFlow?',
      'Why does the free tier have a watermark?',
      'How are captions synced?',
    ],
  },
]

const STORAGE_KEY = 'contentflow.ask.thread'

export default function AskPage() {
  const router = useRouter()
  const pathname = usePathname()
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [multiAgent, setMultiAgent] = useState(false)
  const [agentId, setAgentId] = useState<string>('general')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) setMessages(JSON.parse(raw))
    } catch {}
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  // Enable the multi-agent selector for admin allowlist only (still testing).
  useEffect(() => {
    (async () => {
      const supabase = getSupabase()
      if (!supabase) return
      const { data: sess } = await supabase.auth.getSession()
      setMultiAgent(canAccessMultiAgentChat(sess?.session?.user?.email))
    })()
  }, [])

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30))) } catch {}
  }, [messages])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, sending])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    setError(null)
    const userMsg: Message = { role: 'user', content: trimmed }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setSending(true)

    try {
      const supabase = getSupabase()
      const { data: sess } = supabase ? await supabase.auth.getSession() : { data: { session: null } }
      const token = sess?.session?.access_token

      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: trimmed,
          history: messages.slice(-8).map(m => ({ role: m.role, content: m.content })),
          currentPath: pathname,
          agentId: multiAgent ? agentId : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Assistant unavailable')
      setMessages([...next, {
        role: 'assistant',
        content: data.reply,
        action: data.action,
        results: data.results,
      }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSending(false)
    }
  }

  function handleAction(href: string) {
    router.push(href)
  }

  function resetThread() {
    setMessages([])
    try { sessionStorage.removeItem(STORAGE_KEY) } catch {}
    inputRef.current?.focus()
  }

  const empty = messages.length === 0

  return (
    <main style={{
      display: 'flex', flexDirection: 'column',
      height: 'calc(100vh - 60px)',  // minus TopBar
      padding: '0 24px',
      maxWidth: '760px', margin: '0 auto', width: '100%',
    }}>
      {messages.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 0' }}>
          <button
            onClick={resetThread}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', borderRadius: 9,
              background: 'var(--surface)', border: '1px solid var(--border)',
              color: 'var(--ink-2)', fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
            }}
          >
            <RefreshCcw size={13} />
            New chat
          </button>
        </div>
      )}

      {/* Thread area */}
      <div
        ref={scrollRef}
        style={{
          flex: 1, overflowY: 'auto',
          paddingBottom: '20px',
        }}
      >
        {empty && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 10, padding: '40px 0' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: 'var(--ink)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              marginBottom: 6,
              padding: 10,
            }}>
              <img src="/logo-icon.png" alt="ContentFlow" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 40, margin: 0, letterSpacing: '-0.01em' }}>
              How can I help you <span style={{ fontStyle: 'italic' }}>create?</span>
            </h1>
            <p style={{ fontSize: 14.5, color: 'var(--ink-dim)', margin: '2px 0 18px', maxWidth: 420, lineHeight: 1.55 }}>
              Ask about scripts, hooks, tiers, credits, the UGC pipeline — anything ContentFlow.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', maxWidth: 540 }}>
              {SUGGESTION_GROUPS.flatMap(g => g.prompts).slice(0, 4).map(p => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  style={{
                    textAlign: 'left',
                    padding: '14px 16px',
                    border: '1px solid var(--border)',
                    borderRadius: 13,
                    background: 'var(--surface)',
                    fontSize: 13.5,
                    color: 'var(--ink-2)',
                    cursor: 'pointer',
                    lineHeight: 1.45,
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)' }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {!empty && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '78%',
                    padding: '12px 16px',
                    borderRadius: 14,
                    background: m.role === 'user' ? 'var(--ink)' : 'var(--surface)',
                    color: m.role === 'user' ? 'var(--on-ink)' : 'var(--ink)',
                    fontSize: 14,
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                    border: m.role === 'assistant' ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <span>{m.content}</span>
                  {m.results && m.results.length > 0 && (
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {m.results.map((r, ri) => <ResultBlock key={ri} result={r} />)}
                    </div>
                  )}
                  {m.action && (
                    <button
                      onClick={() => handleAction(m.action!.href)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        marginTop: 12,
                        padding: '8px 14px',
                        background: 'var(--ink)', color: 'var(--on-ink)',
                        border: 'none', borderRadius: 9,
                        fontSize: 13, fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {m.action.label}
                      <ArrowUpRight size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  padding: '12px 16px', borderRadius: 'var(--r-md)',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  color: 'var(--ink-dim)', fontSize: '14px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <Loader2 size={16} className="animate-spin" />
                  Working on it…
                </div>
              </div>
            )}

            {error && (
              <div style={{
                padding: '10px 14px', background: 'rgba(255,80,80,0.1)',
                border: '1px solid var(--bad)', borderRadius: 'var(--r-sm)',
                color: 'var(--bad)', fontSize: '13px',
              }}>
                {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={e => { e.preventDefault(); send(input) }}
        style={{
          position: 'sticky', bottom: 0,
          background: 'var(--bg)',
          padding: '12px 0 24px',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 10,
          border: '1px solid var(--border)',
          borderRadius: 16,
          background: 'var(--surface)',
          padding: '9px 9px 9px 16px',
          boxShadow: '0 2px 12px rgba(20,18,12,0.04)',
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value.slice(0, 2000))}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send(input)
              }
            }}
            placeholder="Ask anything…"
            disabled={sending}
            rows={1}
            style={{
              flex: 1, resize: 'none',
              padding: '6px 0', background: 'transparent',
              border: 'none', outline: 'none',
              color: 'var(--ink)', fontSize: 15, fontFamily: 'inherit',
              lineHeight: 1.55, maxHeight: 150,
            }}
          />
          {multiAgent && (
            <AgentPicker
              agentId={agentId}
              onChange={(id) => { setAgentId(id); resetThread() }}
            />
          )}
          <button
            type="submit"
            disabled={!input.trim() || sending}
            aria-label="Send"
            style={{
              width: 38, height: 38, flexShrink: 0,
              borderRadius: 11,
              background: input.trim() && !sending ? 'var(--ink)' : 'var(--border)',
              border: 'none', cursor: input.trim() && !sending ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Send size={17} color="var(--on-ink)" />
          </button>
        </div>
        <p style={{ margin: '10px 0 0', textAlign: 'center', fontSize: 11.5, color: 'var(--ink-faint)' }}>
          ContentFlow AI can make mistakes. Double-check important details.
        </p>
      </form>
    </main>
  )
}

// Inline result renderer — one per generation the assistant produced.
function ResultBlock({ result }: { result: ChatResult }) {
  if (result.kind === 'image') {
    return (
      <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--bg)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={result.url} alt={result.prompt} style={{ display: 'block', width: '100%', maxWidth: 480 }} />
        <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--ink-mute)' }}>
          <span style={{ fontFamily: 'var(--font-mono)' }}>{result.credits} cr · Image</span>
          <a href={result.url} download style={{ color: 'var(--ink)', textDecoration: 'underline', textUnderlineOffset: 3 }}>Download</a>
        </div>
      </div>
    )
  }
  if (result.kind === 'social') {
    return (
      <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg)', padding: 14 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', color: 'var(--ink-mute)', marginBottom: 8 }}>
          SOCIAL · {result.credits} CR
        </div>
        {Object.entries(result.posts).map(([platform, text]) => (
          <div key={platform} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 4, textTransform: 'capitalize' }}>{platform}</div>
            <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{text}</div>
          </div>
        ))}
      </div>
    )
  }
  if (result.kind === 'error') {
    return (
      <div style={{ border: '1px solid var(--danger)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--danger)', background: 'rgba(184,58,53,0.08)' }}>
        {result.message}
      </div>
    )
  }
  return null
}

// Compact model-picker attached to the composer input.
// Click the name → dropdown of all agents. Matches how ChatGPT / Claude pick
// models on the right side of the input bar.
function AgentPicker({ agentId, onChange }: { agentId: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const active = findAgent(agentId)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-agent-picker]')) setOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div data-agent-picker style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          height: 38,
          padding: '0 12px',
          borderRadius: 11,
          background: 'transparent',
          border: '1px solid var(--border)',
          color: 'var(--ink)',
          fontSize: 12.5,
          fontWeight: 500,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          letterSpacing: '-0.01em',
        }}
        title={active.tagline}
      >
        {active.name}
        <span style={{ fontSize: 9, color: 'var(--ink-mute)', marginTop: 1 }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            right: 0,
            minWidth: 240,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            boxShadow: '0 12px 32px rgba(20,18,12,0.15)',
            padding: 6,
            zIndex: 20,
          }}
        >
          {CHAT_AGENTS.map(a => {
            const isActive = a.id === agentId
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => { onChange(a.id); setOpen(false) }}
                style={{
                  width: '100%',
                  display: 'block',
                  textAlign: 'left',
                  padding: '9px 12px',
                  borderRadius: 8,
                  background: isActive ? 'var(--surface-2)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--ink)',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--surface-2)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>{a.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', marginTop: 1 }}>{a.tagline}</div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
