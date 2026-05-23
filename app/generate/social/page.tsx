'use client'

import { useState } from 'react'
import { Icon } from '@/components/Icons'

const PlatformLogo = ({ platform, size = 'medium' }: { platform: string; size?: 'small' | 'medium' | 'large' }) => {
  const sizeMap = {
    small: '16px',
    medium: '20px',
    large: '24px',
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
      style={{ width: sizeMap[size], height: sizeMap[size], objectFit: 'contain' }}
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, platforms }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate')
      }

      const data = await response.json()
      setContent(data)
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
          metadata: { topic, platforms },
        }),
      })

      if (!response.ok) throw new Error('Failed to save')
      alert('Social posts saved successfully!')
    } catch (err) {
      alert('Failed to save')
    }
  }

  const platformNames: Record<string, string> = {
    twitter: 'X',
    linkedin: 'LinkedIn',
    instagram: 'Instagram',
    facebook: 'Facebook',
    tiktok: 'TikTok',
  }

  return (
    <div className="content">
      <div className="page-head">
        <div className="page-meta">
          <span className="dot" />
          <span className="eyebrow">AI-Powered Multi-Platform Creation</span>
        </div>
        <h1 className="page-title">Create Stunning <em>Social Posts</em></h1>
        <p className="page-sub">Generate beautiful, platform-optimized content for 5 platforms at once with AI-generated visuals.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px' }}>
        {/* Form */}
        <div>
          <div className="section-head">
            <h2 className="section-title">Your Topic</h2>
          </div>

          <div className="form-row">
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What should the posts be about? Be specific..."
              className="textarea"
              rows={5}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <span className="eyebrow" style={{ display: 'block', marginBottom: '12px' }}>Choose Platforms</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {['twitter', 'linkedin', 'instagram', 'facebook', 'tiktok'].map((platform) => {
                const isSelected = platforms.includes(platform)
                return (
                  <label
                    key={platform}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      background: isSelected ? 'var(--accent-soft)' : 'var(--surface)',
                      border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 'var(--r-sm)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => togglePlatform(platform)}
                      style={{
                        width: '16px',
                        height: '16px',
                        cursor: 'pointer',
                        accentColor: 'var(--accent)',
                      }}
                    />
                    <PlatformLogo platform={platform} size="small" />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
                      {platformNames[platform]}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          {error && (
            <div style={{ background: 'var(--danger)', color: 'white', padding: '12px 14px', borderRadius: 'var(--r-sm)', marginBottom: '18px', fontSize: '13px' }}>
              {error}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading || !topic || platforms.length === 0}
            className="btn btn-primary"
            style={{ width: '100%', opacity: loading || !topic || platforms.length === 0 ? 0.6 : 1, cursor: loading || !topic || platforms.length === 0 ? 'not-allowed' : 'pointer' }}
          >
            <Icon.Sparkle style={{ width: 14, height: 14 }} />
            {loading ? 'Generating...' : 'Generate Posts'}
          </button>
        </div>

        {/* Preview */}
        <div>
          {content ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <button
                onClick={handleSave}
                className="btn btn-primary"
                style={{ width: '100%' }}
              >
                <Icon.Settings style={{ width: 14, height: 14 }} />
                Save All Posts
              </button>
              {platforms.map((platform) => (
                <div key={platform} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                    <PlatformLogo platform={platform} size="medium" />
                    <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', flex: 1 }}>
                      {platformNames[platform]}
                    </h3>
                    <span className="eyebrow">{content[platform]?.length || 0} posts</span>
                  </div>
                  <div style={{ borderTop: '1px solid var(--border)' }}>
                    {content[platform]?.map((post: string, idx: number) => (
                      <div key={idx} style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
                        {generatingImages && !images[platform]?.[idx] && (
                          <div style={{ background: 'var(--bg)', borderRadius: 'var(--r-md)', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px', border: '1px solid var(--border)' }}>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '3px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
                              <span className="eyebrow" style={{ fontSize: '11px' }}>Generating image...</span>
                              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                            </div>
                          </div>
                        )}
                        {images[platform]?.[idx] && (
                          <img
                            src={images[platform][idx]}
                            alt="Generated post"
                            style={{ width: '100%', borderRadius: 'var(--r-md)', marginBottom: '12px', maxHeight: '250px', objectFit: 'cover' }}
                          />
                        )}
                        <p style={{ color: 'var(--ink-dim)', fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: '12px' }}>
                          {post}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : loading ? (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '4px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
              <p style={{ color: 'var(--ink)', fontSize: '14px', fontWeight: 600 }}>Creating your posts...</p>
              <p className="eyebrow" style={{ marginTop: '6px' }}>This usually takes 10-15 seconds</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📱</div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>Ready to create?</h3>
              <p className="eyebrow">Enter a topic and select your platforms to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
