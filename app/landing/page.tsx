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
      <LpHero />
      <LpLogos />
      <LpFeatures />
      <LpProof />
      <LpFlow />
      <LpVoices />
      <LpPricing />
      <LpFaq />
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
      padding: '24px 60px',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-serif)' }}>
        ContentFlow
      </div>
      <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
        <a href="#features" style={{ fontSize: '14px', color: 'var(--ink-dim)', cursor: 'pointer' }}>Features</a>
        <a href="#pricing" style={{ fontSize: '14px', color: 'var(--ink-dim)', cursor: 'pointer' }}>Pricing</a>
        <Link href="/auth/login" style={{ fontSize: '14px', color: 'var(--ink)' }}>
          Sign In
        </Link>
        <Link href="/auth/signup" style={{
          padding: '10px 20px',
          background: 'var(--accent)',
          color: 'var(--bg)',
          borderRadius: 'var(--r-md)',
          fontSize: '14px',
          fontWeight: 600,
          textDecoration: 'none',
        }}>
          Get Started
        </Link>
      </div>
    </nav>
  )
}

function LpHero() {
  return (
    <section style={{
      padding: '100px 60px',
      background: 'var(--bg)',
      textAlign: 'center',
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <h1 style={{
          fontSize: '64px',
          fontWeight: 700,
          color: 'var(--ink)',
          marginBottom: '24px',
          fontFamily: 'var(--font-serif)',
          lineHeight: 1.1,
        }}>
          Create & publish content in <em style={{ color: 'var(--accent)', fontStyle: 'italic' }}>minutes</em>
        </h1>
        <p style={{
          fontSize: '18px',
          color: 'var(--ink-dim)',
          marginBottom: '48px',
          lineHeight: 1.7,
          maxWidth: '700px',
          margin: '0 auto 48px',
        }}>
          ContentFlow uses AI to generate blog posts, social media content, email campaigns, and videos. One platform. All your content. Your unique voice.
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <Link href="/auth/signup" style={{
            padding: '14px 36px',
            background: 'var(--accent)',
            color: 'var(--bg)',
            borderRadius: 'var(--r-lg)',
            fontSize: '15px',
            fontWeight: 600,
            textDecoration: 'none',
            cursor: 'pointer',
          }}>
            Start Free
          </Link>
          <button style={{
            padding: '14px 36px',
            background: 'transparent',
            color: 'var(--accent)',
            border: '1px solid var(--accent)',
            borderRadius: 'var(--r-lg)',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
          }}>
            Learn More
          </button>
        </div>
      </div>
    </section>
  )
}


function LpLogos() {
  return (
    <section style={{
      padding: '60px 40px',
      textAlign: 'center',
      borderBottom: '1px solid var(--border)',
    }}>
      <p style={{ fontSize: '12px', color: 'var(--ink-mute)', marginBottom: '24px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        Used by content creators worldwide
      </p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: '32px',
        maxWidth: '800px',
        margin: '0 auto',
        opacity: 0.4,
      }}>
        {['TechFlow', 'CreativeStudio', 'MediaHub', 'BrandLab', 'Content Co.'].map((logo) => (
          <div key={logo} style={{ fontSize: '14px', color: 'var(--ink-dim)', fontWeight: 600 }}>
            {logo}
          </div>
        ))}
      </div>
    </section>
  )
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
          marginBottom: '8px',
          fontFamily: 'var(--font-serif)',
          textAlign: 'center',
        }}>
          Everything you need
        </h2>
        <p style={{
          fontSize: '18px',
          color: 'var(--ink-dim)',
          textAlign: 'center',
          marginBottom: '60px',
        }}>
          All the tools to create and scale your content
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '32px',
        }}>
          {[
            { icon: '📝', title: 'Blog Posts', desc: 'SEO-optimized articles generated in minutes' },
            { icon: '📱', title: 'Social Content', desc: 'Platform-specific posts with hashtags and engagement optimization' },
            { icon: '🎥', title: 'Video Content', desc: 'UGC videos with AI avatars and natural voice' },
            { icon: '📧', title: 'Email Sequences', desc: 'Complete nurture flows that convert' },
            { icon: '📊', title: 'Analytics', desc: 'Track performance across all platforms' },
            { icon: '📅', title: 'Content Calendar', desc: 'Plan, schedule, and publish everything in one place' },
          ].map((feature) => (
            <div key={feature.title} style={{
              padding: '32px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg)',
            }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>{feature.icon}</div>
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)', marginBottom: '8px' }}>
                {feature.title}
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--ink-dim)', lineHeight: 1.6 }}>
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function LpFlow() {
  return (
    <section style={{
      padding: '80px 60px',
      background: 'var(--bg)',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h2 style={{
          fontSize: '48px',
          fontWeight: 700,
          color: 'var(--ink)',
          marginBottom: '8px',
          fontFamily: 'var(--font-serif)',
          textAlign: 'center',
        }}>
          How it works
        </h2>
        <p style={{
          fontSize: '18px',
          color: 'var(--ink-dim)',
          textAlign: 'center',
          marginBottom: '60px',
        }}>
          Three simple steps to content mastery
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '24px',
        }}>
          {[
            { num: '1', title: 'Set Your Brand', desc: 'Tell us about your company, voice, and audience' },
            { num: '2', title: 'Generate Content', desc: 'Let AI create content tailored to your brand' },
            { num: '3', title: 'Publish Anywhere', desc: 'Schedule and publish across all platforms' },
          ].map((step) => (
            <div key={step.num} style={{
              padding: '40px 32px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg)',
              textAlign: 'center',
            }}>
              <div style={{
                width: '56px',
                height: '56px',
                background: 'var(--accent)',
                color: 'var(--bg)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                fontWeight: 700,
                margin: '0 auto 16px',
              }}>
                {step.num}
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)', marginBottom: '8px' }}>
                {step.title}
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--ink-dim)', lineHeight: 1.6 }}>
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function LpVoices() {
  return (
    <section style={{
      padding: '80px 60px',
      background: 'var(--surface)',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h2 style={{
          fontSize: '48px',
          fontWeight: 700,
          color: 'var(--ink)',
          marginBottom: '8px',
          fontFamily: 'var(--font-serif)',
          textAlign: 'center',
        }}>
          Trusted by creators
        </h2>
        <p style={{
          fontSize: '18px',
          color: 'var(--ink-dim)',
          textAlign: 'center',
          marginBottom: '60px',
        }}>
          Join thousands using ContentFlow daily
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '24px',
        }}>
          {[
            { name: 'Alex Chen', role: 'Content Creator', text: '"ContentFlow saved me 20 hours a week. I can now focus on strategy instead of writing."' },
            { name: 'Maria Rodriguez', role: 'Marketing Director', text: '"The quality of AI-generated content is impressive. It feels authentic to our brand."' },
            { name: 'James Wilson', role: 'Agency Owner', text: '"We use ContentFlow for all our clients now. It\'s a game-changer for productivity."' },
          ].map((voice) => (
            <div key={voice.name} style={{
              padding: '32px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg)',
            }}>
              <p style={{ fontSize: '15px', color: 'var(--ink-dim)', lineHeight: 1.8, marginBottom: '16px', fontStyle: 'italic' }}>
                {voice.text}
              </p>
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>{voice.name}</p>
              <p style={{ fontSize: '13px', color: 'var(--ink-mute)' }}>{voice.role}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function LpProof() {
  return (
    <section style={{
      padding: '80px 60px',
      background: 'var(--bg)',
      textAlign: 'center',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '48px',
          marginBottom: '60px',
        }}>
          {[
            { num: '2.5M+', label: 'Content pieces created' },
            { num: '47K+', label: 'Active creators' },
            { num: '3.2B', label: 'Hours saved globally' },
          ].map((stat) => (
            <div key={stat.label}>
              <div style={{ fontSize: '48px', fontWeight: 700, color: 'var(--accent)' }}>
                {stat.num}
              </div>
              <p style={{ fontSize: '14px', color: 'var(--ink-dim)', marginTop: '8px' }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function LpPricing() {
  return (
    <section id="pricing" style={{
      padding: '80px 60px',
      background: 'var(--surface)',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h2 style={{
          fontSize: '48px',
          fontWeight: 700,
          color: 'var(--ink)',
          marginBottom: '8px',
          fontFamily: 'var(--font-serif)',
          textAlign: 'center',
        }}>
          Simple, transparent pricing
        </h2>
        <p style={{
          fontSize: '18px',
          color: 'var(--ink-dim)',
          textAlign: 'center',
          marginBottom: '60px',
        }}>
          Start free. Upgrade when you need more power.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '20px',
        }}>
          {[
            {
              name: 'Free',
              price: '€0',
              credits: '50/mo',
              features: ['50 monthly', '150 bonus', 'All generators'],
            },
            {
              name: 'Starter',
              price: '€19',
              credits: '1,000/mo',
              features: ['1,000 monthly', 'Email support', 'Social integrations'],
              highlight: false,
            },
            {
              name: 'Pro',
              price: '€49',
              credits: '4,000/mo',
              features: ['4,000 monthly', 'Priority support', 'AI videos', 'Analytics'],
              highlight: true,
            },
            {
              name: 'Agency',
              price: '€149',
              credits: '15,000/mo',
              features: ['15,000 monthly', 'Team collab', 'Dedicated support', 'Custom branding'],
            },
          ].map((plan) => (
            <div key={plan.name} style={{
              padding: '28px',
              background: 'var(--bg)',
              border: plan.highlight ? '2px solid var(--accent)' : '1px solid var(--border)',
              borderRadius: 'var(--r-lg)',
              position: 'relative',
            }}>
              {plan.highlight && (
                <div style={{
                  position: 'absolute',
                  top: '-10px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'var(--accent)',
                  color: 'var(--bg)',
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '4px 12px',
                  borderRadius: '4px',
                  letterSpacing: '0.05em',
                }}>
                  MOST POPULAR
                </div>
              )}
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: '8px' }}>
                {plan.name}
              </h3>
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--accent)' }}>
                  {plan.price}
                </div>
                <p style={{ fontSize: '12px', color: 'var(--ink-dim)', margin: '4px 0 0 0' }}>
                  {plan.credits} credits
                </p>
              </div>
              <ul style={{ marginBottom: '20px', listStyle: 'none', padding: 0 }}>
                {plan.features.map((feature, i) => (
                  <li key={i} style={{
                    fontSize: '12px',
                    color: 'var(--ink-dim)',
                    marginBottom: '6px',
                    paddingLeft: '16px',
                    position: 'relative',
                  }}>
                    <span style={{ position: 'absolute', left: 0, color: 'var(--accent)' }}>✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <button style={{
                width: '100%',
                padding: '10px 16px',
                background: plan.highlight ? 'var(--accent)' : 'transparent',
                color: plan.highlight ? 'var(--bg)' : 'var(--accent)',
                border: plan.highlight ? 'none' : '1px solid var(--accent)',
                borderRadius: 'var(--r-md)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}>
                Get Started
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function LpFaq() {
  return (
    <section style={{
      padding: '80px 60px',
      background: 'var(--bg)',
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <h2 style={{
          fontSize: '48px',
          fontWeight: 700,
          color: 'var(--ink)',
          marginBottom: '8px',
          fontFamily: 'var(--font-serif)',
          textAlign: 'center',
        }}>
          Questions?
        </h2>
        <p style={{
          fontSize: '18px',
          color: 'var(--ink-dim)',
          textAlign: 'center',
          marginBottom: '60px',
        }}>
          We've got answers
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '32px',
        }}>
          {[
            {
              q: 'How many credits do I need?',
              a: 'Blog = 1, Image = 5, Voice = 3, Video = 100. Prices vary by quality/length.',
            },
            {
              q: 'Can I use for multiple brands?',
              a: 'Yes! Create separate brand profiles. Pro = 3 brands, Agency = 10+ brands.',
            },
            {
              q: 'Do credits expire?',
              a: 'Monthly credits reset each billing cycle. One-time packs don\'t expire.',
            },
            {
              q: 'Can I cancel anytime?',
              a: 'Absolutely. No contracts. Cancel your subscription whenever you want.',
            },
          ].map((faq, i) => (
            <div key={i} style={{
              padding: '32px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg)',
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: '8px' }}>
                {faq.q}
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--ink-dim)', lineHeight: 1.6, margin: 0 }}>
                {faq.a}
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
      background: 'var(--surface)',
      textAlign: 'center',
    }}>
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        <h2 style={{
          fontSize: '48px',
          fontWeight: 700,
          color: 'var(--ink)',
          marginBottom: '16px',
          fontFamily: 'var(--font-serif)',
        }}>
          Ready to get started?
        </h2>
        <p style={{ fontSize: '18px', color: 'var(--ink-dim)', marginBottom: '32px', lineHeight: 1.6 }}>
          Join thousands of creators using ContentFlow to scale their content strategy.
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <Link href="/auth/signup" style={{
            padding: '14px 36px',
            background: 'var(--accent)',
            color: 'var(--bg)',
            borderRadius: 'var(--r-lg)',
            fontSize: '15px',
            fontWeight: 600,
            textDecoration: 'none',
            cursor: 'pointer',
          }}>
            Start Free
          </Link>
          <Link href="/privacy" style={{
            padding: '14px 36px',
            background: 'transparent',
            color: 'var(--accent)',
            border: '1px solid var(--accent)',
            borderRadius: 'var(--r-lg)',
            fontSize: '15px',
            fontWeight: 600,
            textDecoration: 'none',
            cursor: 'pointer',
          }}>
            Learn More
          </Link>
        </div>
      </div>
    </section>
  )
}

function LpFoot() {
  return (
    <footer style={{
      padding: '60px',
      background: 'var(--bg)',
      borderTop: '1px solid var(--border)',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', marginBottom: '40px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '48px',
        }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent)', marginBottom: '16px', fontFamily: 'var(--font-serif)' }}>
              ContentFlow
            </div>
            <p style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.6 }}>
              Powerful AI content generation for creators, marketers, and agencies.
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Product</h4>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              <li><a href="#" style={{ fontSize: '13px', color: 'var(--ink-dim)', display: 'block', marginBottom: '8px' }}>Features</a></li>
              <li><a href="#" style={{ fontSize: '13px', color: 'var(--ink-dim)', display: 'block', marginBottom: '8px' }}>Pricing</a></li>
              <li><a href="#" style={{ fontSize: '13px', color: 'var(--ink-dim)', display: 'block', marginBottom: '8px' }}>Integrations</a></li>
            </ul>
          </div>
          <div>
            <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Company</h4>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              <li><a href="#" style={{ fontSize: '13px', color: 'var(--ink-dim)', display: 'block', marginBottom: '8px' }}>Blog</a></li>
              <li><a href="#" style={{ fontSize: '13px', color: 'var(--ink-dim)', display: 'block', marginBottom: '8px' }}>Support</a></li>
              <li><a href="#" style={{ fontSize: '13px', color: 'var(--ink-dim)', display: 'block', marginBottom: '8px' }}>Contact</a></li>
            </ul>
          </div>
          <div>
            <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Legal</h4>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              <li><a href="/privacy" style={{ fontSize: '13px', color: 'var(--ink-dim)', display: 'block', marginBottom: '8px' }}>Privacy</a></li>
              <li><a href="#" style={{ fontSize: '13px', color: 'var(--ink-dim)', display: 'block', marginBottom: '8px' }}>Terms</a></li>
              <li><a href="#" style={{ fontSize: '13px', color: 'var(--ink-dim)', display: 'block', marginBottom: '8px' }}>Cookies</a></li>
            </ul>
          </div>
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
