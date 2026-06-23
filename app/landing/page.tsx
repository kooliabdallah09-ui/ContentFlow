'use client'

import Link from 'next/link'

// Landing page — editorial design from the Claude Design export.
// Hero + Features (6-up grid) + Pricing (3 cards) + closing CTA + Footer.
// Every signup CTA routes to /auth/signup so the funnel is consistent.

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)' }}>
      {/* HEADER */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        backdropFilter: 'blur(8px)',
        background: 'rgba(250,250,248,0.92)',
        borderBottom: '1px solid var(--border)',
        padding: '16px 20px',
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="brand-mark" style={{ width: 28, height: 28 }}><img src="/logo-icon.png" alt="ContentFlow" /></span>
            <div className="brand-name" style={{ fontSize: 15 }}>Content<em>flow</em></div>
          </Link>
          <nav style={{ display: 'flex', alignItems: 'center', gap: 8 }} className="ls-nav">
            <a href="#features" style={navLink}>Features</a>
            <a href="#pricing" style={navLink}>Pricing</a>
            <Link href="/help" style={navLink}>Docs</Link>
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
        <div style={heroPreview}>
          <video
            src="https://hqtlrfpzgrflbnkxxvhm.supabase.co/storage/v1/object/public/ugc-assets/demo/ugc-talking-head.mp4"
            autoPlay muted loop playsInline
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 17 }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.22) 100%)', borderRadius: 17 }} />
        </div>
      </section>

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
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{f.svg}</svg>
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }} className="ls-pricing">
          <div style={priceCard}>
            <div style={priceName}>Free</div>
            <div style={priceRow}><span style={priceAmt}>$0</span><span style={priceUnit}>forever</span></div>
            <div style={priceMeta}>60 credits at signup · Standard tier only</div>
            <Link href="/auth/signup" style={btnSecondaryFull}>Get started</Link>
          </div>
          <div style={{ ...priceCard, border: '2px solid var(--ink)', position: 'relative' }}>
            <span style={popularBadge}>Most popular</span>
            <div style={priceName}>Pro</div>
            <div style={priceRow}><span style={priceAmt}>$49</span><span style={priceUnit}>/month</span></div>
            <div style={priceMeta}>2,000 credits/month · Everything + priority support</div>
            <Link href="/auth/signup" style={btnPrimaryFull}>Upgrade to Pro</Link>
          </div>
          <div style={priceCard}>
            <div style={priceName}>Agency</div>
            <div style={priceRow}><span style={priceAmt}>$149</span><span style={priceUnit}>/month</span></div>
            <div style={priceMeta}>6,500 credits · Team seats · API access</div>
            <Link href="/auth/signup" style={btnSecondaryFull}>Contact us</Link>
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
          .ls-pricing { grid-template-columns: 1fr !important; gap: 16px !important; }
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
  { title: 'AI-powered scripts', body: 'Claude drafts 3 compelling hooks tailored to your product.', svg: <path d="M12 3l1.8 4.4L18 9l-4.2 1.6L12 15l-1.8-4.4L6 9l4.2-1.6z"/> },
  { title: 'Sora video', body: 'Your talking head brought to life with photorealistic motion.', svg: <><circle cx="12" cy="12" r="10"/><path d="M10 17l5-5-5-5"/></> },
  { title: 'Premium voices', body: 'Custom narration with ElevenLabs — no AI robot sound.', svg: <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/> },
  { title: 'Auto captions', body: 'Word-synced by Whisper. Burned in, scroll-stopping design.', svg: <><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M9 12h6M9 16h6M5 12h.01M5 16h.01"/></> },
  { title: 'B-roll cutaways', body: 'Anchored on your product, overlaid mid-video.', svg: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15l4-4 5 5 4-6"/></> },
  { title: 'Brand kit', body: 'Set once. Every generation inherits your voice.', svg: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6v6H9z"/></> },
]

// ---- Inline styles ----
const navLink: React.CSSProperties = { padding: '9px 16px', fontSize: 14, fontWeight: 500, color: 'var(--ink-mute)' }
const btnPrimaryLink: React.CSSProperties = { padding: '9px 18px', borderRadius: 9, background: 'var(--ink)', color: '#fff', fontSize: 14, fontWeight: 600, border: 0 }
const btnSecondaryLink: React.CSSProperties = { padding: '9px 18px', borderRadius: 9, background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, fontWeight: 600, border: '1px solid var(--border)' }

const heroEyebrow: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-fade)', marginBottom: 14 }
const heroH1: React.CSSProperties = { fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 64, lineHeight: 1.05, letterSpacing: '-0.02em', margin: '0 0 20px' }
const heroP: React.CSSProperties = { fontSize: 18, color: 'var(--ink-dim)', margin: '0 0 36px', lineHeight: 1.7 }
const btnPrimaryLg: React.CSSProperties = { padding: '13px 28px', borderRadius: 11, background: 'var(--ink)', color: '#fff', fontSize: 14, fontWeight: 600, border: 0 }
const btnSecondaryLg: React.CSSProperties = { padding: '13px 28px', borderRadius: 11, background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, fontWeight: 600, border: '1px solid var(--border)' }
const btnPrimaryXL: React.CSSProperties = { padding: '14px 32px', borderRadius: 11, background: 'var(--ink)', color: '#fff', fontSize: 15, fontWeight: 600, border: 0 }

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
  width: 48, height: 48, borderRadius: 14,
  background: 'var(--ink)',
  color: '#fff',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
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
const popularBadge: React.CSSProperties = { position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', background: 'var(--ink)', color: '#fff', borderRadius: 999, padding: '4px 12px' }
const priceName: React.CSSProperties = { fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 8 }
const priceRow: React.CSSProperties = { display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 16 }
const priceAmt: React.CSSProperties = { fontFamily: 'var(--font-serif)', fontSize: 36, lineHeight: 1 }
const priceUnit: React.CSSProperties = { fontSize: 13, color: 'var(--ink-mute)' }
const priceMeta: React.CSSProperties = { fontSize: 13, color: 'var(--ink-dim)', marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border-soft)' }
const btnPrimaryFull: React.CSSProperties = { display: 'block', textAlign: 'center', width: '100%', padding: 11, border: 0, borderRadius: 9, background: 'var(--ink)', color: '#fff', fontWeight: 600, fontSize: 13 }
const btnSecondaryFull: React.CSSProperties = { display: 'block', textAlign: 'center', width: '100%', padding: 11, border: '1px solid var(--border)', borderRadius: 9, background: 'var(--surface)', color: 'var(--ink)', fontWeight: 600, fontSize: 13 }

const footH: React.CSSProperties = { fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 12 }
const footList: React.CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }
const footLink: React.CSSProperties = { fontSize: 13, color: 'var(--ink-mute)' }
