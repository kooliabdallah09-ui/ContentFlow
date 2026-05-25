'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/Icons'

const DARK_TONES = ['ink', 'moss', 'cocoa', 'violet']

const PLANS = [
  {
    name: 'Free',
    forWho: 'For trying it on',
    price: { m: 0, a: 0 },
    unit: 'EUR / MONTH',
    features: [
      '50 credits / month',
      '+ 150 bonus credits to start',
      'All four generators',
      'Calendar & library',
      'Single brand voice',
      { muted: 'Schedule & auto-publish' },
      { muted: 'Analytics dashboard' },
    ],
    cta: 'Start free',
  },
  {
    name: 'Starter',
    forWho: 'For solo creators',
    price: { m: 19, a: 15 },
    unit: 'EUR / MONTH',
    features: [
      '1,000 credits / month',
      'All four generators',
      'Schedule & auto-publish',
      'Brand voice training',
      'UGC video (10 / month)',
      'Analytics dashboard',
      { muted: 'Multi-client workspaces' },
    ],
    cta: 'Start 14-day trial',
  },
  {
    name: 'Pro',
    forWho: 'For serious creators',
    price: { m: 49, a: 39 },
    unit: 'EUR / MONTH',
    badge: 'Most popular',
    featured: true,
    features: [
      '4,000 credits / month',
      'Unlimited UGC videos',
      'Premium AI avatars',
      'Best-time scheduling',
      'A/B testing on emails',
      'Priority generation queue',
      'API access (beta)',
    ],
    cta: 'Start 14-day trial',
  },
  {
    name: 'Agency',
    forWho: 'For teams & studios',
    price: { m: 149, a: 119 },
    unit: 'EUR / MONTH',
    features: [
      '15,000 credits / month',
      'Unlimited client workspaces',
      'White-label exports',
      'Custom avatar training',
      'SSO + roles',
      'Dedicated success lead',
      'SLA + priority support',
    ],
    cta: 'Contact sales',
  },
]

const FAQS = [
  {
    q: <>How is this <em>different</em> from ChatGPT?</>,
    a: 'ChatGPT gives you a chat window. Contentflow is the studio around it — voice training on your past work, a content calendar, four format-specific generators, scheduling, analytics, and direct publish hooks to WordPress, LinkedIn, Beehiiv, TikTok and more.',
  },
  {
    q: <>Will it sound like <em>everyone else\'s AI?</em></>,
    a: 'No — voice training reads 20 of your past pieces and locks onto sentence length, openers, recurring opinions, even punctuation patterns. Most users tell us their team can\'t guess which drafts are theirs anymore.',
  },
  {
    q: <>What happens when I <em>run out of credits?</em></>,
    a: 'Nothing breaks. You keep access to everything you\'ve made. Topping up is one click — buy a credit pack or roll over to next month. Credits don\'t expire.',
  },
  {
    q: <>Do you train on <em>my content?</em></>,
    a: 'No. Your voice profile lives in your workspace only and is never used to train shared models. Delete your account, delete your data — same day.',
  },
  {
    q: <>Can I cancel <em>anytime?</em></>,
    a: 'Yes, from one screen, no email gauntlet. Annual plans get prorated refunds in the first 30 days. We\'d rather you leave happy than stay annoyed.',
  },
]

export default function LandingPage() {
  const [tone, setTone] = useState('ink')
  const [isDark, setIsDark] = useState(true)
  const [lastDarkTone, setLastDarkTone] = useState('ink')
  const [mounted, setMounted] = useState(false)
  const [pricingPeriod, setPricingPeriod] = useState('a')
  const [openFaq, setOpenFaq] = useState(0)

  useEffect(() => {
    const randomTone = DARK_TONES[Math.floor(Math.random() * DARK_TONES.length)]
    setTone(randomTone)
    setLastDarkTone(randomTone)
    document.documentElement.setAttribute('data-tone', randomTone)
    setMounted(true)
  }, [])

  const applyTone = (t: string) => {
    setTone(t)
    document.documentElement.setAttribute('data-tone', t)
  }

  const toggleDark = () => {
    if (isDark) {
      applyTone('paper')
      setIsDark(false)
    } else {
      applyTone(lastDarkTone)
      setIsDark(true)
    }
  }

  if (!mounted) return null

  return (
    <div className="lp" data-tone={tone}>
      <Nav isDark={isDark} onToggleDark={toggleDark} />
      <Hero />
      <Logos />
      <Features />
      <Proof />
      <Flow />
      <Voices />
      <Pricing period={pricingPeriod} setPeriod={setPricingPeriod} />
      <Faq openIndex={openFaq} setOpenIndex={setOpenFaq} />
      <Cta />
      <Foot />
    </div>
  )
}

