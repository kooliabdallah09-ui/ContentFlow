'use client'

import { useState } from 'react'
import CharacterBuilder, { EMPTY_CHARACTER, type CharacterProfile } from '@/components/CharacterBuilder'
import {
  TIERS,
  DEFAULT_TIER,
  DEFAULT_DURATION,
  DURATION_OPTIONS,
  calculateVideoCredits,
  estimateRenderSeconds,
  type UGCTier,
  type UGCDuration,
} from '@/lib/tiers'
import { getSupabase } from '@/lib/auth'

interface HookVariant {
  id: string
  angle: string
  tone: string
  text: string
}

interface UGCPackageBuilderProps {
  onGenerate: (settings: {
    ugcType: string
    tier: UGCTier
    duration: UGCDuration
    productName: string
    productDescription: string
    benefits: string
    callToAction: string
    style: string
    imageSize: string
    voiceId: string
    productImageBase64?: string
    productImageMimeType?: string
    selectedHook?: string
    character?: CharacterProfile
  }) => Promise<void>
  isLoading: boolean
  creditBalance: number
}

const IMAGE_CREDITS = 3

const UGC_TYPES = [
  { id: 'video-with-voiceover', name: 'Avatar Video', description: 'AI avatar speaks your script' },
  { id: 'image-with-voiceover', name: 'Product Image', description: 'AI-generated product photo' },
  { id: 'all', name: 'Full Package', description: 'Image + Avatar Video' },
]

// Voice options — uses OpenAI TTS by default since it works on free OpenAI accounts
// (and you already pay for OPENAI_API_KEY for Sora/Nano Banana). ElevenLabs requires
// a paid plan ($5+/mo) for API access — once upgraded, swap individual IDs for the
// ElevenLabs voice_id and lib/tts will route them automatically.
const VOICES = [
  { id: 'openai:nova',    label: 'Nova — Bright & energetic (F)' },
  { id: 'openai:shimmer', label: 'Shimmer — Warm & friendly (F)' },
  { id: 'openai:onyx',    label: 'Onyx — Deep & authoritative (M)' },
  { id: 'openai:echo',    label: 'Echo — Smooth conversational (M)' },
]

