'use client'

import { useState, useEffect } from 'react'
import { getSupabase } from '@/lib/auth'
import { useImageDrop } from '@/hooks/useImageDrop'

export default function BrandSettingsPage() {
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess]     = useState('')
  const [error, setError]         = useState('')
  const [exists, setExists]       = useState(false)

  const [form, setForm] = useState({
    companyName:        '',
    description:        '',
    productType:        '',
    uniqueValueProp:    '',
    brandMission:       '',
    targetAudience:     '',
    customerPainPoints: '',
    toneOfVoice:        '',
    brandColors:        '',
    logoUrl:            '',
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabase()
        if (!supabase) return
        const { data: userData } = await supabase.auth.getUser()
        if (!userData.user) return
        const { data } = await supabase
          .from('brand_profiles')
          .select('company_name, description, product_type, unique_value_prop, brand_mission, target_audience, customer_pain_points, tone_of_voice, brand_colors, logo_url')
          .eq('user_id', userData.user.id)
          .maybeSingle()
        if (cancelled) return
        if (data) {
          setExists(true)
          setForm({
            companyName:        data.company_name        ?? '',
            description:        data.description         ?? '',
            productType:        data.product_type        ?? '',
            uniqueValueProp:    data.unique_value_prop   ?? '',
            brandMission:       data.brand_mission       ?? '',
            targetAudience:     data.target_audience     ?? '',
            customerPainPoints: data.customer_pain_points ?? '',
            toneOfVoice:        data.tone_of_voice       ?? '',
            brandColors:        data.brand_colors        ?? '',
            logoUrl:            data.logo_url            ?? '',
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  function update<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const logoDrop = useImageDrop({
    multiple: false,
    onFiles: files => uploadLogo(files[0]),
    disabled: uploading || saving,
  })

  async function uploadLogo(file: File) {
    if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5MB'); return }
    setUploading(true)
    setError('')
    try {
      const supabase = getSupabase()
      if (!supabase) throw new Error('Auth not ready')
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) throw new Error('Not signed in')
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/brand/upload-image', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Upload failed')
      if (!data.url) throw new Error('No URL returned')
      setForm(prev => ({ ...prev, logoUrl: data.url }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function save() {
    if (!form.companyName.trim()) { setError('Company name is required'); return }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const supabase = getSupabase()
      if (!supabase) throw new Error('Auth not ready')
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error('Not authenticated')

      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) throw new Error('Not authenticated')

      const res = await fetch('/api/brand/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          company_name:         form.companyName.trim(),
          description:          form.description.trim(),
          product_type:         form.productType.trim(),
          unique_value_prop:    form.uniqueValueProp.trim(),
          brand_mission:        form.brandMission.trim(),
          target_audience:      form.targetAudience.trim(),
          customer_pain_points: form.customerPainPoints.trim(),
          tone_of_voice:        form.toneOfVoice,
          brand_colors:         form.brandColors.trim(),
          logo_url:             form.logoUrl || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')

      setExists(true)
      setSuccess('Brand profile saved')
      setTimeout(() => setSuccess(''), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="content">
        <div className="page-head">
          <div className="page-meta">Settings</div>
          <h1 className="page-title">Brand <em>profile</em></h1>
        </div>
        <p style={{ color: 'var(--ink-mute)' }}>Loading…</p>
      </main>
    )
  }

  return (
    <main className="content">
      {/* Settings nav tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 28, borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        {['brand', 'account', 'billing', 'integrations'].map(s => (
          <a key={s} href={`/settings/${s}`} style={{
            padding: '8px 14px', fontSize: 13, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap',
            color: s === 'brand' ? 'var(--ink)' : 'var(--ink-mute)',
            borderBottom: s === 'brand' ? '2px solid var(--ink)' : '2px solid transparent',
            marginBottom: -1, transition: 'color 0.15s',
          }}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </a>
        ))}
      </div>

      <div className="page-head">
        <h1 className="page-title">Brand <em>profile</em></h1>
        <p className="page-sub">
          Everything you fill in here auto-populates the UGC builder and content calendar — no re-typing.
        </p>
      </div>

      <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {success && (
          <div style={{ background: 'rgba(47,122,78,0.08)', border: '1px solid var(--good)', color: 'var(--good)', padding: '10px 14px', borderRadius: 11, fontSize: 13 }}>
            ✓ {success}
          </div>
        )}
        {error && (
          <div style={{ background: 'rgba(184,58,53,0.08)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 11, fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Section 1: Identity */}
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="section-step-head" style={{ marginBottom: 0 }}>
            <span className="step-circle">1</span>
            <h3>Brand identity</h3>
          </div>

          {/* Logo */}
          <div className="form-row">
            <label className="form-label">Brand logo <span style={{ color: 'var(--ink-mute)', fontWeight: 400 }}>(optional)</span></label>
            <label {...logoDrop.dropzoneProps} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 16px', borderRadius: 11,
              border: `1.5px dashed ${logoDrop.isDragging ? 'var(--ink)' : 'var(--border-strong)'}`,
              background: logoDrop.isDragging ? 'var(--hover)' : 'var(--bg-elev)',
              cursor: uploading ? 'wait' : 'pointer',
              transition: 'background 120ms, border-color 120ms',
            }}>
              {form.logoUrl ? (
                <img src={form.logoUrl} alt="logo" style={{ width: 52, height: 52, objectFit: 'contain', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 52, height: 52, borderRadius: 8, background: 'var(--hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                </div>
              )}
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                  {uploading ? 'Uploading…' : form.logoUrl ? 'Click to replace' : 'Upload logo'}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--ink-mute)' }}>PNG · JPG · WEBP · ≤ 5MB</p>
              </div>
              <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f) }}
                disabled={uploading || saving} />
            </label>
          </div>

          <div className="form-row">
            <label className="form-label">Company / brand name</label>
            <input className="input" value={form.companyName}
              onChange={e => update('companyName', e.target.value)}
              placeholder="e.g. ContentFlow" disabled={saving} />
          </div>

          <div className="form-row">
            <label className="form-label">Brand description</label>
            <textarea className="textarea" rows={3} value={form.description}
              onChange={e => update('description', e.target.value)}
              placeholder="What your brand does and who it's for, in a sentence or two." disabled={saving} />
          </div>

          <div className="form-row">
            <label className="form-label">Product / service type</label>
            <input className="input" value={form.productType}
              onChange={e => update('productType', e.target.value)}
              placeholder="e.g. SaaS, E-commerce, Fitness, Consulting" disabled={saving} />
          </div>

          <div className="form-row">
            <label className="form-label">Brand colors <span style={{ color: 'var(--ink-mute)', fontWeight: 400 }}>(optional)</span></label>
            <input className="input" value={form.brandColors}
              onChange={e => update('brandColors', e.target.value)}
              placeholder="e.g. Cyan, White, Dark Gray" disabled={saving} />
          </div>
        </section>

        {/* Products — link to Product Studio */}
        <div style={{ padding: '16px 20px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 3 }}>Your products live in Product Studio</div>
            <p className="help" style={{ margin: 0 }}>Brand is your identity — logo, name, description, audience. Each individual product you sell lives in Product Studio, where you upload photos from every angle and generate AI shoots. Campaigns and the UGC builder pull products from there.</p>
          </div>
          <a href="/generate/products" style={{ flexShrink: 0, padding: '9px 16px', borderRadius: 10, background: 'var(--ink)', color: 'var(--on-ink)', fontSize: 13, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            Open Product Studio →
          </a>
        </div>

        {/* Section 2: Positioning */}
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="section-step-head" style={{ marginBottom: 0 }}>
            <span className="step-circle">2</span>
            <h3>Positioning</h3>
          </div>

          <div className="form-row">
            <label className="form-label">Unique value proposition</label>
            <textarea className="textarea" rows={3} value={form.uniqueValueProp}
              onChange={e => update('uniqueValueProp', e.target.value)}
              placeholder="What makes your brand different from competitors?" disabled={saving} />
          </div>

          <div className="form-row">
            <label className="form-label">Brand mission</label>
            <textarea className="textarea" rows={2} value={form.brandMission}
              onChange={e => update('brandMission', e.target.value)}
              placeholder="What's the larger purpose of your brand?" disabled={saving} />
          </div>

          <div className="form-row">
            <label className="form-label">Customer pain points</label>
            <textarea className="textarea" rows={3} value={form.customerPainPoints}
              onChange={e => update('customerPainPoints', e.target.value)}
              placeholder="What problems do your customers face that you solve?" disabled={saving} />
          </div>
        </section>

        {/* Section 3: Voice & Audience */}
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="section-step-head" style={{ marginBottom: 0 }}>
            <span className="step-circle">3</span>
            <h3>Voice &amp; audience</h3>
          </div>

          <div className="form-row">
            <label className="form-label">Target audience</label>
            <textarea className="textarea" rows={2} value={form.targetAudience}
              onChange={e => update('targetAudience', e.target.value)}
              placeholder="e.g. Busy founders in their 30s, indie creators, DTC brand managers" disabled={saving} />
            <p className="help">Helps our AI write hooks that resonate with your specific audience.</p>
          </div>

          <div className="form-row">
            <label className="form-label">Tone of voice</label>
            <select className="input" value={form.toneOfVoice} onChange={e => update('toneOfVoice', e.target.value)} disabled={saving} style={{ cursor: 'pointer' }}>
              <option value="">Select a tone…</option>
              <option value="professional">Professional & Corporate</option>
              <option value="friendly">Friendly & Approachable</option>
              <option value="humorous">Humorous & Playful</option>
              <option value="inspirational">Inspirational & Motivational</option>
              <option value="educational">Educational & Informative</option>
              <option value="luxury">Luxury & Sophisticated</option>
            </select>
            <p className="help">Guides every AI-generated script, caption, and headline.</p>
          </div>
        </section>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
            {exists ? 'Profile saved. Update anytime — changes apply immediately to new generations.' : 'No profile yet — fill it in to enable one-click prefill in the UGC builder.'}
          </p>
          <button type="button" onClick={save} disabled={saving} className="btn btn-primary"
            style={{ padding: '11px 22px', fontSize: 13.5, borderRadius: 10, whiteSpace: 'nowrap' }}>
            {saving ? 'Saving…' : exists ? 'Update brand' : 'Save brand'}
          </button>
        </div>
      </div>
    </main>
  )
}

