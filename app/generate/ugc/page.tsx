'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/auth'
import UGCPackageBuilder from '@/components/UGCPackageBuilder'
import UGCPackagePreview from '@/components/UGCPackagePreview'
import { Sparkles } from 'lucide-react'

interface UGCComponent {
  image?: { url: string; id: string }
  voice?: { url: string; duration: number }
  video?: { url: string; id: string; duration: number }
}

export default function UGCGeneratorPage() {
  const [components, setComponents] = useState<UGCComponent | null>(null)
  const [ugcType, setUgcType] = useState('')
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
    productName: string
    productDescription: string
    benefits: string
    callToAction: string
    style: string
    imageSize: string
    avatarId: string
    voiceId: string
  }) => {
    setLoading(true)
    setError('')
    setComponents(null)

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate UGC package')
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
            Complete UGC Solution
          </div>
          <h1 className="text-5xl font-black mb-3">UGC Package Generator</h1>
          <p className="text-white/60 text-lg max-w-2xl">
            Create complete UGC packages with images, voiceovers, and videos. Everything you need for professional product marketing.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-2 gap-8 p-8 max-w-7xl mx-auto h-[calc(100vh-320px)]">
        {/* Left: Builder */}
        <div className="glass-card rounded-2xl p-8 overflow-y-auto">
          <h2 className="text-2xl font-black mb-6">Create Your Package</h2>
          <UGCPackageBuilder
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
              </div>
            </div>
          )}
        </div>

        {/* Right: Preview */}
        <div className="glass-card rounded-2xl p-8 overflow-hidden flex flex-col">
          <h2 className="text-2xl font-black mb-6">Your UGC Package</h2>
          <UGCPackagePreview
            components={components}
            ugcType={ugcType}
            isLoading={loading}
            error={error}
          />
        </div>
      </div>
    </div>
  )
}
