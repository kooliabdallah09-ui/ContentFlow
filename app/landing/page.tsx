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
  const [activeFeatureTab, setActiveFeatureTab] = useState(0)
  const [featureVisible, setFeatureVisible] = useState(true)

  const switchTab = (i: number) => {
    if (i === activeFeatureTab) return
    setFeatureVisible(false)
    setTimeout(() => { setActiveFeatureTab(i); setFeatureVisible(true) }, 180)
  }

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
            <span className="brand-mark" style={{ width: 28, height: 28, borderRadius: 6, overflow: 'hidden', background: '#000', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><img src="/logo.png" alt="Contentflow" style={{ width: 22, height: 22, objectFit: 'contain' }} /></span>
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

      {/* HERO */}
      <section style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Subtle crimson radial glow behind the text */}
        <div style={{
          position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)',
          width: 700, height: 400, borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(185,28,28,0.13) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', maxWidth: 1200, margin: '0 auto', padding: '100px 20px 80px', textAlign: 'center' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <div style={heroEyebrow}>The future of UGC</div>
            <h1 style={heroH1} className="ls-hero-h1">
              Turn any product into a <span style={{ fontStyle: 'italic', color: '#b91c1c' }}>scroll-stopping ad.</span>
            </h1>
            <p style={heroP}>Script. Character. Voice. Captions. B-roll. Product photos. Social copy. Blog. Email.<br />One brand profile. Every format. 2 minutes.</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
              <Link href="/auth/signup" style={btnPrimaryLg}>Create your first ad</Link>
              <a href="#features" style={btnSecondaryLg}>See how it works</a>
            </div>
          </div>
          {/* Real app screenshot */}
          <div style={{
            marginTop: 72, maxWidth: 960, marginLeft: 'auto', marginRight: 'auto',
            borderRadius: 18, border: '1px solid var(--border)',
            boxShadow: '0 30px 80px -20px rgba(185,28,28,0.18), 0 4px 16px rgba(0,0,0,0.12)',
            overflow: 'hidden',
          }}>
            <img
              src="/hero-screenshot.png"
              alt="ContentFlow app"
              style={{ width: '100%', display: 'block' }}
            />
          </div>
        </div>
      </section>

      {/* POWERED BY — scrolling logo marquee */}
      <section style={{ padding: '36px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ marginBottom: 16, textAlign: 'center', fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--ink-fade)' }}>
          Powered by the world&apos;s best AI
        </div>
        <div style={{ position: 'relative', overflow: 'hidden' }}>
          <div className="pb-track">
            {[...POWERED_BY, ...POWERED_BY, ...POWERED_BY, ...POWERED_BY].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 40px', flexShrink: 0 }}>
                <div style={{ width: 28, height: 28, flexShrink: 0 }}>{item.logo}</div>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{item.name}</span>
              </div>
            ))}
          </div>
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
      </section>
      )}

      {/* FEATURE SHOWCASE — tabbed */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '100px 20px 60px' }}>
        <div style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto 48px' }}>
          <h2 style={sectionH2}>Every tool your brand needs.<br /><span style={{ fontStyle: 'italic', color: 'var(--ink-mute)' }}>One place.</span></h2>
        </div>
        {/* Tab bar */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 40, flexWrap: 'wrap' }}>
          {FEATURE_TABS.map((tab, i) => (
            <button key={tab.label} onClick={() => switchTab(i)} style={{
              padding: '9px 22px', borderRadius: 999, fontSize: 14, fontWeight: 600,
              border: activeFeatureTab === i ? 'none' : '1px solid var(--border)',
              background: activeFeatureTab === i ? 'var(--surface)' : 'transparent',
              color: activeFeatureTab === i ? 'var(--ink)' : 'var(--ink-mute)',
              cursor: 'pointer',
              boxShadow: activeFeatureTab === i ? '0 2px 12px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.18s ease',
            }}>{tab.label}</button>
          ))}
        </div>
        {/* Tab content */}
        <div style={{
          opacity: featureVisible ? 1 : 0,
          transform: featureVisible ? 'translateY(0)' : 'translateY(10px)',
          transition: 'opacity 0.22s ease, transform 0.22s ease',
        }}>
          {activeFeatureTab === 0 ? (
            /* ── Influencer Studio: portrait hero + floating chips ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Top: full-width portrait hero card */}
              <div style={{
                background: '#0d0d0d',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 20,
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
                minHeight: 400,
              }}>
                {/* Left: chips + text */}
                <div style={{
                  flex: '0 0 48%',
                  padding: '40px 44px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  position: 'relative',
                  zIndex: 2,
                }}>
                  {/* Attribute chips */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {['Luxury', 'Lifestyle', 'Fitness', 'Blonde', '18–24', 'Brown eyes', 'Long straight', 'Female'].map(chip => (
                      <span key={chip} style={{
                        fontSize: 12, padding: '6px 14px', borderRadius: 999,
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.65)',
                        fontWeight: 500,
                      }}>{chip}</span>
                    ))}
                  </div>
                  {/* Text block */}
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 400, margin: '0 0 12px', letterSpacing: '-0.03em', color: '#fff', lineHeight: 1.2 }}>
                      Build your AI creator<br />in minutes
                    </h3>
                    <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', margin: '0 0 22px', lineHeight: 1.65, maxWidth: 320 }}>
                      Pick a name, niche, look, and aesthetic from chips — or just describe them. ContentFlow generates a photorealistic portrait and 4K character sheet.
                    </p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {['NB Pro 4K', 'Character sheets', 'Reference upload'].map(t => (
                        <span key={t} style={{ fontSize: 11.5, padding: '4px 12px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>{t}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right: portrait */}
                <div style={{ flex: 1, position: 'relative' }}>
                  {/* Gradient bleed from left */}
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0, width: '55%',
                    background: 'linear-gradient(to right, #0d0d0d 0%, transparent 100%)',
                    zIndex: 1, pointerEvents: 'none',
                  }} />
                  {/* Gradient at bottom */}
                  <div style={{
                    position: 'absolute', left: 0, right: 0, bottom: 0, height: '30%',
                    background: 'linear-gradient(to top, #0d0d0d 0%, transparent 100%)',
                    zIndex: 1, pointerEvents: 'none',
                  }} />
                  <img
                    src="/feat-influencer-portrait.png"
                    alt="AI influencer portrait"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
                  />
                  {/* Floating labels on portrait */}
                  <div style={{ position: 'absolute', top: 28, right: 28, zIndex: 2, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                    <span style={{ fontSize: 11.5, padding: '5px 13px', borderRadius: 999, background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(12px)', fontWeight: 500 }}>Photorealistic · 4K</span>
                    <span style={{ fontSize: 11.5, padding: '5px 13px', borderRadius: 999, background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(12px)', fontWeight: 500 }}>NB Pro</span>
                  </div>
                </div>
              </div>

              {/* Bottom card — studio dashboard */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden' }}>
                <div style={{ overflow: 'hidden' }}>
                  <img src="/feat-influencer-studio.png" alt="Influencer studio dashboard" style={{ width: '100%', display: 'block' }} />
                </div>
                <div style={{ padding: '18px 24px 22px' }}>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 400, margin: '0 0 6px', letterSpacing: '-0.02em' }}>Full studio at your fingertips</h3>
                  <p style={{ fontSize: 13, color: 'var(--ink-dim)', margin: 0, lineHeight: 1.55 }}>Manage all your AI creators, shoot UGC, and generate character sheets — all from one dashboard.</p>
                </div>
              </div>
            </div>
          ) : (
            /* ── Generic layout for all other tabs ── */
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="ls-feat-showcase">
              {/* Big card — left */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden' }}>
                <div style={{
                  aspectRatio: '4/3',
                  background: FEATURE_TABS[activeFeatureTab].cards[0].gradient,
                  overflow: 'hidden', position: 'relative',
                }}>
                  {FEATURE_TABS[activeFeatureTab].cards[0].img && (
                    <img src={FEATURE_TABS[activeFeatureTab].cards[0].img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: FEATURE_TABS[activeFeatureTab].cards[0].imgPosition ?? 'top center' }} />
                  )}
                </div>
                <div style={{ padding: '24px 28px 28px' }}>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 400, margin: '0 0 10px', letterSpacing: '-0.02em' }}>
                    {FEATURE_TABS[activeFeatureTab].cards[0].title}
                  </h3>
                  <p style={{ fontSize: 14, color: 'var(--ink-dim)', margin: '0 0 16px', lineHeight: 1.6 }}>
                    {FEATURE_TABS[activeFeatureTab].cards[0].body}
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {FEATURE_TABS[activeFeatureTab].cards[0].tags?.map(t => (
                      <span key={t} style={{ fontSize: 11.5, padding: '4px 12px', borderRadius: 999, border: '1px solid var(--border)', color: 'var(--ink-mute)', fontWeight: 500 }}>{t}</span>
                    ))}
                  </div>
                </div>
              </div>
              {/* Two stacked cards — right */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {FEATURE_TABS[activeFeatureTab].cards.slice(1, 3).map((card, j) => (
                  <div key={j} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden', flex: 1 }}>
                    <div style={{
                      height: 160,
                      background: card.gradient,
                      overflow: 'hidden', position: 'relative',
                    }}>
                      {card.img && (
                        <img src={card.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: card.imgPosition ?? 'top center' }} />
                      )}
                    </div>
                    <div style={{ padding: '20px 24px 24px' }}>
                      <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 400, margin: '0 0 8px', letterSpacing: '-0.02em' }}>{card.title}</h3>
                      <p style={{ fontSize: 13.5, color: 'var(--ink-dim)', margin: 0, lineHeight: 1.6 }}>{card.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <style>{`
          @media (max-width: 720px) {
            .ls-feat-showcase { grid-template-columns: 1fr !important; }
            .ls-inf-row { flex-direction: column !important; }
          }
        `}</style>
      </section>

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
                <span className="brand-mark" style={{ width: 28, height: 28, borderRadius: 6, overflow: 'hidden', background: '#000', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><img src="/logo.png" alt="ContentFlow" style={{ width: 22, height: 22, objectFit: 'contain' }} /></span>
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

// ---- Feature tab showcase data ----
const FEATURE_TABS = [
  {
    label: 'Influencer Studio',
    cards: [
      {
        title: 'Build your AI creator in minutes',
        body: 'Pick a name, niche, look, and aesthetic from chips — or just describe them. ContentFlow generates a photorealistic portrait and 4K character sheet. Your creator, yours forever.',
        tags: ['NB Pro 4K', 'Character sheets', 'Reference upload'],
        gradient: 'linear-gradient(135deg, #c8a060 0%, #7a3a10 100%)',
        img: '/feat-create-influencer.png',
        imgPosition: 'top center',
      },
      {
        title: 'Photorealistic results',
        body: 'Real skin texture, natural light, genuine expressions. Looks like a real person — because the model was built for it.',
        gradient: 'linear-gradient(135deg, #1e3a5f 0%, #0f1f36 100%)',
        img: '/feat-influencer-portrait.png',
        imgPosition: '20% center',
      },
      {
        title: 'Full studio at your fingertips',
        body: 'Manage all your AI creators, shoot UGC, and generate character sheets — all from one dashboard.',
        gradient: 'linear-gradient(135deg, #2d5a3d 0%, #142a1c 100%)',
        img: '/feat-influencer-studio.png',
        imgPosition: 'top left',
      },
    ],
  },
  {
    label: 'Video Generator',
    cards: [
      {
        title: 'UGC ads that look real',
        body: 'Drop a product photo, pick your AI creator, choose a hook. Get a finished 9:16 UGC ad with voice, captions, and b-roll — ready to post.',
        tags: ['Seedance 2.0', 'Kling v3', '9:16 & 16:9'],
        gradient: 'linear-gradient(135deg, #1a2a1a 0%, #0a180a 100%)',
        img: undefined as string | undefined,
        imgPosition: 'center',
      },
      {
        title: 'Native captions',
        body: 'Word-synced captions burned directly into the video. No editor needed.',
        gradient: 'linear-gradient(135deg, #1a3a5c 0%, #0a1a2e 100%)',
        img: undefined as string | undefined,
        imgPosition: 'top center',
      },
      {
        title: 'Multiple formats',
        body: 'Generate 5s hooks, 10s demos, or 30s full ads — same product, different angles.',
        gradient: 'linear-gradient(135deg, #4a1a1a 0%, #2a0a0a 100%)',
        img: undefined as string | undefined,
        imgPosition: 'top center',
      },
    ],
  },
  {
    label: 'Image Generator',
    cards: [
      {
        title: 'Studio-quality photos',
        body: 'Generate editorial product shots, lifestyle photos, and social content from a single prompt. No photographer needed.',
        tags: ['NB Pro 4K', '4K resolution', 'Batch generate'],
        gradient: 'linear-gradient(135deg, #5a3a1a 0%, #2a1a0a 100%)',
        img: undefined as string | undefined,
        imgPosition: 'top center',
      },
      {
        title: 'Brand-consistent',
        body: 'Lock your color palette, tone, and style. Every image stays on-brand automatically.',
        gradient: 'linear-gradient(135deg, #1a4a3a 0%, #0a2a1a 100%)',
        img: undefined as string | undefined,
        imgPosition: 'top center',
      },
      {
        title: 'Instant variations',
        body: 'Generate 4 versions at once. Pick the best, tweak, regenerate.',
        gradient: 'linear-gradient(135deg, #3a3a5a 0%, #1a1a3a 100%)',
        img: undefined as string | undefined,
        imgPosition: 'top center',
      },
    ],
  },
  {
    label: 'Product Studio',
    cards: [
      {
        title: 'Phone photo → editorial shot',
        body: 'Upload casual phone photos. Get magazine-worthy product shots — splashes, flat lays, hero stacks. Same product, unlimited scenes.',
        tags: ['Remove background', 'Custom scenes', 'Batch export'],
        gradient: 'linear-gradient(135deg, #1a3a5a 0%, #0a1a3a 100%)',
        img: undefined as string | undefined,
        imgPosition: 'top center',
      },
      {
        title: 'Physics-driven motion',
        body: 'Turn your product shot into a cinematic CGI commercial with real motion and lighting.',
        gradient: 'linear-gradient(135deg, #3a1a4a 0%, #1a0a2a 100%)',
        img: undefined as string | undefined,
        imgPosition: 'top center',
      },
      {
        title: 'Feed every format',
        body: 'Product photos feed your UGC ads, captions, blog posts, and emails automatically.',
        gradient: 'linear-gradient(135deg, #1a4a2a 0%, #0a2a10 100%)',
        img: undefined as string | undefined,
        imgPosition: 'top center',
      },
    ],
  },
]

// ---- Powered-by logos (official paths from Simple Icons) ----
const POWERED_BY = [
  {
    name: 'Nanobanana Pro',
    logo: (
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path fill="#4285F4" d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81"/>
      </svg>
    ),
  },
  {
    name: 'Nanobanana 2',
    logo: (
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path fill="#EA4335" d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81"/>
      </svg>
    ),
  },
  {
    name: 'Seedance 2.0',
    logo: (
      // Official ByteDance logo (Seedance is a ByteDance model)
      <svg viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
        <rect width="28" height="28" rx="6" fill="#000"/>
        <g transform="translate(2,3.5) scale(1.0)">
          <path fill="white" transform="scale(0.979) translate(0.1,0.1)" d="M19.8772 1.4685L24 2.5326v18.9426l-4.1228 1.0563V1.4685zm-13.3481 9.428l4.115 1.0641v8.9786l-4.115 1.0642v-11.107zM0 2.572l4.115 1.0642v16.7354L0 21.428V2.572zm17.4553 5.6205v11.107l-4.1228-1.0642V9.2568l4.1228-1.0642z"/>
        </g>
      </svg>
    ),
  },
  {
    name: 'Claude',
    logo: (
      // Official Anthropic path in terracotta square
      <svg viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
        <rect width="28" height="28" rx="6" fill="#CC785C"/>
        <g transform="translate(2, 3.5) scale(0.9917)">
          <path fill="white" d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z"/>
        </g>
      </svg>
    ),
  },
  {
    name: 'ElevenLabs',
    logo: (
      <svg viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
        <rect width="28" height="28" rx="6" fill="#000"/>
        <g transform="translate(4,4) scale(0.833)">
          <path fill="white" d="M4.6035 0v24h4.9317V0zm9.8613 0v24h4.9317V0z"/>
        </g>
      </svg>
    ),
  },
  {
    name: 'Whisper',
    logo: (
      <svg viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
        <rect width="28" height="28" rx="6" fill="#000"/>
        <g transform="translate(4,4) scale(0.833)">
          <path fill="white" d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/>
        </g>
      </svg>
    ),
  },
]

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
const btnPrimaryLink: React.CSSProperties = { padding: '9px 18px', borderRadius: 9, background: '#b91c1c', color: '#fff', fontSize: 14, fontWeight: 600, border: 0, whiteSpace: 'nowrap' }
const btnSecondaryLink: React.CSSProperties = { padding: '9px 18px', borderRadius: 9, background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, fontWeight: 600, border: '1px solid var(--border)', whiteSpace: 'nowrap' }

const heroEyebrow: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-fade)', marginBottom: 14 }
const heroH1: React.CSSProperties = { fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 64, lineHeight: 1.05, letterSpacing: '-0.02em', margin: '0 0 20px' }
const heroP: React.CSSProperties = { fontSize: 18, color: 'var(--ink-dim)', margin: '0 0 36px', lineHeight: 1.7 }
const btnPrimaryLg: React.CSSProperties = { padding: '13px 28px', borderRadius: 11, background: '#b91c1c', color: '#fff', fontSize: 14, fontWeight: 600, border: 0 }
const btnSecondaryLg: React.CSSProperties = { padding: '13px 28px', borderRadius: 11, background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, fontWeight: 600, border: '1px solid var(--border)' }
const btnPrimaryXL: React.CSSProperties = { padding: '14px 32px', borderRadius: 11, background: '#b91c1c', color: '#fff', fontSize: 15, fontWeight: 600, border: 0 }

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
