'use client'

import { useState, useEffect } from 'react'
import type { HeyGenAvatar } from '@/app/api/ugc/avatars/route'

interface AvatarPickerProps {
  selectedId: string
  onChange: (avatarId: string, gender?: string) => void
  disabled?: boolean
}

export default function AvatarPicker({ selectedId, onChange, disabled }: AvatarPickerProps) {
  const [avatars, setAvatars] = useState<HeyGenAvatar[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'Male' | 'Female'>('all')
  const [imgStatus, setImgStatus] = useState<Record<string, 'loading' | 'loaded' | 'failed'>>({})
  const [search, setSearch] = useState('')

  const markLoaded = (id: string) => setImgStatus(prev => ({ ...prev, [id]: 'loaded' }))
  const markFailed = (id: string) => setImgStatus(prev => ({ ...prev, [id]: 'failed' }))

  useEffect(() => {
    fetch('/api/ugc/avatars')
      .then(r => r.json())
      .then(data => {
        setAvatars(data.avatars ?? [])
        // Auto-select first avatar if none selected
        if (!selectedId && data.avatars?.length) {
          onChange(data.avatars[0].avatar_id, data.avatars[0].gender)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const q = search.trim().toLowerCase()
  const visible = avatars.filter(a => {
    if (filter !== 'all' && a.gender !== filter) return false
    if (q && !a.avatar_name.toLowerCase().includes(q)) return false
    return true
  })

  // Inline keyframes so we don't depend on global CSS for the shimmer
  const shimmerCss = `@keyframes avatar-shimmer { 0% { background-position: -100% 0 } 100% { background-position: 200% 0 } }`

  if (loading) {
    // Subtle gradient palette so each skeleton tile reads as a real placeholder, not a void
    const skeletonGradients = [
      ['#3a2f3a', '#2a1f2a'], ['#2f3a3a', '#1f2a2a'], ['#3a3a2f', '#2a2a1f'], ['#3a2f2a', '#2a1f1a'],
      ['#2f2f3a', '#1f1f2a'], ['#3a2a2f', '#2a1a1f'], ['#2a3a3a', '#1a2a2a'], ['#3a3a3a', '#252525'],
    ]
    return (
      <div>
        <style>{shimmerCss}</style>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          {Array.from({ length: 12 }).map((_, i) => {
            const [c1, c2] = skeletonGradients[i % skeletonGradients.length]
            return (
              <div
                key={i}
                style={{
                  position: 'relative',
                  aspectRatio: '3/4',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  background: `linear-gradient(135deg, ${c1}, ${c2})`,
                }}
              >
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.04) 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'avatar-shimmer 1.4s ease-in-out infinite',
                }} />
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div>
      <style>{shimmerCss}</style>

      {/* Search bar */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        disabled={disabled}
        placeholder={`Search ${avatars.length} avatars by name…`}
        style={{
          width: '100%',
          padding: '8px 12px',
          marginBottom: '10px',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          color: 'var(--ink)',
          fontSize: '13px',
          outline: 'none',
        }}
      />

      {/* Gender filter tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        {(['all', 'Female', 'Male'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            disabled={disabled}
            style={{
              padding: '4px 12px',
              borderRadius: '999px',
              border: '1px solid',
              fontSize: '12px',
              fontWeight: 600,
              cursor: disabled ? 'default' : 'pointer',
              transition: 'all 0.15s',
              background: filter === f ? 'var(--accent)' : 'transparent',
              borderColor: filter === f ? 'var(--accent)' : 'var(--border)',
              color: filter === f ? '#fff' : 'var(--ink-dim)',
            }}
          >
            {f === 'all' ? 'All' : f}
          </button>
        ))}
      </div>

      {/* Avatar grid — scrollable so a large library doesn't push the form */}
      <div style={{
        maxHeight: '380px',
        overflowY: 'auto',
        paddingRight: '4px',
        borderRadius: '8px',
      }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
        {visible.map(avatar => {
          const selected = avatar.avatar_id === selectedId
          const status = imgStatus[avatar.avatar_id] ?? (avatar.preview_image_url ? 'loading' : 'failed')
          const showImage = !!avatar.preview_image_url && status !== 'failed'
          const isLoading = status === 'loading'
          const [c1, c2] = avatar.accent ?? ['#444', '#222']
          return (
            <button
              key={avatar.avatar_id}
              onClick={() => !disabled && onChange(avatar.avatar_id, avatar.gender)}
              title={avatar.avatar_name}
              style={{
                position: 'relative',
                aspectRatio: '3/4',
                borderRadius: '10px',
                overflow: 'hidden',
                border: selected ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: disabled ? 'default' : 'pointer',
                padding: 0,
                background: `linear-gradient(135deg, ${c1}, ${c2})`,
                transition: 'border-color 0.15s, transform 0.1s',
                transform: selected ? 'scale(1.02)' : 'scale(1)',
                outline: 'none',
              }}
            >
              {showImage && (
                <img
                  src={avatar.preview_image_url}
                  alt={avatar.avatar_name}
                  loading="lazy"
                  style={{
                    width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                    opacity: status === 'loaded' ? 1 : 0,
                    transition: 'opacity 0.25s ease-out',
                  }}
                  onLoad={e => {
                    const img = e.currentTarget
                    // HeyGen sometimes returns a 200 with a 0×0 image — treat as failed
                    if (img.naturalWidth < 10) markFailed(avatar.avatar_id)
                    else markLoaded(avatar.avatar_id)
                  }}
                  onError={() => markFailed(avatar.avatar_id)}
                />
              )}

              {/* Shimmer while the preview is in flight */}
              {showImage && isLoading && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(90deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.14) 50%, rgba(255,255,255,0.06) 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'avatar-shimmer 1.4s ease-in-out infinite',
                }} />
              )}

              {/* Always-visible identity (works with OR without the photo) */}
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
                padding: '8px 6px',
                background: showImage
                  ? 'linear-gradient(transparent 55%, rgba(0,0,0,0.75))'
                  : 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55))',
                pointerEvents: 'none',
              }}>
                {!showImage && (
                  <span style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '34px', fontWeight: 800, color: 'rgba(255,255,255,0.92)',
                    letterSpacing: '-0.02em',
                  }}>
                    {avatar.avatar_name[0]}
                  </span>
                )}
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff', textAlign: 'center', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>
                  {avatar.avatar_name}
                </span>
                <span style={{ fontSize: '9px', fontWeight: 600, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {avatar.gender}
                </span>
              </div>

              {/* Selected checkmark */}
              {selected && (
                <div style={{
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  color: '#fff',
                  fontWeight: 700,
                }}>
                  ✓
                </div>
              )}
            </button>
          )
        })}
      </div>

      {visible.length === 0 && (
        <p style={{ fontSize: '13px', color: 'var(--ink-fade)', textAlign: 'center', padding: '20px 0' }}>
          {q ? `No avatars match "${search}"` : 'No avatars available'}
        </p>
      )}
      </div>
    </div>
  )
}
