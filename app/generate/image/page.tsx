'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/auth'
import ImageSettings from '@/components/ImageSettings'
import ImagePreview from '@/components/ImagePreview'
import { Icon } from '@/components/Icons'
import { showSuccess, showError } from '@/lib/notifications'
import { useAutoSave } from '@/lib/useAutoSave'

export default function ImageGeneratorPage() {
  const [images, setImages] = useState<string[]>([])
  const [creditBalance, setCreditBalance] = useState(200)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [creditsLoading, setCreditsLoading] = useState(true)
  const [formData, setFormData] = useState({
    prompt: '',
    style: 'realistic',
    size: '1024x1024',
    quantity: 1,
  })

  useAutoSave(formData, {
    key: 'imageGeneratorFormState',
    onRestore: (data) => setFormData(data),
  })

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
    prompt: string
    style: string
    size: string
    quantity: number
  }) => {
    setLoading(true)
    setError('')
    setImages([])

    try {
      const supabase = getSupabase()
      if (!supabase) {
        throw new Error('Authentication failed')
      }

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session?.access_token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/content/generate/image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify(settings),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate image')
      }

      const data = await response.json()
      setImages(data.images)
      setCreditBalance(data.newBalance)
      showSuccess('Images generated successfully', `${settings.quantity} image(s) created`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate image'
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
          <span className="eyebrow">AI Image Generation</span>
        </div>
        <h1 className="page-title">Create Stunning <em>Images</em></h1>
        <p className="page-sub">Generate beautiful, high-quality images with advanced AI. Choose your style and let the AI create.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px' }}>
        {/* Form */}
        <div>
          <div className="section-head">
            <h2 className="section-title">Generate Image</h2>
          </div>

          <ImageSettings
            onGenerate={handleGenerate}
            isLoading={loading}
            creditBalance={creditBalance}
          />

          {/* Credit Balance */}
          {!creditsLoading && (
            <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <span className="eyebrow" style={{ display: 'block', marginBottom: '6px' }}>Your Credits</span>
                  <p style={{ fontSize: '20px', fontWeight: 600, color: creditBalance >= 5 ? 'var(--good)' : 'var(--danger)' }}>
                    {creditBalance}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="eyebrow" style={{ display: 'block', marginBottom: '6px' }}>Per Image</span>
                  <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--accent)' }}>5 credits</p>
                </div>
              </div>
              {creditBalance < 5 && (
                <div style={{ background: 'var(--danger)', color: 'white', padding: '8px 12px', borderRadius: 'var(--r-sm)', fontSize: '12px' }}>
                  Not enough credits. You need 5, have {creditBalance}.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Preview */}
        <div>
          {images.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div className="section-head">
                <h2 className="section-title">Generated Images</h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
                {images.map((image, idx) => (
                  <div key={idx} style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <img src={image} alt={`Generated image ${idx + 1}`} style={{ width: '100%', height: 'auto', display: 'block' }} />
                  </div>
                ))}
              </div>
            </div>
          ) : loading ? (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '4px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
              <p style={{ color: 'var(--ink)', fontSize: '14px', fontWeight: 600 }}>Creating your images...</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center', color: 'var(--ink-mute)' }}><Icon.Image style={{ width: 36, height: 36 }} /></div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>Ready to create?</h3>
              <p className="eyebrow">Describe your image and generate</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
