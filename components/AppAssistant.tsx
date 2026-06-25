'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { MessageCircle, X, Send, ArrowUpRight, Loader2 } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  action?: { href: string; label: string }
}

const SUGGESTIONS = [
  'How do I make a UGC video?',
  'What\'s the difference between Standard and Hero?',
  'How do I upgrade my plan?',
  'How do credits work?',
]

const STORAGE_KEY = 'contentflow.assistant.thread'

export default function AppAssistant() {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Persist the last few messages across page navigations within the session.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) setMessages(JSON.parse(raw))
    } catch {}
  }, [])

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-12))) } catch {}
  }, [messages])

  // Auto-scroll to the bottom whenever a new message lands.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, sending])

  // Focus the input when the panel opens for instant keyboard use.
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  // Hide on auth + landing + onboarding + /ask (full-page chat already there).
  const hidden =
    pathname?.startsWith('/auth') ||
    pathname === '/landing' ||
    pathname === '/' && false ||  // adjust if home should hide too
    pathname?.startsWith('/onboarding') ||
    pathname === '/presentation' ||
    pathname?.startsWith('/ask')
  if (hidden) return null

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    setError(null)
    const userMsg: Message = { role: 'user', content: trimmed }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
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
      setMessages([...nextMessages, { role: 'assistant', content: data.reply, action: data.action }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSending(false)
    }
  }

  function handleAction(href: string) {
    setOpen(false)
    router.push(href)
  }

  function resetThread() {
    setMessages([])
    try { sessionStorage.removeItem(STORAGE_KEY) } catch {}
  }

  return (
    <>
      {/* Floating launcher button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Ask the assistant"
          style={{
            position: 'fixed', bottom: 20, right: 20, zIndex: 90,
            width: 52, height: 52, borderRadius: '50%',
            background: 'var(--ink)', color: 'var(--on-ink)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-md)',
            cursor: 'pointer', transition: 'transform 0.15s, opacity 0.15s',
          }}
          onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.95)')}
          onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          <MessageCircle size={22} />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Assistant"
          style={{
            position: 'fixed', bottom: 20, right: 20, zIndex: 90,
            width: 'min(380px, calc(100vw - 40px))',
            maxHeight: 'min(640px, calc(100vh - 40px))',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 18,
            boxShadow: 'var(--shadow-lg)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px', borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'var(--ink)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', color: 'var(--on-ink)',
              }}>
                <MessageCircle size={15} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>Ask ContentFlow</p>
                <p style={{ margin: 0, fontSize: 10.5, color: 'var(--ink-mute)' }}>Powered by AI</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {messages.length > 0 && (
                <button
                  onClick={resetThread}
                  title="Clear thread"
                  style={{
                    background: 'transparent', border: 'none', color: 'var(--ink-dim)',
                    fontSize: '11px', cursor: 'pointer', padding: '4px 8px',
                    borderRadius: '4px',
                  }}
                >Clear</button>
              )}
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{
                  background: 'transparent', border: 'none', color: 'var(--ink-dim)',
                  cursor: 'pointer', padding: '4px', display: 'flex',
                }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            style={{
              flex: 1, overflowY: 'auto', padding: '16px',
              display: 'flex', flexDirection: 'column', gap: '12px',
            }}
          >
            {messages.length === 0 && (
              <div style={{ marginBottom: '8px' }}>
                <p style={{ fontSize: '13px', color: 'var(--ink)', lineHeight: 1.5, margin: '0 0 12px' }}>
                  Hey! Ask me anything about ContentFlow — how to make a video, plans, tier differences, why a generation failed, anything.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      style={{
                        textAlign: 'left', padding: '10px 12px',
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: 11, cursor: 'pointer',
                        fontSize: 12.5, color: 'var(--ink-2)',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

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
                    maxWidth: '85%',
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: m.role === 'user' ? 'var(--ink)' : 'var(--surface)',
                    color: m.role === 'user' ? '#fff' : 'var(--ink)',
                    fontSize: 13,
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    border: m.role === 'assistant' ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <span>{m.content}</span>
                  {m.action && (
                    <button
                      onClick={() => handleAction(m.action!.href)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        marginTop: 10,
                        padding: '7px 12px',
                        background: 'var(--ink)', color: 'var(--on-ink)',
                        border: 'none', borderRadius: 9,
                        fontSize: 12, fontWeight: 600,
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
                  padding: '10px 14px', borderRadius: 'var(--r-md)',
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  color: 'var(--ink-dim)', fontSize: '13px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <Loader2 size={14} className="animate-spin" />
                  Thinking...
                </div>
              </div>
            )}

            {error && (
              <div style={{
                padding: '8px 12px', background: 'rgba(255,80,80,0.1)',
                border: '1px solid var(--bad)', borderRadius: 'var(--r-sm)',
                color: 'var(--bad)', fontSize: '12px',
              }}>
                {error}
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={e => { e.preventDefault(); send(input) }}
            style={{
              padding: '12px',
              borderTop: '1px solid var(--border)',
              display: 'flex', gap: '8px',
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value.slice(0, 1500))}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send(input)
                }
              }}
              placeholder="Ask anything..."
              disabled={sending}
              rows={1}
              style={{
                flex: 1, resize: 'none',
                padding: '9px 12px', borderRadius: 10,
                background: 'var(--bg-elev)', border: '1px solid var(--border)',
                color: 'var(--ink)', fontSize: 13, fontFamily: 'inherit',
                outline: 'none', minHeight: 36, maxHeight: 120,
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              aria-label="Send"
              style={{
                width: 36, height: 36, padding: 0,
                background: input.trim() && !sending ? 'var(--ink)' : 'var(--border)',
                color: 'var(--on-ink)', border: 'none', borderRadius: 10,
                cursor: input.trim() && !sending ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </>
  )
}
