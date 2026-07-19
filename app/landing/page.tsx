'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { DEMO_VIDEOS } from '@/lib/demo-gallery'

// Landing page — editorial design from the Claude Design export.
// Hero + Features (6-up grid) + Pricing (3 cards) + closing CTA + Footer.
// Every signup CTA routes to /auth/signup so the funnel is consistent.

export default function LandingPage() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('cf-theme') : null
    setIsDark(saved === 'dark')
  }, [])

  const toggleTheme = () => {
    const next = !isDark
    setIsDark(next)
    if (next) {
      document.documentElement.setAttribute('data-theme', 'dark')
      localStorage.setItem('cf-theme', 'dark')
    } else {
      document.documentElement.removeAttribute('data-theme')
      localStorage.setItem('cf-theme', 'light')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)' }}>
      {/* HEADER */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        background: 'color-mix(in srgb, var(--bg) 82%, transparent)',
        borderBottom: '1px solid var(--border)',
        padding: '16px 20px',
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ink)', textDecoration: 'none' }}>
            <span className="brand-mark" style={{ width: 28, height: 28 }}><img src="/logo-icon.png" alt="Contentflow" /></span>
            <div className="brand-name" style={{ fontSize: 15, color: 'var(--ink)' }}>Content<em>flow</em></div>
          </Link>
          <nav style={{ display: 'flex', alignItems: 'center', gap: 8 }} className="ls-nav">
            <a href="#features" style={navLink}>Features</a>
            <a href="#pricing" style={navLink}>Pricing</a>
            <Link href="/help" style={navLink}>Docs</Link>
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{
                width: 36, height: 36, borderRadius: 9,
                background: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--ink)',
                cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <Link href="/auth/login" style={btnSecondaryLink}>Sign in</Link>
            <Link href="/auth/signup" style={btnPrimaryLink}>Get started</Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '100px 20px 120px', textAlign: 'center' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={heroEyebrow}>The future of UGC</div>
          <h1 style={heroH1}>
            Turn any product into a <span style={{ fontStyle: 'italic' }}>scroll-stopping ad.</span>
          </h1>
          <p style={heroP}>One photo in. A finished UGC ad out — with script, character, voice, captions and B-roll. All in 2 minutes.</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
            <Link href="/auth/signup" style={btnPrimaryLg}>Create your first ad</Link>
            <a href="#features" style={btnSecondaryLg}>See how it works</a>
          </div>
        </div>
        <div style={heroPreview} />
      </section>

      {/* MADE WITH CONTENTFLOW — video showcase (hidden until curated demos exist) */}
      {DEMO_VIDEOS.length > 0 && (
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px 100px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 28 }}>
          <h2 style={{ ...sectionH2, fontSize: 28, margin: 0 }}>Made with <em>ContentFlow</em></h2>
          <Link href="/auth/signup" style={{ fontSize: 13, color: 'var(--ink-mute)', fontWeight: 500 }}>Try it free →</Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }} className="ls-demo-grid">
          {DEMO_VIDEOS.map(v => (
            <div key={v.label} style={demoCard} className="ls-demo-card">
              {v.type === 'video' ? (
                <video src={v.src} autoPlay muted loop playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <img src={v.src} alt={v.label} loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
              <div style={demoOverlay} />
              <div style={demoMeta}>
                <span style={demoTag}>{v.tag}</span>
                <span style={demoLabel}>{v.label}</span>
              </div>
            </div>
          ))}
        </div>
        <style>{`
          .ls-demo-grid { }
          .ls-demo-card { transition: transform 200ms, box-shadow 200ms; }
          .ls-demo-card:hover { transform: translateY(-4px); box-shadow: 0 16px 40px rgba(0,0,0,0.14); }
          @media (max-width: 640px) { .ls-demo-grid { grid-template-columns: 1fr !important; } }
        `}</style>
      </section>
      )}

      {/* FEATURES */}
      <section id="features" style={{ maxWidth: 1200, margin: '0 auto', padding: '100px 20px' }}>
        <div style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto 50px' }}>
          <h2 style={sectionH2}>Everything you need to win.<br/><span style={{ fontStyle: 'italic', color: 'var(--ink-mute)' }}>In one app.</span></h2>
          <p style={sectionP}>Stop hiring creators. Stop waiting 3 weeks for clips. Start selling today.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }} className="ls-features">
          {FEATURES.map((f, i) => (
            <div key={f.title} style={featureCard} className="ls-feat-card">
              <div style={featureCardInner}>
                <div style={featureTopRow}>
                  <div style={featureIcon}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{f.svg}</svg>
                  </div>
                  <span style={featureNum}>0{i + 1}</span>
                </div>
                <h3 style={featureH3}>{f.title}</h3>
                <p style={featureP}>{f.body}</p>
              </div>
            </div>
          ))}
        </div>
        <style>{`
          .ls-feat-card { transition: box-shadow 200ms, transform 200ms; }
          .ls-feat-card:hover {
            box-shadow: 0 8px 32px rgba(0,0,0,0.09), 0 2px 8px rgba(0,0,0,0.05);
            transform: translateY(-3px);
          }
        `}</style>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ maxWidth: 1200, margin: '0 auto', padding: '100px 20px' }}>
        <div style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto 50px' }}>
          <h2 style={sectionH2}>Fair pricing.<br/><span style={{ fontStyle: 'italic', color: 'var(--ink-mute)' }}>For everyone.</span></h2>
          <p style={sectionP}>No hidden fees. No long contracts. Credits roll month to month.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }} className="ls-pricing">
          <div style={priceCard}>
            <div style={priceName}>Free</div>
            <div style={priceRow}><span style={priceAmt}>$0</span><span style={priceUnit}>forever</span></div>
            <div style={priceMeta}>60 credits at signup · Explore the platform</div>
            <Link href="/auth/signup" style={btnSecondaryFull}>Get started</Link>
          </div>
          <div style={priceCard}>
            <div style={priceName}>Starter</div>
            <div style={priceRow}><span style={priceAmt}>$19</span><span style={priceUnit}>/month</span></div>
            <div style={priceMeta}>800 credits/month · ~8 UGC videos</div>
            <Link href="/auth/signup?plan=starter" style={btnSecondaryFull}>Get Starter</Link>
          </div>
          <div style={{ ...priceCard, border: '2px solid var(--ink)', position: 'relative' }}>
            <span style={popularBadge}>Most popular</span>
            <div style={priceName}>Pro</div>
            <div style={priceRow}><span style={priceAmt}>$49</span><span style={priceUnit}>/month</span></div>
            <div style={priceMeta}>2,000 credits/month · ~22 UGC videos</div>
            <Link href="/auth/signup?plan=pro" style={btnPrimaryFull}>Get Pro</Link>
          </div>
          <div style={priceCard}>
            <div style={priceName}>Agency</div>
            <div style={priceRow}><span style={priceAmt}>$149</span><span style={priceUnit}>/month</span></div>
            <div style={priceMeta}>6,500 credits/month · ~71 UGC videos</div>
            <Link href="/auth/signup?plan=agency" style={btnSecondaryFull}>Get Agency</Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '100px 20px', textAlign: 'center' }}>
        <h2 style={{ ...sectionH2, fontSize: 48 }}>Ready to make <span style={{ fontStyle: 'italic' }}>better ads?</span></h2>
        <p style={{ ...sectionP, marginBottom: 40 }}>Create your first UGC package today. No credit card required.</p>
        <Link href="/auth/signup" style={btnPrimaryXL}>Get started free</Link>
      </section>

      {/* FOOTER */}
      <footer style={{
        borderTop: '1px solid var(--border)', background: 'var(--surface)', padding: '60px 20px',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 40, marginBottom: 48 }} className="ls-foot-grid">
            <div>
              <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span className="brand-mark" style={{ width: 28, height: 28 }}><img src="/logo-icon.png" alt="ContentFlow" /></span>
                <div className="brand-name" style={{ fontSize: 15 }}>Content<em>flow</em></div>
              </Link>
              <p style={{ fontSize: 13, color: 'var(--ink-mute)', margin: 0, lineHeight: 1.6 }}>Premium UGC ads for indie founders.</p>
            </div>
            <div>
              <div style={footH}>Product</div>
              <ul style={footList}>
                <li><a href="#features" style={footLink}>Features</a></li>
                <li><a href="#pricing" style={footLink}>Pricing</a></li>
                <li><Link href="/help" style={footLink}>Docs</Link></li>
              </ul>
            </div>
            <div>
              <div style={footH}>Company</div>
              <ul style={footList}>
                <li><a href="#" style={footLink}>About</a></li>
                <li><a href="#" style={footLink}>Blog</a></li>
                <li><a href="#" style={footLink}>Contact</a></li>
              </ul>
            </div>
            <div>
              <div style={footH}>Legal</div>
              <ul style={footList}>
                <li><Link href="/privacy" style={footLink}>Privacy</Link></li>
                <li><a href="#" style={footLink}>Terms</a></li>
                <li><a href="#" style={footLink}>Cookies</a></li>
              </ul>
            </div>
          </div>
          <div style={{ paddingTop: 32, borderTop: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-fade)' }}>© 2026 ContentFlow. All rights reserved.</div>
            <div style={{ display: 'flex', gap: 16 }}>
              <a href="#" style={{ fontSize: 12, color: 'var(--ink-mute)' }}>Twitter</a>
              <a href="#" style={{ fontSize: 12, color: 'var(--ink-mute)' }}>LinkedIn</a>
              <a href="#" style={{ fontSize: 12, color: 'var(--ink-mute)' }}>Instagram</a>
            </div>
          </div>
        </div>
      </footer>

      <style>{`
        @media (max-width: 768px) {
          .ls-nav { display: none !important; }
          .ls-features { grid-template-columns: 1fr !important; gap: 20px !important; }
          .ls-pricing { grid-template-columns: repeat(2, 1fr) !important; gap: 16px !important; }
          .ls-foot-grid { grid-template-columns: 1fr 1fr !important; gap: 24px !important; }
        }
        @media (max-width: 640px) {
          h1 { font-size: 42px !important; }
          h2 { font-size: 36px !important; }
        }
      `}</style>
    </div>
  )
}

