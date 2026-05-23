'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const TONES = [
  { id: 'saffron',  label: 'Saffron' },
  { id: 'ink',      label: 'Ink' },
  { id: 'moss',     label: 'Moss' },
  { id: 'cocoa',    label: 'Cocoa' },
  { id: 'violet',   label: 'Violet' },
  { id: 'midnight', label: 'Midnight' },
  { id: 'paper',    label: 'Paper' },
]

const TONE_OVERRIDES: Record<string, Record<string, string>> = {
  ink: {
    '--accent': 'oklch(0.72 0.16 252)',
  },
  moss: {
    '--accent': 'oklch(0.80 0.16 130)',
  },
  cocoa: {
    '--accent': 'oklch(0.70 0.17 32)',
  },
  violet: {
    '--accent': 'oklch(0.74 0.18 305)',
  },
  midnight: {
    '--accent': 'oklch(0.86 0.14 90)',
  },
  paper: {
    '--accent': 'oklch(0.55 0.18 32)',
  },
}

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

  const toneStyle = TONE_OVERRIDES[tone] || {}

  return (
    <div className="lp" style={toneStyle as any}>
      <LpNav />
      <LpHero />
      <LpLogos />
      <LpFeatures />
      <LpProof />
      <LpPricing />
      <LpFaq />
      <LpCta />
      <LpFoot />
    </div>
  )
}

function LpNav() {
  return (
    <nav style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '20px 40px',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-serif)' }}>
        ContentFlow
      </div>
      <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
        <a href="#features" style={{ fontSize: '14px', color: 'var(--ink-dim)' }}>Features</a>
        <a href="#pricing" style={{ fontSize: '14px', color: 'var(--ink-dim)' }}>Pricing</a>
        <a href="/auth/login" style={{ fontSize: '14px', color: 'var(--ink)' }}>Sign In</a>
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
      padding: '120px 40px',
      textAlign: 'center',
      background: 'linear-gradient(135deg, var(--surface) 0%, var(--bg) 100%)',
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{
          fontSize: '56px',
          fontWeight: 700,
          color: 'var(--ink)',
          marginBottom: '16px',
          fontFamily: 'var(--font-serif)',
          lineHeight: 1.2,
        }}>
          Create Content at <em style={{ color: 'var(--accent)' }}>Scale</em>
        </h1>
        <p style={{
          fontSize: '18px',
          color: 'var(--ink-dim)',
          marginBottom: '32px',
          lineHeight: 1.6,
        }}>
          Generate blog posts, social media content, email campaigns, and videos powered by AI. Adapt your voice across all platforms in minutes, not hours.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <Link href="/auth/signup" style={{
            padding: '12px 32px',
            background: 'var(--accent)',
            color: 'var(--bg)',
            borderRadius: 'var(--r-lg)',
            fontSize: '15px',
            fontWeight: 600,
            textDecoration: 'none',
            cursor: 'pointer',
          }}>
            Start Free Trial
          </Link>
          <button style={{
            padding: '12px 32px',
            background: 'transparent',
            color: 'var(--accent)',
            border: '1px solid var(--accent)',
            borderRadius: 'var(--r-lg)',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
          }}>
            Watch Demo
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
  const features = [
    {
      icon: '✨',
      title: 'AI-Powered Generation',
      description: 'Blog posts, social media, emails, and videos created in seconds with your unique voice.'
    },
    {
      icon: '📅',
      title: 'Content Calendar',
      description: 'Plan, schedule, and publish content across all platforms from one dashboard.'
    },
    {
      icon: '🎨',
      title: 'Design Customization',
      description: 'Professional templates and full design control to match your brand perfectly.'
    },
    {
      icon: '📊',
      title: 'Real-Time Analytics',
      description: 'Track performance, engagement, and reach across all your social channels.'
    },
    {
      icon: '🔄',
      title: 'Multi-Platform Support',
      description: 'Publish to Instagram, Twitter, TikTok, LinkedIn, YouTube, and Facebook instantly.'
    },
    {
      icon: '⚡',
      title: 'Batch Generation',
      description: 'Create weeks of content in minutes with our intelligent batch processing.'
    },
  ]

  return (
    <section id="features" style={{
      padding: '80px 40px',
      background: 'var(--surface)',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h2 style={{
            fontSize: '40px',
            fontWeight: 700,
            color: 'var(--ink)',
            marginBottom: '12px',
            fontFamily: 'var(--font-serif)',
          }}>
            Powerful <em style={{ color: 'var(--accent)' }}>Features</em>
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--ink-dim)', maxWidth: '500px', margin: '0 auto' }}>
            Everything you need to create, schedule, and analyze content at scale.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '24px',
        }}>
          {features.map((feature) => (
            <div key={feature.title} style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg)',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
            }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>{feature.icon}</div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: '8px' }}>
                {feature.title}
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--ink-dim)', lineHeight: 1.6 }}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function LpProof() {
  const stats = [
    { label: 'Content Created', value: '2.5M+' },
    { label: 'Active Users', value: '47K+' },
    { label: 'Minutes Saved', value: '3.2B+' },
  ]

  return (
    <section style={{
      padding: '80px 40px',
      background: 'var(--bg)',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{
          fontSize: '40px',
          fontWeight: 700,
          color: 'var(--ink)',
          marginBottom: '48px',
          fontFamily: 'var(--font-serif)',
        }}>
          Trusted by Content <em style={{ color: 'var(--accent)' }}>Creators</em>
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '40px',
          marginBottom: '60px',
        }}>
          {stats.map((stat) => (
            <div key={stat.label}>
              <div style={{ fontSize: '40px', fontWeight: 700, color: 'var(--accent)', marginBottom: '8px' }}>
                {stat.value}
              </div>
              <p style={{ fontSize: '14px', color: 'var(--ink-dim)' }}>{stat.label}</p>
            </div>
          ))}
        </div>

        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)',
          padding: '32px',
          maxWidth: '600px',
          margin: '0 auto',
        }}>
          <p style={{ fontSize: '15px', color: 'var(--ink-dim)', lineHeight: 1.8 }}>
            "ContentFlow cut our content creation time in half. We went from spending entire days on content calendars to just a few hours per week. Best investment for our marketing team."
          </p>
          <p style={{ fontSize: '13px', color: 'var(--ink-mute)', marginTop: '16px' }}>
            — Sarah M., Marketing Director at TechFlow
          </p>
        </div>
      </div>
    </section>
  )
}

