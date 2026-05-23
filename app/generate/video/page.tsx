'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/auth'
import VideoSettings from '@/components/VideoSettings'
import VideoPreview from '@/components/VideoPreview'
import { Icon } from '@/components/Icons'
import { showSuccess, showError } from '@/lib/notifications'
import { useAutoSave } from '@/lib/useAutoSave'

export default function VideoGeneratorPage() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [creditBalance, setCreditBalance] = useState(200)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [creditsLoading, setCreditsLoading] = useState(true)
  const [formData, setFormData] = useState({
    script: '',
    avatarId: 'sarah',
    voiceId: 'rachel',
  })

  useAutoSave(formData, {
    key: 'videoGeneratorFormState',
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
    script: string
    avatarId: string
    voiceId: string
  }) => {
    setLoading(true)
    setError('')
    setVideoUrl(null)

    try {
      const supabase = getSupabase()
      if (!supabase) {
        throw new Error('Authentication failed')
      }

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session?.access_token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/content/generate/video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify(settings),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate video')
      }

      const data = await response.json()
      setVideoUrl(data.videoUrl)
      setDuration(data.duration)
      setCreditBalance(data.newBalance)
      showSuccess('Video generated successfully', `${Math.ceil(data.duration / 60)}m ${Math.round(data.duration % 60)}s duration`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate video'
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
          <span className="eyebrow">AI-Powered Video Creation</span>
        </div>
        <h1 className="page-title">Create Professional <em>Videos</em></h1>
        <p className="page-sub">Generate UGC videos with AI avatars. Write a script and let the AI create realistic, engaging content.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px' }}>
        {/* Form */}
        <div>
          <div className="section-head">
            <h2 className="section-title">Create Video</h2>
          </div>

          <VideoSettings
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
                  <span className="eyebrow" style={{ display: 'block', marginBottom: '6px' }}>Per Video</span>
                  <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)' }}>300 credits</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Preview */}
        <div>
          {videoUrl ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div className="section-head">
                <h2 className="section-title">Your Video</h2>
              </div>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
                <video src={videoUrl} controls style={{ width: '100%', display: 'block' }} />
                <div style={{ padding: '16px' }}>
                  <span className="eyebrow" style={{ display: 'block', marginBottom: '4px' }}>Duration</span>
                  <p style={{ color: 'var(--ink)', fontSize: '14px' }}>{Math.ceil(duration / 60)}m {Math.round(duration % 60)}s</p>
                </div>
              </div>
            </div>
          ) : loading ? (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '4px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
              <p style={{ color: 'var(--ink)', fontSize: '14px', fontWeight: 600 }}>Creating your video...</p>
              <p className="eyebrow" style={{ marginTop: '6px' }}>This usually takes 1-2 minutes</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎬</div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>Ready to create?</h3>
              <p className="eyebrow">Write your script and select avatar to generate</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
