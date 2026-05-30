'use client'

import { useState } from 'react'
import AvatarPicker from '@/components/AvatarPicker'

interface UGCPackageBuilderProps {
  onGenerate: (settings: {
    ugcType: string
    productName: string
    productDescription: string
    benefits: string
    callToAction: string
    style: string
    imageSize: string
    avatarId: string
    voiceId: string
  }) => Promise<void>
  isLoading: boolean
  creditBalance: number
}

const UGC_TYPES = [
  { id: 'video-with-voiceover', name: 'Avatar Video', description: 'AI avatar speaks your script', credits: 40 },
  { id: 'image-with-voiceover', name: 'Product Image', description: 'AI-generated product photo', credits: 3 },
  { id: 'all', name: 'Full Package', description: 'Image + Avatar Video', credits: 43 },
]

const HEYGEN_VOICES = [
  { id: '1bd001e7e50f421d891986aad5158bc8', label: 'Sofia — American Female' },
  { id: '2d5b0e6cf36f460aa7fc47e3eee4ba54', label: 'James — American Male' },
  { id: 'e749e866b30d47e4858cac12a6d13f2f', label: 'Emma — British Female' },
  { id: '1588bf4c1db74e1dbba1c7b2e9f54b14', label: 'Oliver — British Male' },
]

export default function UGCPackageBuilder({ onGenerate, isLoading, creditBalance }: UGCPackageBuilderProps) {
  const [ugcType, setUgcType] = useState('video-with-voiceover')
  const [productName, setProductName] = useState('')
  const [productDescription, setProductDescription] = useState('')
  const [benefits, setBenefits] = useState('')
  const [callToAction, setCallToAction] = useState('Try it today')
  const [style, setStyle] = useState('realistic')
  const [avatarId, setAvatarId] = useState('')
  const [voiceId, setVoiceId] = useState(HEYGEN_VOICES[0].id)

  const selectedType = UGC_TYPES.find(t => t.id === ugcType)!
  const canGenerate = creditBalance >= selectedType.credits && productName.trim() && productDescription.trim() && benefits.trim()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canGenerate || isLoading) return
    await onGenerate({ ugcType, productName, productDescription, benefits, callToAction, style, imageSize: '1024x1024', avatarId, voiceId })
    setProductName('')
    setProductDescription('')
    setBenefits('')
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Package type */}
      <div>
        <span className="eyebrow" style={{ display: 'block', marginBottom: '12px' }}>Package Type</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {UGC_TYPES.map(type => (
            <label key={type.id} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '14px 16px', borderRadius: 'var(--r-md)', cursor: 'pointer',
              border: `1px solid ${ugcType === type.id ? 'var(--accent)' : 'var(--border)'}`,
              background: ugcType === type.id ? 'var(--accent-soft)' : 'var(--surface)',
              transition: 'all 0.15s',
            }}>
              <input type="radio" name="ugcType" value={type.id} checked={ugcType === type.id}
                onChange={e => setUgcType(e.target.value)} disabled={isLoading}
                style={{ accentColor: 'var(--accent)', width: 16, height: 16, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>{type.name}</p>
                <p style={{ fontSize: '12px', color: 'var(--ink-dim)', margin: '2px 0 0' }}>{type.description}</p>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)', flexShrink: 0 }}>{type.credits} cr</span>
            </label>
          ))}
        </div>
      </div>

      {/* Product fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="form-row">
          <label className="form-label">Product Name *</label>
          <input className="input" value={productName} onChange={e => setProductName(e.target.value)}
            placeholder="e.g. ContentFlow" disabled={isLoading} />
        </div>

        <div className="form-row">
          <label className="form-label">Product Description *</label>
          <textarea className="textarea" rows={3} value={productDescription}
            onChange={e => setProductDescription(e.target.value)}
            placeholder="What does it do? What makes it special?" disabled={isLoading} />
        </div>

        <div className="form-row">
          <label className="form-label">Key Benefits *</label>
          <textarea className="textarea" rows={3} value={benefits}
            onChange={e => setBenefits(e.target.value)}
            placeholder="e.g. Save time, post to all platforms, AI-powered" disabled={isLoading} />
        </div>

        <div className="form-row">
          <label className="form-label">Call to Action</label>
          <input className="input" value={callToAction} onChange={e => setCallToAction(e.target.value)}
            placeholder="e.g. Try it free today" disabled={isLoading} />
        </div>
      </div>

      {/* Avatar + voice (only for video types) */}
      {(ugcType === 'video-with-voiceover' || ugcType === 'all') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <span className="eyebrow" style={{ display: 'block', marginBottom: '12px' }}>Choose Avatar</span>
            <AvatarPicker selectedId={avatarId} onChange={setAvatarId} disabled={isLoading} />
          </div>

          <div className="form-row">
            <label className="form-label">Voice</label>
            <select className="input" value={voiceId} onChange={e => setVoiceId(e.target.value)} disabled={isLoading}>
              {HEYGEN_VOICES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Image style (only for image types) */}
      {(ugcType === 'image-with-voiceover' || ugcType === 'all') && (
        <div className="form-row">
          <label className="form-label">Image Style</label>
          <select className="input" value={style} onChange={e => setStyle(e.target.value)} disabled={isLoading}>
            <option value="realistic">Realistic</option>
            <option value="artistic">Artistic</option>
            <option value="professional">Professional</option>
            <option value="minimalist">Minimalist</option>
          </select>
        </div>
      )}

      {/* Footer */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
          <span style={{ color: 'var(--ink-dim)' }}>Cost</span>
          <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{selectedType.credits} credits</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
          <span style={{ color: 'var(--ink-dim)' }}>Your balance</span>
          <span style={{ fontWeight: 600, color: creditBalance >= selectedType.credits ? 'var(--good)' : 'var(--bad)' }}>
            {creditBalance} credits
          </span>
        </div>

        <button type="submit" disabled={!canGenerate || isLoading} className="btn btn-primary"
          style={{ padding: '12px', fontSize: '14px', marginTop: '4px' }}>
          {isLoading ? 'Generating…' : 'Generate UGC Package'}
        </button>

        {!canGenerate && productName && (
          <p style={{ fontSize: '12px', color: 'var(--bad)', textAlign: 'center' }}>
            {creditBalance < selectedType.credits
              ? `Not enough credits. Need ${selectedType.credits}, have ${creditBalance}`
              : 'Fill in all required fields'}
          </p>
        )}
      </div>
    </form>
  )
}
