'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabase } from '@/lib/auth'
import { Icon } from '@/components/Icons'
import { showError, showSuccess } from '@/lib/notifications'

export default function GenerateFromCalendarPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const date = searchParams.get('date')
  const contentType = searchParams.get('contentType')

  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [generatedContent, setGeneratedContent] = useState('')
  const [dailySuggestion, setDailySuggestion] = useState<any>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState('')
  const [aiEditRequest, setAiEditRequest] = useState('')
  const [applyingAiEdit, setApplyingAiEdit] = useState(false)

  useEffect(() => {
    if (date && contentType) {
      generateContent()
    }
  }, [date, contentType])

  const generateContent = async () => {
    try {
      setLoading(true)
      setGenerating(true)

      const supabase = getSupabase()
      if (!supabase) throw new Error('Not authenticated')

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session?.access_token) throw new Error('Not authenticated')

      const response = await fetch('/api/generate/auto-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          contentType,
          date,
          title: 'Daily Content',
          description: 'Auto-generated based on your brand profile',
          platforms: ['Instagram', 'TikTok', 'LinkedIn'],
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate content')
      }

      const data = await response.json()

      setDailySuggestion({
        date,
        contentType,
        title: 'Generated Content',
        description: 'Auto-generated from your brand profile',
        platforms: ['Instagram', 'TikTok', 'LinkedIn'],
      })

      setGeneratedContent(data.content)
      setEditedContent(data.content)
    } catch (err) {
      console.error('Error generating content:', err)
      showError('Failed to generate content', err instanceof Error ? err.message : 'Please try again')
    } finally {
      setLoading(false)
      setGenerating(false)
    }
  }

  const handleAiEdit = async () => {
    if (!aiEditRequest.trim()) return
    try {
      setApplyingAiEdit(true)
      const response = await fetch('/api/generate/refine-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentContent: editedContent || generatedContent,
          editRequest: aiEditRequest,
        }),
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to refine content')
      }
      const data = await response.json()
      setGeneratedContent(data.content)
      setEditedContent(data.content)
      setAiEditRequest('')
    } catch (err) {
      showError('Failed to apply edit', err instanceof Error ? err.message : 'Please try again')
    } finally {
      setApplyingAiEdit(false)
    }
  }

  const handleSaveContent = async () => {
    try {
      setGenerating(true)
      const supabase = getSupabase()
      if (!supabase) throw new Error('Supabase not available')

      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error('Not authenticated')

      // For UGC content (image, video, voice), save to ugc_content table
      if (['image', 'video', 'voice'].includes(contentType || '')) {
        const { error: saveError } = await supabase
          .from('ugc_content')
          .insert({
            user_id: userData.user.id,
            content_type: contentType,
            title: dailySuggestion?.title || `Generated ${contentType}`,
            description: editedContent || generatedContent,
            source_api: 'claude-generated',
            metadata: {
              script: editedContent || generatedContent,
              text: editedContent || generatedContent,
              prompt: dailySuggestion?.description || '',
              date,
              from_calendar: true,
              platforms: dailySuggestion?.platforms || [],
            },
            status: 'completed',
          })

        if (saveError) {
          console.error('Save error:', saveError)
          throw new Error('Failed to save content')
        }
      } else {
        // For written content (blog, social, email), save to content table
        const { error: saveError } = await supabase
          .from('content')
          .insert({
            user_id: userData.user.id,
            content_type: contentType || 'social',
            title: dailySuggestion?.title || `Generated ${contentType}`,
            body: editedContent || generatedContent,
            metadata: {
              prompt: dailySuggestion?.description || '',
              date,
              from_calendar: true,
              platforms: dailySuggestion?.platforms || [],
              original_suggestion: dailySuggestion,
            },
            published: false,
          })

        if (saveError) {
          console.error('Save error:', saveError)
          throw new Error('Failed to save content')
        }
      }

      showSuccess('Content Created!', 'Your content is saved in the library')
      router.push('/library')
    } catch (err) {
      console.error('Error saving content:', err)
      showError('Failed to save content', err instanceof Error ? err.message : 'Please try again')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '4px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--ink-dim)', fontSize: '14px' }}>Generating your content...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    )
  }

  return (
    <div className="content">
      <div className="page-head">
        <div className="page-meta">
          <span className="dot" />
          <Link href="/calendar" style={{ color: 'var(--accent)', textDecoration: 'none', display: 'inline-block' }} className="eyebrow">
            ← Back to Calendar
          </Link>
        </div>
        <h1 className="page-title">Review Generated <em>Content</em></h1>
        <p className="page-sub">AI has prepared your content. Review, edit if needed, and save to library.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Daily Suggestion */}
        {dailySuggestion && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: 'var(--r-lg)', padding: '20px' }}>
            <p className="eyebrow" style={{ marginBottom: '12px' }}>Daily Suggestion</p>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--ink)', marginBottom: '8px' }}>
              {dailySuggestion.title}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--ink-dim)', marginBottom: '12px', lineHeight: 1.5 }}>
              {dailySuggestion.description}
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {dailySuggestion.platforms?.map((p: string) => (
                <span key={p} className="tag" style={{ padding: '4px 8px', fontSize: '11px' }}>
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Generated Content Editor */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>
              Generated {contentType ? contentType.charAt(0).toUpperCase() + contentType.slice(1) : 'Content'}
            </h3>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="btn btn-ghost"
                style={{ fontSize: '12px', padding: '6px 8px' }}
              >
                Edit
              </button>
            )}
          </div>

          {isEditing ? (
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="textarea"
              style={{ flex: 1, minHeight: '200px', marginBottom: '12px' }}
            />
          ) : (
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '12px', color: 'var(--ink-dim)', fontSize: '12px', lineHeight: 1.6, flex: 1, marginBottom: '12px', overflow: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
              {generatedContent}
            </div>
          )}

          {isEditing && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setIsEditing(false)}
                className="btn btn-ghost"
                style={{ flex: 1, fontSize: '12px', padding: '8px 12px' }}
              >
                Done
              </button>
              <button
                onClick={() => {
                  setEditedContent(generatedContent)
                  setIsEditing(false)
                }}
                className="btn btn-ghost"
                style={{ flex: 1, fontSize: '12px', padding: '8px 12px' }}
              >
                Reset
              </button>
            </div>
          )}
        </div>
      </div>

      {/* AI Edit Input */}
      {generatedContent && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '16px', marginTop: '16px' }}>
          <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)', marginBottom: '10px' }}>Ask AI to change something</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={aiEditRequest}
              onChange={(e) => setAiEditRequest(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !applyingAiEdit && handleAiEdit()}
              placeholder='e.g. "make the hook shorter" or "add more energy to the CTA"'
              className="input"
              style={{ flex: 1, fontSize: '13px' }}
              disabled={applyingAiEdit}
            />
            <button
              onClick={handleAiEdit}
              disabled={applyingAiEdit || !aiEditRequest.trim()}
              className="btn btn-primary"
              style={{ whiteSpace: 'nowrap', opacity: applyingAiEdit || !aiEditRequest.trim() ? 0.6 : 1 }}
            >
              {applyingAiEdit ? 'Applying...' : 'Apply'}
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
        <button
          onClick={() => router.push('/calendar')}
          className="btn btn-ghost"
          style={{ flex: 1 }}
        >
          Skip
        </button>
        <button
          onClick={handleSaveContent}
          disabled={generating}
          className="btn btn-primary"
          style={{ flex: 1, opacity: generating ? 0.6 : 1 }}
        >
          {generating ? 'Saving...' : 'Create This Content'}
        </button>
      </div>
    </div>
  )
}
