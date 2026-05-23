'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const TONES = [
  { id: 'saffron',  label: 'Saffron',  swatch: ['oklch(0.16 0.006 60)',  'oklch(0.82 0.15 78)'] },
  { id: 'ink',      label: 'Ink',      swatch: ['oklch(0.155 0.012 250)','oklch(0.72 0.16 252)'] },
  { id: 'moss',     label: 'Moss',     swatch: ['oklch(0.16 0.012 150)', 'oklch(0.80 0.16 130)'] },
  { id: 'cocoa',    label: 'Cocoa',    swatch: ['oklch(0.155 0.014 35)', 'oklch(0.70 0.17 32)'] },
  { id: 'violet',   label: 'Violet',   swatch: ['oklch(0.155 0.014 290)','oklch(0.74 0.18 305)'] },
  { id: 'midnight', label: 'Midnight', swatch: ['oklch(0.13 0.005 240)', 'oklch(0.86 0.14 90)'] },
  { id: 'paper',    label: 'Paper',    swatch: ['oklch(0.965 0.014 78)', 'oklch(0.55 0.18 32)'] },
]

export default function LandingPage() {
  const [tone, setTone] = useState('saffron')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const randomTone = TONES[Math.floor(Math.random() * TONES.length)].id
    setTone(randomTone)
    document.documentElement.setAttribute('data-tone', randomTone === 'saffron' ? '' : randomTone)
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className="lp">
      <LpNav />
      <LpHeroRich />
      <LpProof />
      <LpLogos />
      <LpFeatures />
      <LpCta />
      <LpFoot />

      <TweaksPanel tone={tone} setTone={setTone} />
    </div>
  )
}

function TweaksPanel({ tone, setTone }: { tone: string; setTone: (t: string) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 999,
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          padding: '12px 16px',
          background: 'var(--accent)',
          color: 'var(--bg)',
          border: 'none',
          borderRadius: 'var(--r-lg)',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          marginBottom: open ? '12px' : '0',
        }}
      >
        🎨 Tweaks
      </button>

      {open && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)',
          padding: '20px',
          minWidth: '280px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '16px' }}>
            Color Tone
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
          }}>
            {TONES.map(t => (
              <button
                key={t.id}
                onClick={() => {
                  setTone(t.id)
                  document.documentElement.setAttribute('data-tone', t.id === 'saffron' ? '' : t.id)
                }}
                style={{
                  padding: '8px',
                  background: tone === t.id ? 'var(--accent)' : 'var(--bg)',
                  border: tone === t.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                  borderRadius: 'var(--r-md)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <div style={{
                  display: 'flex',
                  gap: '2px',
                  width: '100%',
                }}>
                  <div style={{ flex: 1, height: '16px', background: t.swatch[0], borderRadius: '2px' }} />
                  <div style={{ flex: 1, height: '16px', background: t.swatch[1], borderRadius: '2px' }} />
                </div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: tone === t.id ? 'var(--bg)' : 'var(--ink-dim)' }}>
                  {t.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function LpNav() {
  return (
    <nav style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '20px 60px',
      background: 'var(--bg)',
    }}>
      <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--font-serif)' }}>
        ContentFlow
      </div>
      <div style={{ display: 'flex', gap: '40px', alignItems: 'center' }}>
        <a href="#features" style={{ fontSize: '14px', color: 'var(--ink-dim)', cursor: 'pointer' }}>Features</a>
        <a href="#pricing" style={{ fontSize: '14px', color: 'var(--ink-dim)', cursor: 'pointer' }}>Pricing</a>
        <a href="#voices" style={{ fontSize: '14px', color: 'var(--ink-dim)', cursor: 'pointer' }}>Voices</a>
        <a href="#faq" style={{ fontSize: '14px', color: 'var(--ink-dim)', cursor: 'pointer' }}>FAQ</a>
        <Link href="/auth/login" style={{ fontSize: '14px', color: 'var(--ink)' }}>
          Sign in
        </Link>
        <Link href="/auth/signup" style={{
          padding: '10px 22px',
          background: 'var(--accent)',
          color: 'var(--bg)',
          borderRadius: 'var(--r-md)',
          fontSize: '14px',
          fontWeight: 600,
          textDecoration: 'none',
        }}>
          Start free
        </Link>
      </div>
    </nav>
  )
}

