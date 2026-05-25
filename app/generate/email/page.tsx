'use client'

import { useState } from 'react'
import { Icon } from '@/components/Icons'

export default function EmailGeneratorPage() {
  const [sequenceType, setSequenceType] = useState('welcome')
  const [product, setProduct] = useState('')
  const [audience, setAudience] = useState('')
  const [emailCount, setEmailCount] = useState(5)
  const [loading, setLoading] = useState(false)
  const [content, setContent] = useState<any>(null)
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/content/generate/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sequenceType, product, audience, emailCount }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate')
      }

      const data = await response.json()
      setContent(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate email sequence')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    const title = prompt('Give your email sequence a name:')
    if (!title) return

    try {
      const response = await fetch('/api/content/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: 'email',
          title,
          body: JSON.stringify(content, null, 2),
          metadata: { sequenceType, product, audience, emailCount },
        }),
      })

      if (!response.ok) throw new Error('Failed to save')
      alert('Email sequence saved successfully!')
    } catch (err) {
      alert('Failed to save')
    }
  }

  return (
    <div className="content">
      <div className="page-head">
        <div className="page-meta">
          <span className="dot" />
          <span className="eyebrow">AI Email Campaigns</span>
        </div>
        <h1 className="page-title">Email Sequence <em>Generator</em></h1>
        <p className="page-sub">Create high-converting email campaigns that nurture, engage, and convert your audience.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px' }}>
        {/* Form */}
        <div>
          <div className="section-head">
            <h2 className="section-title">Build Sequence</h2>
          </div>

          <div className="form-row">
            <label htmlFor="type" style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
              Sequence Type
            </label>
            <select
              id="type"
              value={sequenceType}
              onChange={(e) => setSequenceType(e.target.value)}
              className="select"
            >
              <option value="welcome">Welcome</option>
              <option value="nurture">Nurture</option>
              <option value="launch">Launch</option>
              <option value="sales">Sales</option>
              <option value="reengagement">Re-engagement</option>
            </select>
          </div>

          <div className="form-row">
            <label htmlFor="product" style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
              Product/Service
            </label>
            <input
              id="product"
              type="text"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder="What are you selling?"
              className="input"
            />
          </div>

          <div className="form-row">
            <label htmlFor="audience" style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
              Target Audience
            </label>
            <input
              id="audience"
              type="text"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="Who is this for?"
              className="input"
            />
          </div>

          <div className="form-row">
            <label htmlFor="count" style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
              Number of Emails
            </label>
            <select
              id="count"
              value={emailCount}
              onChange={(e) => setEmailCount(parseInt(e.target.value))}
              className="select"
            >
              {[3, 5, 7, 10].map((num) => (
                <option key={num} value={num}>
                  {num} emails
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div style={{ background: 'var(--danger)', color: 'white', padding: '12px 14px', borderRadius: 'var(--r-sm)', marginBottom: '18px', fontSize: '13px' }}>
              {error}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading || !product || !audience}
            className="btn btn-primary"
            style={{ width: '100%', opacity: loading || !product || !audience ? 0.6 : 1, cursor: loading || !product || !audience ? 'not-allowed' : 'pointer' }}
          >
            <Icon.Sparkle style={{ width: 14, height: 14 }} />
            {loading ? 'Generating...' : 'Generate Sequence'}
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
                Save Sequence
              </button>
              {content.emails?.map((email: any, idx: number) => (
                <div key={idx} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '16px', overflow: 'hidden' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)', marginBottom: '8px' }}>
                    Email {idx + 1}: {email.subject}
                  </h3>
                  <p style={{ color: 'var(--ink-dim)', fontSize: '12px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {email.body}
                  </p>
                </div>
              ))}
            </div>
          ) : loading ? (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '4px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
              <p style={{ color: 'var(--ink)', fontSize: '14px', fontWeight: 600 }}>Creating your email sequence...</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center', color: 'var(--ink-mute)' }}><Icon.Email style={{ width: 36, height: 36 }} /></div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>Ready to create?</h3>
              <p className="eyebrow">Fill in the details and generate your email sequence</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