// ---- Static content ----
const FEATURES = [
  {
    title: 'AI-powered scripts',
    body: 'AI writes 3 scroll-stopping hooks per product — pick your angle, ship in seconds.',
    svg: <>
      <path d="M20 4c-4 0-10 4-12 16l3-1.5 1.5-3.5C15 12 18 8 20 4z"/>
      <path d="M8 20l2-6.5"/>
      <path d="M8 20c-1 .5-1.5.5-2 1 .5-1 1-2 2-1z" fill="currentColor" strokeWidth="0"/>
      <path d="M18 2l.6 1.4L20 4l-1.4.6L18 6l-.6-1.4L16 4l1.4-.6L18 2z" fill="currentColor" strokeWidth="0"/>
    </>,
  },
  {
    title: 'Talking-head video',
    body: 'Our video engine renders your character with lifelike motion and native voice — one generation, done.',
    svg: <>
      <rect x="2" y="8" width="20" height="13" rx="2"/>
      <path d="M2 8l3-6h14l3 6"/>
      <path d="M8 2L6 8M13 2l-1 6M18 2l-2 6"/>
    </>,
  },
  {
    title: 'Premium voices',
    body: 'Premium AI narration that sounds like a real creator — warm, natural, and on-brand.',
    svg: <>
      <path d="M2 12h2M6 7v10M10 4v16M14 7v10M18 9v6M22 12h-2"/>
    </>,
  },
  {
    title: 'Auto captions',
    body: 'AI word-syncs every syllable. Captions burn directly into the video — no editor needed.',
    svg: <>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z"/>
      <path d="M8 10h8M8 14h5"/>
    </>,
  },
  {
    title: 'B-roll cutaways',
    body: 'Product-anchored b-roll drops in mid-video — keeps eyes on screen and backs every claim.',
    svg: <>
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="M2 9h4M18 9h4M2 15h4M18 15h4M7 4v16M17 4v16"/>
    </>,
  },
  {
    title: 'Brand kit',
    body: 'Save your tone, product details, and actor once. Every generation inherits your brand automatically.',
    svg: <>
      <path d="M12 2L2 9l10 13 10-13L12 2z"/>
      <path d="M2 9h20M7 9L12 2M17 9L12 2M7 9l5 13M17 9l-5 13"/>
    </>,
  },
]