function Nav({ isDark, onToggleDark }: { isDark: boolean; onToggleDark: () => void }) {
  return (
    <nav style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '20px 0' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: 'var(--ink)' }}>
          <img src="/logo-icon.png" alt="" style={{ width: '42px', height: '42px', borderRadius: '8px' }} />
          <span style={{ fontSize: '17px', fontWeight: '600' }}>Content<em style={{ fontStyle: 'italic' }}>flow</em></span>
        </a>
        <div style={{ display: 'flex', gap: '32px' }}>
          <a href="#features" style={{ fontSize: '14px', color: 'var(--ink-dim)', textDecoration: 'none' }}>Features</a>
          <a href="#pricing" style={{ fontSize: '14px', color: 'var(--ink-dim)', textDecoration: 'none' }}>Pricing</a>
          <a href="#voices" style={{ fontSize: '14px', color: 'var(--ink-dim)', textDecoration: 'none' }}>Voices</a>
          <a href="#faq" style={{ fontSize: '14px', color: 'var(--ink-dim)', textDecoration: 'none' }}>FAQ</a>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--ink-dim)' }}>
            <span style={{ width: '8px', height: '8px', background: 'var(--good)', borderRadius: '50%' }} />
            All systems go
          </div>
          <button
            onClick={onToggleDark}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{ width: '36px', height: '36px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--surface)', color: 'var(--ink-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            {isDark
              ? <Icon.Sun style={{ width: 16, height: 16 }} />
              : <Icon.Moon style={{ width: 16, height: 16 }} />}
          </button>
          <a href="/auth/login" style={{ fontSize: '14px', color: 'var(--ink-dim)', textDecoration: 'none' }}>Sign in</a>
          <a href="/auth/signup" style={{ padding: '10px 16px', background: 'var(--accent)', color: 'var(--bg)', borderRadius: '6px', fontSize: '14px', fontWeight: '600', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Start free <Icon.Arrow style={{ width: 13, height: 13 }} />
          </a>
        </div>
      </div>
    </nav>
  )
}

