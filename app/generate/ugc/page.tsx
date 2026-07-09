'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { readPrefill } from '@/lib/calendar-prefill'
import { getSupabase } from '@/lib/auth'
import UGCPackageBuilder from '@/components/UGCPackageBuilder'
import UGCPackagePreview from '@/components/UGCPackagePreview'
import { Icon } from '@/components/Icons'
import { showSuccess, showError } from '@/lib/notifications'
import { useAutoSave } from '@/lib/useAutoSave'

interface UGCComponent {
  image?: { url: string; id: string }
  script?: string
  video?: {
    videoId?: string
    videoUrl?: string
    status: 'processing' | 'completed' | 'failed'
    estimatedDuration?: number
    duration?: number
  }
}

export default function UGCGeneratorPage() {
  const [components, setComponents] = useState<UGCComponent | null>(null)
  const [ugcType, setUgcType] = useState('')
  const [creditBalance, setCreditBalance] = useState(200)
  const [creditDeducted, setCreditDeducted] = useState<number | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [creditsLoading, setCreditsLoading] = useState(true)
  const [formData, setFormData] = useState({
    ugcType: 'image-with-voiceover',
    productName: '',
    productDescription: '',
    benefits: '',
    callToAction: '',
    style: 'realistic',
    imageSize: '1024x1024',
    avatarId: 'sarah',
    voiceId: 'rachel',
  })

  useAutoSave(formData, {
    key: 'ugcGeneratorFormState',
    onRestore: (data) => setFormData(data),
  })

  // Prefill from a Content Plan calendar entry via URL params
  // (?hook=...&format=...). This is used when clicking "Generate ↗" in the
  // dashboard's Content Intelligence panel.
  const searchParams = useSearchParams()
  useEffect(() => {
    const hook = searchParams?.get('hook')
    const format = searchParams?.get('format')
    if (!hook && !format) return
    setFormData(prev => ({
      ...prev,
      benefits: hook ? (prev.benefits ? `${hook}\n\n${prev.benefits}` : hook) : prev.benefits,
      // Stash the format id in callToAction so it makes it into the orchestrate
      // call. The script prompt reads it and shapes the script accordingly.
      callToAction: format && !prev.callToAction ? `[format:${format}]` : prev.callToAction,
    }))
  }, [searchParams])

  // Prefill from a calendar suggestion (Create now). Runs once on mount.
  // The calendar day's title becomes the topic-line, description becomes the
  // benefits/script hint — user can still edit before submitting.
  useEffect(() => {
    const suggestion = readPrefill('ugc')
    if (!suggestion) return
    setFormData(prev => ({
      ...prev,
      productName: prev.productName || suggestion.title.slice(0, 80),
      productDescription: prev.productDescription || suggestion.description,
      benefits: prev.benefits || suggestion.reason || suggestion.description,
    }))
  }, [])

  // Load credit balance
  useEffect(() => {
    const fetchCredits = async () => {
      try {
        const supabase = getSupabase()
        if (!supabase) {
          setCreditsLoading(false)
          return
        }

        const { data: sessionData } = await supabase.auth.getSession()
        if (!sessionData?.session?.access_token) {
          setCreditsLoading(false)
          return
        }

        const response = await fetch('/api/credits/balance', {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        }).catch(() => null)

        if (!response) {
          setCreditsLoading(false)
          return
        }

        if (response.ok) {
          const data = await response.json()
          setCreditBalance(data.balance)
        } else if (response.status === 404) {
          // Initialize credits
          const initResponse = await fetch('/api/credits/init', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${sessionData.session.access_token}`,
            },
            body: JSON.stringify({ plan: 'free' }),
          }).catch(() => null)

          if (initResponse?.ok) {
            const data = await initResponse.json()
            setCreditBalance(data.data.balance)
          }
        }
      } catch (err) {
        console.error('Failed to fetch credits:', err)
      } finally {
        setCreditsLoading(false)
      }
    }

    const timer = setTimeout(() => {
      fetchCredits()
    }, 500)

    return () => clearTimeout(timer)
  }, [])

  const handleGenerate = async (settings: {
    ugcType: string
    tier: 'standard'
    duration: 5 | 10 | 15 | 20
    productName: string
    productDescription: string
    benefits: string
    callToAction: string
    style: string
    imageSize: string
    voiceId: string
    productImageBase64?: string
    productImageMimeType?: string
    selectedHook?: string
    character?: import('@/components/CharacterBuilder').CharacterProfile
    customInstructions?: string
    language?: string
    aspect?: 'portrait' | 'square' | 'landscape'
    prewrittenScript?: string
  }) => {
    setLoading(true)
    setError('')
    setComponents(null)
    setCreditDeducted(undefined)

    try {
      const supabase = getSupabase()
      if (!supabase) {
        throw new Error('Authentication failed')
      }

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session?.access_token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/ugc/orchestrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify(settings),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate UGC package')
      }

      const data = await response.json()
      setComponents(data.components)
      setUgcType(settings.ugcType)
      setCreditBalance(data.newBalance)
      setCreditDeducted(data.creditDeducted)
      showSuccess('UGC package generated successfully', 'Complete package ready to use')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate UGC package'
      setError(errorMessage)
      showError('Generation failed', errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ maxWidth: 1140, margin: '0 auto', padding: '36px 40px 90px' }} className="ugc-page">
      <div style={{ marginBottom: 28 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 9,
          fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'var(--ink-fade)',
        }}>
          <span style={{
            background: 'var(--ink)', color: 'var(--on-ink)', borderRadius: 5,
            padding: '2px 7px', letterSpacing: '0.04em',
          }}>Flagship</span>
          UGC Package
        </div>
        <h1 style={{
          fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 42,
          lineHeight: 1.05, letterSpacing: '-0.01em', margin: '13px 0 0',
        }}>
          Build a <span style={{ fontStyle: 'italic' }}>UGC ad</span>.
        </h1>
        <p style={{
          fontSize: 14.5, color: 'var(--ink-dim)', margin: '10px 0 0',
          maxWidth: 520, lineHeight: 1.55,
        }}>
          One product photo in, a finished talking-head UGC ad out — script, character, and native synced voice, generated in about 2 minutes.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 344px', gap: 32, alignItems: 'start' }} className="ugc-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <UGCPackageBuilder
            onGenerate={handleGenerate}
            isLoading={loading}
            creditBalance={creditBalance}
          />
        </div>

        <aside style={{ position: 'sticky', top: 20, display: 'flex', flexDirection: 'column', gap: 14 }} className="ugc-aside">
          <UGCPackagePreview
            components={components}
            ugcType={ugcType}
            isLoading={loading}
            error={error}
            creditDeducted={creditDeducted}
          />
        </aside>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .ugc-page { padding: 20px 16px 90px !important; }
          .ugc-grid { grid-template-columns: 1fr !important; gap: 20px !important; }
          .ugc-aside { position: static !important; }
        }
      `}</style>
    </main>
  )
}
