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
  /** Landing hero variant: adds ambient glow, warmer palette, example URL chips */
  compact?: boolean
}

// Example URLs users can click to auto-fill — reduces cold-start friction.
const EXAMPLE_URLS = [
  { label: 'Allbirds', url: 'https://www.allbirds.com/products/mens-tree-runners' },
  { label: 'Ridge', url: 'https://ridge.com/products/wallet' },
  { label: 'Gymshark', url: 'https://www.gymshark.com/products/gymshark-crest-t-shirt-black-aw22' },
]

export function PreviewGenerator({ compact = false }: PreviewGeneratorProps) {
  const [url, setUrl] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [status, setStatus] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [product, setProduct] = useState<Product | null>(null)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [focused, setFocused] = useState(false)
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
      setStatus('Seedance Mini is rendering your ad…')
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
  const buttonLabel =
    phase === 'submitting' ? 'Reading product…'
    : phase === 'processing' ? `Rendering · ${elapsedSec}s`
    : 'Generate preview'

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 640, margin: '0 auto', textAlign: 'left' }}>
      {/* Ambient spotlight glow behind the card — premium software atmosphere */}
      {compact && (
        <div aria-hidden style={{
          position: 'absolute',
          inset: '-80px -80px -160px -80px',
          background: 'radial-gradient(ellipse 60% 55% at 50% 40%, rgba(185, 28, 28, 0.10) 0%, rgba(185, 28, 28, 0.04) 40%, transparent 75%)',
          filter: 'blur(20px)',
          zIndex: 0,
          pointerEvents: 'none',
        }} />
      )}

      {/* Main card — layered surface with inset highlight for real depth */}
      <div style={{
        position: 'relative',
        padding: '22px 22px 20px',
        borderRadius: 20,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'linear-gradient(180deg, rgba(28, 22, 20, 0.85) 0%, rgba(18, 15, 14, 0.85) 100%)',
        backdropFilter: 'blur(20px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.2)',
        boxShadow: [
          '0 1px 0 rgba(255, 255, 255, 0.06) inset',           // top edge highlight
          '0 -1px 0 rgba(0, 0, 0, 0.3) inset',                  // bottom edge shadow
          '0 30px 60px -20px rgba(0, 0, 0, 0.6)',               // ambient drop
          '0 8px 24px -8px rgba(185, 28, 28, 0.08)',            // warm accent bloom
        ].join(', '),
        zIndex: 1,
      }}>
        {/* Micro-label — mono, refined, not shouty */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
          fontFamily: 'var(--font-mono, ui-monospace, "SF Mono", Menlo, monospace)',
          fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase',
          color: 'rgba(200, 180, 170, 0.55)',
        }}>
          <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#b91c1c', boxShadow: '0 0 8px rgba(185, 28, 28, 0.6)' }} />
          Paste a product URL
        </div>

        {/* Input + Button row */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {/* Input with inset ring, link icon, focus glow */}
          <div style={{
            position: 'relative',
            flex: '1 1 280px', minWidth: 0,
            borderRadius: 12,
            background: 'rgba(10, 8, 8, 0.6)',
            border: `1px solid ${focused ? 'rgba(220, 200, 190, 0.35)' : 'rgba(255, 255, 255, 0.08)'}`,
            boxShadow: focused
              ? '0 0 0 3px rgba(185, 28, 28, 0.12), 0 1px 0 rgba(255, 255, 255, 0.04) inset'
              : '0 1px 0 rgba(255, 255, 255, 0.04) inset',
            transition: 'border-color 160ms ease, box-shadow 160ms ease',
          }}>
            {/* Link icon */}
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(200, 180, 170, 0.55)', pointerEvents: 'none' }}
            >
              <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.7 1.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.7-1.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={e => e.key === 'Enter' && !inputDisabled && submit()}
              placeholder="yourstore.com/products/best-seller"
              disabled={inputDisabled}
              style={{
                width: '100%', padding: '15px 16px 15px 40px', fontSize: 15,
                borderRadius: 12, border: 'none', background: 'transparent',
                color: 'var(--ink, #f5f0ec)', outline: 'none',
                fontFamily: 'inherit', letterSpacing: '-0.005em',
                opacity: inputDisabled ? 0.55 : 1,
              }}
            />
          </div>

          {/* Primary CTA — layered cream button with warm ring + arrow */}
          <button
            onClick={submit}
            disabled={inputDisabled}
            className="cf-preview-cta"
            style={{
              flex: '0 0 auto',
              padding: '0 22px', height: 50, fontSize: 14.5, fontWeight: 600,
              letterSpacing: '-0.005em',
              borderRadius: 12, border: 'none',
              cursor: inputDisabled ? 'wait' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: inputDisabled
                ? 'linear-gradient(180deg, #2a2422 0%, #1e1a18 100%)'
                : 'linear-gradient(180deg, #faf3ec 0%, #ebe0d4 100%)',
              color: inputDisabled ? 'rgba(200, 180, 170, 0.4)' : '#1a0f0d',
              boxShadow: inputDisabled
                ? '0 1px 0 rgba(255, 255, 255, 0.04) inset'
                : '0 1px 0 rgba(255, 255, 255, 0.5) inset, 0 -1px 0 rgba(120, 60, 40, 0.15) inset, 0 6px 16px -4px rgba(185, 28, 28, 0.25), 0 1px 3px rgba(0, 0, 0, 0.4)',
              transition: 'transform 140ms ease, box-shadow 140ms ease, filter 140ms ease',
              whiteSpace: 'nowrap',
            }}
          >
            {buttonLabel}
            {phase === 'idle' && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginLeft: -2 }}>
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
          <style>{`
            .cf-preview-cta:not(:disabled):hover { transform: translateY(-1px); filter: brightness(1.02); }
            .cf-preview-cta:not(:disabled):active { transform: translateY(0); }
          `}</style>
        </div>

        {/* Example URL chips — reduce cold-start friction */}
        {phase === 'idle' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: 'var(--font-mono, ui-monospace, monospace)',
              fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'rgba(200, 180, 170, 0.4)',
            }}>
              Try
            </span>
            {EXAMPLE_URLS.map(ex => (
              <button
                key={ex.label}
                type="button"
                onClick={() => setUrl(ex.url)}
                className="cf-preview-chip"
                style={{
                  padding: '5px 11px', fontSize: 12, fontWeight: 500,
                  borderRadius: 999, cursor: 'pointer',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: 'rgba(230, 215, 205, 0.75)',
                  fontFamily: 'inherit',
                  transition: 'background 140ms, border-color 140ms, color 140ms',
                }}
              >
                {ex.label}
              </button>
            ))}
            <style>{`
              .cf-preview-chip:hover {
                background: rgba(255, 255, 255, 0.08);
                border-color: rgba(220, 200, 190, 0.2);
                color: rgba(245, 235, 225, 1);
              }
            `}</style>
          </div>
        )}

        {errorMsg && (
          <div style={{
            marginTop: 12, padding: '10px 14px', borderRadius: 10,
            background: 'rgba(185, 28, 28, 0.10)',
            border: '1px solid rgba(185, 28, 28, 0.25)',
            color: '#fca5a5', fontSize: 13,
          }}>
            {errorMsg}
          </div>
        )}
      </div>

      {/* Trust line — sits below the card as a quiet spec plate */}
      <div style={{
        marginTop: 14, textAlign: 'center',
        fontFamily: 'var(--font-mono, ui-monospace, monospace)',
        fontSize: 10.5, letterSpacing: '0.11em', textTransform: 'uppercase',
        color: 'rgba(200, 180, 170, 0.4)',
        display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap',
      }}>
        <span>No signup</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>One preview per week</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>Seedance Mini · 480p</span>
      </div>

      {/* Result region */}
      <div ref={resultRef} style={{ scrollMarginTop: 24, position: 'relative', zIndex: 1 }}>
        {(phase === 'processing' || phase === 'done') && product && (
          <div style={{
            marginTop: 20, padding: 14, borderRadius: 14,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'linear-gradient(180deg, rgba(28, 22, 20, 0.7) 0%, rgba(18, 15, 14, 0.7) 100%)',
            backdropFilter: 'blur(12px)',
            display: 'flex', gap: 14, alignItems: 'center',
          }}>
            {product.image && (
              <img src={product.image} alt="" style={{
                width: 52, height: 52, objectFit: 'cover', borderRadius: 10,
                background: '#222', flexShrink: 0,
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }} />
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink, #f5f0ec)' }}>
                {product.name}
              </div>
              {product.site && (
                <div style={{
                  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
                  fontSize: 11, letterSpacing: '0.06em',
                  color: 'rgba(200, 180, 170, 0.55)',
                }}>
                  {product.site}
                </div>
              )}
            </div>
          </div>
        )}

        {phase === 'processing' && (
          <div style={{
            marginTop: 16, padding: 32, borderRadius: 14,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'linear-gradient(180deg, rgba(28, 22, 20, 0.6) 0%, rgba(18, 15, 14, 0.6) 100%)',
            backdropFilter: 'blur(12px)',
            textAlign: 'center',
          }}>
            <div style={{
              width: 34, height: 34,
              border: '2px solid rgba(255, 255, 255, 0.08)',
              borderTopColor: '#e6a67a',
              borderRadius: '50%', margin: '0 auto 14px',
              animation: 'cf-spin 0.9s linear infinite',
            }} />
            <div style={{ fontSize: 13.5, color: 'rgba(230, 215, 205, 0.75)' }}>{status}</div>
            <div style={{
              marginTop: 6,
              fontFamily: 'var(--font-mono, ui-monospace, monospace)',
              fontSize: 10.5, letterSpacing: '0.11em', textTransform: 'uppercase',
              color: 'rgba(200, 180, 170, 0.4)',
            }}>
              Usually 30–90 seconds
            </div>
            <style>{`@keyframes cf-spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {phase === 'done' && videoUrl && (
          <>
            <div style={{
              marginTop: 20, borderRadius: 16, overflow: 'hidden',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: '#000',
              boxShadow: '0 30px 60px -20px rgba(0, 0, 0, 0.6), 0 8px 24px -8px rgba(185, 28, 28, 0.15)',
            }}>
              <video src={videoUrl} controls autoPlay loop playsInline style={{ width: '100%', display: 'block', maxHeight: '70vh', background: '#000' }} />
            </div>

            <div style={{
              marginTop: 18, padding: 24, borderRadius: 16,
              border: '1px solid rgba(220, 200, 190, 0.14)',
              background: 'linear-gradient(180deg, rgba(35, 26, 22, 0.85) 0%, rgba(22, 17, 15, 0.85) 100%)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 1px 0 rgba(255, 255, 255, 0.05) inset, 0 20px 40px -10px rgba(0, 0, 0, 0.5)',
            }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 12,
                padding: '4px 10px 4px 8px', borderRadius: 999,
                background: 'rgba(185, 28, 28, 0.14)',
                border: '1px solid rgba(185, 28, 28, 0.28)',
                fontFamily: 'var(--font-mono, ui-monospace, monospace)',
                fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase',
                color: '#f5a691',
              }}>
                <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: '#f5a691' }} />
                Budget preview
              </div>
              <p style={{ fontSize: 14.5, lineHeight: 1.65, color: 'var(--ink, #f5f0ec)', margin: '0 0 16px' }}>
                Rendered on <strong style={{ color: '#faf3ec' }}>Seedance Mini</strong> — 480p, 5s, watermarked. Sign up to unlock <strong style={{ color: '#faf3ec' }}>Seedance 2.0 &amp; 2.5</strong>, 720p–4K, native audio, up to 30-second clips, no watermark, plus AI Influencers, Product Studio, carousels &amp; captions. Credits never expire.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link href="/auth/signup" className="cf-preview-cta" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '0 20px', height: 44, borderRadius: 11,
                  background: 'linear-gradient(180deg, #faf3ec 0%, #ebe0d4 100%)',
                  color: '#1a0f0d', textDecoration: 'none', fontSize: 14, fontWeight: 600,
                  boxShadow: '0 1px 0 rgba(255, 255, 255, 0.5) inset, 0 -1px 0 rgba(120, 60, 40, 0.15) inset, 0 6px 16px -4px rgba(185, 28, 28, 0.25)',
                  transition: 'transform 140ms ease, filter 140ms ease',
                }}>
                  Start free — 30 credits
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
                <Link href="/pricing" style={{
                  display: 'inline-flex', alignItems: 'center',
                  padding: '0 20px', height: 44, borderRadius: 11,
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: 'var(--ink, #f5f0ec)', textDecoration: 'none', fontSize: 14, fontWeight: 500,
                  background: 'rgba(255, 255, 255, 0.03)',
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
