'use client'

import { useState, useEffect } from 'react'
import { getSupabase } from '@/lib/auth'
import { Icon } from '@/components/Icons'

export default function BrandSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [brandProfile, setBrandProfile] = useState<any>(null)

  const [formData, setFormData] = useState({
    companyName: '',
    description: '',
    targetAudience: '',
    toneOfVoice: '',
    voiceSamples: '',
  })

  useEffect(() => {
    loadBrandProfile()
  }, [])

  const loadBrandProfile = async () => {
    try {
      const supabase = getSupabase()
      if (!supabase) return

      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return

      const { data: profiles } = await supabase
        .from('brand_profiles')
        .select('*')
        .eq('user_id', userData.user.id)
        .order('created_at', { ascending: false })
        .limit(1)

      const data = profiles?.[0]
      if (data) {
        setBrandProfile(data)
        setFormData({
          companyName: data.company_name || '',
          description: data.description || '',
          targetAudience: data.target_audience || '',
          toneOfVoice: data.tone_of_voice || '',
          voiceSamples: data.voice_samples?.join('\n') || '',
        })
      }
    } catch (err) {
      console.error('Failed to load brand profile:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSave = async () => {
    if (!formData.companyName.trim()) {
      setError('Company name is required')
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

      const voiceSamplesArray = formData.voiceSamples
        .split('\n')
        .filter((s) => s.trim())

      if (brandProfile?.id) {
        const { error: updateError } = await supabase
          .from('brand_profiles')
          .update({
            company_name: formData.companyName,
            description: formData.description,
            target_audience: formData.targetAudience,
            tone_of_voice: formData.toneOfVoice,
            voice_samples: voiceSamplesArray,
            updated_at: new Date().toISOString(),
          })
          .eq('id', brandProfile.id)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('brand_profiles')
          .insert({
            user_id: userData.user.id,
            company_name: formData.companyName,
            description: formData.description,
            target_audience: formData.targetAudience,
            tone_of_voice: formData.toneOfVoice,
            voice_samples: voiceSamplesArray,
          })

        if (insertError) throw insertError
      }

      setSuccess('Brand profile saved successfully')
      await loadBrandProfile()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="content">
        <div className="page-head">
          <h1 className="page-title">Brand <em>Settings</em></h1>
        </div>
        <div style={{ opacity: 0.5 }}>Loading...</div>
      </div>
    )
  }

  return (
    <div className="content">
      <div className="page-head">
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px', overflowX: 'auto' }}>
          <a href="/settings/brand" style={{ padding: '8px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--accent)', borderBottom: '2px solid var(--accent)', textDecoration: 'none', whiteSpace: 'nowrap' }}>Brand</a>
          <a href="/settings/account" style={{ padding: '8px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--ink-dim)', textDecoration: 'none', whiteSpace: 'nowrap' }}>Account</a>
          <a href="/settings/billing" style={{ padding: '8px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--ink-dim)', textDecoration: 'none', whiteSpace: 'nowrap' }}>Billing</a>
          <a href="/settings/integrations" style={{ padding: '8px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--ink-dim)', textDecoration: 'none', whiteSpace: 'nowrap' }}>Integrations</a>
        </div>
        <h1 className="page-title">Brand <em>Settings</em></h1>
        <p className="page-sub">Manage your company profile and brand voice. This information personalizes all generated content.</p>
      </div>

      <div className="brand-grid">
        <div className="brand-card">
          {success && (
            <div style={{
              background: 'var(--good)',
              color: 'var(--accent-ink)',
              padding: '12px 14px',
              borderRadius: 'var(--r-sm)',
              marginBottom: '18px',
              fontSize: '13px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              ✓ {success}
            </div>
          )}

          {error && (
            <div style={{
              background: 'var(--danger)',
              color: 'white',
              padding: '12px 14px',
              borderRadius: 'var(--r-sm)',
              marginBottom: '18px',
              fontSize: '13px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              ✕ {error}
            </div>
          )}

          <div className="form-row">
            <label htmlFor="company" style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
              Company/Product Name <span style={{ color: 'var(--accent)' }}>*</span>
            </label>
            <input
              id="company"
              type="text"
              value={formData.companyName}
              onChange={(e) => handleInputChange('companyName', e.target.value)}
              placeholder="Your company or product name"
              className="input"
            />
            <span className="eyebrow" style={{ marginTop: '6px' }}>Used to maintain consistency across all generated content</span>
          </div>

          <div className="form-row">
            <label htmlFor="description" style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
              Product/Service Description <span style={{ color: 'var(--accent)' }}>*</span>
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="What do you do? What problem do you solve? What makes you unique?"
              className="textarea"
              rows={4}
            />
            <span className="eyebrow" style={{ marginTop: '6px' }}>Used in blog posts, social media, and email content</span>
          </div>

          <div className="form-row">
            <label htmlFor="audience" style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
              Target Audience <span style={{ color: 'var(--accent)' }}>*</span>
            </label>
            <textarea
              id="audience"
              value={formData.targetAudience}
              onChange={(e) => handleInputChange('targetAudience', e.target.value)}
              placeholder="e.g., Busy professionals aged 25-45, interested in productivity"
              className="textarea"
              rows={4}
            />
            <span className="eyebrow" style={{ marginTop: '6px' }}>Helps AI tailor messaging and tone to resonate with your audience</span>
          </div>

          <div className="form-row">
            <label htmlFor="tone" style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
              Brand Voice <span style={{ color: 'var(--accent)' }}>*</span>
            </label>
            <select
              id="tone"
              value={formData.toneOfVoice}
              onChange={(e) => handleInputChange('toneOfVoice', e.target.value)}
              className="select"
            >
              <option value="">Select a tone...</option>
              <option value="Professional & Authoritative">Professional & Authoritative</option>
              <option value="Casual & Friendly">Casual & Friendly</option>
              <option value="Humorous & Witty">Humorous & Witty</option>
              <option value="Educational & Helpful">Educational & Helpful</option>
              <option value="Inspirational & Motivating">Inspirational & Motivating</option>
            </select>
            <span className="eyebrow" style={{ marginTop: '6px' }}>Determines the writing style and personality of all generated content</span>
          </div>

          <div className="form-row">
            <label htmlFor="samples" style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
              Voice Samples <span style={{ color: 'var(--ink-fade)' }}>(Optional)</span>
            </label>
            <textarea
              id="samples"
              value={formData.voiceSamples}
              onChange={(e) => handleInputChange('voiceSamples', e.target.value)}
              placeholder="Paste examples of your writing that reflect your brand voice. One example per line."
              className="textarea"
              rows={4}
            />
            <span className="eyebrow" style={{ marginTop: '6px' }}>Real examples help the AI better understand and replicate your unique voice</span>
          </div>

          <div className="divider" style={{ margin: '18px 0' }} />

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleSave}
              disabled={saving || !formData.companyName.trim()}
              className="btn btn-primary"
              style={{ opacity: saving || !formData.companyName.trim() ? 0.6 : 1, cursor: saving || !formData.companyName.trim() ? 'not-allowed' : 'pointer' }}
            >
              <Icon.Settings style={{ width: 14, height: 14 }} />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={loadBrandProfile}
              className="btn btn-ghost"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="brand-card">
          <div className="eyebrow" style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}><Icon.Info style={{ width: 13, height: 13 }} /> How this is used</div>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <li style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.5 }}>✓ All content generators reference your brand profile</li>
            <li style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.5 }}>✓ Blog posts incorporate your company details and value prop</li>
            <li style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.5 }}>✓ Social media content matches your target audience</li>
            <li style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.5 }}>✓ Email campaigns use your brand voice</li>
            <li style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.5 }}>✓ Update anytime, future content reflects changes</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
