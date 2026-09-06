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
      {/* Ambient spotlight glow behind the card — stronger so it reads on true black */}
      {compact && (
        <div aria-hidden style={{
          position: 'absolute',
          inset: '-100px -100px -180px -100px',
          background: 'radial-gradient(ellipse 65% 60% at 50% 40%, rgba(185, 28, 28, 0.22) 0%, rgba(185, 28, 28, 0.08) 40%, transparent 75%)',
          filter: 'blur(24px)',
          zIndex: 0,
          pointerEvents: 'none',
        }} />
      )}

      {/* Main card — visibly lifted off the page in dark mode via a warmer
          gray-brown surface, brighter warm border, and stronger inset highlight. */}
      <div style={{
        position: 'relative',
        padding: '22px 22px 20px',
        borderRadius: 20,
        border: '1px solid rgba(255, 220, 195, 0.12)',
        background: 'linear-gradient(180deg, rgba(42, 32, 28, 0.92) 0%, rgba(26, 20, 18, 0.94) 100%)',
        backdropFilter: 'blur(24px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.2)',
        boxShadow: [
          '0 1px 0 rgba(255, 220, 195, 0.10) inset',            // warm top edge highlight
          '0 -1px 0 rgba(0, 0, 0, 0.4) inset',                  // bottom edge shadow
          '0 40px 80px -20px rgba(0, 0, 0, 0.7)',               // deep ambient drop
          '0 12px 32px -12px rgba(185, 28, 28, 0.18)',          // warm accent bloom
          '0 0 0 1px rgba(255, 220, 195, 0.02)',                // hairline outer definition
        ].join(', '),
        zIndex: 1,
      }}>
        {/* Micro-label — mono, refined, not shouty */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
          fontFamily: 'var(--font-mono, ui-monospace, "SF Mono", Menlo, monospace)',
          fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase',
          color: 'rgba(230, 210, 195, 0.65)',
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
            background: 'rgba(8, 5, 4, 0.85)',
            border: `1px solid ${focused ? 'rgba(220, 200, 190, 0.4)' : 'rgba(255, 220, 195, 0.1)'}`,
            boxShadow: focused
              ? '0 0 0 3px rgba(185, 28, 28, 0.15), 0 2px 6px rgba(0, 0, 0, 0.4) inset'
              : '0 2px 6px rgba(0, 0, 0, 0.4) inset',
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
              className="cf-preview-input"
              style={{
                width: '100%', padding: '15px 16px 15px 40px', fontSize: 15,
                borderRadius: 12, border: 'none', background: 'transparent',
                color: '#f5f0ec', outline: 'none',
                fontFamily: 'inherit', letterSpacing: '-0.005em',
                opacity: inputDisabled ? 0.55 : 1,
                WebkitTextFillColor: '#f5f0ec',
              }}
            />
          </div>

          {/* Primary CTA — brand-red button with glass sheen + warm bloom */}
          <button
            onClick={submit}
            disabled={inputDisabled}
            className="cf-preview-cta"
            style={{
              position: 'relative',
              flex: '0 0 auto',
              padding: '0 24px', height: 52, fontSize: 14.5, fontWeight: 600,
              letterSpacing: '-0.005em',
              borderRadius: 12,
              border: '1px solid rgba(255, 210, 190, 0.14)',
              cursor: inputDisabled ? 'wait' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 9,
              background: inputDisabled
                ? 'linear-gradient(180deg, #2a2422 0%, #1e1a18 100%)'
                : 'linear-gradient(180deg, #d63a2a 0%, #a51818 100%)',
              color: inputDisabled ? 'rgba(200, 180, 170, 0.4)' : '#fef5ec',
              boxShadow: inputDisabled
                ? '0 1px 0 rgba(255, 255, 255, 0.04) inset'
                : [
                  '0 1px 0 rgba(255, 220, 200, 0.28) inset',       // top glass sheen
                  '0 -1px 0 rgba(0, 0, 0, 0.28) inset',             // bottom edge shadow
                  '0 10px 28px -8px rgba(185, 28, 28, 0.55)',       // warm outer bloom
                  '0 2px 6px rgba(0, 0, 0, 0.35)',                  // grounded drop
                  '0 0 0 1px rgba(185, 28, 28, 0.35)',              // subtle ring for definition
                ].join(', '),
              transition: 'transform 160ms ease, box-shadow 200ms ease, filter 160ms ease',
              whiteSpace: 'nowrap',
              textShadow: inputDisabled ? undefined : '0 1px 0 rgba(80, 10, 10, 0.35)',
              overflow: 'hidden',
            }}
          >
            {/* Top specular highlight — the "wet paint" gloss */}
            {!inputDisabled && (
              <span aria-hidden style={{
                position: 'absolute', inset: 0, borderRadius: 12,
                background: 'linear-gradient(180deg, rgba(255, 240, 220, 0.18) 0%, rgba(255, 240, 220, 0) 45%)',
                pointerEvents: 'none',
              }} />
            )}
            <span style={{ position: 'relative' }}>{buttonLabel}</span>
            {phase === 'idle' && (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ position: 'relative', marginLeft: -1 }}>
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
          <style>{`
            .cf-preview-cta:not(:disabled):hover {
              transform: translateY(-1px);
              filter: brightness(1.05) saturate(1.05);
              box-shadow:
                0 1px 0 rgba(255, 220, 200, 0.32) inset,
                0 -1px 0 rgba(0, 0, 0, 0.28) inset,
                0 14px 34px -8px rgba(185, 28, 28, 0.7),
                0 3px 8px rgba(0, 0, 0, 0.4),
                0 0 0 1px rgba(220, 60, 40, 0.5);
            }
            .cf-preview-cta:not(:disabled):active { transform: translateY(0); filter: brightness(0.98); }
            .cf-preview-input::placeholder { color: rgba(200, 180, 170, 0.35); }
            .cf-preview-input::-webkit-input-placeholder { color: rgba(200, 180, 170, 0.35); }
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
                  background: 'rgba(255, 220, 195, 0.06)',
                  border: '1px solid rgba(255, 220, 195, 0.12)',
                  color: 'rgba(240, 225, 215, 0.85)',
                  fontFamily: 'inherit',
                  transition: 'background 140ms, border-color 140ms, color 140ms',
                }}
              >
                {ex.label}
              </button>
            ))}
            <style>{`
              .cf-preview-chip:hover {
                background: rgba(255, 220, 195, 0.12);
                border-color: rgba(220, 200, 190, 0.28);
                color: rgba(255, 245, 235, 1);
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

      {/* Trust line — sits below the card as a quiet spec plate.
          Uses --ink-fade so it works on both light + dark page backgrounds. */}
      <div style={{
        marginTop: 14, textAlign: 'center',
        fontFamily: 'var(--font-mono, ui-monospace, monospace)',
        fontSize: 10.5, letterSpacing: '0.11em', textTransform: 'uppercase',
        color: 'var(--ink-fade, rgba(200, 180, 170, 0.5))',
        display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap',
        position: 'relative', zIndex: 1,
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
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#f5f0ec' }}>
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
              <p style={{ fontSize: 14.5, lineHeight: 1.65, color: '#f5f0ec', margin: '0 0 16px' }}>
                Rendered on <strong style={{ color: '#faf3ec' }}>Seedance Mini</strong> — 480p, 5s, watermarked. Sign up to unlock <strong style={{ color: '#faf3ec' }}>Seedance 2.0 &amp; 2.5</strong>, 720p–4K, native audio, up to 30-second clips, no watermark, plus AI Influencers, Product Studio, carousels &amp; captions. Credits never expire.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link href="/auth/signup" className="cf-preview-cta" style={{
                  position: 'relative', overflow: 'hidden',
                  display: 'inline-flex', alignItems: 'center', gap: 9,
                  padding: '0 22px', height: 46, borderRadius: 11,
                  border: '1px solid rgba(255, 210, 190, 0.14)',
                  background: 'linear-gradient(180deg, #d63a2a 0%, #a51818 100%)',
                  color: '#fef5ec', textDecoration: 'none', fontSize: 14, fontWeight: 600,
                  letterSpacing: '-0.005em',
                  boxShadow: '0 1px 0 rgba(255, 220, 200, 0.28) inset, 0 -1px 0 rgba(0, 0, 0, 0.28) inset, 0 10px 24px -8px rgba(185, 28, 28, 0.55), 0 2px 6px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(185, 28, 28, 0.35)',
                  textShadow: '0 1px 0 rgba(80, 10, 10, 0.35)',
                  transition: 'transform 160ms ease, filter 160ms ease',
                }}>
                  <span aria-hidden style={{
                    position: 'absolute', inset: 0, borderRadius: 11,
                    background: 'linear-gradient(180deg, rgba(255, 240, 220, 0.18) 0%, rgba(255, 240, 220, 0) 45%)',
                    pointerEvents: 'none',
                  }} />
                  <span style={{ position: 'relative' }}>Start free — 30 credits</span>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ position: 'relative' }}>
                    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
                <Link href="/pricing" style={{
                  display: 'inline-flex', alignItems: 'center',
                  padding: '0 20px', height: 44, borderRadius: 11,
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#f5f0ec', textDecoration: 'none', fontSize: 14, fontWeight: 500,
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
