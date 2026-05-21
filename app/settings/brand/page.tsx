'use client'

import { useState, useEffect } from 'react'
import { getSupabase } from '@/lib/auth'
import { Save, AlertCircle, CheckCircle } from 'lucide-react'

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

      const { data } = await supabase
        .from('brand_profiles')
        .select('*')
        .eq('user_id', userData.user.id)
        .single()

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
        // Update existing
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
        // Create new
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

      setSuccess('Brand profile updated successfully!')
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
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-white/10 rounded w-1/4"></div>
            <div className="h-40 bg-white/10 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { font-family: 'Inter', sans-serif; }
        .glass-card { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); }
        .input-glass { background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: white; transition: all 0.3s ease; }
        .input-glass::placeholder { color: rgba(255, 255, 255, 0.5); }
        .input-glass:focus { background: rgba(255, 255, 255, 0.1); border-color: rgba(0, 255, 0, 0.5); outline: none; box-shadow: 0 0 0 3px rgba(0, 255, 0, 0.1); }
        .btn-primary { background: #00ff00; color: #000000; transition: all 0.3s cubic-bezier(0.23, 1, 0.320, 1); font-weight: 700; border: none; }
        .btn-primary:hover:not(:disabled) { background: #00dd00; transform: translateY(-2px); }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>

      <div className="border-b border-white/10 bg-black/50 backdrop-blur-md py-12 px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-black mb-2">Brand Settings</h1>
          <p className="text-white/60">Manage your company profile and brand voice. This information is used to personalize all generated content.</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-12">
        <div className="glass-card rounded-2xl p-8 space-y-8">
          {/* Success Message */}
          {success && (
            <div className="rounded-lg bg-green-900/20 p-4 border border-green-800/50 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-600 text-green-300">{success}</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="rounded-lg bg-red-900/20 p-4 border border-red-800/50 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-600 text-red-300">{error}</p>
            </div>
          )}

          {/* Company Name */}
          <div>
            <label className="block text-sm font-600 text-white/80 mb-3">Company/Product Name *</label>
            <input
              type="text"
              value={formData.companyName}
              onChange={(e) => handleInputChange('companyName', e.target.value)}
              placeholder="Your company or product name"
              className="input-glass w-full px-4 py-3 rounded-lg text-sm"
            />
            <p className="text-xs text-white/50 mt-2">This is used to maintain consistency across all generated content.</p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-600 text-white/80 mb-3">Product/Service Description *</label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="What do you do? What problem do you solve? What makes you unique?"
              className="input-glass w-full px-4 py-3 rounded-lg text-sm resize-none"
              rows={4}
            />
            <p className="text-xs text-white/50 mt-2">Used in blog posts, social media, and email content to ensure accuracy.</p>
          </div>

          {/* Target Audience */}
          <div>
            <label className="block text-sm font-600 text-white/80 mb-3">Target Audience *</label>
            <textarea
              value={formData.targetAudience}
              onChange={(e) => handleInputChange('targetAudience', e.target.value)}
              placeholder="e.g., Busy professionals aged 25-45, interested in productivity"
              className="input-glass w-full px-4 py-3 rounded-lg text-sm resize-none"
              rows={4}
            />
            <p className="text-xs text-white/50 mt-2">Helps AI tailor messaging and tone to resonate with your audience.</p>
          </div>

          {/* Tone of Voice */}
          <div>
            <label className="block text-sm font-600 text-white/80 mb-3">Brand Voice *</label>
            <select
              value={formData.toneOfVoice}
              onChange={(e) => handleInputChange('toneOfVoice', e.target.value)}
              className="input-glass w-full px-4 py-3 rounded-lg text-sm"
            >
              <option value="">Select a tone...</option>
              <option value="Professional & Authoritative">Professional & Authoritative</option>
              <option value="Casual & Friendly">Casual & Friendly</option>
              <option value="Humorous & Witty">Humorous & Witty</option>
              <option value="Educational & Helpful">Educational & Helpful</option>
              <option value="Inspirational & Motivating">Inspirational & Motivating</option>
            </select>
            <p className="text-xs text-white/50 mt-2">Determines the writing style and personality of all generated content.</p>
          </div>

          {/* Voice Samples */}
          <div>
            <label className="block text-sm font-600 text-white/80 mb-3">Voice Samples (Optional)</label>
            <textarea
              value={formData.voiceSamples}
              onChange={(e) => handleInputChange('voiceSamples', e.target.value)}
              placeholder="Paste examples of your writing or content that reflect your brand voice. One example per line."
              className="input-glass w-full px-4 py-3 rounded-lg text-sm resize-none"
              rows={4}
            />
            <p className="text-xs text-white/50 mt-2">Real examples help the AI better understand and replicate your unique voice.</p>
          </div>

          {/* Save Button */}
          <div className="flex gap-3 pt-6 border-t border-white/10">
            <button
              onClick={handleSave}
              disabled={saving || !formData.companyName.trim()}
              className="btn-primary px-6 py-3 rounded-lg font-600 text-sm flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={loadBrandProfile}
              className="px-6 py-3 rounded-lg font-600 text-sm border border-white/20 text-white hover:bg-white/5 transition"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Info Card */}
        <div className="glass-card rounded-2xl p-6 mt-8">
          <h3 className="text-lg font-black mb-3 text-white">💡 How this information is used</h3>
          <ul className="space-y-2 text-sm text-white/70">
            <li>✓ All content generators reference your brand profile for consistency</li>
            <li>✓ Blog posts incorporate your company details and value proposition</li>
            <li>✓ Social media content matches your target audience and tone</li>
            <li>✓ Email campaigns use your brand voice and messaging</li>
            <li>✓ You can update this anytime, and future content will reflect the changes</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