function Hero() {
  return (
    <section style={{ padding: '80px 40px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', fontSize: '13px', color: 'var(--ink-dim)' }}>
            <span style={{ width: '6px', height: '6px', background: 'var(--accent)', borderRadius: '50%' }} />
            AI Content Studio · Built on Claude
          </div>
          <h1 style={{ fontSize: '56px', lineHeight: 1.2, marginBottom: '24px', fontFamily: 'var(--font-serif)', fontWeight: 400 }}>
            Stop <span style={{ textDecoration: 'line-through', color: 'var(--ink-dim)' }}>making</span> content.<br />
            Start <em style={{ color: 'var(--accent)', fontStyle: 'italic' }}>shipping</em> it.
          </h1>
          <p style={{ fontSize: '18px', lineHeight: 1.6, color: 'var(--ink-dim)', marginBottom: '32px' }}>
            SEO blogs, viral threads, UGC videos, full email flows — written in your voice, scheduled to your calendar, ready before lunch. <em style={{ color: 'var(--ink)' }}>Days of work, done in minutes.</em>
          </p>
          <form onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
            <input type="email" placeholder="you@studio.com" style={{ flex: 1, padding: '12px 16px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface)', color: 'var(--ink)', fontSize: '14px' }} />
            <button style={{ padding: '12px 24px', background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Start free <Icon.Arrow style={{ width: 13, height: 13 }} />
            </button>
          </form>
          <div style={{ display: 'flex', gap: '32px', fontSize: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex' }}>
                {['A', 'M', 'K', 'S'].map((letter, i) => (
                  <div key={i} style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '600', fontSize: '12px', marginLeft: i > 0 ? '-8px' : 0, border: '2px solid var(--bg)', background: ['linear-gradient(135deg, oklch(0.75 0.12 50), oklch(0.55 0.14 18))', 'linear-gradient(135deg, oklch(0.7 0.13 280), oklch(0.5 0.15 320))', 'linear-gradient(135deg, oklch(0.72 0.13 145), oklch(0.5 0.14 180))', 'linear-gradient(135deg, oklch(0.78 0.12 78), oklch(0.55 0.14 40))'][i] }}>
                    {letter}
                  </div>
                ))}
              </div>
              <span><strong>2,500+</strong> creators shipping daily</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'flex', gap: '2px', color: 'var(--accent)' }}>{[0,1,2,3,4].map(i => <Icon.Star key={i} style={{ width: 14, height: 14 }} />)}</span>
              <span><strong>4.9</strong> · 412 reviews</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ padding: '20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', fontSize: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', background: 'oklch(0.78 0.14 145)', borderRadius: '2px' }} />
                SEO Blog
              </div>
              <span style={{ color: 'var(--ink-dim)' }}>2,140 words</span>
            </div>
            <h3 style={{ fontSize: '16px', lineHeight: 1.4, marginBottom: '12px', fontFamily: 'var(--font-serif)' }}>
              How <em>indie founders</em> built a 6-figure newsletter in 90 days.
            </h3>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['Draft', 'WordPress', 'Ready to publish'].map((tag, i) => (
                <span key={i} style={{ fontSize: '12px', background: 'var(--bg)', padding: '4px 8px', borderRadius: '4px', color: 'var(--ink-dim)' }}>{tag}</span>
              ))}
            </div>
          </div>

          <div style={{ padding: '20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', fontSize: '13px' }}>
              <div>UGC Video</div>
              <span style={{ color: 'var(--ink-dim)' }}>0:32 · 9:16</span>
            </div>
            <h3 style={{ fontSize: '16px', lineHeight: 1.4, marginBottom: '12px', fontFamily: 'var(--font-serif)' }}>
              Try it in <em>30 seconds.</em>
            </h3>
            <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--ink-dim)' }}>
              <span><strong>184k</strong> views</span>
              <span><strong>12.4k</strong> likes</span>
              <span><strong>891</strong> shares</span>
            </div>
          </div>

          <div style={{ padding: '20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', fontSize: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', background: 'oklch(0.7 0.16 240)', borderRadius: '2px' }} />
                LinkedIn Hook
              </div>
              <span style={{ color: 'var(--ink-dim)' }}>Tue · 9:00 AM</span>
            </div>
            <h3 style={{ fontSize: '16px', lineHeight: 1.4, marginBottom: '12px', fontFamily: 'var(--font-serif)' }}>
              I quit my agency job to build in public. Six months in, here's what nobody told me…
            </h3>
            <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--ink-dim)' }}>
              <span><strong>3.2k</strong> likes</span>
              <span><strong>418</strong> reposts</span>
              <span><strong>92</strong> comments</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Logos() {
  const logos = ['Atelier', 'NORTH/SOUTH', 'Florescene', 'Quill & Co.', 'PARALLAX', 'Verbena']
  return (
    <section style={{ padding: '60px 40px', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', textAlign: 'center' }}>
        <p style={{ fontSize: '13px', color: 'var(--ink-dim)', marginBottom: '32px' }}>Trusted by studios & solo creators</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '48px', flexWrap: 'wrap' }}>
          {logos.map((logo, i) => (
            <div key={i} style={{ fontSize: '16px', fontWeight: '500', color: 'var(--ink-dim)', fontStyle: i % 2 === 0 ? 'italic' : 'normal' }}>
              {logo}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Features() {
  return (
    <section id="features" style={{ padding: '80px 40px', maxWidth: '1400px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '32px', marginBottom: '12px', fontFamily: 'var(--font-serif)', fontWeight: 400 }}>
        Everything you need to ship <em style={{ fontStyle: 'italic' }}>better content,</em> faster.
      </h2>
      <p style={{ fontSize: '16px', color: 'var(--ink-dim)', marginBottom: '60px', maxWidth: '600px' }}>
        Four generators, one brand voice. Built on Claude. Output ready to publish — not another draft to rewrite.
      </p>
      <div style={{ display: 'grid', gap: '80px' }}>
        {[
          {
            num: '01',
            label: 'SEO BLOGS',
            title: 'Long-form that actually ranks.',
            desc: '600 to 3,000-word articles structured for search — headers, metadata, internal links, schema. One click pushes to WordPress, Webflow, or Ghost.',
            specs: [
              { key: 'Length', val: '600 / 1,200 / 2,000 / 3,000 words' },
              { key: 'Voice', val: 'Trained on your past 20 posts' },
              { key: 'Outputs', val: 'WordPress · Webflow · Ghost · Markdown' },
            ],
            cta: 'See a sample article',
          },
          {
            num: '02',
            label: 'SOCIAL POSTS',
            title: 'One idea, every platform.',
            desc: 'LinkedIn hooks, Twitter threads, Instagram captions — each rewritten to the platform\'s tone, length, and rhythm. Hashtags researched, not guessed.',
            specs: [
              { key: 'Platforms', val: 'LinkedIn · X · Threads · Instagram · TikTok' },
              { key: 'Modes', val: 'Hook · Thread · Carousel · Caption' },
              { key: 'Scheduler', val: 'Best-time analysis per audience' },
            ],
            cta: 'Watch a 30s demo',
          },
          {
            num: '03',
            label: 'UGC VIDEOS',
            title: 'AI avatars that don\'t feel AI.',
            desc: 'Pick an avatar, paste a script, get a vertical video back in under five minutes. Natural voice, accurate lip-sync, broll stitched in.',
            specs: [
              { key: 'Avatars', val: '120+ creators, 9 languages, custom upload' },
              { key: 'Aspect', val: '9:16 vertical · 1:1 square · 16:9 wide' },
              { key: 'Voice', val: 'ElevenLabs cloning, your own samples' },
            ],
            cta: 'Try the studio',
          },
          {
            num: '04',
            label: 'EMAIL SEQUENCES',
            title: 'Nurture flows that actually convert.',
            desc: 'Welcome sequences, launch campaigns, re-engagement flows — written end-to-end with personalisation slots, A/B subject lines, and send-time logic.',
            specs: [
              { key: 'Sequences', val: 'Welcome · Launch · Cart · Win-back · Onboard' },
              { key: 'A/B Tests', val: 'Subject lines, openers, CTA, send time' },
              { key: 'Integrations', val: 'Beehiiv · Mailchimp · ConvertKit · Resend' },
            ],
            cta: 'View sample sequence',
          },
        ].map((feature, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'center', direction: i % 2 === 1 ? 'rtl' : 'ltr' }}>
            <div style={{ direction: 'ltr' }}>
              <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--ink-dim)', marginBottom: '16px' }}>
                {feature.num}<span style={{ color: 'var(--ink-mute)' }}> / {feature.label}</span>
              </div>
              <h3 style={{ fontSize: '32px', fontFamily: 'var(--font-serif)', marginBottom: '16px' }}>
                {feature.title.split(/\s(that|it|flows)\s/).map((part, j) => j === 2 ? <em key={j} style={{ fontStyle: 'italic' }}>{part}</em> : part)}
              </h3>
              <p style={{ fontSize: '16px', color: 'var(--ink-dim)', marginBottom: '24px', lineHeight: 1.6 }}>{feature.desc}</p>
              <ul style={{ listStyle: 'none', padding: 0, gap: '12px', display: 'flex', flexDirection: 'column', marginBottom: '24px' }}>
                {feature.specs.map((spec, j) => (
                  <li key={j} style={{ fontSize: '14px', display: 'flex', gap: '16px' }}>
                    <span style={{ fontWeight: '600', minWidth: '80px' }}>{spec.key}</span>
                    <span style={{ color: 'var(--ink-dim)' }}>{spec.val}</span>
                  </li>
                ))}
              </ul>
              <a href="#" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {feature.cta} <Icon.Arrow style={{ width: 13, height: 13 }} />
              </a>
            </div>
            <div style={{ direction: 'ltr', padding: '24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', height: '300px' }} />
          </div>
        ))}
      </div>
    </section>
  )
}

function Proof() {
  return (
    <section style={{ padding: '80px 40px', background: 'var(--surface)', maxWidth: '1400px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '32px', marginBottom: '12px', fontFamily: 'var(--font-serif)', fontWeight: 400 }}>
        Six months. Two thousand studios. <em style={{ fontStyle: 'italic' }}>Real results.</em>
      </h2>
      <p style={{ fontSize: '16px', color: 'var(--ink-dim)', marginBottom: '60px' }}>We don't ship vapor. Here's what the network has shipped together.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '40px' }}>
        {[
          { label: 'Pieces shipped', num: '52', unit: 'k', meta: '+38% MoM' },
          { label: 'Hours saved · per user / month', num: '47', unit: 'h', meta: '≈ a full work week, back' },
          { label: 'Avg. engagement lift', num: '+38', unit: '%', meta: 'vs. pre-Contentflow baseline' },
          { label: 'Active creators', num: '2,500', unit: '', meta: 'From 41 countries' },
        ].map((cell, i) => (
          <div key={i}>
            <p style={{ fontSize: '13px', color: 'var(--ink-dim)', marginBottom: '12px' }}>{cell.label}</p>
            <h3 style={{ fontSize: '48px', fontFamily: 'var(--font-serif)', marginBottom: '8px' }}>
              {cell.num}<em style={{ fontSize: '32px' }}>{cell.unit}</em>
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--ink-dim)' }}>{cell.meta}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function Flow() {
  return (
    <section style={{ padding: '80px 40px', maxWidth: '1400px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '32px', marginBottom: '12px', fontFamily: 'var(--font-serif)', fontWeight: 400 }}>
        From brief to <em style={{ fontStyle: 'italic' }}>published</em> in three steps.
      </h2>
      <p style={{ fontSize: '16px', color: 'var(--ink-dim)', marginBottom: '60px' }}>Set your voice once. After that, every piece carries the same DNA.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '40px' }}>
        {[
          { num: '01', label: 'Train your voice', title: 'Drop in your last 20 posts.', desc: 'Contentflow studies your tone, sentence length, opinions, and recurring themes.' },
          { num: '02', label: 'Generate the slate', title: 'Pick a format. Ship the slate.', desc: 'Tell us what\'s on your calendar this week. We draft blogs, threads, videos, and emails.' },
          { num: '03', label: 'Approve & schedule', title: 'One click — it\'s live.', desc: 'Push to WordPress, LinkedIn, Beehiiv, TikTok. Analytics route in automatically.' },
        ].map((step, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', fontFamily: 'var(--font-serif)', marginBottom: '8px' }}>{step.num}</div>
            <div style={{ fontSize: '12px', color: 'var(--ink-dim)', marginBottom: '16px' }}>{step.label}</div>
            <h3 style={{ fontSize: '20px', fontFamily: 'var(--font-serif)', marginBottom: '12px' }}>{step.title}</h3>
            <p style={{ fontSize: '14px', color: 'var(--ink-dim)', lineHeight: 1.6 }}>{step.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function Voices() {
  return (
    <section id="voices" style={{ padding: '80px 40px', maxWidth: '1400px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '32px', marginBottom: '12px', fontFamily: 'var(--font-serif)', fontWeight: 400 }}>
        The creators who <em style={{ fontStyle: 'italic' }}>got back</em> their afternoons.
      </h2>
      <p style={{ fontSize: '16px', color: 'var(--ink-dim)', marginBottom: '60px' }}>We didn't ask for these. They sent them.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
        {[
          {
            quote: 'I went from three posts a month to three a day. The voice is so close to mine that my own team can\'t tell which drafts I wrote.',
            name: 'Maya Aronovich',
            role: 'Founder · Atelier Studios',
            avatar: 'M',
            gradient: 'linear-gradient(135deg, oklch(0.75 0.12 50), oklch(0.55 0.14 18))',
            stat: '4.2×',
            statLabel: 'Output / week',
            featured: true
          },
          {
            quote: 'The UGC generator paid for the annual plan in one TikTok. I haven\'t recorded myself in five months.',
            name: 'Kenji Park',
            role: 'Solo creator · 184k followers',
            avatar: 'K',
            gradient: 'linear-gradient(135deg, oklch(0.7 0.13 280), oklch(0.5 0.15 320))',
          },
          {
            quote: 'I run a 9-person agency. We replaced two contractors with Contentflow and shipped twice the output.',
            name: 'Sofía Mendez',
            role: 'CEO · Florescene Agency',
            avatar: 'S',
            gradient: 'linear-gradient(135deg, oklch(0.72 0.13 145), oklch(0.5 0.14 180))',
          },
        ].map((quote, i) => (
          <div key={i} style={{ padding: '24px', background: quote.featured ? 'var(--surface)' : 'var(--bg)', border: `1px solid var(--border)`, borderRadius: '12px', gridColumn: quote.featured ? '1 / 2' : 'span 1', gridRow: quote.featured ? '1 / 3' : 'span 1' }}>
            <p style={{ fontSize: '15px', lineHeight: 1.6, marginBottom: '24px' }}>{quote.quote}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: quote.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '600' }}>
                {quote.avatar}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ink)' }}>{quote.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--ink-dim)' }}>{quote.role}</div>
              </div>
              {quote.stat && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--accent)' }}>{quote.stat}</div>
                  <div style={{ fontSize: '11px', color: 'var(--ink-dim)' }}>{quote.statLabel}</div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Pricing({ period, setPeriod }: { period: string; setPeriod: (p: string) => void }) {
  return (
    <section id="pricing" style={{ padding: '80px 40px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '60px' }}>
        <h2 style={{ fontSize: '32px', marginBottom: '12px', fontFamily: 'var(--font-serif)', fontWeight: 400 }}>
          Pricing that <em style={{ fontStyle: 'italic' }}>respects your time.</em>
        </h2>
        <p style={{ fontSize: '16px', color: 'var(--ink-dim)', marginBottom: '32px' }}>No per-seat tax. No hidden generation fees.</p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '24px' }}>
          <button onClick={() => setPeriod('m')} style={{ padding: '8px 16px', background: period === 'm' ? 'var(--accent)' : 'var(--surface)', color: period === 'm' ? 'var(--bg)' : 'var(--ink)', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>Monthly</button>
          <button onClick={() => setPeriod('a')} style={{ padding: '8px 16px', background: period === 'a' ? 'var(--accent)' : 'var(--surface)', color: period === 'a' ? 'var(--bg)' : 'var(--ink)', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Annual <span style={{ fontSize: '11px', color: period === 'a' ? 'var(--bg)' : 'var(--accent)', background: period === 'a' ? 'var(--bg)' : 'var(--accent-soft)', padding: '2px 6px', borderRadius: '3px' }}>−20%</span>
          </button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
        {PLANS.map((plan) => (
          <div key={plan.name} style={{ padding: '24px', background: plan.featured ? 'var(--accent-soft)' : 'var(--surface)', border: `1px solid ${plan.featured ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '12px', position: 'relative' }}>
            {plan.badge && (
              <div style={{ position: 'absolute', top: '-12px', left: '20px', background: 'var(--accent)', color: 'var(--bg)', padding: '4px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                {plan.badge}
              </div>
            )}
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>{plan.name}</h3>
            <p style={{ fontSize: '12px', color: 'var(--ink-dim)', marginBottom: '16px' }}>{plan.forWho}</p>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '32px', fontFamily: 'var(--font-serif)' }}>
                <em style={{ fontSize: '24px' }}>{plan.price[period as 'm' | 'a']}</em>€
              </div>
              <div style={{ fontSize: '11px', color: 'var(--ink-dim)', marginTop: '4px' }}>
                {plan.price[period as 'm' | 'a'] === 0 ? 'FOREVER' : period === 'a' ? 'PER MONTH · BILLED ANNUALLY' : 'PER MONTH'}
              </div>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, gap: '12px', display: 'flex', flexDirection: 'column', marginBottom: '24px' }}>
              {plan.features.map((feature, i) => {
                const muted = typeof feature === 'object'
                const text = muted ? (feature as any).muted : feature
                return (
                  <li key={i} style={{ fontSize: '13px', color: muted ? 'var(--ink-fade)' : 'var(--ink)', display: 'flex', gap: '8px' }}>
                    <span style={{ minWidth: '16px' }}>{muted ? '✕' : '✓'}</span>
                    {text}
                  </li>
                )
              })}
            </ul>
            <button style={{ width: '100%', padding: '10px 16px', background: plan.featured ? 'var(--accent)' : 'var(--bg)', color: plan.featured ? 'var(--bg)' : 'var(--accent)', border: `1px solid ${plan.featured ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '6px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>
              {plan.cta}
            </button>
          </div>
        ))}
      </div>
      <div style={{ textAlign: 'center', marginTop: '48px', fontSize: '13px', color: 'var(--ink-dim)' }}>
        <p style={{ marginBottom: '8px' }}>All plans · 14-day trial · cancel anytime</p>
        <a href="#" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Compare every feature →</a>
      </div>
    </section>
  )
}

function Faq({ openIndex, setOpenIndex }: { openIndex: number; setOpenIndex: (i: number) => void }) {
  return (
    <section id="faq" style={{ padding: '80px 40px', maxWidth: '700px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '32px', marginBottom: '12px', fontFamily: 'var(--font-serif)', fontWeight: 400 }}>
        Questions, <em style={{ fontStyle: 'italic' }}>answered.</em>
      </h2>
      <p style={{ fontSize: '16px', color: 'var(--ink-dim)', marginBottom: '60px' }}>
        Still unsure? <a href="#" style={{ color: 'var(--ink)', borderBottom: '1px solid var(--accent)', textDecoration: 'none' }}>Book a 15-minute walkthrough</a> — we'll show you, not tell you.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {FAQS.map((faq, i) => (
          <div key={i} style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
            <button
              onClick={() => setOpenIndex(openIndex === i ? -1 : i)}
              style={{
                width: '100%',
                padding: '16px',
                background: 'var(--surface)',
                border: 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                fontSize: '15px',
              }}
            >
              <span style={{ textAlign: 'left' }}>{faq.q}</span>
              <span style={{ fontSize: '20px', color: 'var(--accent)' }}>
                {openIndex === i ? '−' : '+'}
              </span>
            </button>
            {openIndex === i && (
              <div style={{ padding: '16px', background: 'var(--bg)', borderTop: '1px solid var(--border)', fontSize: '14px', color: 'var(--ink-dim)', lineHeight: 1.6 }}>
                {faq.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function Cta() {
  return (
    <section style={{ padding: '80px 40px', textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
      <p style={{ fontSize: '13px', color: 'var(--ink-dim)', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
        <span style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        Ready when you are
        <span style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      </p>
      <h2 style={{ fontSize: '40px', fontFamily: 'var(--font-serif)', marginBottom: '16px' }}>
        Your next piece is<br />
        <em style={{ fontStyle: 'italic' }}>already drafted.</em>
      </h2>
      <p style={{ fontSize: '16px', color: 'var(--ink-dim)', marginBottom: '32px' }}>
        Spin up your studio in 90 seconds. First 150 credits on us — no card, no commitment.
      </p>
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
        <a href="/auth/signup" style={{ padding: '12px 24px', background: 'var(--accent)', color: 'var(--bg)', borderRadius: '6px', fontWeight: '600', fontSize: '14px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
          Start free · 150 credits <Icon.Arrow style={{ width: 14, height: 14 }} />
        </a>
        <a href="#" style={{ padding: '12px 24px', background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--border)', borderRadius: '6px', fontWeight: '600', fontSize: '14px', textDecoration: 'none' }}>
          Watch a 90s demo
        </a>
      </div>
    </section>
  )
}

function Foot() {
  return (
    <footer style={{ padding: '60px 40px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '40px', marginBottom: '40px' }}>
          <div>
            <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: 'var(--ink)', marginBottom: '16px' }}>
              <img src="/logo-icon.png" alt="" style={{ width: '36px', height: '36px', borderRadius: '6px' }} />
              <span style={{ fontSize: '16px', fontWeight: '600' }}>Content<em style={{ fontStyle: 'italic' }}>flow</em></span>
            </a>
            <p style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.6 }}>
              An <em>AI content studio</em> for creators who'd rather ship than prompt.
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '16px' }}>Product</h4>
            <ul style={{ listStyle: 'none', padding: 0, gap: '8px', display: 'flex', flexDirection: 'column' }}>
              {['Blog generator', 'Social posts', 'UGC videos', 'Email sequences'].map((item) => (
                <li key={item}><a href="#" style={{ fontSize: '13px', color: 'var(--ink-dim)', textDecoration: 'none' }}>{item}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '16px' }}>Resources</h4>
            <ul style={{ listStyle: 'none', padding: 0, gap: '8px', display: 'flex', flexDirection: 'column' }}>
              {['Documentation', 'Blog', 'Changelog', 'API reference'].map((item) => (
                <li key={item}><a href="#" style={{ fontSize: '13px', color: 'var(--ink-dim)', textDecoration: 'none' }}>{item}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '16px' }}>Company</h4>
            <ul style={{ listStyle: 'none', padding: 0, gap: '8px', display: 'flex', flexDirection: 'column' }}>
              {['Contact', 'Privacy', 'Terms', 'Security'].map((item) => (
                <li key={item}><a href="#" style={{ fontSize: '13px', color: 'var(--ink-dim)', textDecoration: 'none' }}>{item}</a></li>
              ))}
            </ul>
          </div>
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: 'var(--ink-dim)' }}>
          <div>© 2026 Contentflow Studio · Crafted in Paris</div>
          <div style={{ display: 'flex', gap: '24px' }}>
            {['Twitter', 'LinkedIn', 'YouTube', 'Discord'].map((social) => (
              <a key={social} href="#" style={{ color: 'var(--ink-dim)', textDecoration: 'none' }}>{social}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

