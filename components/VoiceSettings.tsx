'use client'

import { useState } from 'react'
import { Icon } from './Icons'
import { CREDIT_COSTS } from '@/lib/planConfig'

interface VoiceSettingsProps {
  onGenerate: (settings: {
    text: string
    voiceId: string
    stability: number
    similarityBoost: number
  }) => Promise<void>
  isLoading: boolean
  creditBalance: number
}

const VOICES = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', description: 'Warm, engaging American female' },
  { id: 'cjVigB5qzO86Huf0OWl1', name: 'Clyde', description: 'Deep, authoritative male' },
  { id: 'AZnzlk1XvdvUBZ4xNXUI', name: 'Domi', description: 'Strong Spanish accent female' },
  { id: 'CwhRBWXzygEsXDAw7dVj', name: 'Dave', description: 'Casual, friendly male' },
  { id: 'NM3f8KbDDMqs3UZLIu7G', name: 'Josh', description: 'Young, energetic male' },
]

export default function VoiceSettings({
  onGenerate,
  isLoading,
  creditBalance,
}: VoiceSettingsProps) {
  const [text, setText] = useState('')
  const [voiceId, setVoiceId] = useState(VOICES[0].id)
  const [stability, setStability] = useState(0.5)
  const [similarityBoost, setSimilarityBoost] = useState(0.75)

  const creditCost = CREDIT_COSTS.voice
  const charCount = text.length
  const maxChars = 5000
  const canGenerate = creditBalance >= creditCost && text.trim().length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canGenerate || isLoading) return

    try {
      await onGenerate({ text, voiceId, stability, similarityBoost })
      setText('')
    } catch {
      // Error handled in parent
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div className="form-row">
        <label htmlFor="text" style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
          Text to Synthesize
        </label>
        <textarea
          id="text"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, maxChars))}
          placeholder="Enter the text you want to convert to speech..."
          className="textarea"
          style={{ minHeight: '120px' }}
          disabled={isLoading}
          maxLength={maxChars}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
          <p className="eyebrow">
            {charCount} / {maxChars} characters
          </p>
          {charCount >= maxChars * 0.9 && (
            <p className="eyebrow" style={{ color: 'var(--danger)' }}>Approaching limit</p>
          )}
        </div>
      </div>

      <div className="form-row">
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
          Voice Selection
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
                <p className="eyebrow">{voice.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div className="form-row">
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
            Stability: <span style={{ color: 'var(--accent)' }}>{stability.toFixed(1)}</span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={stability}
            onChange={(e) => setStability(parseFloat(e.target.value))}
            disabled={isLoading}
            style={{ width: '100%', height: '6px', accentColor: 'var(--accent)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: 'var(--ink-dim)' }}>
            <span>Less Stable</span>
            <span>More Stable</span>
          </div>
        </div>

        <div className="form-row">
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
            Similarity: <span style={{ color: 'var(--accent)' }}>{similarityBoost.toFixed(1)}</span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={similarityBoost}
            onChange={(e) => setSimilarityBoost(parseFloat(e.target.value))}
            disabled={isLoading}
            style={{ width: '100%', height: '6px', accentColor: 'var(--accent)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: 'var(--ink-dim)' }}>
            <span>Less Similar</span>
            <span>More Similar</span>
          </div>
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
          {isLoading ? 'Generating...' : 'Generate Voice'}
        </button>

        {!canGenerate && text.trim().length > 0 && (
          <p className="eyebrow" style={{ color: 'var(--danger)', textAlign: 'center', fontSize: '11px' }}>
            Not enough credits. Need {creditCost}, have {creditBalance}
          </p>
        )}
      </div>
    </div>
  )
}
