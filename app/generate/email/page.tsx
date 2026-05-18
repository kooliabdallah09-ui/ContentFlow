'use client'

import { useState } from 'react'

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
        headers: {
          'Content-Type': 'application/json',
        },
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
          metadata: {
            sequenceType,
            product,
            audience,
            emailCount,
          },
        }),
      })

      if (!response.ok) throw new Error('Failed to save')
      alert('Email sequence saved successfully!')
    } catch (err) {
      alert('Failed to save')
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { font-family: 'Inter', sans-serif; }
        .glass-card { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1); }
        .input-glass { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(8px); border: 1px solid rgba(255, 255, 255, 0.1); color: white; }
        .input-glass::placeholder { color: rgba(255, 255, 255, 0.5); }
        .input-glass:focus { background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.2); outline: none; box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.05); }
        .input-glass option { background: #000; color: white; }
        .btn-primary { background: #00ff00; color: #000000; box-shadow: 0 10px 25px rgba(0, 255, 0, 0.3); font-weight: 600; }
        .btn-primary:hover:not(:disabled) { background: #00dd00; transform: translateY(-2px); box-shadow: 0 15px 40px rgba(0, 255, 0, 0.5); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>

      {/* Header */}
      <div className="border-b border-white/10 bg-black/50 backdrop-blur-md py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="inline-block bg-white/10 text-white px-4 py-2 rounded-full text-sm font-600 mb-4 border border-white/20">
            ✨ AI Email Campaigns
          </div>
          <h1 className="text-5xl font-black mb-3">Email Sequence Generator</h1>
          <p className="text-white/60 text-lg">
            Create high-converting email campaigns that nurture, engage, and convert
          </p>
        </div>
      </div>

      <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-black">Build Your Email Sequence</h2>
      </div>

      <div className="grid grid-cols-3 gap-8">
        {/* Form */}
        <div className="col-span-1">
          <div className="glass-card rounded-2xl p-6 space-y-5">
            <div>
              <label className="block text-sm font-600 text-white/70 mb-2">Sequence Type</label>
              <select
                value={sequenceType}
                onChange={(e) => setSequenceType(e.target.value)}
                className="input-glass w-full px-4 py-3 rounded-lg text-sm"
              >
                <option value="welcome">Welcome</option>
                <option value="nurture">Nurture</option>
                <option value="launch">Launch</option>
                <option value="sales">Sales</option>
                <option value="reengagement">Re-engagement</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-600 text-white/70 mb-2">Product/Service</label>
              <input
                type="text"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                placeholder="What are you selling?"
                className="input-glass w-full px-4 py-3 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-600 text-white/70 mb-2">Target Audience</label>
              <input
                type="text"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="Who is this for?"
                className="input-glass w-full px-4 py-3 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-600 text-white/70 mb-2">Number of Emails</label>
              <select
                value={emailCount}
                onChange={(e) => setEmailCount(parseInt(e.target.value))}
                className="input-glass w-full px-4 py-3 rounded-lg text-sm"
              >
                <option value={3}>3 emails</option>
                <option value={5}>5 emails</option>
                <option value={7}>7 emails</option>
              </select>
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading || !product || !audience}
              className="btn-primary w-full text-white py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-600 text-sm mt-6"
            >
              {loading ? 'Creating sequence...' : 'Generate Sequence'}
            </button>

            {error && (
              <div className="rounded-lg bg-red-900/20 p-4 border border-red-800/50">
                <p className="text-sm font-600 text-red-300">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="col-span-2">
          {content ? (
            <div className="space-y-4">
              <button
                onClick={handleSave}
                className="btn-primary w-full text-white py-3 rounded-lg font-600 text-sm"
              >
                ✓ Save Sequence
              </button>
              {content.emails.map((email: any, idx: number) => (
                <div key={idx} className="glass-card rounded-2xl overflow-hidden">
                  <div className="bg-white/5 px-6 py-4 border-b border-white/10">
                    <h3 className="text-lg font-black text-white">Email {idx + 1}</h3>
                    <p className="text-sm text-white/60 mt-1">📧 {email.subject}</p>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <label className="text-xs font-600 text-white/60 uppercase tracking-wider">Preview Text</label>
                      <p className="text-sm text-white/70 italic mt-2">{email.preheader}</p>
                    </div>

                    <div className="border-t border-white/10 pt-4">
                      <label className="text-xs font-600 text-white/60 uppercase tracking-wider">Email Body</label>
                      <div className="bg-white/5 p-4 rounded-lg text-sm text-white/70 mt-2 max-h-36 overflow-y-auto">
                        <p className="whitespace-pre-wrap">{email.body}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
                      <div>
                        <label className="text-xs font-600 text-white/60 uppercase tracking-wider block mb-2">CTA Button</label>
                        <div className="btn-primary px-4 py-2 rounded-lg text-sm font-600 text-center">
                          {email.cta}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-600 text-white/60 uppercase tracking-wider block mb-2">Link</label>
                        <div className="text-xs text-white/60 bg-white/5 p-3 rounded-lg overflow-x-auto font-mono border border-white/10">
                          {email.ctaUrl}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-white/10">
                      <button className="flex-1 text-xs bg-white/10 text-white/70 px-3 py-2 rounded-lg hover:bg-white/20 font-600 border border-white/20">
                        📋 Copy
                      </button>
                      <button className="flex-1 text-xs bg-white/10 text-white/70 px-3 py-2 rounded-lg hover:bg-white/20 font-600 border border-white/20">
                        ✏️ Edit
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card rounded-2xl p-12 text-center">
              <div className="text-5xl mb-4">💌</div>
              <p className="text-white/60">Generate a sequence to see it here</p>
            </div>
          )}

          {loading && (
            <div className="glass-card rounded-2xl p-12 text-center">
              <div className="inline-block">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-white/20 border-t-white"></div>
              </div>
              <p className="text-white mt-6 font-500">Crafting your email sequence...</p>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}
