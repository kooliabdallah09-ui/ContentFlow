'use client'

import { useState } from 'react'
import { Icon } from './Icons'

interface VideoSettingsProps {
  onGenerate: (settings: {
    script: string
    avatarId: string
    voiceId: string
  }) => Promise<void>
  isLoading: boolean
  creditBalance: number
}

const AVATARS = [
  { id: 'avtr_1', name: 'Sarah', gender: 'Female', accent: 'American' },
  { id: 'avtr_2', name: 'James', gender: 'Male', accent: 'American' },
  { id: 'avtr_3', name: 'Sophia', gender: 'Female', accent: 'British' },
  { id: 'avtr_4', name: 'Lucas', gender: 'Male', accent: 'Australian' },
  { id: 'avtr_5', name: 'Maya', gender: 'Female', accent: 'Indian' },
]

const VOICES = [
  { id: 'en-US-Neural2-A', name: 'Professional Female', accent: 'American' },
  { id: 'en-US-Neural2-C', name: 'Professional Male', accent: 'American' },
  { id: 'en-GB-Neural2-A', name: 'British Female', accent: 'British' },
  { id: 'en-GB-Neural2-B', name: 'British Male', accent: 'British' },
  { id: 'en-AU-Neural2-A', name: 'Australian Female', accent: 'Australian' },
]

export default function VideoSettings({
  onGenerate,
  isLoading,
  creditBalance,
}: VideoSettingsProps) {
  const [script, setScript] = useState('')
  const [avatarId, setAvatarId] = useState(AVATARS[0].id)
  const [voiceId, setVoiceId] = useState(VOICES[0].id)

  const creditCost = 100
  const charCount = script.length
  const maxChars = 3000
  const estimatedDuration = Math.ceil((script.split(/\s+/).length / 150) * 60)
  const canGenerate = creditBalance >= creditCost && script.trim().length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canGenerate || isLoading) return

    try {
      await onGenerate({ script, avatarId, voiceId })
      setScript('')
    } catch {
      // Error handled in parent
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div className="form-row">
        <label htmlFor="script" style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
          Video Script
        </label>
        <textarea
          id="script"
          value={script}
          onChange={(e) => setScript(e.target.value.slice(0, maxChars))}
          placeholder="Write the script for your video. Be clear and engaging."
          className="textarea"
          style={{ minHeight: '120px' }}
          disabled={isLoading}
          maxLength={maxChars}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
          <p className="eyebrow">
            {charCount} / {maxChars} characters
          </p>
          {estimatedDuration > 0 && (
            <p className="eyebrow" style={{ color: 'var(--accent)' }}>
              Est. Duration: ~{estimatedDuration}s
            </p>
          )}
        </div>
      </div>

      <div className="form-row">
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
          Select Avatar
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflow: 'auto' }}>
          {AVATARS.map((avatar) => (
            <label
              key={avatar.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 12px',
                background: avatarId === avatar.id ? 'var(--accent-soft)' : 'var(--surface)',
                border: `1px solid ${avatarId === avatar.id ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 'var(--r-sm)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <input
                type="radio"
                name="avatar"
                value={avatar.id}
                checked={avatarId === avatar.id}
                onChange={(e) => setAvatarId(e.target.value)}
                disabled={isLoading}
                style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              <div style={{ marginLeft: '10px', flex: 1 }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '2px' }}>{avatar.name}</p>
                <p className="eyebrow">{avatar.gender} • {avatar.accent}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="form-row">
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
          Select Voice
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflow: 'auto' }}>
          {VOICES.map((voice) => (
            <label
              key={voice.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 12px',
                background: voiceId === voice.id ? 'var(--accent-soft)' : 'var(--surface)',
                border: `1px solid ${voiceId === voice.id ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 'var(--r-sm)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <input
                type="radio"
                name="voice"
                value={voice.id}
                checked={voiceId === voice.id}
                onChange={(e) => setVoiceId(e.target.value)}
                disabled={isLoading}
                style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              <div style={{ marginLeft: '10px', flex: 1 }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '2px' }}>{voice.name}</p>
                <p className="eyebrow">{voice.accent}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
          <span className="eyebrow">Credit Cost:</span>
          <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{creditCost} credits</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
          <span className="eyebrow">Your Balance:</span>
          <span
            style={{
              fontWeight: 600,
              color: creditBalance >= creditCost ? 'var(--good)' : 'var(--danger)',
            }}
          >
            {creditBalance} credits
          </span>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!canGenerate || isLoading}
          className="btn btn-primary"
          style={{ width: '100%', marginTop: '12px', opacity: canGenerate && !isLoading ? 1 : 0.6, cursor: canGenerate && !isLoading ? 'pointer' : 'not-allowed' }}
        >
          <Icon.Sparkle style={{ width: 14, height: 14 }} />
          {isLoading ? 'Generating...' : 'Generate Video'}
        </button>

        {!canGenerate && script.trim().length > 0 && (
          <p className="eyebrow" style={{ color: 'var(--danger)', textAlign: 'center', fontSize: '11px' }}>
            Not enough credits. Need {creditCost}, have {creditBalance}
          </p>
        )}
      </div>
    </div>
  )
}