function LpHeroRich() {
  return (
    <section style={{
      padding: '80px 60px',
      background: 'var(--bg)',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '80px',
      alignItems: 'center',
    }}>
      <div>
        <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)', marginBottom: '24px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          ✨ AI Content Studio • Built on Claude
        </p>
        <h1 style={{
          fontSize: '56px',
          fontWeight: 700,
          color: 'var(--ink)',
          marginBottom: '24px',
          fontFamily: 'var(--font-serif)',
          lineHeight: 1.2,
        }}>
          Stop <span style={{ color: 'var(--ink-dim)', textDecoration: 'line-through' }}>making</span> content.<br />
          Start <span style={{ color: 'var(--accent)', fontStyle: 'italic' }}>shipping</span> it.
        </h1>
        <p style={{
          fontSize: '16px',
          color: 'var(--ink-dim)',
          marginBottom: '32px',
          lineHeight: 1.7,
          maxWidth: '500px',
        }}>
          SEO blogs, viral threads, UGC videos, full email flows — written in your voice, scheduled to your calendar, ready before lunch. <em style={{ color: 'var(--accent)', fontStyle: 'italic' }}>Days of work, done in minutes.</em>
        </p>
        <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
          <input
            type="email"
            placeholder="you@studio.com"
            style={{
              padding: '12px 16px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)',
              fontSize: '14px',
              color: 'var(--ink)',
              width: '280px',
            }}
          />
          <button style={{
            padding: '12px 28px',
            background: 'var(--accent)',
            color: 'var(--bg)',
            border: 'none',
            borderRadius: 'var(--r-md)',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}>
            Start free →
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', marginLeft: '-8px' }}>
            {['🟥', '🟩', '🟦', '🟨'].map((emoji, i) => (
              <div key={i} style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                marginLeft: i > 0 ? '-8px' : '0',
                border: '2px solid var(--bg)',
              }}>
                {emoji}
              </div>
            ))}
          </div>
          <span style={{ fontSize: '13px', color: 'var(--ink-dim)' }}>
            <strong style={{ color: 'var(--ink)' }}>2,500+ creators</strong> shipping daily
          </span>
          <span style={{ marginLeft: '12px', fontSize: '13px' }}>
            ⭐⭐⭐⭐⭐ <strong style={{ color: 'var(--ink)' }}>49</strong> · 412 reviews
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Blog Card */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)',
          padding: '24px',
          backdropFilter: 'blur(10px)',
        }}>
          <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            📝 SEO BLOG
          </p>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: '8px' }}>
            How <em style={{ color: 'var(--accent)', fontStyle: 'italic' }}>indie founders</em> built a 6-figure<br />newsletter in 90 days.
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--ink-mute)', marginBottom: '12px' }}>
            2,140 words
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--ink-dim)', background: 'var(--bg)', padding: '4px 8px', borderRadius: '4px' }}>DRAFT</span>
            <span style={{ fontSize: '11px', color: 'var(--ink-dim)', background: 'var(--bg)', padding: '4px 8px', borderRadius: '4px' }}>WORDPRESS</span>
            <span style={{ fontSize: '11px', color: 'var(--ink-dim)', background: 'var(--bg)', padding: '4px 8px', borderRadius: '4px' }}>READY TO PUBLISH</span>
          </div>
        </div>

        {/* Video Card */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)',
          padding: '24px',
          backdropFilter: 'blur(10px)',
        }}>
          <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            🎬 UGC VIDEO
          </p>
          <div style={{
            background: 'var(--bg)',
            borderRadius: 'var(--r-md)',
            height: '160px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '12px',
            fontSize: '48px',
            color: 'var(--accent)',
          }}>
            ▶️
          </div>
          <p style={{ fontSize: '13px', color: 'var(--ink)', marginBottom: '8px', fontWeight: 500 }}>
            Try it in <span style={{ color: 'var(--accent)', fontStyle: 'italic' }}>30 seconds.</span>
          </p>
          <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--ink-dim)' }}>
            <span>👁️ 169k views</span>
            <span>❤️ 12k likes</span>
            <span>💬 89 shares</span>
          </div>
        </div>

        {/* LinkedIn Card */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)',
          padding: '24px',
          backdropFilter: 'blur(10px)',
        }}>
          <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            💼 LINKEDIN HOOK
          </p>
          <p style={{ fontSize: '14px', color: 'var(--ink)', marginBottom: '12px', fontWeight: 500, lineHeight: 1.6 }}>
            I quit my agency job to build in public. Six months in, here's what nobody told me…
          </p>
          <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--ink-dim)' }}>
            <span>1.2k likes</span>
            <span>47 reposts</span>
            <span>92 comments</span>
          </div>
        </div>
      </div>
    </section>
  )
}

