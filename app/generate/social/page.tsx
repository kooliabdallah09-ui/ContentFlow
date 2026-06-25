'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/auth'
import { useCredits } from '@/lib/useCredits'
import { Loader2, Copy, Check, Layers } from 'lucide-react'
import { showError, showSuccess } from '@/lib/notifications'
import { Icon } from '@/components/Icons'

// ─── Constants ──────────────────────────────────────────────────────────────

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', color: '#E1306C' },
  { id: 'linkedin',  label: 'LinkedIn',  color: '#0A66C2' },
  { id: 'twitter',   label: 'X / Twitter', color: '#000000' },
  { id: 'tiktok',    label: 'TikTok',    color: '#010101' },
]

const TONES = [
  { id: 'bold',          label: 'Bold' },
  { id: 'conversational',label: 'Conversational' },
  { id: 'professional',  label: 'Professional' },
  { id: 'storytelling',  label: 'Storytelling' },
]

const CONTENT_TYPES = [
  { id: 'caption',  label: 'Caption / Post', desc: 'Platform-native captions + hashtags', cost: '5 cr', icon: 'Social' },
  { id: 'carousel', label: 'Image Carousel',  desc: 'AI-generated visuals per slide',      cost: '5 cr / slide', icon: 'Carousel' },
] as const

type ContentType = typeof CONTENT_TYPES[number]['id']

const CAPTION_COST = 5

// ─── Component ───────────────────────────────────────────────────────────────