// ---- Inline styles ----
const navLink: React.CSSProperties = { padding: '9px 16px', fontSize: 14, fontWeight: 500, color: 'var(--ink-mute)' }
const btnPrimaryLink: React.CSSProperties = { padding: '9px 18px', borderRadius: 9, background: 'var(--ink)', color: 'var(--on-ink)', fontSize: 14, fontWeight: 600, border: 0 }
const btnSecondaryLink: React.CSSProperties = { padding: '9px 18px', borderRadius: 9, background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, fontWeight: 600, border: '1px solid var(--border)' }

const heroEyebrow: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-fade)', marginBottom: 14 }
const heroH1: React.CSSProperties = { fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 64, lineHeight: 1.05, letterSpacing: '-0.02em', margin: '0 0 20px' }
const heroP: React.CSSProperties = { fontSize: 18, color: 'var(--ink-dim)', margin: '0 0 36px', lineHeight: 1.7 }
const btnPrimaryLg: React.CSSProperties = { padding: '13px 28px', borderRadius: 11, background: 'var(--ink)', color: 'var(--on-ink)', fontSize: 14, fontWeight: 600, border: 0 }
const btnSecondaryLg: React.CSSProperties = { padding: '13px 28px', borderRadius: 11, background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, fontWeight: 600, border: '1px solid var(--border)' }
const btnPrimaryXL: React.CSSProperties = { padding: '14px 32px', borderRadius: 11, background: 'var(--ink)', color: 'var(--on-ink)', fontSize: 15, fontWeight: 600, border: 0 }

