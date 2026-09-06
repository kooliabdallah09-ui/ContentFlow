'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

type Phase = 'idle' | 'submitting' | 'processing' | 'done' | 'error'

interface Product {
  name: string
  image?: string
  site?: string
}

interface PreviewGeneratorProps {
  compact?: boolean  // Landing hero variant: tighter spacing, no leading tips block
}

export function PreviewGenerator({ compact = false }: PreviewGeneratorProps) {
  const [url, setUrl] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [status, setStatus] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [product, setProduct] = useState<Product | null>(null)
  const [elapsedSec, setElapsedSec] = useState(0)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const tickRef = useRef<NodeJS.Timeout | null>(null)
  const resultRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (tickRef.current) clearInterval(tickRef.current)
  }, [])

  useEffect(() => {
    if ((phase === 'processing' || phase === 'done') && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [phase])

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

  const cardBg = compact ? 'rgba(255,255,255,0.04)' : 'var(--surface, #111)'
  const cardBorder = compact ? '1px solid rgba(255,255,255,0.1)' : '1px solid var(--border, #222)'
  const inputBg = compact ? 'rgba(0,0,0,0.35)' : 'var(--bg, #0a0a0a)'

  return (
    <div style={{ width: '100%', maxWidth: 620, margin: '0 auto', textAlign: 'left' }}>
      <div style={{
        padding: compact ? 20 : 24,
        borderRadius: 16,
        border: cardBorder,
        background: cardBg,
        backdropFilter: compact ? 'blur(12px)' : undefined,
      }}>
        <label style={{
          fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6,
          color: 'var(--ink-dim, #888)', display: 'block', marginBottom: 8, fontWeight: 500,
        }}>
          Paste your product URL — Shopify, TikTok Shop, Amazon…
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !inputDisabled && submit()}
            placeholder="https://yourstore.com/products/best-seller"
            disabled={inputDisabled}
            style={{
              flex: '1 1 260px', minWidth: 0, padding: '14px 16px', fontSize: 15,
              borderRadius: 10, border: '1px solid var(--border, #333)',
              background: inputBg, color: 'var(--ink)', outline: 'none',
              fontFamily: 'inherit', opacity: inputDisabled ? 0.6 : 1,
            }}
          />
          <button
            onClick={submit}
            disabled={inputDisabled}
            style={{
              flex: '0 0 auto', padding: '14px 22px', fontSize: 15, fontWeight: 500,
              borderRadius: 10, border: 'none', cursor: inputDisabled ? 'wait' : 'pointer',
              background: inputDisabled ? '#333' : 'var(--ink)',
              color: inputDisabled ? '#888' : 'var(--bg)',
              whiteSpace: 'nowrap',
            }}
          >
            {phase === 'submitting' ? 'Reading…' : phase === 'processing' ? `Rendering ${elapsedSec}s` : 'Generate free preview'}
          </button>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--ink-dim, #888)' }}>
          Free · No signup · One preview per week · Powered by Seedance Mini (our budget model)
        </div>
        {errorMsg && (
          <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', fontSize: 13.5 }}>
            {errorMsg}
          </div>
        )}
      </div>

      <div ref={resultRef} style={{ scrollMarginTop: 24 }}>
        {(phase === 'processing' || phase === 'done') && product && (
          <div style={{
            marginTop: 16, padding: 16, borderRadius: 14, border: cardBorder,
            background: cardBg, display: 'flex', gap: 14, alignItems: 'center',
          }}>
            {product.image && (
              <img src={product.image} alt="" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 10, background: '#222', flexShrink: 0 }} />
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</div>
              {product.site && <div style={{ fontSize: 12, color: 'var(--ink-dim, #888)' }}>{product.site}</div>}
            </div>
          </div>
        )}

        {phase === 'processing' && (
          <div style={{
            marginTop: 16, padding: 28, borderRadius: 14, border: cardBorder,
            background: cardBg, textAlign: 'center',
          }}>
            <div style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,0.15)', borderTopColor: '#93c5fd', borderRadius: '50%', margin: '0 auto 14px', animation: 'cf-spin 0.9s linear infinite' }} />
            <div style={{ fontSize: 13.5, color: 'var(--ink-dim, #999)' }}>{status}</div>
            <style>{`@keyframes cf-spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {phase === 'done' && videoUrl && (
          <>
            <div style={{ marginTop: 16, borderRadius: 14, overflow: 'hidden', border: cardBorder, background: '#000' }}>
              <video src={videoUrl} controls autoPlay loop playsInline style={{ width: '100%', display: 'block', maxHeight: '70vh', background: '#000' }} />
            </div>

            <div style={{
              marginTop: 16, padding: 22, borderRadius: 14,
              border: '1px solid rgba(96, 165, 250, 0.3)',
              background: 'linear-gradient(135deg, rgba(96, 165, 250, 0.08) 0%, rgba(139, 92, 246, 0.06) 100%)',
            }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: '#93c5fd', marginBottom: 10, fontWeight: 500 }}>
                This is the budget preview
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink, #f2f2f2)', margin: '0 0 14px' }}>
                Rendered on <strong>Seedance Mini</strong> — 480p, 5s, watermarked. Sign up to unlock <strong>Seedance 2.0 &amp; 2.5</strong>, 720p–4K, native audio, up to 30-second clips, no watermark, plus AI Influencers, Product Studio, carousels &amp; captions. Credits never expire.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link href="/auth/signup" style={{
                  display: 'inline-block', padding: '11px 20px',
                  background: 'var(--ink, #f2f2f2)', color: 'var(--bg, #0a0a0a)',
                  borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 500,
                }}>
                  Start free — 30 credits
                </Link>
                <Link href="/pricing" style={{
                  display: 'inline-block', padding: '11px 20px',
                  border: '1px solid var(--border, #333)', color: 'var(--ink)',
                  borderRadius: 10, textDecoration: 'none', fontSize: 14,
                }}>
                  See plans
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
