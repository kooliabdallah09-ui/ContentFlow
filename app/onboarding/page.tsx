'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/auth'
import { ChevronRight, Sparkles } from 'lucide-react'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    companyName: '',
    description: '',
    targetAudience: '',
    toneOfVoice: '',
    voiceSamples: '',
  })

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) return

    supabase.auth.getUser().then((result: any) => {
      const authUser = result.data?.user
      if (!authUser) {
        router.push('/auth/signup')
      } else {
        setUser(authUser)
      }
    })
  }, [router])

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleNext = () => {
    if (step === 1 && !formData.companyName.trim()) {
      setError('Please enter your product/company name')
      return
    }
    if (step === 2 && !formData.description.trim()) {
      setError('Please describe your product/service')
      return
    }
    if (step === 3 && !formData.targetAudience.trim()) {
      setError('Please describe your target audience')
      return
    }
    if (step === 4 && !formData.toneOfVoice.trim()) {
      setError('Please select a tone of voice')
      return
    }

    setError('')
    if (step < 4) {
      setStep(step + 1)
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')

    try {
      const supabase = getSupabase()
      if (!supabase || !user) throw new Error('Not authenticated')

      const { data } = await supabase.auth.getSession()
      const token = data?.session?.access_token

      const response = await fetch('/api/onboarding/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          companyName: formData.companyName,
          description: formData.description,
          targetAudience: formData.targetAudience,
          toneOfVoice: formData.toneOfVoice,
          voiceSamples: formData.voiceSamples,
        }),
      })

      if (!response.ok) throw new Error('Failed to save profile')

      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete onboarding')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        * { font-family: 'Inter', sans-serif; }
        .glass-card { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1); }
        .input-glass { background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: white; transition: all 0.3s ease; }
        .input-glass::placeholder { color: rgba(255, 255, 255, 0.5); }
        .input-glass:focus { background: rgba(255, 255, 255, 0.1); border-color: rgba(0, 255, 0, 0.5); outline: none; box-shadow: 0 0 0 3px rgba(0, 255, 0, 0.1); }
        .input-glass option { background: #000; color: white; }
        .btn-primary { background: #00ff00; color: #000000; box-shadow: 0 8px 24px rgba(0, 255, 0, 0.25); transition: all 0.3s cubic-bezier(0.23, 1, 0.320, 1); font-weight: 700; border: none; }
        .btn-primary:hover:not(:disabled) { background: #00dd00; transform: translateY(-2px); box-shadow: 0 12px 32px rgba(0, 255, 0, 0.4); }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-secondary { background: transparent; border: 1px solid rgba(255, 255, 255, 0.2); color: white; transition: all 0.3s ease; }
        .btn-secondary:hover { background: rgba(255, 255, 255, 0.05); border-color: rgba(255, 255, 255, 0.4); }
        .tone-option { position: relative; cursor: pointer; transition: all 0.3s ease; }
        .tone-option input[type="radio"] { appearance: none; position: absolute; width: 20px; height: 20px; accent-color: #00ff00; }
        .tone-option:has(input:checked) { background: rgba(0, 255, 0, 0.15); border-color: #00ff00; }
      `}</style>

      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-2xl">
          {/* Progress Indicator */}
          <div className="mb-12">
            <div className="flex gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 flex-1 rounded-full transition ${
                    s <= step ? 'bg-green-400' : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-white/60 uppercase tracking-wider font-600">Step {step} of 5</p>
          </div>

          {/* Card */}
          <div className="glass-card rounded-2xl p-8 md:p-12 mb-6">
            {/* Step 1: Welcome */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-6 h-6 text-green-400" />
                    <span className="text-xs font-600 text-green-400 uppercase tracking-wider">Brand Setup</span>
                  </div>
                  <h2 className="text-5xl font-black text-white mb-3">
                    Let's build your brand profile
                  </h2>
                  <p className="text-white/60 text-lg">
                    This information will be used by our AI to create personalized content that matches your voice and audience.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3 py-6">
                  {['Brand Info', 'Products', 'Audience'].map((item, i) => (
                    <div key={i} className="bg-white/5 p-3 rounded-lg text-center">
                      <div className="text-xs text-white/60">{item}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Company */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-4xl font-black text-white mb-2">
                    What's your company called? 🏢
                  </h2>
                  <p className="text-white/60 text-lg">
                    This helps personalize all the content we generate.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-600 text-white/80 mb-3">Company/Product Name</label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => handleInputChange('companyName', e.target.value)}
                    placeholder="e.g., TechStartup, Coffee Roasters, Fitness App"
                    className="input-glass w-full px-4 py-3 rounded-lg text-sm"
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="rounded-lg bg-red-900/20 p-4 border border-red-800/50">
                    <p className="text-sm font-600 text-red-300">{error}</p>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Description */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-4xl font-black text-white mb-2">
                    What do you do? 📝
                  </h2>
                  <p className="text-white/60 text-lg">
                    Describe your product, service, or business.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-600 text-white/80 mb-3">Product/Service Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="What do you do? What problem do you solve? What makes you unique?"
                    className="input-glass w-full px-4 py-3 rounded-lg text-sm resize-none"
                    rows={5}
                  />
                </div>

                {error && (
                  <div className="rounded-lg bg-red-900/20 p-4 border border-red-800/50">
                    <p className="text-sm font-600 text-red-300">{error}</p>
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Target Audience */}
            {step === 4 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-4xl font-black text-white mb-2">
                    Who's your audience? 👥
                  </h2>
                  <p className="text-white/60 text-lg">
                    The more specific, the better we can tailor content.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-600 text-white/80 mb-3">Target Audience</label>
                  <textarea
                    value={formData.targetAudience}
                    onChange={(e) => handleInputChange('targetAudience', e.target.value)}
                    placeholder="e.g., Busy professionals aged 25-45, interested in productivity tools, value work-life balance"
                    className="input-glass w-full px-4 py-3 rounded-lg text-sm resize-none"
                    rows={5}
                  />
                </div>

                {error && (
                  <div className="rounded-lg bg-red-900/20 p-4 border border-red-800/50">
                    <p className="text-sm font-600 text-red-300">{error}</p>
                  </div>
                )}
              </div>
            )}

            {/* Step 5: Brand Voice */}
            {step === 5 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-4xl font-black text-white mb-2">
                    What's your brand voice? 🎨
                  </h2>
                  <p className="text-white/60 text-lg">
                    Choose the tone that best represents your brand.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-600 text-white/80 mb-4">Brand Voice</label>
                  <div className="space-y-3">
                    {['Professional & Authoritative', 'Casual & Friendly', 'Humorous & Witty', 'Educational & Helpful', 'Inspirational & Motivating'].map(
                      (tone) => (
                        <label
                          key={tone}
                          className="tone-option glass-card p-4 rounded-lg border border-white/10 flex items-center gap-3 hover:border-green-400/50"
                        >
                          <input
                            type="radio"
                            name="tone"
                            value={tone}
                            checked={formData.toneOfVoice === tone}
                            onChange={(e) =>
                              handleInputChange('toneOfVoice', e.target.value)
                            }
                          />
                          <span className="font-500 text-white">{tone}</span>
                        </label>
                      )
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-600 text-white/80 mb-3">Voice Samples (Optional)</label>
                  <textarea
                    value={formData.voiceSamples}
                    onChange={(e) => handleInputChange('voiceSamples', e.target.value)}
                    placeholder="Paste examples of content or writing samples that reflect your brand voice"
                    className="input-glass w-full px-4 py-3 rounded-lg text-sm resize-none"
                    rows={3}
                  />
                </div>

                {error && (
                  <div className="rounded-lg bg-red-900/20 p-4 border border-red-800/50">
                    <p className="text-sm font-600 text-red-300">{error}</p>
                  </div>
                )}
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 mt-8">
              {step > 1 && (
                <button
                  onClick={() => {
                    setStep(step - 1)
                    setError('')
                  }}
                  className="btn-secondary px-6 py-3 rounded-lg font-600 text-sm"
                >
                  ← Back
                </button>
              )}
              <button
                onClick={step === 5 ? handleSubmit : handleNext}
                disabled={loading}
                className="flex-1 btn-primary py-3 rounded-lg disabled:opacity-50 font-600 text-sm flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent"></div>
                    Setting up...
                  </>
                ) : (
                  <>
                    {step === 5 ? '🚀 Start Creating' : 'Next'}
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Skip Option */}
          {step === 5 && (
            <div className="text-center">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-white/60 hover:text-white/80 text-sm font-500 transition"
              >
                Skip for now →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