export default function UGCPackageBuilder({ onGenerate, isLoading, creditBalance }: UGCPackageBuilderProps) {
  const [ugcType, setUgcType] = useState('video-with-voiceover')
  const [tier, setTier] = useState<UGCTier>(DEFAULT_TIER)
  const [duration, setDuration] = useState<UGCDuration>(DEFAULT_DURATION)
  const [productName, setProductName] = useState('')
  const [productDescription, setProductDescription] = useState('')
  const [benefits, setBenefits] = useState('')
  const [callToAction, setCallToAction] = useState('Try it today')
  const [style, setStyle] = useState('realistic')
  const [character, setCharacter] = useState<CharacterProfile>(EMPTY_CHARACTER)
  const [voiceId, setVoiceId] = useState(VOICES[0].id)
  const [productImage, setProductImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(null)

  // Hook-preview stage
  const [hooks, setHooks] = useState<HookVariant[] | null>(null)
  const [hooksLoading, setHooksLoading] = useState(false)
  const [hooksError, setHooksError] = useState<string | null>(null)

  const tierCfg = TIERS[tier]
  const includesVideo = ugcType === 'video-with-voiceover' || ugcType === 'all'
  const includesImage = ugcType === 'image-with-voiceover' || ugcType === 'all'
  const videoCredits = calculateVideoCredits(tier, duration)
  const totalCredits = (includesImage ? IMAGE_CREDITS : 0) + (includesVideo ? videoCredits : 0)
  const canGenerate = creditBalance >= totalCredits && productName.trim() && productDescription.trim() && benefits.trim()

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const [header, base64] = dataUrl.split(',')
      const mimeType = header.match(/data:(.*);base64/)?.[1] ?? 'image/jpeg'
      setProductImage({ base64, mimeType, preview: dataUrl })
    }
    reader.readAsDataURL(file)
  }

  const resetForm = () => {
    setProductName('')
    setProductDescription('')
    setBenefits('')
  }

  const runGenerate = async (selectedHook?: string) => {
    await onGenerate({
      ugcType, tier, duration, productName, productDescription, benefits, callToAction,
      style, imageSize: '1024x1024', voiceId,
      productImageBase64: productImage?.base64,
      productImageMimeType: productImage?.mimeType,
      selectedHook,
      character,
    })
    resetForm()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canGenerate || isLoading || hooksLoading) return

    // Image-only packages don't need a hook
    if (!includesVideo) {
      await runGenerate()
      return
    }

    setHooksError(null)
    setHooksLoading(true)
    try {
      const supabase = getSupabase()
      if (!supabase) throw new Error('Auth not ready')
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) throw new Error('Not signed in')

      const res = await fetch('/api/ugc/hooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          productName, productDescription, benefits,
          productImageBase64: productImage?.base64,
          productImageMimeType: productImage?.mimeType,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load hooks')
      if (!Array.isArray(data.hooks) || data.hooks.length === 0) throw new Error('No hooks returned')
      setHooks(data.hooks)
    } catch (err) {
      setHooksError(err instanceof Error ? err.message : 'Failed to load hooks')
    } finally {
      setHooksLoading(false)
    }
  }

  const handleHookPick = async (hook: HookVariant) => {
    setHooks(null)
    await runGenerate(hook.text)
  }

  const handleSkipHook = async () => {
    setHooks(null)
    await runGenerate()
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Package type */}
      <div>
        <span className="eyebrow" style={{ display: 'block', marginBottom: '12px' }}>Package Type</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {UGC_TYPES.map(type => {
            const typeCredits = (type.id === 'image-with-voiceover' ? IMAGE_CREDITS : 0)
              + ((type.id === 'video-with-voiceover' || type.id === 'all') ? videoCredits : 0)
            return (
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
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)', flexShrink: 0 }}>{typeCredits} cr</span>
              </label>
            )
          })}
        </div>
      </div>

      {/* Quality tier + duration — only relevant when video is included */}
      {includesVideo && (
        <>
          <div>
            <span className="eyebrow" style={{ display: 'block', marginBottom: '12px' }}>Voice Quality</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {(Object.keys(TIERS) as UGCTier[]).map(key => {
                const t = TIERS[key]
                const active = tier === key && t.available
                const disabled = !t.available || isLoading
                const tierCost = calculateVideoCredits(key, duration)
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => t.available && setTier(key)}
                    disabled={disabled}
                    style={{
                      textAlign: 'left', cursor: disabled ? 'not-allowed' : 'pointer',
                      padding: '14px', borderRadius: 'var(--r-md)',
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      background: active ? 'var(--accent-soft)' : 'var(--surface)',
                      opacity: t.available ? 1 : 0.5,
                      transition: 'all 0.15s',
                      display: 'flex', flexDirection: 'column', gap: '6px',
                    }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)' }}>{t.label}</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)' }}>{tierCost} cr</span>
                    </div>
                    <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: active ? 'var(--accent)' : 'var(--ink-dim)', margin: 0, fontWeight: 600 }}>{t.tagline}</p>
                    <p style={{ fontSize: '11px', color: 'var(--ink-dim)', margin: 0, lineHeight: 1.4 }}>{t.description}</p>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
              <span className="eyebrow">Duration</span>
              <span style={{ fontSize: '11px', color: 'var(--ink-dim)', fontFamily: 'var(--font-mono)' }}>
                ~{Math.round(estimateRenderSeconds(duration) / 60)}m render time
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${DURATION_OPTIONS.length}, 1fr)`, gap: '8px' }}>
              {DURATION_OPTIONS.map(sec => {
                const active = duration === sec
                const cost = calculateVideoCredits(tier, sec)
                return (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setDuration(sec)}
                    disabled={isLoading}
                    style={{
                      textAlign: 'center', cursor: isLoading ? 'not-allowed' : 'pointer',
                      padding: '12px', borderRadius: 'var(--r-md)',
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      background: active ? 'var(--accent-soft)' : 'var(--surface)',
                      transition: 'all 0.15s',
                      display: 'flex', flexDirection: 'column', gap: '4px',
                    }}>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ink)' }}>{sec}s</span>
                    <span style={{ fontSize: '11px', color: active ? 'var(--accent)' : 'var(--ink-dim)', fontWeight: 600 }}>{cost} cr</span>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

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

        <div className="form-row">
          <label className="form-label">
            Product Photo{' '}
            <span style={{ color: 'var(--ink-dim)', fontWeight: 400 }}>(required)</span>
          </label>
          <p style={{ fontSize: '11px', color: 'var(--ink-dim)', margin: '0 0 8px', lineHeight: 1.5 }}>
            Required — Nano Banana composites your real product (or app screen) into the AI character’s hand for the Sora 2 first frame.
          </p>
          <label style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '12px 14px', borderRadius: 'var(--r-md)',
            border: '1px dashed var(--border)', cursor: isLoading ? 'default' : 'pointer',
            background: 'var(--surface)', transition: 'border-color 0.15s',
          }}>
            <input type="file" accept="image/jpeg,image/png,image/webp"
              onChange={handleImageChange} disabled={isLoading}
              style={{ display: 'none' }} />
            {productImage ? (
              <>
                <img src={productImage.preview} alt="Product"
                  style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>Photo added</p>
                  <p style={{ fontSize: '12px', color: 'var(--ink-dim)', margin: '2px 0 0' }}>Click to change</p>
                </div>
                <button type="button" onClick={e => { e.preventDefault(); setProductImage(null) }}
                  disabled={isLoading}
                  style={{ fontSize: '18px', lineHeight: 1, background: 'none', border: 'none', color: 'var(--ink-dim)', cursor: 'pointer', padding: '0 4px' }}>
                  ×
                </button>
              </>
            ) : (
              <>
                <div style={{ width: 48, height: 48, borderRadius: '6px', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
                  📷
                </div>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>Upload product photo</p>
                  <p style={{ fontSize: '12px', color: 'var(--ink-dim)', margin: '2px 0 0' }}>JPG, PNG or WebP — helps AI generate better visuals</p>
                </div>
              </>
            )}
          </label>
        </div>
      </div>

      {/* Avatar + voice (only for video types) */}
      {(ugcType === 'video-with-voiceover' || ugcType === 'all') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          <div>
            <span className="eyebrow" style={{ display: 'block', marginBottom: '12px' }}>Build Your AI Creator</span>
            <p style={{ fontSize: '12px', color: 'var(--ink-dim)', margin: '0 0 12px' }}>
              Sora 2 generates a hyper-realistic AI character holding your real product. Answer below or pick a saved persona.
            </p>
            <CharacterBuilder value={character} onChange={setCharacter} disabled={isLoading} />
          </div>

          {tier === 'hero' ? (
            <div className="form-row">
              <label className="form-label">Voice</label>
              <select className="input" value={voiceId} onChange={e => setVoiceId(e.target.value)} disabled={isLoading}>
                {VOICES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
              <p style={{ fontSize: '11px', color: 'var(--ink-dim)', margin: '4px 0 0' }}>
                Overlaid on the video. Defaults to OpenAI TTS (works free). Add an ElevenLabs voice ID in <code>lib/tts.ts</code> once you upgrade for higher quality.
              </p>
            </div>
          ) : (
            <p style={{ fontSize: '12px', color: 'var(--ink-dim)', margin: '4px 0 0' }}>
              ✦ Standard uses Sora&apos;s native AI voice. Switch to Hero above for branded voice control.
            </p>
          )}
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
          <span style={{ color: 'var(--ink-dim)' }}>Cost{includesVideo ? ` (${tierCfg.label} tier)` : ''}</span>
          <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{totalCredits} credits</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
          <span style={{ color: 'var(--ink-dim)' }}>Your balance</span>
          <span style={{ fontWeight: 600, color: creditBalance >= totalCredits ? 'var(--good)' : 'var(--bad)' }}>
            {creditBalance} credits
          </span>
        </div>

        <button type="submit" disabled={!canGenerate || isLoading || hooksLoading} className="btn btn-primary"
          style={{ padding: '12px', fontSize: '14px', marginTop: '4px' }}>
          {isLoading ? 'Generating…' : hooksLoading ? 'Writing hooks…' : includesVideo ? 'Preview hooks → generate' : 'Generate UGC Package'}
        </button>

        {hooksError && (
          <p style={{ fontSize: '12px', color: 'var(--bad)', textAlign: 'center' }}>{hooksError}</p>
        )}

        {!canGenerate && productName && (
          <p style={{ fontSize: '12px', color: 'var(--bad)', textAlign: 'center' }}>
            {creditBalance < totalCredits
              ? `Not enough credits. Need ${totalCredits}, have ${creditBalance}`
              : 'Fill in all required fields'}
          </p>
        )}
      </div>

      {hooks && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => !isLoading && setHooks(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg)', padding: '24px',
              maxWidth: '560px', width: '100%',
              display: 'flex', flexDirection: 'column', gap: '16px',
              maxHeight: '90vh', overflowY: 'auto',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--ink)' }}>Pick your hook</h3>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--ink-dim)' }}>
                Different angles for the first 5 seconds. Picking one charges {totalCredits} credits.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {hooks.map(h => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => handleHookPick(h)}
                  disabled={isLoading}
                  style={{
                    textAlign: 'left', cursor: isLoading ? 'not-allowed' : 'pointer',
                    padding: '14px 16px', borderRadius: 'var(--r-md)',
                    border: '1px solid var(--border)', background: 'var(--surface)',
                    transition: 'all 0.15s',
                    display: 'flex', flexDirection: 'column', gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent)', fontWeight: 700 }}>
                      {h.angle}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--ink-dim)', fontStyle: 'italic' }}>{h.tone}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '14px', color: 'var(--ink)', lineHeight: 1.4 }}>
                    “{h.text}”
                  </p>
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '4px' }}>
              <button type="button" onClick={() => setHooks(null)} disabled={isLoading}
                className="btn btn-ghost" style={{ fontSize: '13px' }}>
                Cancel
              </button>
              <button type="button" onClick={handleSkipHook} disabled={isLoading}
                className="btn btn-ghost" style={{ fontSize: '13px' }}>
                Use original hook
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}
