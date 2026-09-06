'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/Logo'

type Phase = 'idle' | 'submitting' | 'processing' | 'done' | 'error'

interface Product {
  name: string
  image?: string
  site?: string
}

export default function TryPage() {
  const [url, setUrl] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [status, setStatus] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [product, setProduct] = useState<Product | null>(null)
  const [elapsedSec, setElapsedSec] = useState(0)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const tickRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') document.documentElement.setAttribute('data-theme', 'dark')
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [])

  async function submit() {
    if (!url.trim()) { setErrorMsg('Paste a product URL first.'); return }
    setErrorMsg('')
    setVideoUrl('')
    setProduct(null)
    setPhase('submitting')
    setStatus('Reading your product page…')
    setElapsedSec(0)

    try {
      const res = await fetch('/api/preview/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPhase('error')
        setErrorMsg(data.error ?? 'Preview failed. Try a different URL.')
        return
      }
      setProduct(data.product ?? null)
      setPhase('processing')
      setStatus('Seedance Mini is rendering your ad… usually 30–90 seconds.')
      tickRef.current = setInterval(() => setElapsedSec(s => s + 1), 1000)
      pollStatus(data.predictionId)
    } catch (e) {
      setPhase('error')
      setErrorMsg(e instanceof Error ? e.message : 'Network error')
    }
  }

  function pollStatus(predictionId: string) {
    if (pollRef.current) clearInterval(pollRef.current)
    let attempts = 0
    pollRef.current = setInterval(async () => {
      attempts++
      if (attempts > 60) {
        if (pollRef.current) clearInterval(pollRef.current)
        if (tickRef.current) clearInterval(tickRef.current)
        setPhase('error')
        setErrorMsg('Preview took too long. Try again in a moment.')
        return
      }
      try {
        const r = await fetch(`/api/ugc/video-status?videoId=${encodeURIComponent(predictionId)}&provider=seedance`)
        const d = await r.json()
        const v = d.video
        if (v?.status === 'completed' && v?.videoUrl) {
          if (pollRef.current) clearInterval(pollRef.current)
          if (tickRef.current) clearInterval(tickRef.current)
          setVideoUrl(v.videoUrl)
          setPhase('done')
          setStatus('')
        } else if (v?.status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current)
          if (tickRef.current) clearInterval(tickRef.current)
          setPhase('error')
          setErrorMsg(v.error ?? 'Render failed. Try a different product URL.')
        }
      } catch { /* keep polling */ }
    }, 5000)
  }

  const inputDisabled = phase === 'submitting' || phase === 'processing'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #0a0a0a)', color: 'var(--ink, #f2f2f2)', fontFamily: 'var(--font-sans, system-ui)' }}>
      <header style={{ padding: '20px 24px', borderBottom: '1px solid var(--border, #222)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'var(--ink)' }}>
          <Logo size={22} />
          <span style={{ fontSize: 15 }}>Content<em>flow</em></span>
        </Link>
        <Link href="/auth/signup" style={{ padding: '8px 16px', fontSize: 13, background: 'var(--ink)', color: 'var(--bg)', borderRadius: 8, textDecoration: 'none', fontWeight: 500 }}>
          Sign up free
        </Link>
      </header>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 96px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'inline-block', padding: '6px 14px', borderRadius: 999, background: 'rgba(96, 165, 250, 0.12)', color: '#93c5fd', fontSize: 12, marginBottom: 20, letterSpacing: 0.3 }}>
            FREE PREVIEW · NO SIGNUP
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 44, lineHeight: 1.1, fontWeight: 400, margin: '0 0 16px' }}>
            See your product as a <em>UGC ad</em> in 60 seconds.
          </h1>
          <p style={{ fontSize: 16, color: 'var(--ink-dim, #999)', maxWidth: 520, margin: '0 auto', lineHeight: 1.55 }}>
            Paste any Shopify, TikTok Shop, Amazon, or product URL. We&apos;ll animate it into a 5-second UGC-style ad — no signup, no card.
          </p>
        </div>

        <section style={{ padding: 24, borderRadius: 16, border: '1px solid var(--border, #222)', background: 'var(--surface, #111)', marginBottom: 20 }}>
          <label style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--ink-dim, #888)', display: 'block', marginBottom: 8 }}>
            Your product URL
          </label>
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !inputDisabled && submit()}
            placeholder="https://yourstore.com/products/best-seller"
            disabled={inputDisabled}
            style={{
              width: '100%', padding: '14px 16px', fontSize: 15, borderRadius: 10,
              border: '1px solid var(--border, #333)', background: 'var(--bg, #0a0a0a)',
              color: 'var(--ink)', outline: 'none', fontFamily: 'inherit',
              opacity: inputDisabled ? 0.6 : 1,
            }}
          />
          <button
            onClick={submit}
            disabled={inputDisabled}
            style={{
              width: '100%', marginTop: 12, padding: '14px 20px', fontSize: 15, fontWeight: 500,
              borderRadius: 10, border: 'none', cursor: inputDisabled ? 'wait' : 'pointer',
              background: inputDisabled ? '#333' : 'var(--ink)',
              color: inputDisabled ? '#888' : 'var(--bg)',
              transition: 'all 0.15s ease',
            }}
          >
            {phase === 'submitting' ? 'Reading product…' : phase === 'processing' ? `Rendering… ${elapsedSec}s` : 'Generate free preview'}
          </button>
          {errorMsg && (
            <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', fontSize: 13.5 }}>
              {errorMsg}
            </div>
          )}
        </section>

        {(phase === 'processing' || phase === 'done') && product && (
          <section style={{ padding: 20, borderRadius: 16, border: '1px solid var(--border, #222)', background: 'var(--surface, #111)', marginBottom: 20, display: 'flex', gap: 16, alignItems: 'center' }}>
            {product.image && (
              <img src={product.image} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 10, background: '#222', flexShrink: 0 }} />
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</div>
              {product.site && <div style={{ fontSize: 12, color: 'var(--ink-dim, #888)' }}>{product.site}</div>}
            </div>
          </section>
        )}

        {phase === 'processing' && (
          <div style={{ padding: 28, borderRadius: 16, border: '1px solid var(--border, #222)', background: 'var(--surface, #111)', textAlign: 'center', marginBottom: 20 }}>
            <div style={{ width: 40, height: 40, border: '3px solid #333', borderTopColor: '#93c5fd', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.9s linear infinite' }} />
            <div style={{ fontSize: 14, color: 'var(--ink-dim, #999)' }}>{status}</div>
            <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {phase === 'done' && videoUrl && (
          <>
            <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border, #222)', background: '#000', marginBottom: 20 }}>
              <video src={videoUrl} controls autoPlay loop playsInline style={{ width: '100%', display: 'block', maxHeight: '70vh', background: '#000' }} />
            </div>

            <section style={{ padding: 24, borderRadius: 16, border: '1px solid rgba(96, 165, 250, 0.3)', background: 'linear-gradient(135deg, rgba(96, 165, 250, 0.08) 0%, rgba(139, 92, 246, 0.06) 100%)', marginBottom: 20 }}>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: '#93c5fd', marginBottom: 10 }}>
                About this preview
              </div>
              <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink, #f2f2f2)', margin: '0 0 16px' }}>
                This ad was rendered on <strong>Seedance Mini</strong> — our budget model at 480p, 5 seconds, watermarked. Subscribe to unlock:
              </p>
              <ul style={{ margin: '0 0 20px', padding: 0, listStyle: 'none', display: 'grid', gap: 8, fontSize: 14, color: 'var(--ink-dim, #ccc)' }}>
                <li>✓ <strong>Seedance 2.0 &amp; 2.5</strong> — sharper motion, better prompt fidelity</li>
                <li>✓ <strong>720p, 1080p, 4K</strong> resolutions</li>
                <li>✓ <strong>Native audio</strong> — real voice, ambient sound, music</li>
                <li>✓ <strong>Up to 30-second clips</strong>, chained together</li>
                <li>✓ <strong>No watermark</strong> on Starter and above</li>
                <li>✓ <strong>AI Influencers, Product Studio, carousels, captions</strong> — all in one wallet</li>
                <li>✓ <strong>Credits that never expire</strong></li>
              </ul>
              <Link href="/auth/signup" style={{ display: 'inline-block', padding: '12px 22px', background: 'var(--ink, #f2f2f2)', color: 'var(--bg, #0a0a0a)', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>
                Start free — 30 credits included
              </Link>
              <Link href="/pricing" style={{ display: 'inline-block', marginLeft: 12, padding: '12px 22px', border: '1px solid var(--border, #333)', color: 'var(--ink)', borderRadius: 10, textDecoration: 'none', fontSize: 14 }}>
                See plans
              </Link>
            </section>

            <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-dim, #666)' }}>
              You&apos;ve used your free preview for this week. Sign up to generate as many as you want.
            </div>
          </>
        )}

        {phase === 'idle' && (
          <div style={{ marginTop: 32, padding: 20, borderRadius: 12, background: 'var(--surface, #111)', border: '1px dashed var(--border, #333)', fontSize: 13, color: 'var(--ink-dim, #888)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--ink, #ccc)' }}>How it works:</strong> we scrape your product page for the image + name, then use Seedance Mini (our budget video model) to animate it into a 5-second vertical ad. One free preview per visitor, per week. No card, no signup.
          </div>
        )}
      </main>
    </div>
  )
}