const heroPreview: React.CSSProperties = {
  marginTop: 80, aspectRatio: '1.6',
  borderRadius: 18, border: '1px solid var(--border)',
  background: '#111',
  overflow: 'hidden',
  position: 'relative',
}
const heroPreviewPlay: React.CSSProperties = {
  width: 56, height: 56, borderRadius: '50%',
  background: 'var(--surface)', border: '1px solid var(--border-strong)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: 'var(--shadow-md)',
}

const sectionH2: React.CSSProperties = { fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 44, lineHeight: 1.1, letterSpacing: '-0.01em', margin: '0 0 12px' }
const sectionP: React.CSSProperties = { fontSize: 16, color: 'var(--ink-dim)', margin: 0, lineHeight: 1.6 }

const featureCard: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 18,
  overflow: 'hidden',
  boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
}
const featureCardInner: React.CSSProperties = {
  padding: '28px 28px 30px',
  background: 'linear-gradient(160deg, var(--surface) 0%, var(--surface-2) 100%)',
  height: '100%',
}
const featureTopRow: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20,
}
const featureIcon: React.CSSProperties = {
  width: 52, height: 52, borderRadius: 15,
  background: 'linear-gradient(145deg, #2E2C22 0%, #161610 100%)',
  color: '#E8E2D0',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '0 4px 20px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.08)',
  flexShrink: 0,
}
const featureNum: React.CSSProperties = {
  fontFamily: 'var(--font-serif)',
  fontSize: 26,
  fontWeight: 400,
  color: 'var(--border-strong)',
  lineHeight: 1,
  userSelect: 'none' as const,
}
const featureH3: React.CSSProperties = {
  fontFamily: 'var(--font-serif)',
  fontSize: 18,
  fontWeight: 400,
  margin: '0 0 10px',
  letterSpacing: '-0.02em',
  lineHeight: 1.2,
}
const featureP: React.CSSProperties = { fontSize: 13.5, color: 'var(--ink-dim)', margin: 0, lineHeight: 1.6 }

const priceCard: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 15, padding: 32 }
const popularBadge: React.CSSProperties = { position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', background: 'var(--ink)', color: 'var(--on-ink)', borderRadius: 999, padding: '4px 12px' }
const priceName: React.CSSProperties = { fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 8 }
const priceRow: React.CSSProperties = { display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 16 }
const priceAmt: React.CSSProperties = { fontFamily: 'var(--font-serif)', fontSize: 36, lineHeight: 1 }
const priceUnit: React.CSSProperties = { fontSize: 13, color: 'var(--ink-mute)' }
const priceMeta: React.CSSProperties = { fontSize: 13, color: 'var(--ink-dim)', marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border-soft)' }
const btnPrimaryFull: React.CSSProperties = { display: 'block', textAlign: 'center', width: '100%', padding: 11, border: 0, borderRadius: 9, background: 'var(--ink)', color: 'var(--on-ink)', fontWeight: 600, fontSize: 13 }
const btnSecondaryFull: React.CSSProperties = { display: 'block', textAlign: 'center', width: '100%', padding: 11, border: '1px solid var(--border)', borderRadius: 9, background: 'var(--surface)', color: 'var(--ink)', fontWeight: 600, fontSize: 13 }

const footH: React.CSSProperties = { fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 12 }
const footList: React.CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }
const footLink: React.CSSProperties = { fontSize: 13, color: 'var(--ink-mute)' }

const demoCard: React.CSSProperties = {
  position: 'relative', aspectRatio: '9/16', borderRadius: 16,
  overflow: 'hidden', background: '#111', border: '1px solid var(--border)',
  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
}
const demoOverlay: React.CSSProperties = {
  position: 'absolute', inset: 0,
  background: 'linear-gradient(to bottom, transparent 55%, rgba(0,0,0,0.55) 100%)',
  pointerEvents: 'none',
}
const demoMeta: React.CSSProperties = {
  position: 'absolute', bottom: 16, left: 14, right: 14,
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
}
const demoTag: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
  background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)',
  color: '#fff', borderRadius: 5, padding: '3px 7px', letterSpacing: '0.04em',
}
const demoLabel: React.CSSProperties = {
  fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.85)',
  letterSpacing: '-0.01em',
}
