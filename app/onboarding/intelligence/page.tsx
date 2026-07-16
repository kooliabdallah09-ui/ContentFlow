'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/auth'
import { showError } from '@/lib/notifications'
import { Loader2 } from 'lucide-react'

const GOALS = [
  { id: 'brand_awareness',   label: 'Brand awareness',    desc: 'Get seen by more people in my niche' },
  { id: 'drive_sales',       label: 'Drive sales',        desc: 'Turn views into buyers' },
  { id: 'build_community',   label: 'Build community',    desc: 'Grow a loyal audience' },
  { id: 'get_ugc_creators',  label: 'Get UGC creators',   desc: 'Attract creators to work with me' },
]

const STEPS = [
  { key: 'product', title: 'What are you selling or promoting?', placeholder: 'e.g. handmade skincare soaps, SaaS tool for freelancers, fitness coaching…' },
  { key: 'audience', title: 'Who is your target audience?', placeholder: 'e.g. women 25-40 who care about clean ingredients, indie devs shipping side projects…' },
  { key: 'goal', title: 'What is your primary goal?' },
] as const

export default function IntelligenceOnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState({ product: '', audience: '', goal: '' })
  const [phase, setPhase] = useState<'form' | 'profiling' | 'planning'>('form')
  const [aiFilling, setAiFilling] = useState(false)

  useEffect(() => {
    // If they've already completed onboarding, skip to the dashboard
    (async () => {
      const supabase = getSupabase()
      if (!supabase) return
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) return
      const res = await fetch('/api/intelligence/plan', { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const data = await res.json()
        if (data.hasProfile && data.plan) router.push('/dashboard?plan=ready')
      }
    })()
  }, [router])

  async function autofillFromBrand() {
    try {
      setAiFilling(true)
      const supabase = getSupabase()!
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) throw new Error('Not signed in')
      const res = await fetch('/api/intelligence/ai-fill', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'AI fill failed')
      const a = data.answers ?? {}
      setAnswers({
        product: a.product ?? '',
        audience: a.audience ?? '',
        goal: a.goal ?? '',
      })
      // Jump to the last step so user just confirms.
      setStep(STEPS.length - 1)
    } catch (err) {
      showError('AI fill failed', err instanceof Error ? err.message : 'Fill out your brand first')
    } finally {
      setAiFilling(false)
    }
  }

  function next() {
    const currentKey = STEPS[step].key
    if (!answers[currentKey].trim()) return
    if (step < STEPS.length - 1) setStep(step + 1)
    else submit()
  }

  // Skip the rest of intelligence onboarding. Since the profile row + plan
  // both depend on all three answers being present, skipping any step means
  // we can't safely generate a calendar — so we route straight to the
  // dashboard without calling onboard / generate-plan.
  // The dashboard's ContentPlanSection already shows the "Start onboarding"
  // CTA when there's no profile, so the user gets a clean re-entry path.
  function skipIntelligence() {
    router.push('/dashboard?intel=skipped')
  }

  async function submit() {
    try {
      const supabase = getSupabase()!
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) throw new Error('Not signed in')

      setPhase('profiling')
      // If the user came from brand step 2, forward their platform + frequency
      // + format prefs so the profile row + plan generator can honour them.
      let prefs: unknown = null
      try {
        const raw = sessionStorage.getItem('cf-onboarding-prefs')
        if (raw) prefs = JSON.parse(raw)
      } catch {}
      const onb = await fetch('/api/intelligence/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ answers, prefs }),
      })
      if (!onb.ok) {
        const err = await onb.json()
        throw new Error(err.error || 'Onboarding failed')
      }

      setPhase('planning')
      // Plan generation is the slow step (Sonnet + trends can push past 60s).
      // If it fails, don't dump the user back to Step 3 — the brand +
      // intelligence rows are already saved, so send them to the dashboard
      // where the "Refresh trends" button retries plan gen without
      // re-answering the questionnaire.
      try {
        const plan = await fetch('/api/intelligence/generate-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({}),
        })
        if (!plan.ok) {
          const err = await plan.json().catch(() => ({}))
          console.warn('[intelligence] plan generation failed, routing to dashboard for retry:', err)
          showError('Almost there', 'Your profile was saved but the plan generation took too long. Hit "Refresh trends" on the dashboard to try again.')
          router.push('/dashboard?plan=pending&onboarded=1')
          return
        }
      } catch (planErr) {
        console.warn('[intelligence] plan generation threw, routing to dashboard for retry:', planErr)
        showError('Almost there', 'Your profile was saved but the plan generation timed out. Hit "Refresh trends" on the dashboard to try again.')
        router.push('/dashboard?plan=pending&onboarded=1')
        return
      }
      router.push('/dashboard?plan=ready&onboarded=1')
    } catch (err) {
      setPhase('form')
      showError('Error', err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  if (phase !== 'form') {
    return (
      <main style={{ maxWidth: 640, margin: '0 auto', padding: '120px 32px', textAlign: 'center' }}>
        <Loader2 size={32} className="animate-spin" style={{ marginBottom: 20 }} />
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 400, margin: '0 0 8px' }}>
          {phase === 'profiling' && 'Reading your niche…'}
          {phase === 'planning' && 'Building your 30-day plan…'}
        </h1>
        <p style={{ fontSize: 14.5, color: 'var(--ink-dim)', maxWidth: 460, margin: '0 auto', lineHeight: 1.6 }}>
          {phase === 'profiling' && 'Extracting your product profile and pulling real-time trend data from Google + Reddit.'}
          {phase === 'planning' && 'Scoring UGC formats, generating hooks, and structuring 30 days of content around what already works in your niche.'}
        </p>
      </main>
    )
  }

  const currentKey = STEPS[step].key
  const currentAnswer = answers[currentKey]
  const canProceed = currentAnswer.trim().length > 0
  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '80px 32px 40px' }}>
      {/* progress bar */}
      <div style={{ height: 3, borderRadius: 999, background: 'var(--surface)', marginBottom: 40, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${progress}%`, background: 'var(--ink)', transition: 'width 300ms' }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: 'var(--ink-dim)' }}>
          STEP {step + 1} OF {STEPS.length}
        </div>
        <button
          type="button"
          onClick={autofillFromBrand}
          disabled={aiFilling}
          style={{
            padding: '7px 14px', borderRadius: 8,
            border: '1px dashed var(--border)', background: 'var(--surface-2)',
            color: 'var(--ink)', fontSize: 12, fontWeight: 600,
            cursor: aiFilling ? 'wait' : 'pointer',
          }}
        >
          {aiFilling ? 'Filling…' : '✨ Fill from my brand'}
        </button>
      </div>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 34, fontWeight: 400, margin: '0 0 24px', letterSpacing: '-0.01em', lineHeight: 1.15 }}>
        {STEPS[step].title}
      </h1>

      {currentKey === 'goal' ? (
        <div style={{ display: 'grid', gap: 10, marginBottom: 24 }}>
          {GOALS.map(g => {
            const active = answers.goal === g.id
            return (
              <button
                key={g.id}
                onClick={() => setAnswers(a => ({ ...a, goal: g.id }))}
                style={{
                  textAlign: 'left',
                  padding: '16px 18px',
                  borderRadius: 14,
                  border: `1.5px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                  background: active ? 'var(--surface-2)' : 'var(--surface)',
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 3 }}>{g.label}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-dim)' }}>{g.desc}</div>
              </button>
            )
          })}
        </div>
      ) : (
        <textarea
          className="textarea"
          rows={4}
          value={currentAnswer}
          onChange={e => setAnswers(a => ({ ...a, [currentKey]: e.target.value }))}
          placeholder={('placeholder' in STEPS[step] ? STEPS[step].placeholder : '') as string}
          style={{ marginBottom: 24, fontSize: 15 }}
          autoFocus
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        {step > 0 ? (
          <button
            onClick={() => setStep(s => s - 1)}
            style={{
              padding: '12px 20px', borderRadius: 11,
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--ink)', fontSize: 14, cursor: 'pointer',
            }}
          >
            Back
          </button>
        ) : <div />}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={skipIntelligence}
            style={{
              padding: '12px 16px', borderRadius: 11,
              background: 'transparent', border: 'none',
              color: 'var(--ink-dim)', fontSize: 13.5, cursor: 'pointer',
              textDecoration: 'underline', textUnderlineOffset: 3,
            }}
          >
            Skip for now
          </button>
          <button
            onClick={next}
            disabled={!canProceed}
            style={{
              padding: '12px 28px', borderRadius: 11,
              background: 'var(--ink)', color: 'var(--on-ink)', border: 'none',
              fontSize: 14, fontWeight: 600, cursor: canProceed ? 'pointer' : 'not-allowed',
              opacity: canProceed ? 1 : 0.4,
            }}
          >
            {step === STEPS.length - 1 ? 'Generate my content plan →' : 'Continue →'}
          </button>
        </div>
      </div>
      <p style={{ marginTop: 16, fontSize: 12, color: 'var(--ink-mute)', textAlign: 'center' }}>
        Skipping means we can&apos;t build your 30-day content plan yet — you can come back and finish this from the dashboard whenever you&apos;re ready.
      </p>
    </main>
  )
}
