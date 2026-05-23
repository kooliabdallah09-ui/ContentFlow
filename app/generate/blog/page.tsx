'use client'

import { useState } from 'react'
import { Icon } from '@/components/Icons'
import { Editor } from '@/components/Editor'
import BlogPostPreview from '@/components/BlogPostPreview'

export default function BlogGeneratorPage() {
  const [topic, setTopic] = useState('')
  const [tone, setTone] = useState('professional')
  const [length, setLength] = useState('medium')
  const [loading, setLoading] = useState(false)
  const [content, setContent] = useState<any>(null)
  const [error, setError] = useState('')
  const [savedContentId, setSavedContentId] = useState<string | null>(null)

  const handleGenerate = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/content/generate/blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, tone, length }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate')
      }

      const data = await response.json()
      setContent(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate blog post')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (text: string, title: string) => {
    try {
      const response = await fetch('/api/content/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: 'blog',
          title,
          body: text,
          metadata: { topic, tone, length, headline: content?.headline },
        }),
      })

      if (!response.ok) throw new Error('Failed to save')
      const data = await response.json()
      setSavedContentId(data.id)
      return true
    } catch (err) {
      throw err
    }
  }

  const handleSchedule = async (text: string, title: string, date: Date, platforms: string[]) => {
    try {
      const saveResponse = await fetch('/api/content/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: 'blog',
          title,
          body: text,
          metadata: { topic, tone, length, headline: content?.headline },
        }),
      })

      if (!saveResponse.ok) throw new Error('Failed to save content')
      const saveData = await saveResponse.json()

      const scheduleResponse = await fetch('/api/calendar/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId: saveData.id,
          scheduledDate: date.toISOString(),
          platforms,
        }),
      })

      if (!scheduleResponse.ok) throw new Error('Failed to schedule')
      setSavedContentId(saveData.id)
    } catch (err) {
      throw err
    }
  }

  return (
    <div className="content">
      <div className="page-head">
        <div className="page-meta">
          <span className="dot" />
          <span className="eyebrow">AI-Powered Blog Writing</span>
        </div>
        <h1 className="page-title">Blog Post <em>Generator</em></h1>
        <p className="page-sub">Generate SEO-optimized, high-converting blog posts in minutes powered by advanced AI.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Form */}
        <div>
          <div className="section-head">
            <h2 className="section-title">Create Blog Post</h2>
          </div>

          <div className="form-row">
            <label htmlFor="topic" style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
              Blog Topic
            </label>
            <textarea
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What should this blog post be about? (e.g., 'Best practices for remote work in 2026')"
              className="textarea"
              rows={5}
            />
          </div>

          <div className="form-row">
            <label htmlFor="tone" style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
              Tone of Voice
            </label>
            <select
              id="tone"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="select"
            >
              <option value="professional">Professional</option>
              <option value="casual">Casual</option>
              <option value="funny">Funny</option>
              <option value="educational">Educational</option>
            </select>
          </div>

          <div className="form-row">
            <label htmlFor="length" style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
              Content Length
            </label>
            <select
              id="length"
              value={length}
              onChange={(e) => setLength(e.target.value)}
              className="select"
            >
              <option value="short">Short (600-1000 words)</option>
              <option value="medium">Medium (1200-1800 words)</option>
              <option value="long">Long (2000-3000 words)</option>
            </select>
          </div>

          {error && (
            <div style={{ background: 'var(--danger)', color: 'white', padding: '12px 14px', borderRadius: 'var(--r-sm)', marginBottom: '18px', fontSize: '13px' }}>
              {error}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading || !topic}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '12px', opacity: loading || !topic ? 0.6 : 1, cursor: loading || !topic ? 'not-allowed' : 'pointer' }}
          >
            <Icon.Sparkle style={{ width: 14, height: 14 }} />
            {loading ? 'Generating...' : 'Generate Blog Post'}
          </button>
        </div>

        {/* Preview */}
        <div>
          {content && (
            <div>
              <BlogPostPreview
                headline={content.headline}
                metaDescription={content.metaDescription}
                content={content.content}
                featuredImage={content.featuredImage}
                outline={content.outline}
                faqs={content.faqs}
              />
              <div style={{ marginTop: '24px' }}>
                <div className="section-head">
                  <h2 className="section-title">Edit & Publish</h2>
                </div>
                <Editor
                  initialContent={content.content}
                  onSave={handleSave}
                  onSchedule={handleSchedule}
                />
              </div>
            </div>
          )}

          {!content && !loading && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>📝</div>
              <p style={{ color: 'var(--ink-mute)', fontSize: '13px' }}>Generate a blog post to see the preview here</p>
            </div>
          )}

          {loading && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '4px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
              <p style={{ color: 'var(--ink-mute)', fontSize: '13px' }}>Creating your blog post with AI...</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