export default function SocialPage() {
  const router = useRouter()
  const { balance: rawBalance, refresh: refreshCredits } = useCredits()
  const balance = rawBalance ?? 0

  const [contentType, setContentType] = useState<ContentType>('caption')

  // Caption form state
  const [topic, setTopic] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['instagram', 'linkedin'])
  const [tone, setTone] = useState('bold')
  const [loading, setLoading] = useState(false)
  const [posts, setPosts] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const canGenerate = topic.trim().length >= 3 && selectedPlatforms.length > 0 && balance >= CAPTION_COST && !loading

  function togglePlatform(id: string) {
    setSelectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  async function generate() {
    if (!canGenerate) return
    setLoading(true)
    setPosts({})
    setActiveTab('')
    try {
      const supabase = getSupabase()
      if (!supabase) throw new Error('Auth not ready')
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) throw new Error('Not signed in')

      const res = await fetch('/api/content/generate/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ topic: topic.trim(), platforms: selectedPlatforms, tone }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setPosts(data.posts)
      setActiveTab(selectedPlatforms[0])
      refreshCredits()
      showSuccess('Posts ready', `${Object.keys(data.posts).length} platform${Object.keys(data.posts).length > 1 ? 's' : ''} generated`)
    } catch (e) {
      showError('Generation failed', e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  async function copyPost(platformId: string) {
    const text = posts[platformId]
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopied(platformId)
    setTimeout(() => setCopied(null), 2000)
  }

  const hasPosts = Object.keys(posts).length > 0

  return (
    <main style={{ maxWidth: 1040, margin: '0 auto', padding: '42px 40px 90px' }}>
      <header style={{ marginBottom: 32 }}>
        <h1 style={{
          fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 54,
          lineHeight: 1.05, letterSpacing: '-0.01em', margin: 0,
        }}>
          Social
        </h1>
        <p style={{ fontSize: 15.5, color: 'var(--ink-dim)', margin: '14px 0 0', maxWidth: 520, lineHeight: 1.55 }}>
          Platform-native posts and image carousels. One topic, every format.
        </p>
      </header>

      {/* Content type selector */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }}>
        {CONTENT_TYPES.map(ct => {
          const active = contentType === ct.id
          return (
            <button
              key={ct.id}
              type="button"
              onClick={() => ct.id === 'carousel' ? router.push('/generate/carousel') : setContentType(ct.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '16px 20px', borderRadius: 14, border: 'none',
                background: active ? 'var(--ink)' : 'var(--surface)',
                border: `1.5px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.15s',
              }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: active ? 'rgba(255,255,255,0.12)' : 'var(--bg-elev)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: active ? '#fff' : 'var(--ink-2)',
              }}>
                {ct.icon === 'Social' ? <Icon.Social style={{ width: 20, height: 20 }} /> : <Icon.Carousel style={{ width: 20, height: 20 }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 700, color: active ? '#fff' : 'var(--ink)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  {ct.label}
                  {ct.id === 'carousel' && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
                      color: active ? 'rgba(255,255,255,0.7)' : 'var(--ink-mute)',
                      textTransform: 'uppercase',
                    }}>↗</span>
                  )}
                </div>
                <div style={{ fontSize: 12.5, color: active ? 'rgba(255,255,255,0.65)' : 'var(--ink-mute)', marginTop: 2 }}>
                  {ct.desc} · <strong style={{ color: active ? 'rgba(255,255,255,0.8)' : 'var(--ink-2)' }}>{ct.cost}</strong>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Caption generator */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: hasPosts ? '400px 1fr' : '1fr',
        gap: 20,
        alignItems: 'start',
      }}>
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
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) generate() }}
              placeholder="e.g. Our skincare serum just hit 10,000 five-star reviews…"
              disabled={loading}
              rows={3}
              style={{
                width: '100%', resize: 'vertical', minHeight: 84,
                border: '1px solid var(--border)', borderRadius: 10, outline: 'none',
                background: 'var(--bg-elev)', fontFamily: 'inherit',
                fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink)',
                padding: '10px 12px', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Platforms */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-mute)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
              Platforms
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {PLATFORMS.map(p => {
                const selected = selectedPlatforms.includes(p.id)
                return (
                  <label key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
                    background: selected ? 'var(--bg-elev)' : 'transparent',
                    border: `1px solid ${selected ? 'var(--border)' : 'transparent'}`,
                    transition: 'all 0.12s',
                  }}>
                    <input type="checkbox" checked={selected} onChange={() => togglePlatform(p.id)}
                      disabled={loading}
                      style={{ width: 15, height: 15, accentColor: p.color, cursor: 'pointer' }} />
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{p.label}</span>
                    {selected && (
                      <span style={{
                        marginLeft: 'auto', fontSize: 11, color: 'var(--ink-mute)',
                        background: 'var(--border-soft)', borderRadius: 4, padding: '2px 6px',
                      }}>
                        {p.id === 'instagram' ? '2200 chars' : p.id === 'linkedin' ? '3000 chars' : p.id === 'twitter' ? '280 chars' : '300 chars'}
                      </span>
                    )}
                  </label>
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
                      padding: '8px 16px', borderRadius: 999,
                      background: active ? 'var(--ink)' : 'var(--surface)',
                      border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                      color: active ? '#fff' : 'var(--ink-2)',
                      fontSize: 12.5, fontWeight: 600,
                      cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                    }}>
                    {t.label}
                  </button>
                )
              })}
            </div>
          </div>

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
              ? <><Loader2 size={15} className="animate-spin" /> Writing posts…</>
              : `Generate${selectedPlatforms.length > 1 ? ` (${selectedPlatforms.length} platforms)` : ''}`}
          </button>

          {/* Cost line */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: 12, color: 'var(--ink-mute)',
            paddingTop: 6, borderTop: '1px solid var(--border-soft)',
          }}>
            <span>{CAPTION_COST} credits · all platforms in one generation</span>
            <span>Balance: <strong style={{ color: balance >= CAPTION_COST ? 'var(--good)' : 'var(--danger)' }}>{balance}</strong></span>
          </div>
        </div>

        {/* Results */}
        {hasPosts && (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 18, overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Platform tabs */}
            <div style={{
              display: 'flex', borderBottom: '1px solid var(--border)',
              overflowX: 'auto',
            }}>
              {selectedPlatforms.filter(p => posts[p]).map(p => {
                const platform = PLATFORMS.find(pl => pl.id === p)!
                const active = activeTab === p
                return (
                  <button key={p} onClick={() => setActiveTab(p)}
                    style={{
                      padding: '12px 20px', border: 'none', cursor: 'pointer',
                      background: 'transparent', flexShrink: 0,
                      fontSize: 13, fontWeight: 700,
                      color: active ? 'var(--ink)' : 'var(--ink-mute)',
                      borderBottom: `2px solid ${active ? 'var(--ink)' : 'transparent'}`,
                      transition: 'all 0.15s',
                    }}>
                    {platform.label}
                  </button>
                )
              })}
            </div>

            {/* Post content */}
            {selectedPlatforms.filter(p => posts[p]).map(p => {
              const platform = PLATFORMS.find(pl => pl.id === p)!
              const content = posts[p] ?? ''
              const isCopied = copied === p
              return (
                <div key={p} style={{ display: activeTab === p ? 'flex' : 'none', flexDirection: 'column', flex: 1 }}>
                  {/* Header row */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 20px 0',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: platform.color,
                      }} />
                      <span style={{ fontSize: 12, color: 'var(--ink-mute)', fontWeight: 500 }}>
                        {content.length} chars
                      </span>
                    </div>
                    <button onClick={() => copyPost(p)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 14px', borderRadius: 8,
                        background: isCopied ? 'var(--good-bg, #f0fdf4)' : 'var(--bg-elev)',
                        border: `1px solid ${isCopied ? 'var(--good, #16a34a)' : 'var(--border)'}`,
                        color: isCopied ? 'var(--good, #16a34a)' : 'var(--ink)',
                        fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}>
                      {isCopied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
                    </button>
                  </div>

                  {/* Editable textarea */}
                  <textarea
                    value={content}
                    onChange={e => setPosts(prev => ({ ...prev, [p]: e.target.value }))}
                    style={{
                      flex: 1, minHeight: 320, resize: 'vertical',
                      border: 'none', outline: 'none', background: 'transparent',
                      fontFamily: 'inherit', fontSize: 14.5, lineHeight: 1.7,
                      color: 'var(--ink)', padding: '14px 20px 20px',
                    }}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
