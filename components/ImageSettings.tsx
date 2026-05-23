'use client'

import { useState } from 'react'
import { Icon } from './Icons'

interface ImageSettingsProps {
  onGenerate: (settings: {
    prompt: string
    style: string
    size: string
    quantity: number
  }) => Promise<void>
  isLoading: boolean
  creditBalance: number
}

const STYLES = [
  'realistic',
  'artistic',
  'cartoon',
  'sketch',
  'photographic',
  'illustration',
  'digital-art',
  'fantasy',
]

const SIZES = [
  { label: '512×512', value: '512x512' },
  { label: '768×768', value: '768x768' },
  { label: '1024×1024', value: '1024x1024' },
]

export default function ImageSettings({
  onGenerate,
  isLoading,
  creditBalance,
}: ImageSettingsProps) {
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState('realistic')
  const [size, setSize] = useState('1024x1024')
  const [quantity, setQuantity] = useState(1)

  const creditCostPerImage = 5
  const creditCost = creditCostPerImage * quantity
  const canGenerate = creditBalance >= creditCost && prompt.trim().length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canGenerate || isLoading) return

    try {
      await onGenerate({ prompt, style, size, quantity })
      setPrompt('')
    } catch {
      // Error handling done in parent component
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div className="form-row">
        <label htmlFor="prompt" style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
          Image Description
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the image you want to generate..."
          className="textarea"
          style={{ minHeight: '120px' }}
          disabled={isLoading}
        />
        <p className="eyebrow" style={{ marginTop: '6px' }}>
          {prompt.length} characters
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div className="form-row">
          <label htmlFor="style" style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
            Style
          </label>
          <select
            id="style"
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            className="select"
            disabled={isLoading}
          >
            {STYLES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ')}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="size" style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
            Size
          </label>
          <select
            id="size"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="select"
            disabled={isLoading}
          >
            {SIZES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-row">
        <label htmlFor="quantity" style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
          Number of Variations: <span style={{ color: 'var(--accent)' }}>{quantity}</span>
        </label>
        <input
          id="quantity"
          type="range"
          min="1"
          max="4"
          value={quantity}
          onChange={(e) => setQuantity(parseInt(e.target.value))}
          disabled={isLoading}
          style={{ width: '100%', height: '6px', accentColor: 'var(--accent)' }}
        />
        <p className="eyebrow" style={{ marginTop: '6px' }}>
          {quantity > 1
            ? `Generating ${quantity} variations`
            : 'Single generation'}
        </p>
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
          {isLoading ? 'Generating...' : 'Generate Image'}
        </button>

        {!canGenerate && prompt.trim().length > 0 && (
          <p className="eyebrow" style={{ color: 'var(--danger)', textAlign: 'center', fontSize: '11px' }}>
            Not enough credits. Need {creditCost}, have {creditBalance}
          </p>
        )}
      </div>
    </div>
  )
}
