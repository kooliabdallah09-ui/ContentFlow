'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Send, ArrowUpRight, Loader2, Sparkles, RefreshCcw } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  action?: { href: string; label: string }
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
      'My Sora generation failed — what now?',
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) setMessages(JSON.parse(raw))
    } catch {}
    setTimeout(() => inputRef.current?.focus(), 50)
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
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: messages.slice(-8).map(m => ({ role: m.role, content: m.content })),
          currentPath: pathname,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Assistant unavailable')
      setMessages([...next, { role: 'assistant', content: data.reply, action: data.action }])
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
      height: 'calc(100vh - 56px)',  // minus TopBar
      padding: '24px 32px 0',
      maxWidth: '900px', margin: '0 auto', width: '100%',
    }}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '10px',
            background: 'var(--accent-soft)', color: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={20} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--ink)' }}>Ask AI</h1>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--ink-dim)' }}>
              Anything about ContentFlow — features, pricing, troubleshooting, best practices.
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={resetThread}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 12px', borderRadius: 'var(--r-sm)',
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--ink-dim)', fontSize: '12px', cursor: 'pointer',
            }}
          >
            <RefreshCcw size={13} />
            New chat
          </button>
        )}
      </header>

      {/* Thread area */}
      <div
        ref={scrollRef}
        style={{
          flex: 1, overflowY: 'auto',
          paddingBottom: '20px',
        }}
      >
        {empty && (
          <div>
            <div style={{
              padding: '24px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg)', marginBottom: '24px',
            }}>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--ink)', lineHeight: 1.6 }}>
                Hey! I&apos;m the in-app assistant. I know every feature, pricing detail, and common gotcha. Ask me anything — I&apos;ll often include a button that takes you straight to the right page.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
              {SUGGESTION_GROUPS.map(group => (
                <div key={group.title}>
                  <p style={{
                    margin: '0 0 10px',
                    fontSize: '11px', textTransform: 'uppercase',
                    letterSpacing: '0.08em', fontWeight: 700,
                    color: 'var(--ink-dim)',
                  }}>{group.title}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {group.prompts.map(p => (
                      <button
                        key={p}
                        onClick={() => send(p)}
                        style={{
                          textAlign: 'left',
                          padding: '10px 14px',
                          background: 'var(--surface)', border: '1px solid var(--border)',
                          borderRadius: 'var(--r-sm)',
                          color: 'var(--ink)', fontSize: '13px',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'var(--accent-soft)'
                          e.currentTarget.style.borderColor = 'var(--accent)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'var(--surface)'
                          e.currentTarget.style.borderColor = 'var(--border)'
                        }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
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
                    borderRadius: 'var(--r-md)',
                    background: m.role === 'user' ? 'var(--accent)' : 'var(--surface)',
                    color: m.role === 'user' ? '#fff' : 'var(--ink)',
                    fontSize: '14px',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    border: m.role === 'assistant' ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <span>{m.content}</span>
                  {m.action && (
                    <button
                      onClick={() => handleAction(m.action!.href)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        marginTop: '12px',
                        padding: '8px 14px',
                        background: 'var(--accent)', color: '#fff',
                        border: 'none', borderRadius: 'var(--r-sm)',
                        fontSize: '13px', fontWeight: 600,
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
                  Thinking…
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
          display: 'flex', gap: '10px', alignItems: 'flex-end',
          padding: '10px 12px',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
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
            placeholder="Ask anything about ContentFlow…"
            disabled={sending}
            rows={1}
            style={{
              flex: 1, resize: 'none',
              padding: '8px 4px', background: 'transparent',
              border: 'none', outline: 'none',
              color: 'var(--ink)', fontSize: '14px', fontFamily: 'inherit',
              lineHeight: 1.5, minHeight: '24px', maxHeight: '180px',
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            aria-label="Send"
            style={{
              padding: '10px 14px',
              background: input.trim() && !sending ? 'var(--accent)' : 'var(--border)',
              color: '#fff', border: 'none', borderRadius: 'var(--r-sm)',
              cursor: input.trim() && !sending ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Send size={16} />
          </button>
        </div>
        <p style={{
          margin: '8px 0 0', textAlign: 'center',
          fontSize: '11px', color: 'var(--ink-dim)',
        }}>
          Press Enter to send · Shift+Enter for newline · {input.length}/2000
        </p>
      </form>
    </main>
  )
}
