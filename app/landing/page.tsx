'use client'

import Link from 'next/link'
import { useState } from 'react'
import { DEMO_VIDEOS } from '@/lib/demo-gallery'
import { PreviewGenerator } from '@/components/PreviewGenerator'
import { MarketingHeader } from '@/components/MarketingHeader'
import { MarketingFooter } from '@/components/MarketingFooter'

// Landing page — editorial design from the Claude Design export.
// Chrome (header + footer) is shared with every other marketing page via
// MarketingHeader / MarketingFooter so cross-page navigation feels continuous.
// Every signup CTA routes to /auth/signup so the funnel is consistent.

export default function LandingPage() {
  const [activeFeatureTab, setActiveFeatureTab] = useState(0)
  const [featureVisible, setFeatureVisible] = useState(true)

  const switchTab = (i: number) => {
    if (i === activeFeatureTab) return
    setFeatureVisible(false)
    setTimeout(() => { setActiveFeatureTab(i); setFeatureVisible(true) }, 180)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)' }}>
      <MarketingHeader />

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
            <div style={heroEyebrow}>The AI ad engine for e-commerce brands</div>
            <h1 style={heroH1} className="ls-hero-h1">
              Ads that <span style={{ fontStyle: 'italic', color: '#b91c1c' }}>pass review.</span><br />For stores that ship every week.
            </h1>
            <p style={heroP}>Paste your Shopify, TikTok Shop, or Amazon URL. Get a week&apos;s worth of UGC ads — script, hero frame, actor, voice, captions — with a disclosure overlay and review report built in.<br />One wallet. Every language. Credits that roll over.</p>
          </div>
          {/* Inline preview generator — the demo IS the pitch */}
          <div style={{ marginTop: 44, maxWidth: 640, marginLeft: 'auto', marginRight: 'auto' }}>
            <PreviewGenerator compact />
          </div>
          {/* Quiet text-link row — secondary actions, not competing CTAs */}
          <div style={{
            marginTop: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 20, flexWrap: 'wrap', fontSize: 13, color: 'var(--ink-mute)',
          }}>
            <Link href="/auth/signup" style={{ color: 'var(--ink)', textDecoration: 'none', borderBottom: '1px solid var(--ink-fade)', paddingBottom: 1 }}>
              Skip preview → create free account
            </Link>
            <span style={{ opacity: 0.4 }}>·</span>
            <Link href="/teardown" style={{ color: 'var(--ink-mute)', textDecoration: 'none' }}>
              Or tear down a competitor&apos;s ad — free
            </Link>
          </div>
        </div>
      </section>


      {/* MADE WITH CONTENTFLOW — auto-scrolling marquee (hidden until curated demos exist) */}
      {DEMO_VIDEOS.length > 0 && (
      <section style={{ padding: '0 0 104px', overflow: 'hidden' }}>
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

      {/* AD TEARDOWN PROMO — the tool itself lives at /teardown so it can rank
          and be shared as its own entry point. The landing only points to it. */}
      <section style={{ position: 'relative', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: -140, left: '50%', transform: 'translateX(-50%)',
          width: 640, height: 300, borderRadius: '50%', pointerEvents: 'none',
          background: 'radial-gradient(ellipse, rgba(185,28,28,0.10) 0%, transparent 70%)',
        }} />
        <div style={{
          position: 'relative', maxWidth: 1000, margin: '0 auto', padding: '72px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 40,
        }} className="ls-promo">
          <div style={{ maxWidth: 560 }}>
            <div style={{ ...sectionEyebrow, color: '#b91c1c' }}>Free tool · no account needed</div>
            <h2 style={{ ...sectionH2, fontSize: 36, margin: '0 0 12px' }}>
              Why does <span style={{ fontStyle: 'italic', color: '#b91c1c' }}>that</span> ad work?
            </h2>
            <p style={{ ...sectionP, margin: 0 }}>
              Drop in the competitor ad that&apos;s outselling you. We name the hook, map the beat
              structure, count the cuts — then hand you a prompt that rebuilds it for your product.
            </p>
          </div>
          <Link href="/teardown" style={{
            flexShrink: 0, padding: '14px 28px', borderRadius: 12, background: '#b91c1c',
            color: '#fff', fontSize: 14.5, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap',
          }}>
            Tear down an ad →
          </Link>
        </div>
      </section>

      {/* FEATURE SHOWCASE — tabbed */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '104px 20px 64px' }}>
        <div style={{ textAlign: 'center', maxWidth: 620, margin: '0 auto 44px' }}>
          <div style={sectionEyebrow}>The studios</div>
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
              <div className="ls-inf-row" style={{
                background: '#0d0d0d',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 20,
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
                minHeight: 400,
              }}>
                {/* Left: chips + text */}
                <div className="ls-inf-left" style={{
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
                    {['Penthouse', 'Lifestyle', 'Dry humor', 'Dark hair', '25–29', 'Brown eyes', 'Clean shave', 'Male'].map(chip => (
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
                <div className="ls-inf-right" style={{ flex: 1, position: 'relative' }}>
                  {/* Gradient bleed from left */}
                  <div className="ls-inf-bleed-left" style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0, width: '55%',
                    background: 'linear-gradient(to right, #0d0d0d 0%, transparent 100%)',
                    zIndex: 1, pointerEvents: 'none',
                  }} />
                  {/* Gradient at bottom */}
                  <div className="ls-inf-bleed-bottom" style={{
                    position: 'absolute', left: 0, right: 0, bottom: 0, height: '30%',
                    background: 'linear-gradient(to top, #0d0d0d 0%, transparent 100%)',
                    zIndex: 1, pointerEvents: 'none',
                  }} />
                  <img
                    src="/feat-influencer-portrait-marco.png"
                    alt="Marco Vell — AI creator portrait"
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
            .ls-inf-row {
              flex-direction: column-reverse !important;
              min-height: 0 !important;
            }
            .ls-inf-left {
              flex: 1 1 auto !important;
              padding: 26px 22px !important;
            }
            .ls-inf-right {
              flex: 1 1 auto !important;
              width: 100% !important;
              aspect-ratio: 4 / 3 !important;
              min-height: 320px !important;
            }
            .ls-inf-right .ls-inf-bleed-left { display: none !important; }
            .ls-inf-right .ls-inf-bleed-bottom { height: 40% !important; }
          }
          @media (max-width: 380px) {
            .ls-inf-left { padding: 22px 18px !important; }
            .ls-inf-right { min-height: 280px !important; }
          }
        `}</style>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ maxWidth: 1200, margin: '0 auto', padding: SECTION_PAD }}>
        <div style={{ textAlign: 'center', maxWidth: 620, margin: '0 auto 50px' }}>
          <div style={sectionEyebrow}>What you get</div>
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

      {/* CTA */}
      <section style={{ borderTop: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', bottom: -180, left: '50%', transform: 'translateX(-50%)',
          width: 720, height: 380, borderRadius: '50%', pointerEvents: 'none',
          background: 'radial-gradient(ellipse, rgba(185,28,28,0.12) 0%, transparent 70%)',
        }} />
        <div style={{ position: 'relative', maxWidth: 900, margin: '0 auto', padding: SECTION_PAD, textAlign: 'center' }}>
          <div style={sectionEyebrow}>Start free</div>
          <h2 style={{ ...sectionH2, fontSize: 48 }}>Ready to make <span style={{ fontStyle: 'italic' }}>better ads?</span></h2>
          <p style={{ ...sectionP, marginBottom: 36 }}>Create your first UGC package today. No credit card required.</p>
          <Link href="/auth/signup" style={btnPrimaryXL}>Get started free</Link>
        </div>
      </section>

      <MarketingFooter />

      <style>{`
        @media (max-width: 768px) {
          .ls-nav { display: none !important; }
          .ls-promo { flex-direction: column !important; align-items: flex-start !important; gap: 24px !important; }
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
        tags: ['Seedance 2.0', 'Seedance 2.5', '9:16 & 16:9'],
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
        body: 'Turn your product shot into a premium CGI ad with real motion and lighting.',
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
    body: 'Premium CGI product ads from your product photos — physics-driven motion, designed environments, native audio.',
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

const heroEyebrow: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-fade)', marginBottom: 14 }
const heroH1: React.CSSProperties = { fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 64, lineHeight: 1.05, letterSpacing: '-0.02em', margin: '0 0 20px' }
const heroP: React.CSSProperties = { fontSize: 18, color: 'var(--ink-dim)', margin: '0 0 36px', lineHeight: 1.7 }
const btnPrimaryXL: React.CSSProperties = { padding: '14px 32px', borderRadius: 11, background: '#b91c1c', color: '#fff', fontSize: 15, fontWeight: 600, border: 0 }


// A miniature recreation of the actual UGC generator UI, used as the
// hero preview until we have a real demo video to swap in.

// Shared vertical rhythm so every landing section breathes identically.
const SECTION_PAD = '104px 20px'
const sectionEyebrow: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-fade)', marginBottom: 14 }
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
