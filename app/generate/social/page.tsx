'use client'

import { useState } from 'react'
import { Sparkles, Smartphone, Copy, Edit2, Download, Check } from 'lucide-react'

// Real official logos from CDN
const PlatformLogo = ({ platform, size = 'medium' }: { platform: string; size?: 'small' | 'medium' | 'large' }) => {
  const sizeMap = {
    small: 'w-5 h-5',
    medium: 'w-6 h-6',
    large: 'w-8 h-8',
  }

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
      className={`${sizeMap[size]} object-contain`}
      loading="lazy"
    />
  )
}

export default function SocialGeneratorPage() {
  const [topic, setTopic] = useState('')
  const [platforms, setPlatforms] = useState(['twitter', 'linkedin'])
  const [loading, setLoading] = useState(false)
  const [generatingImages, setGeneratingImages] = useState(false)
  const [content, setContent] = useState<any>(null)
  const [images, setImages] = useState<Record<string, string[]>>({})
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/content/generate/social', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ topic, platforms }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate')
      }

      const data = await response.json()
      setContent(data)

      // Generate images for each post
      await generateImagesForPosts(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate social content')
    } finally {
      setLoading(false)
    }
  }

  const generateImagesForPosts = async (postsData: any) => {
    setGeneratingImages(true)
    const generatedImages: Record<string, string[]> = {}

    try {
      for (const platform of platforms) {
        generatedImages[platform] = []
        const posts = postsData[platform] || []

        for (const post of posts) {
          try {
            const response = await fetch('/api/content/generate/social-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ post, platform }),
            })

            if (response.ok) {
              const data = await response.json()
              generatedImages[platform].push(data.image)
            } else {
              generatedImages[platform].push('')
            }
          } catch (err) {
            console.error('Image generation failed for post:', err)
            generatedImages[platform].push('')
          }
        }
      }

      setImages(generatedImages)
    } finally {
      setGeneratingImages(false)
    }
  }

  const togglePlatform = (platform: string) => {
    setPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    )
  }

  const handleSave = async () => {
    const title = prompt('Give your social posts a name:')
    if (!title) return

    try {
      const response = await fetch('/api/content/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: 'social',
          title,
          body: JSON.stringify(content, null, 2),
          metadata: {
            topic,
            platforms,
          },
        }),
      })

      if (!response.ok) throw new Error('Failed to save')
      alert('Social posts saved successfully!')
    } catch (err) {
      alert('Failed to save')
    }
  }


  const platformNames: Record<string, string> = {
    twitter: 'X (Twitter)',
    linkedin: 'LinkedIn',
    instagram: 'Instagram',
    facebook: 'Facebook',
    tiktok: 'TikTok',
  }

  const platformColors: Record<string, { bg: string; border: string; ringColor: string; logoColor: string }> = {
    twitter: { bg: 'bg-slate-50 hover:bg-slate-100', border: 'border-slate-200 hover:border-slate-400', ringColor: 'ring-slate-400', logoColor: 'text-slate-900' },
    linkedin: { bg: 'bg-blue-50 hover:bg-blue-100', border: 'border-blue-200 hover:border-blue-400', ringColor: 'ring-blue-400', logoColor: 'text-blue-700' },
    instagram: { bg: 'bg-pink-50 hover:bg-pink-100', border: 'border-pink-200 hover:border-pink-400', ringColor: 'ring-pink-400', logoColor: 'text-pink-600' },
    facebook: { bg: 'bg-indigo-50 hover:bg-indigo-100', border: 'border-indigo-200 hover:border-indigo-400', ringColor: 'ring-indigo-400', logoColor: 'text-indigo-700' },
    tiktok: { bg: 'bg-black bg-opacity-5 hover:bg-opacity-10', border: 'border-slate-200 hover:border-slate-400', ringColor: 'ring-slate-400', logoColor: 'text-black' },
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800&family=Inter:wght@300;400;500;600;700&display=swap');
        * { font-family: 'Inter', sans-serif; }
        .serif-headline { font-family: 'Fraunces', serif; font-weight: 700; }
        .glass-card { background: rgba(255, 255, 255, 0.6); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.8); }
        .input-glass { background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(10px); border: 1px solid rgba(226, 232, 240, 0.8); transition: all 0.3s ease; }
        .input-glass:focus { background: rgba(255, 255, 255, 0.95); border-color: rgba(59, 130, 246, 0.6); outline: none; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1); }
        .btn-primary { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); box-shadow: 0 12px 30px rgba(59, 130, 246, 0.25); transition: all 0.3s ease; }
        .btn-primary:hover:not(:disabled) { transform: translateY(-3px); box-shadow: 0 18px 45px rgba(59, 130, 246, 0.4); }
        .platform-card { transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .platform-card:hover { transform: translateY(-4px); }
      `}</style>

      {/* Header */}
      <div className="border-b border-white/40 py-16 px-6 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-full text-sm font-600 mb-6 shadow-lg shadow-blue-500/20">
            <Sparkles className="w-4 h-4" />
            AI-Powered Multi-Platform Creation
          </div>
          <h1 className="serif-headline text-6xl text-slate-900 mb-4 leading-tight">
            Create Stunning <br />
            <span className="bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">
              Social Posts
            </span>
          </h1>
          <p className="text-slate-600 text-lg max-w-2xl leading-relaxed">
            Generate beautiful, platform-optimized content with AI-generated visuals. One input, five platforms, infinite possibilities.
          </p>
        </div>
      </div>

      <div className="p-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-3 gap-8">
          {/* Form */}
          <div className="col-span-1">
            <div className="glass-card rounded-2xl p-8 space-y-7 sticky top-8">
              {/* Topic Input */}
              <div>
                <label className="block text-sm font-700 text-slate-900 mb-3 tracking-tight">Your Topic</label>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="What should the posts be about? Be specific..."
                  className="input-glass w-full px-4 py-3 rounded-xl text-sm placeholder-slate-400 resize-none"
                  rows={5}
                />
              </div>

              {/* Platforms Selection */}
              <div>
                <label className="block text-sm font-700 text-slate-900 mb-4 tracking-tight">Choose Platforms</label>
                <div className="grid grid-cols-1 gap-3">
                  {['twitter', 'linkedin', 'instagram', 'facebook', 'tiktok'].map((platform) => {
                    const colors = platformColors[platform as keyof typeof platformColors]
                    const isSelected = platforms.includes(platform)
                    return (
                      <button
                        key={platform}
                        onClick={() => togglePlatform(platform)}
                        className={`platform-card relative flex items-center gap-4 px-5 py-4 rounded-xl border-2 font-500 text-sm transition-all ${
                          isSelected
                            ? `${colors.bg} ${colors.border} ring-2 ring-offset-2 ring-${colors.ringColor.split('-')[1]}-400`
                            : `bg-white border-slate-200 text-slate-600 hover:border-slate-300`
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition ${
                          isSelected ? `bg-gradient-to-br from-blue-500 to-blue-600 border-transparent` : 'border-slate-300 bg-white'
                        }`}>
                          {isSelected && <Check className="text-white w-4 h-4" />}
                        </div>
                        <div className={`flex-shrink-0 transition ${colors.logoColor} filter brightness-100`}>
                          <PlatformLogo platform={platform} size="medium" />
                        </div>
                        <span className={isSelected ? 'text-slate-900' : 'text-slate-700'}>
                          {platformNames[platform]}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={loading || !topic || platforms.length === 0}
                className="btn-primary w-full text-white py-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed font-600 text-sm mt-4"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                    Creating posts...
                  </div>
                ) : (
                  'Generate Posts'
                )}
              </button>

              {error && (
                <div className="rounded-xl bg-red-50 p-4 border border-red-200">
                  <p className="text-sm font-600 text-red-800">{error}</p>
                </div>
              )}
            </div>
          </div>

          {/* Preview */}
          <div className="col-span-2">
            {content ? (
              <div className="space-y-5">
                <button
                  onClick={handleSave}
                  className="btn-primary w-full text-white py-4 rounded-xl font-600 text-sm flex items-center justify-center gap-2"
                >
                  <span>✓</span>
                  Save All Posts
                </button>
                {platforms.map((platform) => {
                  const colors = platformColors[platform as keyof typeof platformColors]
                  return (
                    <div key={platform} className="glass-card rounded-2xl overflow-hidden border border-white/40">
                      <div className={`${colors.bg} px-6 py-5 border-b border-white/20 flex items-center gap-3`}>
                        <div className={`w-8 h-8 flex items-center justify-center flex-shrink-0 ${colors.logoColor}`}>
                          <PlatformLogo platform={platform} size="large" />
                        </div>
                        <h3 className="serif-headline text-lg text-slate-900">
                          {platformNames[platform]}
                        </h3>
                        <span className="ml-auto text-xs font-600 text-slate-600 bg-white/60 px-3 py-1.5 rounded-full">
                          {content[platform]?.length || 0} {content[platform]?.length === 1 ? 'post' : 'posts'}
                        </span>
                      </div>
                      <div className="divide-y divide-white/20">
                        {content[platform]?.map((post: string, idx: number) => (
                          <div key={idx} className="p-6 hover:bg-white/20 transition">
                            {/* Generated Image */}
                            {generatingImages && !images[platform]?.[idx] && (
                              <div className="mb-5 bg-gradient-to-br from-slate-100 to-slate-50 rounded-xl h-56 flex items-center justify-center border border-slate-200">
                                <div className="text-center">
                                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600/20 border-t-blue-600 mx-auto mb-3"></div>
                                  <p className="text-xs text-slate-600 font-500">Generating image...</p>
                                </div>
                              </div>
                            )}
                            {images[platform]?.[idx] && (
                              <div className="mb-5 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                                <img
                                  src={images[platform][idx]}
                                  alt="Generated post image"
                                  className="w-full h-auto max-h-80 object-cover"
                                />
                              </div>
                            )}

                            {/* Post Text */}
                            <p className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed font-400 mb-5">{post}</p>

                            {/* Actions */}
                            <div className="flex gap-2 flex-wrap">
                              <button className="text-xs bg-blue-100 text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-200 font-600 flex items-center gap-1.5 transition">
                                <Copy className="w-3 h-3" />
                                Copy
                              </button>
                              <button className="text-xs bg-slate-100 text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-200 font-600 flex items-center gap-1.5 transition">
                                <Edit2 className="w-3 h-3" />
                                Edit
                              </button>
                              {images[platform]?.[idx] && (
                                <button className="text-xs bg-emerald-100 text-emerald-700 px-3 py-2 rounded-lg hover:bg-emerald-200 font-600 flex items-center gap-1.5 transition">
                                  <Download className="w-3 h-3" />
                                  Download
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : loading ? (
              <div className="glass-card rounded-2xl p-16 text-center border border-white/40">
                <div className="inline-block mb-6">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600/20 border-t-blue-600"></div>
                </div>
                <p className="text-slate-600 font-500 text-lg">Creating your posts...</p>
                <p className="text-slate-500 text-sm mt-2">This usually takes 10-15 seconds</p>
              </div>
            ) : (
              <div className="glass-card rounded-2xl p-16 text-center border border-white/40">
                <div className="flex justify-center mb-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-50 rounded-2xl flex items-center justify-center">
                    <Smartphone className="w-10 h-10 text-blue-600" />
                  </div>
                </div>
                <h3 className="serif-headline text-xl text-slate-900 mb-2">Ready to create?</h3>
                <p className="text-slate-600 text-sm">Enter a topic and select your platforms to get started</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
