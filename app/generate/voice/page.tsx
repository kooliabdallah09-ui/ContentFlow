'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/auth'
import VoiceSettings from '@/components/VoiceSettings'
import VoicePreview from '@/components/VoicePreview'
import { Sparkles } from 'lucide-react'

export default function VoiceGeneratorPage() {
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [characterCount, setCharacterCount] = useState(0)
  const [creditBalance, setCreditBalance] = useState(200)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [creditsLoading, setCreditsLoading] = useState(true)

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
        if (!sessionData.session?.access_token) {
          setCreditsLoading(false)
          return
        }

        const response = await fetch('/api/credits/balance', {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        })

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
          })

          if (initResponse.ok) {
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

    fetchCredits()
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate voice')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        * { font-family: 'Inter', sans-serif; }

        .glass-card {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
      `}</style>

      {/* Header */}
      <div className="border-b border-white/10 bg-black/50 backdrop-blur-md py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/10 text-white px-4 py-2 rounded-full text-sm font-600 mb-4 border border-white/20">
            <Sparkles className="w-4 h-4" />
            AI Voice Synthesis
          </div>
          <h1 className="text-5xl font-black mb-3">Voice Generator</h1>
          <p className="text-white/60 text-lg max-w-2xl">
            Create realistic voiceovers with ElevenLabs. Choose from multiple voices and customize the tone.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-2 gap-8 p-8 max-w-7xl mx-auto h-[calc(100vh-320px)]">
        {/* Left: Settings */}
        <div className="glass-card rounded-2xl p-8 overflow-y-auto">
          <h2 className="text-2xl font-black mb-6">Create Voice</h2>
          <VoiceSettings
            onGenerate={handleGenerate}
            isLoading={loading}
            creditBalance={creditBalance}
          />

          {/* Credit Balance Display */}
          {!creditsLoading && (
            <div className="mt-8 pt-8 border-t border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/60">Total Credits</p>
                  <p className="text-2xl font-black text-cyan-400">
                    {creditBalance}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/50 mb-1">Each generation costs</p>
                  <p className="text-lg font-700 text-white">150 credits</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Preview */}
        <div className="glass-card rounded-2xl p-8 overflow-hidden flex flex-col">
          <h2 className="text-2xl font-black mb-6">Generated Voice</h2>
          <VoicePreview
            audioUrl={audioUrl}
            duration={duration}
            isLoading={loading}
            error={error}
            characterCount={characterCount}
          />
        </div>
      </div>
    </div>
  )
}
