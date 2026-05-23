'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/auth'
import VoiceSettings from '@/components/VoiceSettings'
import VoicePreview from '@/components/VoicePreview'
import { Icon } from '@/components/Icons'
import { showSuccess, showError } from '@/lib/notifications'
import { useAutoSave } from '@/lib/useAutoSave'

export default function VoiceGeneratorPage() {
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [characterCount, setCharacterCount] = useState(0)
  const [creditBalance, setCreditBalance] = useState(200)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [creditsLoading, setCreditsLoading] = useState(true)
  const [formData, setFormData] = useState({
    text: '',
    voiceId: 'rachel',
    stability: 0.5,
    similarityBoost: 0.75,
  })

  useAutoSave(formData, {
    key: 'voiceGeneratorFormState',
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
    text: string
    voiceId: string
    stability: number
    similarityBoost: number
  }) => {
    setLoading(true)
    setError('')
    setAudioUrl(null)

    try {
      const supabase = getSupabase()
      if (!supabase) {
        throw new Error('Authentication failed')
      }

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session?.access_token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/content/generate/voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify(settings),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate voice')
      }

      const data = await response.json()
      setAudioUrl(data.audioUrl)
      setDuration(data.duration)
      setCharacterCount(data.characterCount)
      setCreditBalance(data.newBalance)
      showSuccess('Voiceover generated successfully', `${Math.ceil(data.duration / 60)}m ${Math.round(data.duration % 60)}s duration`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate voice'
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
          <span className="eyebrow">AI Voice Synthesis</span>
        </div>
        <h1 className="page-title">Create Natural <em>Voiceovers</em></h1>
        <p className="page-sub">Generate realistic voice narration for your videos and content. Choose from premium voices and customize the tone.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px' }}>
        {/* Form */}
        <div>
          <div className="section-head">
            <h2 className="section-title">Create Voiceover</h2>
          </div>

          <VoiceSettings
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
                <div style={{ textAlign: 'right' }}>
                  <span className="eyebrow" style={{ display: 'block', marginBottom: '6px' }}>Per Generation</span>
                  <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)' }}>150 credits</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Preview */}
        <div>
          {audioUrl ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div className="section-head">
                <h2 className="section-title">Your Voiceover</h2>
              </div>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '20px' }}>
                <audio src={audioUrl} controls style={{ width: '100%' }} />
                <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                  <div>
                    <span className="eyebrow" style={{ display: 'block', marginBottom: '4px' }}>Duration</span>
                    <p style={{ color: 'var(--ink)' }}>{Math.ceil(duration / 60)}m {Math.round(duration % 60)}s</p>
                  </div>
                  <div>
                    <span className="eyebrow" style={{ display: 'block', marginBottom: '4px' }}>Characters</span>
                    <p style={{ color: 'var(--ink)' }}>{characterCount.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : loading ? (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '4px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
              <p style={{ color: 'var(--ink)', fontSize: '14px', fontWeight: 600 }}>Creating your voiceover...</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎙️</div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>Ready to create?</h3>
              <p className="eyebrow">Write your script and generate voiceover</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
