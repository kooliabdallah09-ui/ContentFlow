'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, Link2, ArrowRight, Lock } from 'lucide-react'

interface Integration {
  platform: string
  connected_at: string
}

// Real official logos from CDN
const PlatformLogo = ({ platform }: { platform: string }) => {
  const logoMap: Record<string, string> = {
    twitter: 'https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/x.svg',
    linkedin: 'https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/linkedin.svg',
    instagram: 'https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/instagram.svg',
    facebook: 'https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/facebook.svg',
    tiktok: 'https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/tiktok.svg',
  }

  return (
    <img
      src={logoMap[platform]}
      alt={platform}
      className="w-6 h-6 object-contain"
      loading="lazy"
    />
  )
}

const PLATFORMS = [
  { id: 'twitter', name: 'X (Twitter)', color: 'slate' },
  { id: 'instagram', name: 'Instagram', color: 'pink' },
  { id: 'facebook', name: 'Facebook', color: 'blue' },
  { id: 'linkedin', name: 'LinkedIn', color: 'blue', comingSoon: true },
  { id: 'tiktok', name: 'TikTok', color: 'tiktok', comingSoon: true },
]

export default function IntegrationsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    // Show message from redirect
    const success = searchParams.get('success')
    const error = searchParams.get('error')

    if (success === 'twitter_connected') {
      setMessage({ type: 'success', text: 'Twitter account connected successfully!' })
      fetchIntegrations()
    } else if (success === 'instagram') {
      setMessage({ type: 'success', text: 'Instagram account connected successfully!' })
      fetchIntegrations()
    } else if (success === 'facebook') {
      setMessage({ type: 'success', text: 'Facebook account connected successfully!' })
      fetchIntegrations()
    } else if (error) {
      const errorText = error === 'invalid_state' ? 'Security check failed. Please try again.' :
                        error === 'no_code' ? 'Authorization was not completed.' :
                        `Connection failed: ${error}`
      setMessage({ type: 'error', text: errorText })
    }

    // Clear message after 5 seconds
    if (success || error) {
      const timer = setTimeout(() => setMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [searchParams])

  const fetchIntegrations = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/integrations/status')
      const data = await response.json()
      setIntegrations(data.integrations || [])
    } catch (error) {
      console.error('Failed to fetch integrations:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchIntegrations()
  }, [])

  const handleConnect = (platform: string) => {
    if (platform === 'twitter') {
      window.location.href = '/api/integrations/twitter/connect'
    } else if (platform === 'instagram' || platform === 'facebook') {
      window.location.href = `/api/integrations/connect/${platform}`
    }
  }

  const handleDisconnect = async (platform: string) => {
    setDisconnecting(platform)
    try {
      const response = await fetch('/api/integrations/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      })

      if (response.ok) {
        setMessage({ type: 'success', text: `${platform} disconnected successfully` })
        fetchIntegrations()
      } else {
        setMessage({ type: 'error', text: 'Failed to disconnect' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Disconnection failed' })
    } finally {
      setDisconnecting(null)
    }
  }

  const isConnected = (platform: string) => {
    return integrations.some((i) => i.platform === platform)
  }

  const colorMap = {
    slate: 'text-slate-700',
    blue: 'text-blue-700',
    pink: 'text-pink-700',
    tiktok: 'text-black',
  }

  const bgColorMap = {
    slate: 'bg-slate-100',
    blue: 'bg-blue-100',
    pink: 'bg-pink-100',
    tiktok: 'bg-black/5',
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800&family=Inter:wght@300;400;500;600;700&display=swap');
        * { font-family: 'Inter', sans-serif; }
        .serif-headline { font-family: 'Fraunces', serif; font-weight: 700; }
        .btn-primary { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); box-shadow: 0 10px 25px rgba(59, 130, 246, 0.2); transition: all 0.3s ease; }
        .btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 15px 40px rgba(59, 130, 246, 0.35); }
      `}</style>

      {/* Header */}
      <div className="border-b border-slate-200 py-8 px-6">
        <div className="max-w-7xl mx-auto">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition mb-6">
            <ArrowRight className="w-4 h-4 rotate-180" />
            <span className="text-sm font-500">Back to Dashboard</span>
          </Link>
          <div>
            <h1 className="serif-headline text-4xl text-slate-900 mb-2">Integrations</h1>
            <p className="text-slate-600">
              Connect your accounts to publish content across multiple platforms
            </p>
          </div>
        </div>
      </div>

      <div className="p-8 max-w-7xl mx-auto">
        {/* Message Alert */}
        {message && (
          <div
            className={`mb-8 rounded-lg p-4 border flex items-start gap-3 ${
              message.type === 'success'
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <div className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5">✕</div>
            )}
            <p
              className={`text-sm font-500 ${
                message.type === 'success' ? 'text-green-800' : 'text-red-800'
              }`}
            >
              {message.text}
            </p>
          </div>
        )}

        {/* Integrations Grid */}
        <div className="mb-16">
          <h2 className="text-lg font-600 text-slate-900 mb-6">Available Integrations</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {PLATFORMS.map((platform) => {
              const connected = isConnected(platform.id)
              const colorClass = colorMap[platform.color as keyof typeof colorMap]
              const bgColorClass = bgColorMap[platform.color as keyof typeof bgColorMap]

              return (
                <div
                  key={platform.id}
                  className="border border-slate-200 rounded-lg p-6 hover:border-slate-300 hover:shadow-sm transition"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`${bgColorClass} rounded-lg p-3 w-fit flex items-center justify-center`}>
                      <div className={`w-6 h-6 ${colorClass}`}>
                        <PlatformLogo platform={platform.id} />
                      </div>
                    </div>
                    {platform.comingSoon && (
                      <span className="bg-slate-100 text-slate-700 text-xs font-600 px-2.5 py-1 rounded">
                        Coming soon
                      </span>
                    )}
                    {connected && (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    )}
                  </div>

                  <h3 className="font-600 text-slate-900 mb-1">{platform.name}</h3>
                  <p className="text-sm text-slate-600 mb-4">
                    {connected
                      ? 'Account connected and ready to publish'
                      : 'Connect your account to enable publishing'}
                  </p>

                  {connected ? (
                    <button
                      onClick={() => handleDisconnect(platform.id)}
                      disabled={disconnecting === platform.id}
                      className="w-full text-sm font-500 py-2 px-4 border border-red-200 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50 transition"
                    >
                      {disconnecting === platform.id ? 'Disconnecting...' : 'Disconnect'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConnect(platform.id)}
                      disabled={platform.comingSoon || loading}
                      className="btn-primary w-full text-white text-sm font-500 py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition"
                    >
                      {platform.comingSoon ? (
                        <>
                          <Lock className="w-4 h-4" />
                          Coming soon
                        </>
                      ) : (
                        <>
                          <Link2 className="w-4 h-4" />
                          Connect
                        </>
                      )}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* How It Works Section */}
        <div className="border-t border-slate-200 pt-12">
          <h2 className="serif-headline text-2xl text-slate-900 mb-3">How publishing works</h2>
          <p className="text-slate-600 mb-8">
            Get your content in front of your audience with just a few clicks
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="relative">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Link2 className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
                <div className="flex-1 pt-1">
                  <h3 className="font-600 text-slate-900 mb-2">Connect your account</h3>
                  <p className="text-sm text-slate-600">
                    Select a platform and authorize ContentFlow to access your account securely
                  </p>
                </div>
              </div>
              <div className="hidden md:block absolute top-10 left-[30px] w-px h-16 bg-gradient-to-b from-slate-300 to-transparent" style={{ top: '40px' }} />
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                </div>
                <div className="flex-1 pt-1">
                  <h3 className="font-600 text-slate-900 mb-2">Create your content</h3>
                  <p className="text-sm text-slate-600">
                    Generate blog posts, social media content, or emails using AI-powered tools
                  </p>
                </div>
              </div>
              <div className="hidden md:block absolute top-10 left-[30px] w-px h-16 bg-gradient-to-b from-slate-300 to-transparent" style={{ top: '40px' }} />
            </div>

            {/* Step 3 */}
            <div>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <ArrowRight className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
                <div className="flex-1 pt-1">
                  <h3 className="font-600 text-slate-900 mb-2">Publish instantly</h3>
                  <p className="text-sm text-slate-600">
                    Schedule or publish immediately to your connected platforms with one click
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
