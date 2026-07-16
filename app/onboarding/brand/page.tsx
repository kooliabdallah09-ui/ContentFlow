'use client'

import React, { useState, useEffect } from 'react'
import { getSupabase } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { showSuccess, showError } from '@/lib/notifications'
import { DailySuggestion } from '@/lib/planner'
import { FormatPreferences, FormatFrequency } from '@/lib/planConfig'

const FORMAT_OPTIONS: { id: keyof FormatPreferences; label: string; desc: string }[] = [
  { id: 'ugc',         label: 'UGC Video',     desc: 'AI talking-head brand videos' },
  { id: 'video',       label: 'AI Video',       desc: 'Short clips, reels & Sora generations' },
  { id: 'image',       label: 'AI Image',       desc: 'AI-generated visuals & graphics' },
  { id: 'social',      label: 'Social Post',    desc: 'Captions, hashtags & image carousels' },
  { id: 'voice',       label: 'Voice / Audio',  desc: 'ElevenLabs voiceovers & audio clips' },
  { id: 'screen-demo', label: 'Screen Demo',    desc: 'Software demo & walkthrough videos' },
]

const FREQ_CHIPS: { value: FormatFrequency; label: string }[] = [
  { value: 0, label: 'Never' },
  { value: 1, label: 'Light' },
  { value: 2, label: 'Regular' },
  { value: 3, label: 'Heavy' },
]

const PLATFORM_ICONS: Record<string, React.ReactElement> = {
  instagram: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  ),
  tiktok: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.19 8.19 0 004.79 1.53V6.78a4.85 4.85 0 01-1.02-.09z"/>
    </svg>
  ),
  twitter: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  ),
  youtube: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  ),
  facebook: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  ),
}

const FREQUENCIES = [
  { value: 'light', label: '2-3 posts/week' },
  { value: 'moderate', label: '4-5 posts/week' },
  { value: 'heavy', label: '6-7 posts/week' },
]

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  fontSize: '14px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--r-md)',
  background: 'var(--surface)',
  color: 'var(--ink)',
  fontFamily: 'inherit',
  outline: 'none',
} as const

const labelStyle = {
  display: 'block',
  marginBottom: '8px',
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--ink)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  fontFamily: 'var(--font-mono)',
} as const

