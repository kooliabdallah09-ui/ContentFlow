'use client'

import { useState } from 'react'
import { getSupabase } from '@/lib/auth'
import { ChevronRight, ChevronLeft, Loader } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { DailySuggestion } from '@/lib/planner'
import { showSuccess, showError } from '@/lib/notifications'

type Step = 'info' | 'preferences' | 'review'

const INDUSTRIES = [
  'E-commerce',
  'SaaS/Software',
  'Agency',
  'Fitness/Wellness',
  'Fashion',
  'Food/Beverage',
  'Education',
  'Entertainment',
  'Consulting',
  'Other',
]

const FREQUENCIES = [
  { value: 'light', label: '2-3 posts/week', icon: '⏱️' },
  { value: 'moderate', label: '4-5 posts/week', icon: '📊' },
  { value: 'heavy', label: '6-7 posts/week', icon: '⚡' },
]

export default function OnboardingPlanPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('info')
  const [loading, setLoading] = useState(false)
  const [generatedPlan, setGeneratedPlan] = useState<DailySuggestion[]>([])

  // Step 1: Basic Info
  const [companyName, setCompanyName] = useState('')
  const [industry, setIndustry] = useState('')

  // Step 2: Preferences
  const [audience, setAudience] = useState('')
  const [platforms, setPlatforms] = useState<string[]>([])
  const [frequency, setFrequency] = useState('moderate')

  const handlePlatformToggle = (platform: string) => {
    setPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    )
  }

  const handleGeneratePlan = async () => {
    if (!industry || !audience || platforms.length === 0) {
      showError('Missing Information', 'Please fill in all fields')
      return
    }

    setLoading(true)
    try {
      const supabase = getSupabase()
      if (!supabase) throw new Error('Auth failed')

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session?.access_token) throw new Error('Not authenticated')

      const response = await fetch('/api/planner/generate-monthly-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          industry,
          audience,
          platforms,
          frequency,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate plan')
      }

      const data = await response.json()
      setGeneratedPlan(data.plan)
      setStep('review')
    } catch (err) {
      console.error('Error generating plan:', err)
      showError('Generation Failed', 'Could not create your monthly plan')
    } finally {
      setLoading(false)
    }
  }

  const handleCompletePlan = async () => {
    try {
      const supabase = getSupabase()
      if (!supabase) throw new Error('Auth failed')

      // Save company name to user metadata
      await supabase.auth.updateUser({
        data: { company_name: companyName },
      })

      showSuccess('All Set!', 'Your monthly plan is ready')
      router.push('/dashboard')
    } catch (err) {
      console.error('Error completing onboarding:', err)
      showError('Error', 'Failed to complete setup')
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Top Progress Bar */}
      <div className="border-b border-white/10 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-black">Set Up Your Content Plan</h1>
            <div className="text-sm text-white/60">
              Step {step === 'info' ? 1 : step === 'preferences' ? 2 : 3} of 3
            </div>
          </div>
          <div className="w-full bg-white/10 rounded-full h-1">
            <div
              className="bg-cyan-500 h-1 rounded-full transition-all"
              style={{
                width:
                  step === 'info' ? '33%' : step === 'preferences' ? '66%' : '100%',
              }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Step 1: Basic Info */}
        {step === 'info' && (
          <div className="space-y-8">
            <div>
              <label className="block text-sm text-white/60 mb-3">
                What's your company name?
              </label>
              <input
                type="text"
                placeholder="e.g., Acme Corp"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50 text-lg"
              />
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-3">
                What industry are you in?
              </label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 text-lg"
              >
                <option value="">Select an industry...</option>
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-8">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex-1 px-4 py-3 rounded-lg border border-white/20 text-white font-medium hover:bg-white/5 transition-colors"
              >
                Skip
              </button>
              <button
                onClick={() => setStep('preferences')}
                disabled={!companyName || !industry}
                className="flex-1 px-4 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Preferences */}
        {step === 'preferences' && (
          <div className="space-y-8">
            <div>
              <label className="block text-sm text-white/60 mb-3">
                Who's your target audience?
              </label>
              <textarea
                placeholder="e.g., Small business owners, 25-45 years old, looking for productivity tools"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50 text-lg min-h-20"
              />
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-4">
                Which platforms do you use?
              </label>
              <div className="grid grid-cols-2 gap-3">
                {['Instagram', 'TikTok', 'LinkedIn', 'Twitter', 'Facebook', 'YouTube'].map((platform) => (
                  <button
                    key={platform}
                    onClick={() => handlePlatformToggle(platform)}
                    className={`px-4 py-3 rounded-lg border font-medium transition-all ${
                      platforms.includes(platform)
                        ? 'bg-cyan-600 border-cyan-600 text-white'
                        : 'border-white/20 text-white/70 hover:border-white/40'
                    }`}
                  >
                    {platform}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-4">
                How often do you want to post?
              </label>
              <div className="space-y-2">
                {FREQUENCIES.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFrequency(opt.value)}
                    className={`w-full px-4 py-3 rounded-lg border font-medium transition-all text-left flex items-center gap-3 ${
                      frequency === opt.value
                        ? 'bg-cyan-600 border-cyan-600 text-white'
                        : 'border-white/20 text-white/70 hover:border-white/40'
                    }`}
                  >
                    <span className="text-xl">{opt.icon}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-8">
              <button
                onClick={() => setStep('info')}
                className="flex-1 px-4 py-3 rounded-lg border border-white/20 text-white font-medium hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={handleGeneratePlan}
                disabled={!audience || platforms.length === 0 || loading}
                className="flex-1 px-4 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    Generate Plan <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review Plan */}
        {step === 'review' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-black mb-4">Your 30-Day Content Plan</h2>
              <p className="text-white/60 mb-6">
                We've created a customized content plan for you. Review the suggestions below, then start creating!
              </p>

              {/* Calendar Preview */}
              <div className="grid grid-cols-7 gap-2 mb-8">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="text-center text-xs text-white/60 font-semibold mb-2">
                    {day}
                  </div>
                ))}

                {generatedPlan.map((suggestion, idx) => {
                  const date = new Date(suggestion.date)
                  const isFirstDay = idx === 0
                  const firstDayOfWeek = new Date(suggestion.date).getDay()

                  // Add empty cells for days before the first day
                  const cells = []
                  if (isFirstDay) {
                    for (let i = 0; i < firstDayOfWeek; i++) {
                      cells.push(
                        <div key={`empty-${i}`} className="aspect-square" />
                      )
                    }
                  }

                  return (
                    <div
                      key={suggestion.date}
                      className="aspect-square bg-white/5 border border-white/10 rounded-lg p-2 flex items-center justify-center text-center hover:bg-white/10 transition-colors"
                    >
                      <div>
                        <div className="text-xl">{suggestion.icon}</div>
                        <div className="text-xs text-white/60">{date.getDate()}</div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Sample Days */}
              <div className="space-y-3 mb-8">
                <h3 className="font-semibold text-white/80">Sample Days:</h3>
                {generatedPlan.slice(0, 3).map((day) => (
                  <div
                    key={day.date}
                    className="p-4 rounded-lg bg-white/5 border border-white/10"
                  >
                    <div className="flex gap-3">
                      <span className="text-2xl">{day.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white">
                          {day.day}, {day.title}
                        </p>
                        <p className="text-sm text-white/60 mt-1">{day.description}</p>
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {day.platforms.map((p) => (
                            <span
                              key={p}
                              className="text-xs px-2 py-1 bg-cyan-600/20 text-cyan-300 rounded"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-white/50 text-center">
                ...and {Math.max(0, generatedPlan.length - 3)} more days in your plan
              </p>
            </div>

            <div className="flex gap-3 pt-8">
              <button
                onClick={() => setStep('preferences')}
                className="flex-1 px-4 py-3 rounded-lg border border-white/20 text-white font-medium hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={handleCompletePlan}
                className="flex-1 px-4 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                Let's Start! <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