function LpPricing() {
  const plans = [
    {
      name: 'Starter',
      price: '€19',
      period: '/month',
      credits: '1,000 credits',
      features: ['1,000 monthly credits', 'Text generation', 'Social content', 'Email sequences', 'Community support'],
      highlight: false,
    },
    {
      name: 'Pro',
      price: '€49',
      period: '/month',
      credits: '4,000 credits',
      features: ['4,000 monthly credits', 'All Starter features', 'AI images (Flux Pro)', 'AI voiceovers', 'Email support', '3 social accounts'],
      highlight: true,
    },
    {
      name: 'Agency',
      price: '€149',
      period: '/month',
      credits: '15,000 credits',
      features: ['15,000 monthly credits', 'All Pro features', 'AI videos', 'Team collaboration', 'Dedicated support', '10+ social accounts'],
      highlight: false,
    },
  ]

  return (
    <section id="pricing" style={{
      padding: '80px 40px',
      background: 'var(--surface)',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h2 style={{
            fontSize: '40px',
            fontWeight: 700,
            color: 'var(--ink)',
            marginBottom: '12px',
            fontFamily: 'var(--font-serif)',
          }}>
            Simple <em style={{ color: 'var(--accent)' }}>Pricing</em>
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--ink-dim)' }}>
            Start free, upgrade anytime. 150 bonus credits on signup.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px',
        }}>
          {plans.map((plan) => (
            <div key={plan.name} style={{
              background: 'var(--bg)',
              border: plan.highlight ? '2px solid var(--accent)' : '1px solid var(--border)',
              borderRadius: 'var(--r-lg)',
              padding: '32px',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
            }}>
              {plan.highlight && (
                <div style={{
                  position: 'absolute',
                  top: '-12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'var(--accent)',
                  color: 'var(--bg)',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '4px 12px',
                  borderRadius: 'var(--r-sm)',
                }}>
                  MOST POPULAR
                </div>
              )}
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>
                {plan.name}
              </h3>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--accent)' }}>
                  {plan.price}
                </div>
                <p style={{ fontSize: '13px', color: 'var(--ink-dim)', margin: '4px 0 0 0', fontFamily: 'var(--font-mono)' }}>
                  {plan.period} • {plan.credits}
                </p>
              </div>
              <ul style={{ flex: 1, marginBottom: '16px', listStyle: 'none', padding: 0 }}>
                {plan.features.map((feature, i) => (
                  <li key={i} style={{
                    fontSize: '13px',
                    color: 'var(--ink-dim)',
                    marginBottom: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}>
                    <span style={{ color: 'var(--accent)' }}>✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <button style={{
                padding: '12px 20px',
                background: plan.highlight ? 'var(--accent)' : 'transparent',
                color: plan.highlight ? 'var(--bg)' : 'var(--accent)',
                border: plan.highlight ? 'none' : '1px solid var(--accent)',
                borderRadius: 'var(--r-md)',
                fontSize: '14px',
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
  const faqs = [
    {
      q: 'How many credits do I need to generate content?',
      a: 'Credits vary by content type. Blog posts use 1 credit, images use 5 credits, voiceovers use 3 credits, and videos use 100 credits. You can view exact costs before generating.',
    },
    {
      q: 'Can I use ContentFlow for multiple brands?',
      a: 'Yes! Create separate brand profiles for each client or brand. Pro plan supports 3 accounts, Agency plan supports 10+.',
    },
    {
      q: 'Do unused monthly credits roll over?',
      a: 'No, monthly credits reset on your billing date. However, you can purchase additional credit packs that don\'t expire.',
    },
    {
      q: 'How is the AI content quality?',
      a: 'Our AI uses state-of-the-art language models trained on millions of high-performing social posts and content. All content is customizable and editable before publishing.',
    },
  ]

  return (
    <section style={{
      padding: '80px 40px',
      background: 'var(--bg)',
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h2 style={{
          fontSize: '40px',
          fontWeight: 700,
          color: 'var(--ink)',
          marginBottom: '48px',
          textAlign: 'center',
          fontFamily: 'var(--font-serif)',
        }}>
          Frequently Asked <em style={{ color: 'var(--accent)' }}>Questions</em>
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {faqs.map((faq, i) => (
            <div key={i} style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg)',
              padding: '20px',
            }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)', marginBottom: '8px' }}>
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
      padding: '100px 40px',
      background: 'linear-gradient(135deg, var(--surface) 0%, var(--bg) 100%)',
      textAlign: 'center',
    }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h2 style={{
          fontSize: '44px',
          fontWeight: 700,
          color: 'var(--ink)',
          marginBottom: '16px',
          fontFamily: 'var(--font-serif)',
        }}>
          Ready to scale your <em style={{ color: 'var(--accent)' }}>content</em>?
        </h2>
        <p style={{ fontSize: '16px', color: 'var(--ink-dim)', marginBottom: '32px', lineHeight: 1.6 }}>
          Join thousands of creators, marketers, and agencies saving hours on content creation.
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
          Start Free Trial
        </Link>
      </div>
    </section>
  )
}

function LpFoot() {
  return (
    <footer style={{
      padding: '40px',
      background: 'var(--surface)',
      borderTop: '1px solid var(--border)',
      textAlign: 'center',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '30px', marginBottom: '40px' }}>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent)', marginBottom: '12px', fontFamily: 'var(--font-serif)' }}>
            Product
          </div>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li><a href="#" style={{ fontSize: '13px', color: 'var(--ink-dim)' }}>Features</a></li>
            <li><a href="#" style={{ fontSize: '13px', color: 'var(--ink-dim)' }}>Pricing</a></li>
            <li><a href="#" style={{ fontSize: '13px', color: 'var(--ink-dim)' }}>Security</a></li>
          </ul>
        </div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent)', marginBottom: '12px', fontFamily: 'var(--font-serif)' }}>
            Company
          </div>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li><a href="#" style={{ fontSize: '13px', color: 'var(--ink-dim)' }}>Blog</a></li>
            <li><a href="#" style={{ fontSize: '13px', color: 'var(--ink-dim)' }}>Status</a></li>
            <li><a href="#" style={{ fontSize: '13px', color: 'var(--ink-dim)' }}>Contact</a></li>
          </ul>
        </div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent)', marginBottom: '12px', fontFamily: 'var(--font-serif)' }}>
            Legal
          </div>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li><a href="/privacy" style={{ fontSize: '13px', color: 'var(--ink-dim)' }}>Privacy</a></li>
            <li><a href="#" style={{ fontSize: '13px', color: 'var(--ink-dim)' }}>Terms</a></li>
            <li><a href="#" style={{ fontSize: '13px', color: 'var(--ink-dim)' }}>Cookies</a></li>
          </ul>
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
        <p style={{ fontSize: '13px', color: 'var(--ink-mute)', margin: 0 }}>
          © 2026 ContentFlow. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