export default function OnboardingBrandPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [aiSeed, setAiSeed] = useState('')
  const [aiFilling, setAiFilling] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genProgress, setGenProgress] = useState(0)
  const [genStatus, setGenStatus] = useState('')
  const [authChecked, setAuthChecked] = useState(false)

  // Step 1: Brand Info
  const [companyName, setCompanyName] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState('')
  const [description, setDescription] = useState('')
  const [productType, setProductType] = useState('')
  const [uniqueValue, setUniqueValue] = useState('')
  const [brandMission, setBrandMission] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [customerPainPoints, setCustomerPainPoints] = useState('')
  const [toneOfVoice, setToneOfVoice] = useState('')
  const [brandColors, setBrandColors] = useState('')
  // App/Software specific
  const [appScreenshots, setAppScreenshots] = useState<{ file: File; preview: string }[]>([])
  const [appKeyFeatures, setAppKeyFeatures] = useState('')

  const isSoftwareProduct = ['app', 'saas', 'software', 'platform', 'tool', 'website', 'web', 'mobile', 'extension', 'plugin']
    .some(kw => productType.toLowerCase().includes(kw))

  const handleScreenshotAdd = (files: FileList) => {
    const newFiles = Array.from(files).slice(0, 8 - appScreenshots.length)
    newFiles.forEach(file => {
      const reader = new FileReader()
      reader.onloadend = () => {
        setAppScreenshots(prev => [...prev, { file, preview: reader.result as string }])
      }
      reader.readAsDataURL(file)
    })
  }

  // Step 2: Platforms, Format Preferences & Frequency
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [frequency, setFrequency] = useState('moderate')
  const [formatPrefs, setFormatPrefs] = useState<FormatPreferences>({
    ugc: 2, video: 2, image: 2, social: 3, voice: 1, 'screen-demo': 1,
  })

  // Step 3: Generated plan
  const [generatedPlan, setGeneratedPlan] = useState<DailySuggestion[]>([])

  const platforms = [
    { id: 'instagram', name: 'Instagram' },
    { id: 'tiktok', name: 'TikTok' },
    { id: 'twitter', name: 'X (Twitter)' },
    { id: 'youtube', name: 'YouTube' },
    { id: 'facebook', name: 'Facebook' },
  ]

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = getSupabase()
      if (!supabase) { router.push('/auth/login'); return }
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      setAuthChecked(true)
    }
    checkAuth()
  }, [])

  const handleLogoChange = (file: File) => {
    setLogoFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setLogoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleAiFill = async () => {
    if (aiSeed.trim().length < 5) {
      showError('Say a bit more', 'Describe your product in one sentence.')
      return
    }
    try {
      setAiFilling(true)
      const supabase = getSupabase()!
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Please sign in')
      const res = await fetch('/api/brand/ai-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ description: aiSeed.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'AI fill failed')
      const p = data.profile ?? {}
      if (p.companyName) setCompanyName(p.companyName)
      if (p.description) setDescription(p.description)
      if (p.productType) setProductType(p.productType)
      if (p.uniqueValue) setUniqueValue(p.uniqueValue)
      if (p.brandMission) setBrandMission(p.brandMission)
      if (p.targetAudience) setTargetAudience(p.targetAudience)
      if (p.customerPainPoints) setCustomerPainPoints(p.customerPainPoints)
      if (p.toneOfVoice) setToneOfVoice(p.toneOfVoice)
      if (p.brandColors) setBrandColors(p.brandColors)
      showSuccess('Filled in', 'Review the fields and tweak anything.')
    } catch (err) {
      showError('AI fill failed', err instanceof Error ? err.message : 'Try again')
    } finally {
      setAiFilling(false)
    }
  }

  const handleSaveBrandInfo = async () => {
    if (!companyName || !description || !productType || !uniqueValue || !brandMission || !targetAudience || !customerPainPoints || !toneOfVoice) {
      showError('Missing Info', 'Please fill in all fields')
      return
    }
    try {
      setLoading(true)
      const supabase = getSupabase()!
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) throw new Error('Please sign in to continue')

      const res = await fetch('/api/brand/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          company_name: companyName,
          description,
          target_audience: targetAudience,
          tone_of_voice: toneOfVoice,
          product_type: productType,
          unique_value_prop: uniqueValue,
          brand_mission: brandMission,
          customer_pain_points: customerPainPoints,
          brand_colors: brandColors,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to save')
      }
      // Advance to step 2 (platforms + frequency + format prefs).
      // Step 2's Continue button routes to /onboarding/intelligence.
      setStep(2)
    } catch (err) {
      showError('Error', err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  // Step 2 -> intelligence: stash platforms + frequency + format prefs in
  // sessionStorage so the intelligence page can merge them into the onboard
  // request. Avoids a migration; sessionStorage clears when the tab closes.
  const handleGeneratePlan = async () => {
    if (selectedPlatforms.length === 0) {
      showError('Missing Info', 'Select at least one platform')
      return
    }
    try {
      sessionStorage.setItem('cf-onboarding-prefs', JSON.stringify({
        platforms: selectedPlatforms,
        frequency,
        formatPreferences: formatPrefs,
      }))
    } catch {}
    router.push('/onboarding/intelligence')
  }

  const handleCompletePlan = async () => {
    if (loading) return
    setLoading(true)
    try {
      const supabase = getSupabase()!
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) throw new Error('Not authenticated')

      // Always save to sessionStorage so calendar can display the plan
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('generatedPlan', JSON.stringify(generatedPlan))
      }

      // Save to DB — await it so we can catch errors
      const now = new Date()
      const saveRes = await fetch('/api/planner/save-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          month: now.getMonth() + 1,
          year: now.getFullYear(),
          plan_data: generatedPlan,
        }),
      })

      if (!saveRes.ok) {
        const err = await saveRes.json().catch(() => ({}))
        console.error('Plan save failed:', err)
        // Still navigate — sessionStorage fallback will show the plan
      }

      router.push('/calendar')
    } catch (err) {
      showError('Error', err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  if (!authChecked) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '4px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const stepTitles = ['Build Your Brand Profile', 'Platforms & Frequency', 'Your Monthly Plan']

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--ink)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border)', padding: '28px 48px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '36px', margin: 0, fontWeight: 400 }}>
              {step === 1 ? <>Build Your <em style={{ fontStyle: 'italic', color: 'var(--ink-dim)' }}>Brand Profile</em></> :
               step === 2 ? <>Platforms & <em style={{ fontStyle: 'italic', color: 'var(--ink-dim)' }}>Frequency</em></> :
               <>Your <em style={{ fontStyle: 'italic', color: 'var(--ink-dim)' }}>Monthly Plan</em></>}
            </h1>
            <div style={{ fontSize: '13px', color: 'var(--ink-dim)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Step {step} of 3
            </div>
          </div>
          <div style={{ width: '100%', height: '3px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'var(--accent)', borderRadius: '99px', transition: 'width 300ms ease', width: `${(step / 3) * 100}%` }} />
          </div>
        </div>
      </div>

      <div style={{ flex: 1, padding: '48px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: '600px' }}>

          {/* ── STEP 1: Brand Info ── */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

              <div style={{ padding: '18px 20px', border: '1px dashed var(--border)', borderRadius: 'var(--r-md)', background: 'var(--surface-2)' }}>
                <label style={{ ...labelStyle, marginBottom: 8 }}>Skip the typing <span style={{ color: 'var(--ink-mute)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontFamily: 'inherit' }}>— describe your product and AI fills every field below</span></label>
                <textarea
                  rows={2}
                  placeholder="e.g. Handmade skincare soaps made with cold-pressed olive oil, for women who care about clean ingredients."
                  value={aiSeed}
                  onChange={e => setAiSeed(e.target.value)}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                />
                <button
                  type="button"
                  onClick={handleAiFill}
                  disabled={aiFilling || aiSeed.trim().length < 5}
                  style={{
                    marginTop: 10, padding: '10px 18px', borderRadius: 10,
                    background: 'var(--ink)', color: 'var(--on-ink)', border: 'none',
                    fontSize: 13, fontWeight: 600,
                    cursor: aiFilling || aiSeed.trim().length < 5 ? 'not-allowed' : 'pointer',
                    opacity: aiFilling || aiSeed.trim().length < 5 ? 0.5 : 1,
                  }}
                >
                  {aiFilling ? 'Filling…' : '✨ Fill everything with AI'}
                </button>
              </div>

              <div>
                <label style={labelStyle}>Company Name</label>
                <input type="text" placeholder="Your brand name" value={companyName} onChange={e => setCompanyName(e.target.value)} style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Brand Logo <span style={{ color: 'var(--ink-mute)', fontWeight: 400 }}>(optional)</span></label>
                <div
                  style={{ border: '2px dashed var(--border)', borderRadius: 'var(--r-md)', padding: '24px', textAlign: 'center', cursor: 'pointer', background: logoPreview ? 'var(--surface)' : 'transparent' }}
                  onClick={() => document.getElementById('logoInput')?.click()}
                >
                  <input id="logoInput" type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleLogoChange(e.target.files[0])} />
                  {logoPreview ? (
                    <>
                      <img src={logoPreview} alt="Logo" style={{ maxHeight: '72px', marginBottom: '10px' }} />
                      <p style={{ margin: 0, fontSize: '13px', color: 'var(--ink-dim)' }}>{logoFile?.name} · Click to change</p>
                    </>
                  ) : (
                    <>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="1.5" style={{ marginBottom: '8px' }}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                      <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 600 }}>Upload your logo</p>
                      <p style={{ margin: 0, fontSize: '13px', color: 'var(--ink-dim)' }}>PNG, JPG up to 5MB</p>
                    </>
                  )}
                </div>
              </div>

              <div>
                <label style={labelStyle}>Brand Description</label>
                <textarea placeholder="What does your brand do? What makes it unique?" value={description} onChange={e => setDescription(e.target.value)} style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }} />
              </div>

              <div>
                <label style={labelStyle}>Product / Service Type</label>
                <input type="text" placeholder="e.g., SaaS, E-commerce, Fitness, Consulting" value={productType} onChange={e => setProductType(e.target.value)} style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Unique Value Proposition</label>
                <textarea placeholder="What makes your brand different from competitors?" value={uniqueValue} onChange={e => setUniqueValue(e.target.value)} style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} />
              </div>

              <div>
                <label style={labelStyle}>Brand Mission</label>
                <textarea placeholder="What's the larger purpose of your brand?" value={brandMission} onChange={e => setBrandMission(e.target.value)} style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} />
              </div>

              <div>
                <label style={labelStyle}>Target Audience</label>
                <textarea placeholder="Who are your ideal customers? (demographics, interests)" value={targetAudience} onChange={e => setTargetAudience(e.target.value)} style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} />
              </div>

              <div>
                <label style={labelStyle}>Customer Pain Points</label>
                <textarea placeholder="What problems do your customers face that you solve?" value={customerPainPoints} onChange={e => setCustomerPainPoints(e.target.value)} style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} />
              </div>

              <div>
                <label style={labelStyle}>Tone of Voice</label>
                <select value={toneOfVoice} onChange={e => setToneOfVoice(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">Select a tone...</option>
                  <option value="professional">Professional & Corporate</option>
                  <option value="friendly">Friendly & Approachable</option>
                  <option value="humorous">Humorous & Playful</option>
                  <option value="inspirational">Inspirational & Motivational</option>
                  <option value="educational">Educational & Informative</option>
                  <option value="luxury">Luxury & Sophisticated</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Brand Colors <span style={{ color: 'var(--ink-mute)', fontWeight: 400 }}>(optional)</span></label>
                <input type="text" placeholder="e.g., Cyan, White, Dark Gray" value={brandColors} onChange={e => setBrandColors(e.target.value)} style={inputStyle} />
              </div>

              {/* App/Software only */}
              {isSoftwareProduct && (
                <>
                  <div>
                    <label style={labelStyle}>App Screenshots <span style={{ color: 'var(--ink-mute)', fontWeight: 400 }}>(optional, up to 8)</span></label>
                    <p style={{ fontSize: '13px', color: 'var(--ink-dim)', marginBottom: '12px', marginTop: '2px' }}>
                      These help the AI suggest content that accurately shows your product.
                    </p>
                    <div
                      style={{ border: '2px dashed var(--border)', borderRadius: 'var(--r-md)', padding: '20px', textAlign: 'center', cursor: 'pointer', background: 'transparent' }}
                      onClick={() => document.getElementById('screenshotInput')?.click()}
                    >
                      <input
                        id="screenshotInput" type="file" accept="image/*" multiple style={{ display: 'none' }}
                        onChange={e => e.target.files && handleScreenshotAdd(e.target.files)}
                      />
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="1.5" style={{ marginBottom: '6px' }}>
                        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
                      </svg>
                      <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 600 }}>
                        {appScreenshots.length > 0 ? `${appScreenshots.length} screenshot${appScreenshots.length > 1 ? 's' : ''} added — click to add more` : 'Upload screenshots of your app'}
                      </p>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--ink-mute)' }}>Dashboard, key features, onboarding — anything visual</p>
                    </div>
                    {appScreenshots.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '12px' }}>
                        {appScreenshots.map((s, i) => (
                          <div key={i} style={{ position: 'relative', aspectRatio: '16/9', borderRadius: 'var(--r-sm)', overflow: 'hidden', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                            <img src={s.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <button
                              onClick={e => { e.stopPropagation(); setAppScreenshots(prev => prev.filter((_, j) => j !== i)) }}
                              style={{ position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                            >×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={labelStyle}>Key Screens & Features</label>
                    <textarea
                      placeholder={`Describe your app's main screens and what they show.\ne.g. "Dashboard shows daily stats and credit balance. Generator page has a text input and style selector. Library stores all past creations with preview thumbnails."`}
                      value={appKeyFeatures}
                      onChange={e => setAppKeyFeatures(e.target.value)}
                      style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
                    />
                    <p style={{ fontSize: '12px', color: 'var(--ink-mute)', marginTop: '6px' }}>
                      The AI uses this to suggest content that shows your actual product — not generic app footage.
                    </p>
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button onClick={() => router.push('/dashboard')} className="btn btn-ghost" style={{ flex: 1, padding: '12px 16px', fontSize: '14px' }}>
                  Skip
                </button>
                <button
                  onClick={handleSaveBrandInfo}
                  disabled={loading || !companyName || !description || !productType || !uniqueValue || !brandMission || !targetAudience || !customerPainPoints || !toneOfVoice}
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '12px 16px', fontSize: '14px', opacity: loading || !companyName || !description || !productType || !uniqueValue || !brandMission || !targetAudience || !customerPainPoints || !toneOfVoice ? 0.5 : 1 }}
                >
                  {loading ? 'Saving...' : 'Continue →'}
                </button>
              </div>
            </div>
          )}

          {/* ── GENERATING OVERLAY ── */}
          {generating && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '32px' }}>
              <div style={{ textAlign: 'center' }}>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 400, margin: '0 0 8px' }}>
                  Building your <em style={{ fontStyle: 'italic', color: 'var(--ink-dim)' }}>content plan</em>
                </h2>
                <p style={{ color: 'var(--ink-dim)', fontSize: '14px', margin: 0 }}>~15 seconds</p>
              </div>
              <div style={{ width: '100%', maxWidth: '480px' }}>
                <div style={{ width: '100%', height: '6px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden', marginBottom: '16px' }}>
                  <div style={{
                    height: '100%',
                    background: 'var(--accent)',
                    borderRadius: '99px',
                    width: `${genProgress}%`,
                    transition: 'width 600ms cubic-bezier(0.4, 0, 0.2, 1)',
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: 'var(--ink-dim)', fontFamily: 'var(--font-mono)' }}>{genStatus}</span>
                  <span style={{ fontSize: '13px', color: 'var(--ink-mute)', fontFamily: 'var(--font-mono)' }}>{genProgress}%</span>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Platforms & Frequency ── */}
          {step === 2 && !generating && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>

              {/* Format Mix */}
              <div>
                <label style={labelStyle}>Content Format Mix</label>
                <p style={{ fontSize: '13px', color: 'var(--ink-dim)', marginBottom: '16px', marginTop: '4px' }}>
                  How often do you want each format in your plan?
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {FORMAT_OPTIONS.map(fmt => {
                    const val = formatPrefs[fmt.id] ?? 0
                    return (
                      <div key={fmt.id} style={{
                        display: 'flex', alignItems: 'center', gap: '16px',
                        padding: '12px 16px', borderRadius: 'var(--r-md)',
                        background: 'var(--surface)', border: '1px solid var(--border)',
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '14px', fontWeight: 600 }}>{fmt.label}</div>
                          <div style={{ fontSize: '12px', color: 'var(--ink-mute)' }}>{fmt.desc}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                          {FREQ_CHIPS.map(chip => (
                            <button
                              key={chip.value}
                              onClick={() => setFormatPrefs(p => ({ ...p, [fmt.id]: chip.value }))}
                              style={{
                                padding: '4px 10px', borderRadius: '99px', fontSize: '12px',
                                fontWeight: 500, cursor: 'pointer', border: 'none',
                                background: val === chip.value ? 'var(--accent)' : 'var(--bg)',
                                color: val === chip.value ? 'var(--accent-ink)' : 'var(--ink-mute)',
                                transition: 'all 120ms',
                              }}
                            >
                              {chip.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {/* Distribution preview */}
                {Object.values(formatPrefs).some(v => v && v > 0) && (
                  <div style={{ marginTop: '14px' }}>
                    <div style={{ display: 'flex', height: '6px', borderRadius: '99px', overflow: 'hidden', gap: '2px' }}>
                      {FORMAT_OPTIONS.filter(f => (formatPrefs[f.id] ?? 0) > 0).map(fmt => {
                        const total = Object.values(formatPrefs).reduce((s: number, v) => s + (v ?? 0), 0 as number)
                        const pct = ((formatPrefs[fmt.id] ?? 0) / total) * 100
                        const colors: Record<string, string> = {
                          ugc: 'var(--accent)', video: '#6366f1', image: '#06b6d4',
                          social: '#10b981', voice: '#8b5cf6', 'screen-demo': '#f59e0b',
                        }
                        return (
                          <div key={fmt.id} style={{
                            flex: pct, background: colors[fmt.id] || 'var(--accent)',
                            borderRadius: '99px', minWidth: '4px',
                          }} />
                        )
                      })}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                      {FORMAT_OPTIONS.filter(f => (formatPrefs[f.id] ?? 0) > 0).map(fmt => {
                        const colors: Record<string, string> = {
                          ugc: 'var(--accent)', video: '#6366f1', image: '#06b6d4',
                          social: '#10b981', voice: '#8b5cf6', 'screen-demo': '#f59e0b',
                        }
                        return (
                          <span key={fmt.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--ink-dim)' }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors[fmt.id], display: 'inline-block', flexShrink: 0 }} />
                            {fmt.label}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label style={labelStyle}>Platforms You Use</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px' }}>
                  {platforms.map(p => {
                    const selected = selectedPlatforms.includes(p.id)
                    const soon: boolean = 'soon' in p && Boolean((p as { soon?: boolean }).soon)
                    return (
                      <button
                        key={p.id}
                        disabled={soon}
                        onClick={() => !soon && setSelectedPlatforms(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}
                        style={{
                          padding: '14px 16px',
                          borderRadius: 'var(--r-md)',
                          border: selected ? '2px solid var(--accent)' : '1px solid var(--border)',
                          background: selected ? 'var(--accent)' : 'var(--surface)',
                          color: selected ? 'var(--accent-ink)' : 'var(--ink)',
                          fontSize: '14px', fontWeight: 500, cursor: soon ? 'not-allowed' : 'pointer',
                          opacity: soon ? 0.55 : 1,
                          display: 'flex', alignItems: 'center', gap: '10px',
                          transition: 'all 120ms',
                        }}
                      >
                        <span style={{ opacity: selected ? 1 : 0.7 }}>{PLATFORM_ICONS[p.id]}</span>
                        <span style={{ flex: 1, textAlign: 'left' }}>{p.name}</span>
                        {soon && <span style={{ fontSize: 10, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--ink-mute)', borderRadius: 4, padding: '2px 6px', letterSpacing: '0.05em' }}>SOON</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label style={labelStyle}>Posting Frequency</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                  {FREQUENCIES.map(f => (
                    <button
                      key={f.value}
                      onClick={() => setFrequency(f.value)}
                      style={{
                        padding: '14px 20px',
                        borderRadius: 'var(--r-md)',
                        border: frequency === f.value ? '2px solid var(--accent)' : '1px solid var(--border)',
                        background: frequency === f.value ? 'var(--accent)' : 'var(--surface)',
                        color: frequency === f.value ? 'var(--accent-ink)' : 'var(--ink)',
                        fontSize: '14px', fontWeight: 500, cursor: 'pointer',
                        textAlign: 'left', transition: 'all 120ms',
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button onClick={() => setStep(1)} className="btn btn-ghost" style={{ flex: 1, padding: '12px 16px', fontSize: '14px' }}>← Back</button>
                {/* Skip: user bails on plan generation. We route straight to
                    the dashboard without calling any plan-gen endpoint, so
                    no calendar is built. They can come back and generate
                    later from the dashboard's Refresh trends button. */}
                <button
                  onClick={() => router.push('/dashboard?intel=skipped')}
                  className="btn btn-ghost"
                  style={{ flex: 1, padding: '12px 16px', fontSize: '14px' }}
                >
                  Skip
                </button>
                <button
                  onClick={handleGeneratePlan}
                  disabled={loading || selectedPlatforms.length === 0}
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '12px 16px', fontSize: '14px', opacity: loading || selectedPlatforms.length === 0 ? 0.5 : 1 }}
                >
                  {loading ? 'Loading...' : 'Continue →'}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Review Plan ── */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <p style={{ fontSize: '14px', color: 'var(--ink-dim)', marginBottom: '20px' }}>
                  Your AI-generated content plan for {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })} — {generatedPlan.length} days scheduled.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                  {generatedPlan.slice(0, 10).map((day, i) => (
                    <div key={i} style={{ padding: '12px 16px', background: 'var(--surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '12px', color: 'var(--ink-mute)', marginBottom: '3px', fontFamily: 'var(--font-mono)' }}>{day.date}</div>
                        <div style={{ fontSize: '14px', fontWeight: 500 }}>{day.title}</div>
                      </div>
                      <span style={{ fontSize: '12px', padding: '3px 10px', background: 'var(--accent-soft)', color: 'var(--accent)', borderRadius: '99px', fontFamily: 'var(--font-mono)' }}>
                        {day.contentType}
                      </span>
                    </div>
                  ))}
                  {generatedPlan.length > 10 && (
                    <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--ink-mute)', padding: '8px' }}>+ {generatedPlan.length - 10} more days in calendar</p>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setStep(2)} className="btn btn-ghost" style={{ flex: 1, padding: '12px 16px', fontSize: '14px' }}>← Back</button>
                <button onClick={handleCompletePlan} disabled={loading} className="btn btn-primary" style={{ flex: 1, padding: '12px 16px', fontSize: '14px', opacity: loading ? 0.5 : 1 }}>
                  {loading ? 'Saving...' : 'Go to Calendar →'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
