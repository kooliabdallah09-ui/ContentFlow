'use client'

import { useEffect, useState } from 'react'
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
    tier: 'standard' | 'hero'
    duration: 4 | 8 | 12
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
    <div className="content">
      <div className="page-head">
        <div className="page-meta">
          <span className="dot" />
          <span className="eyebrow">Complete Product Marketing Kit</span>
        </div>
        <h1 className="page-title">Create UGC <em>Packages</em></h1>
        <p className="page-sub">Generate complete UGC packages with images, voiceovers, and videos all at once. Professional product marketing made simple.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px' }}>
        {/* Form */}
        <div>
          <div className="section-head">
            <h2 className="section-title">Create Package</h2>
          </div>

          <UGCPackageBuilder
            onGenerate={handleGenerate}
            isLoading={loading}
            creditBalance={creditBalance}
          />

          {/* Credit Balance */}
          {!creditsLoading && (
            <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span className="eyebrow" style={{ display: 'block', marginBottom: '6px' }}>Total Credits</span>
                  <p style={{ fontSize: '20px', fontWeight: 600, color: 'var(--accent)' }}>
                    {creditBalance}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Preview */}
        <div>
          <div className="section-head">
            <h2 className="section-title">Your Package</h2>
          </div>
          <UGCPackagePreview
            components={components}
            ugcType={ugcType}
            isLoading={loading}
            error={error}
            creditDeducted={creditDeducted}
          />
        </div>
      </div>
    </div>
  )
}
