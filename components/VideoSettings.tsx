'use client'

import { useState } from 'react'
import { Icon } from './Icons'
import AvatarPicker from './AvatarPicker'
import { CREDIT_COSTS } from '@/lib/planConfig'

interface VideoSettingsProps {
  onGenerate: (settings: {
    script: string
    avatarId: string
    voiceId: string
  }) => Promise<void>
  isLoading: boolean
  creditBalance: number
}

const VOICES = [
  { id: '1bd001e7e50f421d891986aad5158bc8', name: 'Professional Female', accent: 'American' },
  { id: '2d5b0e6cf36f460aa7fc47e3eee4ba54', name: 'Professional Male', accent: 'American' },
  { id: 'e749e866b30d47e4858cac12a6d13f2f', name: 'British Female', accent: 'British' },
  { id: '1588bf4c1db74e1dbba1c7b2e9f54b14', name: 'British Male', accent: 'British' },
]

export default function VideoSettings({
  onGenerate,
  isLoading,
  creditBalance,
}: VideoSettingsProps) {
  const [script, setScript] = useState('')
  const [avatarId, setAvatarId] = useState('')
  const [voiceId, setVoiceId] = useState(VOICES[0].id)

  const creditCost = CREDIT_COSTS.video_standard
  const charCount = script.length
  const maxChars = 3000
  const estimatedDuration = Math.ceil((script.split(/\s+/).length / 150) * 60)
  const canGenerate = creditBalance >= creditCost && script.trim().length > 0 && !!avatarId

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
          <p className="eyebrow">{charCount} / {maxChars} characters</p>
          {estimatedDuration > 0 && (
            <p className="eyebrow" style={{ color: 'var(--accent)' }}>Est. ~{estimatedDuration}s</p>
          )}
        </div>
      </div>

      <div className="form-row">
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
          Choose Avatar
        </label>
        <AvatarPicker selectedId={avatarId} onChange={setAvatarId} disabled={isLoading} />
      </div>

      <div className="form-row">
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
          Voice
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
          <span style={{ fontWeight: 600, color: creditBalance >= creditCost ? 'var(--good)' : 'var(--danger)' }}>
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

        {!canGenerate && script.trim().length > 0 && !avatarId && (
          <p className="eyebrow" style={{ color: 'var(--danger)', textAlign: 'center', fontSize: '11px' }}>
            Please select an avatar
          </p>
        )}
        {!canGenerate && script.trim().length > 0 && avatarId && creditBalance < creditCost && (
          <p className="eyebrow" style={{ color: 'var(--danger)', textAlign: 'center', fontSize: '11px' }}>
            Not enough credits. Need {creditCost}, have {creditBalance}
          </p>
        )}
      </div>
    </div>
  )
}
