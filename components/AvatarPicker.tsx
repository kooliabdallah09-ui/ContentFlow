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
  const [imgFailed, setImgFailed] = useState<Set<string>>(new Set())

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

  const visible = filter === 'all' ? avatars : avatars.filter(a => a.gender === filter)

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            style={{
              aspectRatio: '3/4',
              borderRadius: '10px',
              background: 'var(--surface)',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
        ))}
      </div>
    )
  }

  return (
    <div>
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

      {/* Avatar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
        {visible.map(avatar => {
          const selected = avatar.avatar_id === selectedId
          const failed = imgFailed.has(avatar.avatar_id)
          const showImage = !!avatar.preview_image_url && !failed
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
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onError={() => setImgFailed(prev => new Set(prev).add(avatar.avatar_id))}
                />
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
          No avatars available
        </p>
      )}
    </div>
  )
}
