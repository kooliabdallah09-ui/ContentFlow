'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/auth'

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
    if (step === 2 && !formData.targetAudience.trim()) {
      setError('Please describe your target audience')
      return
    }
    if (step === 3 && !formData.toneOfVoice.trim()) {
      setError('Please select a tone of voice')
      return
    }

    setError('')
    if (step < 4) {
      setStep(step + 1)
    }
  }

  const handleSubmit = async () => {
    if (!formData.description.trim()) {
      setError('Please describe your product/service')
      return
    }

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800&family=Inter:wght@300;400;500;600;700&display=swap');
        * { font-family: 'Inter', sans-serif; }
        .serif-headline { font-family: 'Fraunces', serif; font-weight: 700; }
        .glass-card { background: rgba(255, 255, 255, 0.45); backdrop-filter: blur(8px); border: 1px solid rgba(255, 255, 255, 0.6); }
        .input-glass { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(8px); border: 1px solid rgba(255, 255, 255, 0.4); }
        .input-glass:focus { background: rgba(255, 255, 255, 0.9); border-color: rgba(59, 130, 246, 0.5); outline: none; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
        .btn-primary { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); box-shadow: 0 10px 25px rgba(59, 130, 246, 0.2); transition: all 0.3s ease; }
        .btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 15px 40px rgba(59, 130, 246, 0.35); }
      `}</style>

      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-2xl">
          {/* Progress Indicator */}
          <div className="mb-8">
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((s) => (
                <div
                  key={s}
                  className={`h-1 flex-1 rounded-full transition ${
                    s <= step ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                />
              ))}
            </div>
            <p className="text-sm text-slate-600 mt-3">Step {step} of 4</p>
          </div>

          {/* Card */}
          <div className="glass-card rounded-2xl p-8 md:p-10">
            {/* Step 1: Company */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="serif-headline text-4xl text-slate-900 mb-2">
                    Welcome to ContentFlow! 👋
                  </h2>
                  <p className="text-slate-600 text-lg">
                    Let's set up your profile. First, what's your product or company called?
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-600 text-slate-700 mb-3">
                    Product/Company Name
                  </label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => handleInputChange('companyName', e.target.value)}
                    placeholder="e.g., TechStartup, Coffee Roasters, Fitness App"
                    className="input-glass w-full px-4 py-3 rounded-lg text-sm"
                  />
                </div>

                {error && (
                  <div className="rounded-lg bg-red-50 p-3 border border-red-200">
                    <p className="text-sm font-600 text-red-800">{error}</p>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Target Audience */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="serif-headline text-4xl text-slate-900 mb-2">
                    Who are your customers? 👥
                  </h2>
                  <p className="text-slate-600 text-lg">
                    Tell us about your target audience.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-600 text-slate-700 mb-3">
                    Target Audience
                  </label>
                  <textarea
                    value={formData.targetAudience}
                    onChange={(e) => handleInputChange('targetAudience', e.target.value)}
                    placeholder="e.g., Busy professionals aged 25-45, interested in productivity tools"
                    className="input-glass w-full px-4 py-3 rounded-lg text-sm"
                    rows={4}
                  />
                </div>

                {error && (
                  <div className="rounded-lg bg-red-50 p-3 border border-red-200">
                    <p className="text-sm font-600 text-red-800">{error}</p>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Tone */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="serif-headline text-4xl text-slate-900 mb-2">
                    What's your brand tone? 🎨
                  </h2>
                  <p className="text-slate-600 text-lg">
                    How do you want to sound when communicating with your audience?
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-600 text-slate-700 mb-4">
                    Brand Voice
                  </label>
                  <div className="space-y-3">
                    {['Professional', 'Casual & Friendly', 'Humorous', 'Educational', 'Inspirational'].map(
                      (tone) => (
                        <label
                          key={tone}
                          className="flex items-center p-4 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition"
                        >
                          <input
                            type="radio"
                            name="tone"
                            value={tone}
                            checked={formData.toneOfVoice === tone}
                            onChange={(e) =>
                              handleInputChange('toneOfVoice', e.target.value)
                            }
                            className="w-4 h-4 rounded-full"
                          />
                          <span className="ml-3 font-500 text-slate-700">{tone}</span>
                        </label>
                      )
                    )}
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg bg-red-50 p-3 border border-red-200">
                    <p className="text-sm font-600 text-red-800">{error}</p>
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Description */}
            {step === 4 && (
              <div className="space-y-6">
                <div>
                  <h2 className="serif-headline text-4xl text-slate-900 mb-2">
                    Tell us more 📝
                  </h2>
                  <p className="text-slate-600 text-lg">
                    Describe your product and anything else we should know.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-600 text-slate-700 mb-3">
                    Product Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="What do you do? What problem do you solve? What makes you unique?"
                    className="input-glass w-full px-4 py-3 rounded-lg text-sm"
                    rows={5}
                  />
                </div>

                <div>
                  <label className="block text-sm font-600 text-slate-700 mb-3">
                    Voice Samples (Optional)
                  </label>
                  <textarea
                    value={formData.voiceSamples}
                    onChange={(e) => handleInputChange('voiceSamples', e.target.value)}
                    placeholder="Paste examples of content or writing samples that reflect your brand voice"
                    className="input-glass w-full px-4 py-3 rounded-lg text-sm"
                    rows={4}
                  />
                </div>

                {error && (
                  <div className="rounded-lg bg-red-50 p-3 border border-red-200">
                    <p className="text-sm font-600 text-red-800">{error}</p>
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
                  className="flex-1 border border-slate-300 text-slate-700 py-3 rounded-lg hover:bg-slate-50 font-600 text-sm transition"
                >
                  ← Back
                </button>
              )}
              <button
                onClick={step === 4 ? handleSubmit : handleNext}
                disabled={loading}
                className="flex-1 btn-primary text-white py-3 rounded-lg disabled:opacity-50 font-600 text-sm"
              >
                {loading
                  ? '⏳ Setting up...'
                  : step === 4
                    ? '🎉 Start Creating'
                    : 'Next →'}
              </button>
            </div>
          </div>

          {/* Skip Option */}
          <p className="text-center text-sm text-slate-600 mt-4">
            {step === 4 && (
              <button
                onClick={() => router.push('/dashboard')}
                className="text-blue-600 hover:text-blue-700 font-600"
              >
                Skip for now
              </button>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