function LpProof() {
  return (
    <section style={{
      padding: '60px 60px',
      background: 'var(--bg)',
      borderBottom: '1px solid var(--border)',
      textAlign: 'center',
    }}>
      <p style={{ fontSize: '12px', color: 'var(--ink-dim)', marginBottom: '24px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        ✓ TRUSTED BY STUDIOS & SOLO CREATORS
      </p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: '32px',
        maxWidth: '900px',
        margin: '0 auto',
      }}>
        {['Atelier', 'NORTH/SOUTH', 'Florescene', 'Quill & Co.', 'PARALLAX', 'Verbena'].map((name) => (
          <div key={name} style={{ fontSize: '13px', color: 'var(--ink-mute)', fontStyle: 'italic' }}>
            {name}
          </div>
        ))}
      </div>
    </section>
  )
}

function LpLogos() {
  return null
}

function LpFeatures() {
  return (
    <section id="features" style={{
      padding: '80px 60px',
      background: 'var(--surface)',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h2 style={{
          fontSize: '48px',
          fontWeight: 700,
          color: 'var(--ink)',
          marginBottom: '60px',
          fontFamily: 'var(--font-serif)',
          textAlign: 'center',
        }}>
          The studio in your pocket
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '32px',
        }}>
          {[
            { icon: '📝', title: 'Blogs & Articles', desc: 'SEO-optimized long-form content' },
            { icon: '📱', title: 'Social Posts', desc: 'Multi-platform hooks and threads' },
            { icon: '🎥', title: 'UGC Videos', desc: 'AI avatars with natural lip-sync' },
            { icon: '📧', title: 'Email Sequences', desc: 'Complete nurture workflows' },
            { icon: '📅', title: 'Content Calendar', desc: 'Plan and schedule everything' },
            { icon: '📊', title: 'Analytics Dashboard', desc: 'Track reach and engagement' },
          ].map((feature) => (
            <div key={feature.title} style={{
              padding: '32px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>{feature.icon}</div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: '8px' }}>
                {feature.title}
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--ink-dim)' }}>
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function LpCta() {
  return (
    <section style={{
      padding: '100px 60px',
      background: 'var(--bg)',
      textAlign: 'center',
    }}>
      <h2 style={{
        fontSize: '48px',
        fontWeight: 700,
        color: 'var(--ink)',
        marginBottom: '24px',
        fontFamily: 'var(--font-serif)',
      }}>
        Ready to ship?
      </h2>
      <p style={{ fontSize: '16px', color: 'var(--ink-dim)', marginBottom: '32px', maxWidth: '600px', margin: '0 auto 32px' }}>
        Join 2,500+ creators building in public with ContentFlow.
      </p>
      <Link href="/auth/signup" style={{
        display: 'inline-block',
        padding: '14px 40px',
        background: 'var(--accent)',
        color: 'var(--bg)',
        borderRadius: 'var(--r-lg)',
        fontSize: '15px',
        fontWeight: 600,
        textDecoration: 'none',
        cursor: 'pointer',
      }}>
        Start free today →
      </Link>
    </section>
  )
}

function LpFoot() {
  return (
    <footer style={{
      padding: '60px',
      background: 'var(--surface)',
      borderTop: '1px solid var(--border)',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '48px', marginBottom: '40px' }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent)', marginBottom: '12px', fontFamily: 'var(--font-serif)' }}>
            ContentFlow
          </div>
        </div>
        <div>
          <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Product</h4>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li><a href="#" style={{ fontSize: '13px', color: 'var(--ink-dim)', display: 'block', marginBottom: '8px' }}>Features</a></li>
            <li><a href="#" style={{ fontSize: '13px', color: 'var(--ink-dim)', display: 'block', marginBottom: '8px' }}>Pricing</a></li>
          </ul>
        </div>
        <div>
          <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Company</h4>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li><a href="#" style={{ fontSize: '13px', color: 'var(--ink-dim)', display: 'block', marginBottom: '8px' }}>Blog</a></li>
            <li><a href="#" style={{ fontSize: '13px', color: 'var(--ink-dim)', display: 'block', marginBottom: '8px' }}>Support</a></li>
          </ul>
        </div>
        <div>
          <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Legal</h4>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li><a href="/privacy" style={{ fontSize: '13px', color: 'var(--ink-dim)', display: 'block', marginBottom: '8px' }}>Privacy</a></li>
            <li><a href="#" style={{ fontSize: '13px', color: 'var(--ink-dim)', display: 'block', marginBottom: '8px' }}>Terms</a></li>
          </ul>
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '24px', textAlign: 'center' }}>
        <p style={{ fontSize: '12px', color: 'var(--ink-mute)', margin: 0 }}>
          © 2026 ContentFlow. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
