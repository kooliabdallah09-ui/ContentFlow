'use client'

import { useState, useEffect } from 'react'
import CharacterBuilder, { EMPTY_CHARACTER, type CharacterProfile } from '@/components/CharacterBuilder'
import {
  TIERS,
  DEFAULT_TIER,
  DEFAULT_DURATION,
  DURATION_OPTIONS,
  DURATION_CONFIGS,
  calculateVideoCredits,
  estimateRenderSeconds,
  creditsToUSD,
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
    customInstructions?: string
  }) => Promise<void>
  isLoading: boolean
  creditBalance: number
}

// The UGC builder always produces the full pipeline (script + Sora video +
// captions + B-rolls). For standalone images, users go to /generate/image
// from the sidebar — we don't conflate the two on this page anymore.
const UGC_TYPE = 'video-with-voiceover'

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
  const [tier, setTier] = useState<UGCTier>(DEFAULT_TIER)
  const [duration, setDuration] = useState<UGCDuration>(DEFAULT_DURATION)
  const [productName, setProductName] = useState('')
  const [productDescription, setProductDescription] = useState('')
  const [benefits, setBenefits] = useState('')
  const [callToAction, setCallToAction] = useState('Try it today')
  const [customInstructions, setCustomInstructions] = useState('')
  const [character, setCharacter] = useState<CharacterProfile>(EMPTY_CHARACTER)
  const [voiceId, setVoiceId] = useState(VOICES[0].id)
  const [productImage, setProductImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(null)

  // Brand profile — loaded once on mount. When the user toggles `useBrand` on,
  // we pre-fill the 4 product fields + product image from this profile (and lock
  // them with a visual cue). Toggling off restores manual entry.
  interface BrandProfile {
    productName: string
    description: string
    keyBenefits: string
    defaultCta: string
    productImageUrl?: string
  }
  const [brand, setBrand] = useState<BrandProfile | null>(null)
  const [useBrand, setUseBrand] = useState(false)

  // Hook-preview stage
  const [hooks, setHooks] = useState<HookVariant[] | null>(null)
  const [hooksLoading, setHooksLoading] = useState(false)
  const [hooksError, setHooksError] = useState<string | null>(null)

  // Fetch a saved brand image URL, convert to base64, and shove it into the
  // productImage state so the existing orchestrate pipeline reads it like a
  // freshly-uploaded file. Used when the brand toggle flips ON.
  async function loadBrandImage(url: string) {
    try {
      const res = await fetch(url)
      if (!res.ok) return null
      const blob = await res.blob()
      const buf = await blob.arrayBuffer()
      const bytes = new Uint8Array(buf)
      let bin = ''
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
      const base64 = btoa(bin)
      const mimeType = blob.type || 'image/png'
      return {
        base64,
        mimeType,
        preview: `data:${mimeType};base64,${base64}`,
      }
    } catch {
      return null
    }
  }

  // Load the user's brand profile once. If they have a meaningful one
  // (product name present), default the toggle to ON so the form pre-fills.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabase()
        if (!supabase) return
        const { data: sess } = await supabase.auth.getSession()
        const token = sess?.session?.access_token
        if (!token) return
        const res = await fetch('/api/brand/load', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (cancelled) return
        const p = data?.profile
        if (p && p.company_name) {
          const profile: BrandProfile = {
            productName: p.company_name ?? '',
            description: p.description ?? '',
            keyBenefits: p.unique_value_prop ?? '',
            defaultCta: p.brand_mission ?? 'Try it today',
            productImageUrl: p.logo_url ?? undefined,
          }
          setBrand(profile)
          // Auto-fill on first load — user can opt out.
          setUseBrand(true)
          setProductName(profile.productName)
          setProductDescription(profile.description)
          setBenefits(profile.keyBenefits)
          setCallToAction(profile.defaultCta)
          // Pull the image too — best-effort, don't block on it.
          if (profile.productImageUrl) {
            loadBrandImage(profile.productImageUrl).then(img => {
              if (!cancelled && img) setProductImage(img)
            })
          }
        }
      } catch {
        // brand load is non-critical — silent failure is fine
      }
    })()
    return () => { cancelled = true }
  }, [])

  // When the user flips the toggle, sync the form fields accordingly.
  async function toggleUseBrand(next: boolean) {
    setUseBrand(next)
    if (next && brand) {
      setProductName(brand.productName)
      setProductDescription(brand.description)
      setBenefits(brand.keyBenefits)
      setCallToAction(brand.defaultCta)
      if (brand.productImageUrl) {
        const img = await loadBrandImage(brand.productImageUrl)
        if (img) setProductImage(img)
      }
    } else if (!next) {
      setProductName('')
      setProductDescription('')
      setBenefits('')
      setCallToAction('Try it today')
      setProductImage(null)
    }
  }

  const tierCfg = TIERS[tier]
  // UGC always renders the full pipeline (tier+duration drives the cost).
  const includesVideo = true
  const videoCredits = calculateVideoCredits(tier, duration)
  const totalCredits = videoCredits
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
      ugcType: UGC_TYPE, tier, duration, productName, productDescription, benefits, callToAction,
      style: 'realistic', imageSize: '1024x1024', voiceId,
      productImageBase64: productImage?.base64,
      productImageMimeType: productImage?.mimeType,
      selectedHook,
      character,
      customInstructions: customInstructions.trim() || undefined,
    })
    resetForm()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canGenerate || isLoading || hooksLoading) return

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
          customInstructions: customInstructions.trim() || undefined,
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
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* 1 — Format (tier + duration) */}
      <section className="card">
        <div className="section-step-head">
          <span className="step-circle">1</span>
          <h3>Format</h3>
        </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
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
                    padding: '14px', borderRadius: 12,
                    border: `1.5px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                    background: active ? 'var(--hover)' : 'var(--surface)',
                    opacity: t.available ? 1 : 0.5,
                    transition: 'all 0.15s',
                    display: 'flex', flexDirection: 'column', gap: '7px',
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{t.label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px', color: 'var(--ink-mute)' }}>from {tierCost} cr</span>
                  </div>
                  <p style={{ fontSize: '12.5px', color: 'var(--ink-dim)', margin: 0, lineHeight: 1.45 }}>{t.description}</p>
                </button>
              )
            })}
          </div>

          <div style={{ marginTop: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 9 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>Duration</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-fade)' }}>
              ~{Math.round(estimateRenderSeconds(duration) / 60)}m render
            </span>
          </div>

          {(['native', 'extended', 'chained'] as const).map(group => {
            const groupDurations = DURATION_OPTIONS.filter(d => DURATION_CONFIGS[d].strategy === group)
            if (!groupDurations.length) return null
            const groupLabel =
              group === 'native'   ? 'Short'
            : group === 'extended' ? 'Extended (cheaper)'
                                   : 'Cinematic (premium)'
            return (
              <div key={group} style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-fade)', margin: '0 0 6px', fontWeight: 600 }}>
                  {groupLabel}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${groupDurations.length}, 1fr)`, gap: 8 }}>
                  {groupDurations.map(sec => {
                    const dCfg = DURATION_CONFIGS[sec]
                    const active = duration === sec
                    const cost = calculateVideoCredits(tier, sec)
                    const usd = creditsToUSD(cost)
                    const locked = !dCfg.available
                    return (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => !locked && setDuration(sec)}
                        disabled={isLoading || locked}
                        title={locked ? 'Coming soon' : undefined}
                        style={{
                          textAlign: 'center',
                          cursor: locked ? 'not-allowed' : (isLoading ? 'not-allowed' : 'pointer'),
                          padding: '10px 6px', borderRadius: 10,
                          border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                          background: active ? 'var(--ink)' : 'var(--surface)',
                          color: active ? '#fff' : 'var(--ink)',
                          opacity: locked ? 0.45 : 1,
                          transition: 'all 0.15s',
                          display: 'flex', flexDirection: 'column', gap: 2,
                          position: 'relative',
                        }}>
                        <span style={{ fontSize: 14.5, fontWeight: 600 }}>{sec}s</span>
                        <span style={{ fontSize: 10.5, opacity: 0.75, fontFamily: 'var(--font-mono)' }}>{cost} cr · ${usd.toFixed(2)}</span>
                        {locked && (
                          <span style={{
                            position: 'absolute', top: 3, right: 3,
                            fontSize: 8, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                            padding: '1px 4px', borderRadius: 3,
                            background: 'var(--ink-faint)', color: 'var(--surface)',
                          }}>Soon</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
      </section>

      {/* 2 — Your product */}
      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div className="section-step-head" style={{ marginBottom: 0 }}>
          <span className="step-circle">2</span>
          <h3>Your product</h3>
        </div>

        {/* Brand profile toggle — only render when a brand profile actually exists.
            On = pre-fills the 4 fields from /settings/brand. Off = manual entry. */}
        {brand && (
          <label style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 14px', borderRadius: 11,
            background: useBrand ? 'var(--ink)' : 'var(--surface-2)',
            border: `1px solid ${useBrand ? 'var(--ink)' : 'var(--border)'}`,
            color: useBrand ? '#fff' : 'var(--ink)',
            cursor: 'pointer', transition: 'all 0.15s',
          }}>
            <span style={{
              position: 'relative', flexShrink: 0,
              width: 32, height: 18, borderRadius: 99,
              background: useBrand ? 'rgba(255,255,255,0.25)' : 'var(--border-strong)',
              transition: 'background 0.15s',
            }}>
              <span style={{
                position: 'absolute', top: 2, left: useBrand ? 16 : 2,
                width: 14, height: 14, borderRadius: '50%',
                background: '#fff', transition: 'left 0.15s',
              }} />
            </span>
            <input type="checkbox" checked={useBrand} onChange={e => toggleUseBrand(e.target.checked)}
              disabled={isLoading}
              style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>
                Use my brand profile
              </div>
              <div style={{
                fontSize: 11.5,
                color: useBrand ? 'rgba(255,255,255,0.7)' : 'var(--ink-mute)',
                marginTop: 2,
              }}>
                {useBrand ? `Pre-filled with “${brand.productName}”` : 'Or fill the fields manually below'}
              </div>
            </div>
          </label>
        )}

        <div className="form-row">
          <label className="form-label">Product name</label>
          <input className="input" value={productName} onChange={e => { setProductName(e.target.value); if (useBrand) setUseBrand(false) }}
            placeholder="e.g. ContentFlow" disabled={isLoading} />
        </div>

        <div className="form-row">
          <label className="form-label">One-line description</label>
          <textarea className="textarea" rows={3} value={productDescription}
            onChange={e => { setProductDescription(e.target.value); if (useBrand) setUseBrand(false) }}
            placeholder="What it is and who it's for, in a sentence." disabled={isLoading} />
        </div>

        <div className="form-row">
          <label className="form-label">Key benefits</label>
          <textarea className="textarea" rows={3} value={benefits}
            onChange={e => { setBenefits(e.target.value); if (useBrand) setUseBrand(false) }}
            placeholder="Save time · ships to all platforms · AI-powered" disabled={isLoading} />
        </div>

        <div className="form-row">
          <label className="form-label">Call to action</label>
          <input className="input" value={callToAction} onChange={e => { setCallToAction(e.target.value); if (useBrand) setUseBrand(false) }}
            placeholder="e.g. Try it free today" disabled={isLoading} />
        </div>


        <div className="form-row">
          <label className="form-label">Product photo <span style={{ color: 'var(--ink-mute)', fontWeight: 400 }}>(required)</span></label>
          <p className="help">Nano Banana composites your real product into the Sora 2 first frame.</p>
          <label style={{
            display: 'flex', alignItems: 'center', gap: '14px',
            padding: '12px 14px', borderRadius: 12,
            border: '1.5px dashed var(--border-strong)', cursor: isLoading ? 'default' : 'pointer',
            background: 'var(--bg-elev)',
            transition: 'border-color 0.15s',
          }}>
            <input type="file" accept="image/jpeg,image/png,image/webp"
              onChange={handleImageChange} disabled={isLoading}
              style={{ display: 'none' }} />
            {productImage ? (
              <>
                <img src={productImage.preview} alt="Product"
                  style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>Photo added</p>
                  <p style={{ fontSize: '12px', color: 'var(--ink-mute)', margin: '2px 0 0' }}>Click to change</p>
                </div>
                <button type="button" onClick={e => { e.preventDefault(); setProductImage(null) }}
                  disabled={isLoading}
                  style={{ fontSize: '18px', lineHeight: 1, background: 'none', border: 'none', color: 'var(--ink-mute)', cursor: 'pointer', padding: '0 4px' }}>
                  ×
                </button>
              </>
            ) : (
              <>
                <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>
                </div>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>Drop product photo</p>
                  <p style={{ fontSize: '11px', color: 'var(--ink-mute)', margin: '2px 0 0', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>PNG · JPG · WEBP</p>
                </div>
              </>
            )}
          </label>
        </div>
      </section>

      {/* 3 — Character + voice */}
      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="section-step-head" style={{ marginBottom: 0 }}>
          <span className="step-circle">3</span>
          <h3>Character &amp; setting</h3>
        </div>

          <p style={{ fontSize: 12.5, color: 'var(--ink-dim)', margin: 0, lineHeight: 1.5 }}>
            Sora generates a hyper-realistic AI character holding your real product.
          </p>

          <CharacterBuilder value={character} onChange={setCharacter} disabled={isLoading} />

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
      </section>

      {/* 4 — Customize */}
      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="section-step-head" style={{ marginBottom: 0 }}>
          <span className="step-circle">4</span>
          <h3>Customize</h3>
        </div>

        <div className="form-row">
          <label className="form-label">Custom instructions <span style={{ color: 'var(--ink-mute)', fontWeight: 400 }}>(optional)</span></label>
          <p className="help">Paste your own script, set a tone, mention an offer, target an audience. The AI obeys.</p>
          <textarea
            className="textarea"
            value={customInstructions}
            onChange={e => setCustomInstructions(e.target.value.slice(0, 1500))}
            disabled={isLoading}
            rows={4}
            placeholder={'• Use this script: "Three drops, every morning."\n• Make it sound like a college student\n• Mention the 30% launch discount'}
            style={{ minHeight: 84 }}
          />
          <p style={{ fontSize: 10.5, color: 'var(--ink-fade)', textAlign: 'right', margin: '4px 0 0', fontFamily: 'var(--font-mono)' }}>
            {customInstructions.length} / 1500
          </p>
        </div>
      </section>

      {/* 6 — Cost summary + generate */}
      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div className="section-step-head" style={{ marginBottom: 0 }}>
          <span className="step-circle">5</span>
          <h3>Ready when you are</h3>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0', borderBottom: '1px solid var(--border-soft)' }}>
          <span style={{ fontSize: 13, color: 'var(--ink-dim)' }}>Cost · {tierCfg.label}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 500, letterSpacing: '-0.03em' }}>{totalCredits} <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>cr</span></span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--ink-mute)' }}>
          <span>Your balance</span>
          <span style={{ color: creditBalance >= totalCredits ? 'var(--good)' : 'var(--danger)', fontWeight: 600 }}>
            {creditBalance} credits
          </span>
        </div>

        <button type="submit" disabled={!canGenerate || isLoading || hooksLoading} className="btn btn-primary"
          style={{ padding: '13px', fontSize: '14px', marginTop: '4px', borderRadius: 11 }}>
          {isLoading ? 'Generating…' : hooksLoading ? 'Writing hooks…' : 'Preview hooks → generate'}
        </button>

        {hooksError && (
          <p style={{ fontSize: 12, color: 'var(--danger)', textAlign: 'center', margin: 0 }}>{hooksError}</p>
        )}

        {!canGenerate && productName && (
          <p style={{ fontSize: 11.5, color: 'var(--ink-mute)', textAlign: 'center', margin: 0 }}>
            {creditBalance < totalCredits
              ? `Not enough credits — need ${totalCredits}, have ${creditBalance}`
              : 'Fill in all required fields'}
          </p>
        )}
      </section>

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
                    <span style={{
                      fontSize: 10.5, fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase',
                      color: 'var(--ink-2)', background: 'var(--hover)',
                      borderRadius: 5, padding: '2px 8px',
                    }}>
                      {h.angle}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--ink-mute)', fontStyle: 'italic' }}>{h.tone}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.5, fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>
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
