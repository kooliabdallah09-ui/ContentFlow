'use client'

import { useEffect, useRef, useState } from 'react'
import { getSupabase } from '@/lib/auth'
import { showError } from '@/lib/notifications'

type PrivacyStatus = 'public' | 'unlisted' | 'private'
type State = 'idle' | 'checking' | 'not-connected' | 'form' | 'publishing' | 'done'

const PRIVACY_OPTIONS: { value: PrivacyStatus; label: string; desc: string }[] = [
  { value: 'public',   label: 'Public',    desc: 'Anyone can search and watch' },
  { value: 'unlisted', label: 'Unlisted',  desc: 'Only people with the link' },
  { value: 'private',  label: 'Private',   desc: 'Only you' },
]

// YouTube wordmark SVG (red + white)
function YTIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 0 0 .5 6.19C0 8.04 0 12 0 12s0 3.96.5 5.81a3.02 3.02 0 0 0 2.12 2.14C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14C24 15.96 24 12 24 12s0-3.96-.5-5.81z" fill="#FF0000"/>
      <path d="M9.75 15.02V8.98L15.5 12l-5.75 3.02z" fill="#fff"/>
    </svg>
  )
}

export default function PublishToYouTube({
  videoUrl,
  defaultTitle = '',
}: {
  videoUrl: string
  defaultTitle?: string
}) {
  const [state, setState] = useState<State>('idle')
  const [title, setTitle] = useState(defaultTitle)
  const [description, setDescription] = useState('')
  const [privacy, setPrivacy] = useState<PrivacyStatus>('public')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [accountName, setAccountName] = useState('')
  const modalRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (state !== 'form') return
    function onClick(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setState('idle')
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [state])

  async function handleOpen() {
    setState('checking')
    const supabase = getSupabase()
    if (!supabase) { setState('idle'); return }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) { setState('idle'); return }

    const res = await fetch('/api/youtube/status', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const data = await res.json()

    if (!data.connected) {
      setState('not-connected')
      return
    }
    setAccountName(data.accountName ?? '')
    setState('form')
  }

  async function handlePublish() {
    if (!title.trim()) { showError('Title is required'); return }
    setState('publishing')

    const supabase = getSupabase()
    if (!supabase) { setState('form'); return }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) { setState('form'); return }

    try {
      const res = await fetch('/api/youtube/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ videoUrl, title, description, privacyStatus: privacy }),
      })
      const data = await res.json()
      if (!res.ok) {
        showError(data.error || 'Publish failed')
        setState('form')
        return
      }
      setYoutubeUrl(data.youtubeUrl)
      setState('done')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Publish failed')
      setState('form')
    }
  }

  // Trigger button
  const triggerBtn = (
    <button
      onClick={handleOpen}
      disabled={state === 'checking'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        padding: '9px 18px', borderRadius: 9,
        border: '1.5px solid #FF0000',
        background: 'transparent', color: '#FF0000',
        fontSize: 13, fontWeight: 600,
        cursor: state === 'checking' ? 'wait' : 'pointer',
        opacity: state === 'checking' ? 0.6 : 1,
        transition: 'background 0.12s, color 0.12s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget
        el.style.background = '#FF0000'
        el.style.color = '#fff'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget
        el.style.background = 'transparent'
        el.style.color = '#FF0000'
      }}
    >
      <YTIcon />
      {state === 'checking' ? 'Checking…' : 'Publish to YouTube'}
    </button>
  )

  if (state === 'idle' || state === 'checking') return triggerBtn

  // Overlay backdrop
  const backdrop: React.CSSProperties = {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.55)',
    zIndex: 100,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 16,
  }

  // Not connected state
  if (state === 'not-connected') {
    return (
      <>
        {triggerBtn}
        <div style={backdrop} onClick={() => setState('idle')}>
          <div ref={modalRef} onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: 16, padding: 28, maxWidth: 380, width: '100%',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <YTIcon />
              <span style={{ fontWeight: 700, fontSize: 15 }}>YouTube not connected</span>
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--ink-dim)', margin: '0 0 20px', lineHeight: 1.55 }}>
              Connect your YouTube channel first to publish directly from ContentFlow.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <a
                href="/settings/integrations"
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 9, textAlign: 'center',
                  background: '#FF0000', color: '#fff',
                  fontSize: 13.5, fontWeight: 600, textDecoration: 'none',
                }}
              >
                Connect YouTube
              </a>
              <button onClick={() => setState('idle')} style={{
                padding: '10px 16px', borderRadius: 9,
                border: '1.5px solid var(--border)', background: 'transparent',
                color: 'var(--ink-dim)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  // Success state
  if (state === 'done') {
    return (
      <>
        {triggerBtn}
        <div style={backdrop} onClick={() => setState('idle')}>
          <div ref={modalRef} onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: 16, padding: 28, maxWidth: 400, width: '100%',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🎉</div>
            <p style={{ fontWeight: 700, fontSize: 16, margin: '0 0 6px' }}>Published to YouTube!</p>
            <p style={{ fontSize: 13.5, color: 'var(--ink-dim)', margin: '0 0 20px' }}>
              Your video is now {privacy === 'public' ? 'live' : privacy === 'unlisted' ? 'accessible via link' : 'saved privately'}.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <a
                href={youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '10px 20px', borderRadius: 9,
                  background: '#FF0000', color: '#fff',
                  fontSize: 13.5, fontWeight: 600, textDecoration: 'none',
                }}
              >
                View on YouTube
              </a>
              <button onClick={() => setState('idle')} style={{
                padding: '10px 16px', borderRadius: 9,
                border: '1.5px solid var(--border)', background: 'transparent',
                color: 'var(--ink-dim)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                Close
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  // Publish form modal
  return (
    <>
      {triggerBtn}
      <div style={backdrop}>
        <div ref={modalRef} style={{
          background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 16, padding: 28, maxWidth: 440, width: '100%',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <YTIcon />
              <span style={{ fontWeight: 700, fontSize: 15 }}>Publish to YouTube</span>
            </div>
            {accountName && (
              <span style={{ fontSize: 11.5, color: 'var(--ink-dim)', fontFamily: 'var(--font-mono)' }}>
                {accountName}
              </span>
            )}
          </div>

          {/* Title */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-dim)', display: 'block', marginBottom: 6 }}>
              Title
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={100}
              placeholder="Enter a title for your video…"
              disabled={state === 'publishing'}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 12px', borderRadius: 9,
                border: '1px solid var(--border)', background: 'transparent',
                color: 'var(--ink)', fontSize: 13.5, outline: 'none',
                fontFamily: 'inherit',
              }}
            />
            <p style={{ fontSize: 11, color: 'var(--ink-dim)', textAlign: 'right', margin: '3px 0 0', fontFamily: 'var(--font-mono)' }}>
              {title.length}/100
            </p>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-dim)', display: 'block', marginBottom: 6 }}>
              Description <span style={{ opacity: 0.5 }}>(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              maxLength={5000}
              placeholder="Add a description…"
              disabled={state === 'publishing'}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 12px', borderRadius: 9,
                border: '1px solid var(--border)', background: 'transparent',
                color: 'var(--ink)', fontSize: 13, lineHeight: 1.55,
                fontFamily: 'inherit', resize: 'vertical', outline: 'none',
              }}
            />
          </div>

          {/* Privacy */}
          <div style={{ marginBottom: 22 }}>
            <label style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-dim)', display: 'block', marginBottom: 8 }}>
              Visibility
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {PRIVACY_OPTIONS.map(opt => {
                const active = privacy === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPrivacy(opt.value)}
                    disabled={state === 'publishing'}
                    style={{
                      flex: 1, padding: '9px 6px', borderRadius: 9, textAlign: 'center',
                      border: `1.5px solid ${active ? '#FF0000' : 'var(--border)'}`,
                      background: active ? 'rgba(255,0,0,0.06)' : 'transparent',
                      color: active ? '#FF0000' : 'var(--ink-dim)',
                      cursor: 'pointer', transition: 'all 0.12s',
                    }}
                  >
                    <div style={{ fontSize: 12.5, fontWeight: 700 }}>{opt.label}</div>
                    <div style={{ fontSize: 10.5, opacity: 0.7, marginTop: 2 }}>{opt.desc}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handlePublish}
              disabled={state === 'publishing' || !title.trim()}
              style={{
                flex: 1, padding: '11px 0', borderRadius: 9, border: 'none',
                background: state === 'publishing' || !title.trim() ? 'var(--border)' : '#FF0000',
                color: state === 'publishing' || !title.trim() ? 'var(--ink-dim)' : '#fff',
                fontSize: 14, fontWeight: 700,
                cursor: state === 'publishing' || !title.trim() ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'background 0.15s',
              }}
            >
              {state === 'publishing' ? (
                <>
                  <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', display: 'inline-block', animation: 'yt-spin 0.8s linear infinite' }} />
                  Uploading…
                </>
              ) : 'Publish'}
            </button>
            <button
              onClick={() => setState('idle')}
              disabled={state === 'publishing'}
              style={{
                padding: '11px 18px', borderRadius: 9,
                border: '1.5px solid var(--border)', background: 'transparent',
                color: 'var(--ink-dim)', fontSize: 13, fontWeight: 600,
                cursor: state === 'publishing' ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
          </div>

          <p style={{ fontSize: 11.5, color: 'var(--ink-dim)', margin: '12px 0 0', textAlign: 'center', lineHeight: 1.4 }}>
            Video uploads can take 1–3 minutes depending on file size.
          </p>
        </div>
      </div>
      <style>{`@keyframes yt-spin { to { transform: rotate(360deg); } }`}</style>
    </>
  )
}
