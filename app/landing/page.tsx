'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Sun, Moon, Menu, X } from 'lucide-react'
import { DEMO_VIDEOS } from '@/lib/demo-gallery'

// Landing page — editorial design from the Claude Design export.
// Hero + Features (6-up grid) + Pricing (3 cards) + closing CTA + Footer.
// Every signup CTA routes to /auth/signup so the funnel is consistent.

export default function LandingPage() {
  const [isDark, setIsDark] = useState(true)  // Landing defaults to dark
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    // Default dark on landing; respect an explicit user override.
    const saved = typeof window !== 'undefined' ? localStorage.getItem('cf-theme') : null
    const shouldDark = saved ? saved === 'dark' : true
    setIsDark(shouldDark)
    if (shouldDark) document.documentElement.setAttribute('data-theme', 'dark')
    else document.documentElement.removeAttribute('data-theme')
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
            <Link href="/pricing" style={navLink}>Pricing</Link>
            <Link href="/help" style={navLink}>Docs</Link>
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} className="ls-actions">
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
            <Link href="/auth/login" style={btnSecondaryLink} className="ls-signin">Sign in</Link>
            <Link href="/auth/signup" style={btnPrimaryLink}>Get started</Link>
          </div>
          {/* Burger — shown ≤640px in place of Sign in + nav links */}
          <button
            className="ls-burger"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen(o => !o)}
            style={{
              display: 'none',
              width: 40, height: 40, borderRadius: 10,
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--ink)', cursor: 'pointer',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
        {/* Mobile drop-panel: shows the same nav + Sign in when the burger is open. */}
        {menuOpen && (
          <div className="ls-mobile-panel" style={{
            display: 'none',
            padding: '10px 20px 20px', borderTop: '1px solid var(--border)',
            flexDirection: 'column', gap: 4,
            background: 'var(--bg)',
          }}>
            <a href="#features" onClick={() => setMenuOpen(false)} style={mobileNavItem}>Features</a>
            <Link href="/pricing" onClick={() => setMenuOpen(false)} style={mobileNavItem}>Pricing</Link>
            <Link href="/help" onClick={() => setMenuOpen(false)} style={mobileNavItem}>Docs</Link>
            <Link href="/auth/login" onClick={() => setMenuOpen(false)} style={mobileNavItem}>Sign in</Link>
            {/* On the smallest phones, the theme toggle and Get started move
                inside the burger to keep the header uncluttered. */}
            <div className="ls-mobile-actions" style={{
              display: 'none',
              marginTop: 10, paddingTop: 14, borderTop: '1px solid var(--border-soft)',
              gap: 10,
            }}>
              <button
                onClick={() => { toggleTheme() }}
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                style={{
                  flex: '0 0 auto', width: 44, height: 44, borderRadius: 10,
                  background: 'transparent', border: '1px solid var(--border)',
                  color: 'var(--ink)', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {isDark ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <Link href="/auth/signup" onClick={() => setMenuOpen(false)} style={{
                flex: 1, textAlign: 'center', padding: '12px 16px', borderRadius: 10,
                background: 'var(--ink)', color: 'var(--on-ink)',
                fontSize: 14.5, fontWeight: 600, whiteSpace: 'nowrap',
              }}>
                Get started
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* HERO — Hokusai's Great Wave (public domain) as a soft backdrop */}
      <section style={{ position: 'relative', overflow: 'hidden' }}>
        <img src="/images/hero-wave.jpg" alt="" aria-hidden
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center 30%',
            opacity: 0.16, filter: 'saturate(0.85)', pointerEvents: 'none',
          }} />
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(to bottom, var(--bg) 0%, transparent 40%, transparent 62%, var(--bg) 100%)',
        }} />
        <div style={{ position: 'relative', maxWidth: 1200, margin: '0 auto', padding: '100px 20px 120px', textAlign: 'center' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <div style={heroEyebrow}>The future of UGC</div>
            <h1 style={heroH1} className="ls-hero-h1">
              Turn any product into a <span style={{ fontStyle: 'italic' }}>scroll-stopping ad.</span>
            </h1>
            <p style={heroP}>Script. Character. Voice. Captions. B-roll. Product photos. Social copy. Blog. Email.<br />One brand profile. Every format. 2 minutes.</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
              <Link href="/auth/signup" style={btnPrimaryLg}>Create your first ad</Link>
              <a href="#features" style={btnSecondaryLg}>See how it works</a>
            </div>
          </div>
          <UGCMockup />
        </div>
      </section>

      {/* MADE WITH CONTENTFLOW — auto-scrolling marquee (hidden until curated demos exist) */}
      {DEMO_VIDEOS.length > 0 && (
      <section style={{ padding: '0 0 100px', overflow: 'hidden' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 28 }}>
          <h2 style={{ ...sectionH2, fontSize: 28, margin: 0 }}>Made with <em>ContentFlow</em></h2>
          <Link href="/auth/signup" style={{ fontSize: 13, color: 'var(--ink-mute)', fontWeight: 500 }}>Try it free →</Link>
        </div>
        <div className="ls-marquee">
          <div className="ls-marquee-track">
            {[...DEMO_VIDEOS, ...DEMO_VIDEOS].map((v, i) => (
              <div key={`${v.label}-${i}`} style={demoCard} className="ls-demo-card">
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
        </div>
        <style>{`
          .ls-marquee { width: 100%; overflow: hidden; }
          .ls-marquee-track {
            display: flex; gap: 18px; width: max-content;
            animation: ls-scroll 70s linear infinite;
            will-change: transform;
          }
          .ls-marquee:hover .ls-marquee-track { animation-play-state: paused; }
          @keyframes ls-scroll {
            from { transform: translateX(0); }
            to { transform: translateX(-50%); }
          }
          .ls-demo-card { width: 240px; flex-shrink: 0; }
          @media (max-width: 640px) { .ls-demo-card { width: 180px; } }
        `}</style>
      </section>
      )}

      {/* FEATURES */}
      <section id="features" style={{ maxWidth: 1200, margin: '0 auto', padding: '100px 20px' }}>
        <div style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto 50px' }}>
          <h2 style={sectionH2}>One brand profile.<br/><span style={{ fontStyle: 'italic', color: 'var(--ink-mute)' }}>Every format.</span></h2>
          <p style={sectionP}>Other tools make one video at a time. ContentFlow runs your brand&apos;s entire content stack — video ads, product photos, captions, blog posts, emails — all from the same profile.</p>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 40, marginBottom: 48 }} className="ls-foot-grid">
            <div>
              <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span className="brand-mark" style={{ width: 28, height: 28 }}><img src="/logo-icon.png" alt="ContentFlow" /></span>
                <div className="brand-name" style={{ fontSize: 15 }}>Content<em>flow</em></div>
              </Link>
              <p style={{ fontSize: 13, color: 'var(--ink-mute)', margin: 0, lineHeight: 1.6 }}>Your brand&apos;s entire content team, in one app.</p>
            </div>
            <div>
              <div style={footH}>Product</div>
              <ul style={footList}>
                <li><a href="#features" style={footLink}>Features</a></li>
                <li><Link href="/pricing" style={footLink}>Pricing</Link></li>
                <li><Link href="/help" style={footLink}>Docs</Link></li>
              </ul>
            </div>
            <div>
              <div style={footH}>Company</div>
              <ul style={footList}>
                <li><Link href="/about" style={footLink}>About</Link></li>
                <li><Link href="/blog" style={footLink}>Blog</Link></li>
                <li><Link href="/contact" style={footLink}>Contact</Link></li>
              </ul>
            </div>
            <div>
              <div style={footH}>Compare</div>
              <ul style={footList}>
                <li><Link href="/vs/higgsfield" style={footLink}>vs Higgsfield</Link></li>
                <li><Link href="/vs/arcads" style={footLink}>vs Arcads</Link></li>
                <li><Link href="/vs/heygen" style={footLink}>vs HeyGen</Link></li>
                <li><Link href="/vs/runway" style={footLink}>vs Runway</Link></li>
              </ul>
            </div>
            <div>
              <div style={footH}>Legal</div>
              <ul style={footList}>
                <li><Link href="/privacy" style={footLink}>Privacy</Link></li>
                <li><Link href="/terms" style={footLink}>Terms</Link></li>
                <li><Link href="/refunds" style={footLink}>Refund policy</Link></li>
                <li><Link href="/cookies" style={footLink}>Cookies</Link></li>
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
          .ls-hero-h1 { font-size: 38px !important; }
          .ls-pricing { grid-template-columns: 1fr !important; }
          .ls-foot-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

// ---- Static content ----
const FEATURES = [
  {
    title: 'UGC video packages',
    body: 'One product photo in — a finished UGC ad out: script, character, voice, captions and b-roll, ready to post.',
    svg: <>
      <path d="M20 4c-4 0-10 4-12 16l3-1.5 1.5-3.5C15 12 18 8 20 4z"/>
      <path d="M8 20l2-6.5"/>
      <path d="M8 20c-1 .5-1.5.5-2 1 .5-1 1-2 2-1z" fill="currentColor" strokeWidth="0"/>
      <path d="M18 2l.6 1.4L20 4l-1.4.6L18 6l-.6-1.4L16 4l1.4-.6L18 2z" fill="currentColor" strokeWidth="0"/>
    </>,
  },
  {
    title: 'AI influencers',
    body: 'Your AI creator remembers your brand across every shoot — same face, same voice, same identity, forever. No other tool does this.',
    svg: <>
      <rect x="2" y="8" width="20" height="13" rx="2"/>
      <path d="M2 8l3-6h14l3 6"/>
      <path d="M8 2L6 8M13 2l-1 6M18 2l-2 6"/>
    </>,
  },
  {
    title: 'Product Studio',
    body: 'Upload phone photos and get editorial product shots — splashes, flat lays, hero stacks. Those same photos feed your UGC ads, captions, and blog posts automatically.',
    svg: <>
      <path d="M2 12h2M6 7v10M10 4v16M14 7v10M18 9v6M22 12h-2"/>
    </>,
  },
  {
    title: 'CineMotion ads',
    body: 'Cinematic CGI product commercials from your product photos — physics-driven motion, designed environments, native audio.',
    svg: <>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z"/>
      <path d="M8 10h8M8 14h5"/>
    </>,
  },
  {
    title: 'Voices & captions',
    body: 'Natural AI narration plus word-synced captions burned straight into the video — no external editor needed.',
    svg: <>
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="M2 9h4M18 9h4M2 15h4M18 15h4M7 4v16M17 4v16"/>
    </>,
  },
  {
    title: 'Built-in editor & library',
    body: 'Trim, caption, and score your clips in the browser — every render backs up automatically to your own Google Drive.',
    svg: <>
      <path d="M12 2L2 9l10 13 10-13L12 2z"/>
      <path d="M2 9h20M7 9L12 2M17 9L12 2M7 9l5 13M17 9l-5 13"/>
    </>,
  },
]


// ---- Inline styles ----
const navLink: React.CSSProperties = { padding: '9px 16px', fontSize: 14, fontWeight: 500, color: 'var(--ink-mute)' }
const mobileNavItem: React.CSSProperties = { display: 'block', padding: '13px 4px', fontSize: 16, color: 'var(--ink)', fontWeight: 600, textDecoration: 'none', borderBottom: '1px solid var(--border-soft)' }
const btnPrimaryLink: React.CSSProperties = { padding: '9px 18px', borderRadius: 9, background: 'var(--ink)', color: 'var(--on-ink)', fontSize: 14, fontWeight: 600, border: 0, whiteSpace: 'nowrap' }
const btnSecondaryLink: React.CSSProperties = { padding: '9px 18px', borderRadius: 9, background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, fontWeight: 600, border: '1px solid var(--border)', whiteSpace: 'nowrap' }

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

// A miniature recreation of the actual UGC generator UI, used as the
// hero preview until we have a real demo video to swap in.
function UGCMockup() {
  return (
    <div className="ls-mockup" style={{
      marginTop: 72, maxWidth: 940, marginLeft: 'auto', marginRight: 'auto',
      borderRadius: 18, border: '1px solid var(--border)',
      background: 'var(--surface)',
      boxShadow: '0 30px 60px -20px rgba(20,18,12,0.18), 0 4px 12px rgba(20,18,12,0.06)',
      overflow: 'hidden', textAlign: 'left',
    }}>
      {/* Browser chrome */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '11px 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-elev)',
      }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
        <div style={{
          flex: 1, textAlign: 'center', fontSize: 11.5,
          color: 'var(--ink-mute)', fontFamily: 'var(--font-mono)',
        }}>contentflow-web.com/generate/ugc</div>
      </div>
      {/* App body: sidebar + main */}
      <div className="ls-mockup-body" style={{ display: 'grid', gridTemplateColumns: '180px 1fr' }}>
        {/* Sidebar */}
        <div className="ls-mockup-side" style={{
          padding: '18px 12px', borderRight: '1px solid var(--border)',
          background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px 12px' }}>
            <span style={{ width: 20, height: 20, borderRadius: 6, background: 'var(--ink)' }} />
            <span style={{ fontSize: 13, fontFamily: 'var(--font-serif)', color: 'var(--ink)' }}>Content<em>flow</em></span>
          </div>
          {['Dashboard', 'Library', 'Brand', 'Calendar'].map(l => (
            <div key={l} style={{ padding: '6px 8px', fontSize: 11.5, color: 'var(--ink-mute)' }}>{l}</div>
          ))}
          <div style={{ height: 1, background: 'var(--border-soft)', margin: '6px 4px' }} />
          {[
            { l: 'UGC Package', active: true, badge: 'Flagship' },
            { l: 'Influencers', active: false, badge: 'Beta' },
            { l: 'Product Studio', active: false, badge: 'Beta' },
            { l: 'Image', active: false },
            { l: 'Video', active: false },
          ].map(x => (
            <div key={x.l} style={{
              padding: '7px 8px', borderRadius: 7, fontSize: 11.5,
              background: x.active ? 'var(--ink)' : 'transparent',
              color: x.active ? 'var(--on-ink)' : 'var(--ink)',
              display: 'flex', alignItems: 'center', gap: 6, fontWeight: x.active ? 600 : 500,
            }}>
              <span style={{ flex: 1 }}>{x.l}</span>
              {x.badge && <span style={{
                fontSize: 8.5, padding: '2px 5px', borderRadius: 4,
                background: x.active ? 'rgba(255,255,255,0.18)' : 'var(--border-soft)',
                color: x.active ? '#fff' : 'var(--ink-mute)', fontWeight: 700, letterSpacing: '0.03em',
              }}>{x.badge.toUpperCase()}</span>}
            </div>
          ))}
        </div>
        {/* Main */}
        <div style={{ padding: '22px 24px 24px' }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', color: 'var(--ink-fade)', textTransform: 'uppercase' }}>STUDIO / UGC PACKAGE</div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '10px 0 18px' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, letterSpacing: '-0.01em', color: 'var(--ink)' }}>
              Turn <em>Skittles</em> into an ad
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-mute)' }}>~2 min</div>
          </div>
          {/* Two-column: product + character */}
          <div className="ls-mockup-cols" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg-elev)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-fade)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>Product</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ width: 44, height: 54, borderRadius: 6, background: 'linear-gradient(135deg,#e11d48,#f97316)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--ink)', fontWeight: 600 }}>Skittles Original</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>Candy · rainbow pack</div>
                </div>
              </div>
            </div>
            <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg-elev)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-fade)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>Creator</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#fde68a,#fca5a5)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--ink)', fontWeight: 600 }}>Ava · Gen-Z casual</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>Warm voice · 22 y/o</div>
                </div>
              </div>
            </div>
          </div>
          {/* Prompt */}
          <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg-elev)', border: '1px solid var(--border)', marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-fade)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>Hook</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.5 }}>
              &ldquo;I&apos;ve been eating Skittles wrong my whole life — here&apos;s the trick that changed everything.&rdquo;
            </div>
          </div>
          {/* Options row */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {[
              { l: '9:16', on: true },
              { l: '5 s', on: false },
              { l: '10 s', on: true },
              { l: '720p', on: true },
              { l: '+ Captions', on: true },
              { l: '+ B-roll', on: true },
            ].map(o => (
              <span key={o.l} style={{
                fontSize: 10.5, padding: '5px 9px', borderRadius: 999,
                background: o.on ? 'var(--ink)' : 'var(--surface)',
                color: o.on ? 'var(--on-ink)' : 'var(--ink-mute)',
                border: o.on ? 'none' : '1px solid var(--border)', fontWeight: 600,
              }}>{o.l}</span>
            ))}
          </div>
          {/* Cost + Generate */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
            <div style={{ fontSize: 11.5, color: 'var(--ink-mute)' }}>
              Cost: <strong style={{ color: 'var(--ink)' }}>184 cr</strong>
              <span style={{ marginLeft: 8 }}>Balance: <strong style={{ color: 'var(--good, #16a34a)' }}>2,000</strong></span>
            </div>
            <div style={{
              padding: '9px 16px', borderRadius: 9, background: 'var(--ink)',
              color: 'var(--on-ink)', fontSize: 12.5, fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'ls-pulse 1.4s ease-in-out infinite' }} />
              Generate UGC
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes ls-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.8); } }
        @media (max-width: 720px) {
          .ls-mockup-body { grid-template-columns: 1fr !important; }
          .ls-mockup-side { display: none !important; }
          .ls-mockup-cols { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
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
