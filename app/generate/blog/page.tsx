'use client'

import { useState } from 'react'
import { Editor } from '@/components/Editor'
import BlogPostPreview from '@/components/BlogPostPreview'
import { Sparkles, FileText } from 'lucide-react'

export default function BlogGeneratorPage() {
  const [topic, setTopic] = useState('')
  const [tone, setTone] = useState('professional')
  const [length, setLength] = useState('medium')
  const [loading, setLoading] = useState(false)
  const [content, setContent] = useState<any>(null)
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/content/generate/blog', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

  const [savedContentId, setSavedContentId] = useState<string | null>(null)

  const handleSave = async (text: string, title: string) => {
    try {
      const response = await fetch('/api/content/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: 'blog',
          title,
          body: text,
          metadata: {
            topic,
            tone,
            length,
            headline: content?.headline,
            metaDescription: content?.metaDescription,
          },
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

  const handleSchedule = async (
    text: string,
    title: string,
    date: Date,
    platforms: string[]
  ) => {
    try {
      // First save the content
      const saveResponse = await fetch('/api/content/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: 'blog',
          title,
          body: text,
          metadata: {
            topic,
            tone,
            length,
            headline: content?.headline,
            metaDescription: content?.metaDescription,
          },
        }),
      })

      if (!saveResponse.ok) throw new Error('Failed to save content')
      const saveData = await saveResponse.json()

      // Then schedule it
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
    <div className="min-h-screen bg-black text-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        * { font-family: 'Inter', sans-serif; }

        .glass-card {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .input-glass {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
        }

        .input-glass:focus {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
          outline: none;
          box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.05);
        }

        .input-glass::placeholder {
          color: rgba(255, 255, 255, 0.5);
        }

        .input-glass option {
          background: #000;
          color: white;
        }

        .btn-primary {
          background: #00ff00;
          color: #000000;
          transition: all 0.3s cubic-bezier(0.23, 1, 0.320, 1);
          font-weight: 700;
          border: none;
          box-shadow: 0 8px 24px rgba(0, 255, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3);
          letter-spacing: -0.5px;
        }

        .btn-primary:hover:not(:disabled) {
          background: #00dd00;
          transform: translateY(-3px);
          box-shadow: 0 12px 32px rgba(0, 255, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3);
        }

        .btn-primary:active:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 255, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.3);
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>

      {/* Header */}
      <div className="border-b border-white/10 bg-black/50 backdrop-blur-md py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/10 text-white px-4 py-2 rounded-full text-sm font-600 mb-4 border border-white/20">
            <Sparkles className="w-4 h-4" />
            AI-Powered Blog Writing
          </div>
          <h1 className="text-5xl font-black mb-3">Blog Post Generator</h1>
          <p className="text-white/60 text-lg max-w-2xl">
            Generate SEO-optimized, high-converting blog posts in minutes. Powered by advanced AI.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 p-8 max-w-7xl mx-auto">
      {/* Form */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-black mb-6">Create Your Blog Post</h2>
        </div>

        <div>
          <label className="block text-sm font-600 text-white/70 mb-2">Blog Topic</label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What should this blog post be about? (e.g., 'Best practices for remote work in 2026')"
            className="input-glass w-full px-4 py-3 rounded-lg text-sm"
            rows={4}
          />
        </div>

        <div>
          <label className="block text-sm font-600 text-white/70 mb-2">Tone of Voice</label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="input-glass w-full px-4 py-3 rounded-lg text-sm"
          >
            <option value="professional">Professional</option>
            <option value="casual">Casual</option>
            <option value="funny">Funny</option>
            <option value="educational">Educational</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-600 text-white/70 mb-2">Content Length</label>
          <select
            value={length}
            onChange={(e) => setLength(e.target.value)}
            className="input-glass w-full px-4 py-3 rounded-lg text-sm"
          >
            <option value="short">Short (600-1000 words)</option>
            <option value="medium">Medium (1200-1800 words)</option>
            <option value="long">Long (2000-3000 words)</option>
          </select>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || !topic}
          className="btn-primary w-full py-3 rounded-lg font-600 text-sm mt-6"
        >
          {loading ? 'Creating your blog post...' : 'Generate Blog Post'}
        </button>

        {error && (
          <div className="rounded-lg bg-red-900/20 p-4 border border-red-800/50">
            <p className="text-sm font-600 text-red-300">{error}</p>
          </div>
        )}
      </div>

      {/* Preview */}
      <div>
        {content && (
          <div className="rounded-2xl overflow-hidden">
            <BlogPostPreview
              headline={content.headline}
              metaDescription={content.metaDescription}
              content={content.content}
              featuredImage={content.featuredImage}
              outline={content.outline}
              faqs={content.faqs}
            />

            <div className="mt-12 glass-card rounded-2xl p-8">
              <h2 className="text-2xl font-black mb-6">Edit & Publish</h2>
              <Editor
                initialContent={content.content}
                onSave={handleSave}
                onSchedule={handleSchedule}
              />
            </div>
          </div>
        )}

        {!content && !loading && (
          <div className="glass-card rounded-2xl p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-xl mb-4">
              <FileText className="w-8 h-8 text-white/70" />
            </div>
            <p className="text-white/60 font-500 text-lg">Generate a blog post to see the preview here</p>
          </div>
        )}

        {loading && (
          <div className="glass-card rounded-2xl p-12 text-center">
            <div className="inline-block">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-white/20 border-t-white"></div>
            </div>
            <p className="text-white/60 mt-6 font-500">Creating your blog post with AI...</p>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
