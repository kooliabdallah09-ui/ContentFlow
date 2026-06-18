'use client'

import { useState, useEffect } from 'react'
import { getSupabase } from '@/lib/auth'

// Brand profile — single source of truth for product info that auto-populates
// the UGC builder when the user toggles "Use my brand profile".
//
// Field mapping to brand_profiles columns (no migration required):
//   company_name      → Product name
//   description       → One-line description
//   unique_value_prop → Key benefits
//   brand_mission     → Default call to action
//   target_audience   → Audience (used as context by Claude)
//   tone_of_voice     → Voice (used as context by Claude)

export default function BrandSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [exists, setExists] = useState(false)

  const [form, setForm] = useState({
    productName: '',
    description: '',
    keyBenefits: '',
    defaultCta: 'Try it today',
    targetAudience: '',
    toneOfVoice: '',
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
          .select('company_name, description, unique_value_prop, brand_mission, target_audience, tone_of_voice')
          .eq('user_id', userData.user.id)
          .maybeSingle()
        if (cancelled) return
        if (data) {
          setExists(true)
          setForm({
            productName: data.company_name ?? '',
            description: data.description ?? '',
            keyBenefits: data.unique_value_prop ?? '',
            defaultCta: data.brand_mission ?? 'Try it today',
            targetAudience: data.target_audience ?? '',
            toneOfVoice: data.tone_of_voice ?? '',
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

  async function save() {
    if (!form.productName.trim()) {
      setError('Product name is required')
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const supabase = getSupabase()
      if (!supabase) throw new Error('Supabase not available')
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error('Not authenticated')

      const payload = {
        user_id: userData.user.id,
        user_email: userData.user.email,
        company_name: form.productName.trim(),
        description: form.description.trim(),
        unique_value_prop: form.keyBenefits.trim(),
        brand_mission: form.defaultCta.trim() || 'Try it today',
        target_audience: form.targetAudience.trim(),
        tone_of_voice: form.toneOfVoice.trim(),
      }

      const res = await fetch('/api/brand/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
      <div className="page-head">
        <div className="page-meta">Settings</div>
        <h1 className="page-title">Brand <em>profile</em></h1>
        <p className="page-sub">
          Fill this in once. The UGC generator can auto-populate every field from here with one click —
          so you don&apos;t re-type your product name and benefits on every video.
        </p>
      </div>

      <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {success && (
          <div style={{
            background: 'rgba(47,122,78,0.08)', border: '1px solid var(--good)',
            color: 'var(--good)', padding: '10px 14px', borderRadius: 11, fontSize: 13,
          }}>✓ {success}</div>
        )}
        {error && (
          <div style={{
            background: 'rgba(184,58,53,0.08)', border: '1px solid var(--danger)',
            color: 'var(--danger)', padding: '10px 14px', borderRadius: 11, fontSize: 13,
          }}>{error}</div>
        )}

        {/* Product card — mirrors the UGC builder step 3 exactly */}
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="section-step-head" style={{ marginBottom: 0 }}>
            <span className="step-circle">1</span>
            <h3>Your product</h3>
          </div>

          <div className="form-row">
            <label className="form-label">Product name</label>
            <input className="input" value={form.productName}
              onChange={e => update('productName', e.target.value)}
              placeholder="e.g. ContentFlow" disabled={saving} />
          </div>

          <div className="form-row">
            <label className="form-label">One-line description</label>
            <textarea className="textarea" rows={3} value={form.description}
              onChange={e => update('description', e.target.value)}
              placeholder="What it is and who it's for, in a sentence." disabled={saving} />
          </div>

          <div className="form-row">
            <label className="form-label">Key benefits</label>
            <textarea className="textarea" rows={3} value={form.keyBenefits}
              onChange={e => update('keyBenefits', e.target.value)}
              placeholder="Save time · ships to all platforms · AI-powered" disabled={saving} />
          </div>

          <div className="form-row">
            <label className="form-label">Default call to action</label>
            <input className="input" value={form.defaultCta}
              onChange={e => update('defaultCta', e.target.value)}
              placeholder="e.g. Try it free today" disabled={saving} />
            <p className="help">Used as the default CTA when generating UGC — you can always override.</p>
          </div>
        </section>

        {/* Brand-level context */}
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="section-step-head" style={{ marginBottom: 0 }}>
            <span className="step-circle">2</span>
            <h3>Voice &amp; audience <span style={{ color: 'var(--ink-mute)', fontWeight: 400, fontSize: 12.5, marginLeft: 4 }}>(optional)</span></h3>
          </div>

          <div className="form-row">
            <label className="form-label">Target audience</label>
            <input className="input" value={form.targetAudience}
              onChange={e => update('targetAudience', e.target.value)}
              placeholder="e.g. busy moms in their 30s, indie SaaS founders" disabled={saving} />
            <p className="help">Helps Claude write hooks that resonate.</p>
          </div>

          <div className="form-row">
            <label className="form-label">Tone of voice</label>
            <input className="input" value={form.toneOfVoice}
              onChange={e => update('toneOfVoice', e.target.value)}
              placeholder="e.g. warm and direct, playful, expert-but-friendly" disabled={saving} />
            <p className="help">A short phrase Claude reads as priority context when writing your script.</p>
          </div>
        </section>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
            {exists ? 'This profile is saved. Update anytime.' : 'No profile yet — fill it in to enable one-click prefill.'}
          </p>
          <button type="button" onClick={save} disabled={saving} className="btn btn-primary"
            style={{ padding: '11px 22px', fontSize: 13.5, borderRadius: 10 }}>
            {saving ? 'Saving…' : exists ? 'Update brand' : 'Save brand'}
          </button>
        </div>
      </div>
    </main>
  )
}
