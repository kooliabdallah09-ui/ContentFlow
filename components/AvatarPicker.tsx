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
                background: 'var(--surface)',
                transition: 'border-color 0.15s, transform 0.1s',
                transform: selected ? 'scale(1.02)' : 'scale(1)',
                outline: 'none',
              }}
            >
              {avatar.preview_image_url ? (
                <img
                  src={avatar.preview_image_url}
                  alt={avatar.avatar_name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', fontSize: '22px', fontWeight: 700, color: 'var(--ink-dim)' }}>
                  {avatar.avatar_name[0]}
                </div>
              )}

              {/* Name overlay */}
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                padding: '16px 6px 6px',
                fontSize: '10px',
                fontWeight: 600,
                color: '#fff',
                textAlign: 'center',
              }}>
                {avatar.avatar_name}
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
