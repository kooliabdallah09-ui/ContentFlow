'use client'

import React, { useState, useEffect } from 'react'
import { getSupabase } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { showSuccess, showError } from '@/lib/notifications'
import { DailySuggestion } from '@/lib/planner'

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
  linkedin: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
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

  // Step 2: Platforms & Frequency
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [frequency, setFrequency] = useState('moderate')

  // Step 3: Generated plan
  const [generatedPlan, setGeneratedPlan] = useState<DailySuggestion[]>([])

  const platforms = [
    { id: 'instagram', name: 'Instagram' },
    { id: 'tiktok', name: 'TikTok' },
    { id: 'linkedin', name: 'LinkedIn' },
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: session.user.id,
          user_email: session.user.email,
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
      setStep(2)
    } catch (err) {
      showError('Error', err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  const handleGeneratePlan = async () => {
    if (selectedPlatforms.length === 0) {
      showError('Missing Info', 'Select at least one platform')
      return
    }
    try {
      setLoading(true)
      setGenerating(true)
      setGenProgress(0)

      const steps = [
        { pct: 15, msg: 'Analysing your brand profile...' },
        { pct: 35, msg: 'Researching content trends...' },
        { pct: 55, msg: 'Building your 30-day calendar...' },
        { pct: 75, msg: 'Optimising posting schedule...' },
        { pct: 90, msg: 'Almost there...' },
      ]
      let si = 0
      const tick = setInterval(() => {
        if (si < steps.length) {
          setGenProgress(steps[si].pct)
          setGenStatus(steps[si].msg)
          si++
        }
      }, 2800)

      const supabase = getSupabase()!
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const res = await fetch('/api/planner/generate-monthly-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          industry: productType,
          platforms: selectedPlatforms,
          frequency,
        }),
      })
      clearInterval(tick)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to generate plan')
      }
      setGenProgress(100)
      setGenStatus('Plan ready!')
      const data = await res.json()
      setGeneratedPlan(data.plan)
      setTimeout(() => { setGenerating(false); setStep(3) }, 500)
    } catch (err) {
      setGenerating(false)
      showError('Error', err instanceof Error ? err.message : 'Failed to generate plan')
    } finally {
      setLoading(false)
    }
  }

  const handleCompletePlan = async () => {
    if (loading) return
    try {
      setLoading(true)
      const supabase = getSupabase()!
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) throw new Error('Not authenticated')

      const now = new Date()
      const res = await fetch('/api/planner/save-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: session.user.id,
          month: now.getMonth() + 1,
          year: now.getFullYear(),
          plan_data: generatedPlan,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to save plan')
      }

      if (typeof window !== 'undefined') {
        sessionStorage.setItem('generatedPlan', JSON.stringify(generatedPlan))
      }
      router.push('/calendar')
    } catch (err) {
      showError('Error', err instanceof Error ? err.message : 'Failed to save plan')
    } finally {
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              <div>
                <label style={labelStyle}>Platforms You Use</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px' }}>
                  {platforms.map(p => {
                    const selected = selectedPlatforms.includes(p.id)
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPlatforms(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}
                        style={{
                          padding: '14px 16px',
                          borderRadius: 'var(--r-md)',
                          border: selected ? '2px solid var(--accent)' : '1px solid var(--border)',
                          background: selected ? 'var(--accent)' : 'var(--surface)',
                          color: selected ? 'var(--accent-ink)' : 'var(--ink)',
                          fontSize: '14px', fontWeight: 500, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '10px',
                          transition: 'all 120ms',
                        }}
                      >
                        <span style={{ opacity: selected ? 1 : 0.7 }}>{PLATFORM_ICONS[p.id]}</span>
                        {p.name}
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
                <button
                  onClick={handleGeneratePlan}
                  disabled={loading || selectedPlatforms.length === 0}
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '12px 16px', fontSize: '14px', opacity: loading || selectedPlatforms.length === 0 ? 0.5 : 1 }}
                >
                  {loading ? 'Generating...' : 'Generate My Plan →'}
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
