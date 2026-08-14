'use client'

import React, { useState, useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

// ── SVG icons ────────────────────────────────────────────────────────────────
function IconSpark() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z"/>
    </svg>
  )
}
function IconBox() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  )
}
function IconPerson() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
}
function IconCalendar() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}
function IconCamera() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  )
}
function IconZap() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  )
}

// ── Illustrations — each rendered at 760px inner width, scaled to 380px ──────

function IlluDashboard() {
  return (
    <>
      <div style={{ padding: '24px 28px' }}>
        <div style={{ fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20, fontFamily: 'var(--font-mono, monospace)' }}>
          STUDIO · DASHBOARD
        </div>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 52, fontWeight: 400, color: 'var(--ink)', lineHeight: 1.05, margin: '0 0 4px', letterSpacing: '-0.02em' }}>
          Good afternoon, S.
        </h1>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 52, fontWeight: 400, color: 'var(--ink-dim)', fontStyle: 'italic', lineHeight: 1.05, margin: '0 0 24px', letterSpacing: '-0.02em' }}>
          What are we making today?
        </h1>
        <div style={{ background: 'linear-gradient(120deg,#FBF7EC,#F3EBD6)', border: '1px solid #EADFBB', borderRadius: 18, padding: '18px 24px', marginBottom: 22, display: 'flex', gap: 24, alignItems: 'center', color: '#2C1F0A' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A6420', marginBottom: 4 }}>Available credits</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 30, letterSpacing: '-0.02em', lineHeight: 1 }}>30</div>
          </div>
          <div style={{ width: 1, height: 36, background: '#E4D2A0', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 10, color: '#8A8264', marginBottom: 4 }}>Monthly allocation</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>0 · Free plan</div>
          </div>
          <div style={{ width: 1, height: 36, background: '#E4D2A0', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 10, color: '#8A8264', marginBottom: 4 }}>Reset date</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Sep 1, 2026</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { l: 'UGC Package', s: 'Talking-head · 9:16', d: '#D97706' },
            { l: 'Image',       s: 'AI product shots',    d: '#0EA5E9' },
            { l: 'Voiceover',   s: 'ElevenLabs · per clip', d: '#6366F1' },
            { l: 'Social',      s: 'AI copywriting',      d: '#F59E0B' },
          ].map((t, i) => (
            <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: '16px 14px', background: 'var(--surface)', cursor: 'pointer' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.d, marginBottom: 14 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 4, lineHeight: 1.2 }}>{t.l}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>{t.s}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function IlluBrand() {
  return (
    <div style={{ padding: '24px 28px' }}>
      <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 40, fontWeight: 400, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.1, margin: '0 0 22px' }}>
        Brand <em>profile</em>
      </h1>
      {/* Section 1: Identity */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 16, padding: '20px 22px', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--ink)', color: 'var(--on-ink, #fff)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>1</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Brand identity</div>
        </div>
        {/* Logo row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 10, border: '1.5px dashed var(--border-strong)', background: 'var(--bg-elev)' }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Upload logo</div>
            <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>PNG · JPG · WEBP</div>
          </div>
        </div>
        {/* Name + Description */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ height: 38, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-elev)', padding: '0 12px', display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>ContentFlow</span>
          </div>
          <div style={{ height: 60, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-elev)', padding: '10px 12px' }}>
            <span style={{ fontSize: 12.5, color: 'var(--ink-mute)' }}>AI content studio for brand marketers…</span>
          </div>
        </div>
        {/* Colors */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>Brand colors</span>
          {['#111','#fff','#2563eb'].map((c, i) => (
            <div key={i} style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: '1.5px solid var(--border)' }} />
          ))}
          <div style={{ width: 20, height: 20, borderRadius: '50%', border: '1.5px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          </div>
        </div>
      </div>
      {/* Section 2: Audience + Tone */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 16, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--ink-dim)' }}>2</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Voice &amp; audience</div>
        </div>
        <div style={{ height: 38, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-elev)', padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: 'var(--ink)' }}>Friendly &amp; Approachable</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>
        </div>
        <div style={{ height: 38, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-elev)', padding: '0 12px', display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--ink-mute)' }}>Busy founders in their 30s, indie creators…</span>
        </div>
      </div>
    </div>
  )
}

function IlluProductStudio() {
  const products = [
    { name: 'Summer Serum', cat: 'Beauty',   grad: 'linear-gradient(135deg,#f5ede0,#d4b896,#b89070)' },
    { name: 'Night Cream',  cat: 'Skincare', grad: 'linear-gradient(135deg,#e8f0ec,#c0d4c8,#8aaa98)' },
    { name: 'Face Wash',    cat: 'Cleanser', grad: 'linear-gradient(135deg,#e8eaf5,#b8bce0,#8890c8)' },
  ]
  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 22, borderBottom: '1px solid var(--border)' }}>
        {['Influencers', 'Products', 'Scenes'].map((tab, i) => (
          <div key={i} style={{
            fontSize: 13, fontWeight: i === 1 ? 700 : 500,
            color: i === 1 ? 'var(--ink)' : 'var(--ink-mute)',
            padding: '8px 18px',
            borderBottom: i === 1 ? '2px solid var(--ink)' : '2px solid transparent',
            marginBottom: -1,
            cursor: 'pointer',
          }}>{tab}</div>
        ))}
      </div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 40, fontWeight: 400, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.1, margin: '0 0 6px' }}>
            Product <em>studio</em>
          </h1>
          <p style={{ fontSize: 13, color: 'var(--ink-mute)', margin: 0 }}>Add your product once — shoot it in endless aesthetics.</p>
        </div>
        <div style={{ background: 'var(--ink)', color: 'var(--on-ink, #fff)', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          ✦ Add product
        </div>
      </div>
      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {products.map((p, i) => (
          <div key={i} style={{ textAlign: 'left', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', background: 'var(--surface)' }}>
            <div style={{ width: '100%', aspectRatio: '1', background: p.grad }} />
            <div style={{ padding: '10px 12px' }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{p.name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-dim)', marginTop: 2 }}>{p.cat}</div>
            </div>
          </div>
        ))}
        {/* Dashed ghost tile */}
        <div style={{ border: '1.5px dashed var(--border)', borderRadius: 14, background: 'transparent', minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--ink-mute)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8M8 12h8"/></svg>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>Add another</span>
        </div>
      </div>
    </div>
  )
}

function IlluInfluencerStudio() {
  const actors = [
    { name: 'Tom Harland',  handle: '@tomharland',  niche: 'fitness, film',     grad: 'linear-gradient(to bottom,#c8b8a8 0%,#907868 45%,#3a2c24 100%)' },
    { name: 'Marcus Vael',  handle: '@marcusvael',  niche: "men's style",       grad: 'linear-gradient(to bottom,#b8a898 0%,#806858 45%,#2e2218 100%)' },
    { name: 'Mara Soleil',  handle: '@marasoleil',  niche: 'lifestyle, beauty', grad: 'linear-gradient(to bottom,#e0c8b0 0%,#c09880 45%,#6a4838 100%)' },
    { name: 'Marco Reyes',  handle: '@marcoreyes',  niche: 'streetwear, art',   grad: 'linear-gradient(to bottom,#a8a0b0 0%,#706880 45%,#302838 100%)' },
  ]
  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 22, borderBottom: '1px solid var(--border)' }}>
        {['Influencers BETA', 'Products BETA', 'Scenes'].map((tab, i) => (
          <div key={i} style={{
            fontSize: 13, fontWeight: i === 0 ? 700 : 500,
            color: i === 0 ? 'var(--ink)' : 'var(--ink-mute)',
            padding: '8px 18px',
            borderBottom: i === 0 ? '2px solid var(--ink)' : '2px solid transparent',
            marginBottom: -1,
            cursor: 'pointer',
          }}>{tab}</div>
        ))}
      </div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 40, fontWeight: 400, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.1, margin: '0 0 6px' }}>
            Influencer <em>studio</em>
          </h1>
          <p style={{ fontSize: 13, color: 'var(--ink-mute)', margin: 0 }}>Describe a character once — get a persistent AI influencer.</p>
        </div>
        <div style={{ border: '1px solid var(--border)', color: 'var(--ink)', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          ✦ Create new influencer
        </div>
      </div>
      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {actors.map((a, i) => (
          <div key={i} style={{ textAlign: 'left', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', background: 'var(--surface)' }}>
            <div style={{ width: '100%', aspectRatio: '4/5', background: a.grad }} />
            <div style={{ padding: '10px 12px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{a.name}</div>
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11.5, color: 'var(--ink-mute)', marginTop: 1 }}>{a.handle}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-dim)', marginTop: 4 }}>{a.niche}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function IlluCampaigns() {
  const campaigns = [
    { name: 'Summer Launch',   meta: 'Beauty · Maya · 12 shots · Launch',    badge: 'ACTIVE', bc: '#16a34a' },
    { name: 'Fall Collection', meta: 'Fashion · Alex · 8 shots · Awareness', badge: 'DRAFT',  bc: '#6b7280' },
  ]
  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 40, fontWeight: 400, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.1, margin: '0 0 6px' }}>
            Campaigns
          </h1>
          <p style={{ fontSize: 13, color: 'var(--ink-mute)', margin: 0 }}>Map out a full content strategy — the AI writes the shot list.</p>
        </div>
        <div style={{ background: 'var(--ink)', color: 'var(--on-ink, #fff)', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          New campaign
        </div>
      </div>
      {/* Campaign rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {campaigns.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)' }}>
            <div style={{ width: 56, height: 56, borderRadius: 10, background: 'var(--border)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{c.name}</div>
                <div style={{ background: c.bc + '22', color: c.bc, fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 99, letterSpacing: '0.06em' }}>{c.badge}</div>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-mute)' }}>{c.meta}</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
          </div>
        ))}
      </div>
    </div>
  )
}

function IlluShooting() {
  const shots = [
    { grad: 'linear-gradient(135deg,#f5ede0,#c8a878,#8a6840)', label: 'Golden hour' },
    { grad: 'linear-gradient(135deg,#e8f0ec,#a8c8b0,#507860)', label: 'Studio white' },
    { grad: 'linear-gradient(135deg,#e8eaf5,#a8b0e0,#485898)', label: 'Street editorial' },
    { grad: 'linear-gradient(135deg,#f8e8e0,#e0a898,#a86050)', label: 'Custom scene' },
  ]
  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 22, borderBottom: '1px solid var(--border)' }}>
        {['Influencers', 'Products', 'Scenes'].map((tab, i) => (
          <div key={i} style={{
            fontSize: 13, fontWeight: i === 1 ? 700 : 500,
            color: i === 1 ? 'var(--ink)' : 'var(--ink-mute)',
            padding: '8px 18px',
            borderBottom: i === 1 ? '2px solid var(--ink)' : '2px solid transparent',
            marginBottom: -1,
            cursor: 'pointer',
          }}>{tab}</div>
        ))}
      </div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 40, fontWeight: 400, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.1, margin: '0 0 6px' }}>
            Product <em>studio</em>
          </h1>
          <p style={{ fontSize: 13, color: 'var(--ink-mute)', margin: 0 }}>Shoot your product in any aesthetic — art-directed by AI.</p>
        </div>
        <div style={{ background: 'var(--ink)', color: 'var(--on-ink, #fff)', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          ✦ Shoot
        </div>
      </div>
      {/* Generated photo grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {shots.map((s, i) => (
          <div key={i} style={{ borderRadius: 13, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)', position: 'relative' }}>
            <div style={{ width: '100%', aspectRatio: '4/5', background: s.grad }} />
            <span style={{ position: 'absolute', bottom: 8, left: 8, fontSize: 9.5, fontWeight: 600, background: 'rgba(0,0,0,0.55)', color: '#fff', padding: '3px 8px', borderRadius: 999 }}>
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function IlluBilling() {
  const plans = [
    { name: 'Lite',    price: '$6',   credits: '200 cr/mo',   pop: false, current: false },
    { name: 'Starter', price: '$19',  credits: '800 cr/mo',   pop: false, current: true  },
    { name: 'Pro',     price: '$49',  credits: '2,000 cr/mo', pop: true,  current: false },
    { name: 'Agency',  price: '$149', credits: '6,500 cr/mo', pop: false, current: false },
  ]
  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Title */}
      <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 40, fontWeight: 400, color: 'var(--ink)', letterSpacing: '-0.02em', margin: '0 0 18px', lineHeight: 1.1 }}>
        Billing &amp; <em>Credits</em>
      </h1>
      {/* Credits bar */}
      <div style={{ background: 'linear-gradient(120deg,#FBF7EC,#F3EBD6)', border: '1px solid #EADFBB', borderRadius: 16, padding: '16px 22px', marginBottom: 22, display: 'flex', gap: 24, alignItems: 'center', color: '#2C1F0A' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A6420', marginBottom: 3 }}>Available credits</div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 26, letterSpacing: '-0.02em', lineHeight: 1 }}>30</div>
        </div>
        <div style={{ width: 1, height: 34, background: '#E4D2A0', flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 10, color: '#8A8264', marginBottom: 3 }}>Plan</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Starter · $19/mo</div>
        </div>
        <div style={{ width: 1, height: 34, background: '#E4D2A0', flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 10, color: '#8A8264', marginBottom: 3 }}>Reset</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Sep 1, 2026</div>
        </div>
      </div>
      {/* Monthly/Annual toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 99, display: 'flex', padding: 3, gap: 2 }}>
          <div style={{ padding: '5px 16px', borderRadius: 99, background: 'var(--ink)', color: 'var(--on-ink, #fff)', fontSize: 12, fontWeight: 600 }}>Monthly</div>
          <div style={{ padding: '5px 16px', borderRadius: 99, fontSize: 12, fontWeight: 500, color: 'var(--ink-mute)' }}>Annual</div>
        </div>
        <div style={{ fontSize: 11.5, color: '#16a34a', fontWeight: 600 }}>Save 20% with annual</div>
      </div>
      {/* Plan cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {plans.map((p, i) => (
          <div key={i} style={{ position: 'relative', border: p.pop ? '2px solid var(--ink)' : p.current ? '1.5px solid var(--ink)' : '1px solid var(--border)', borderRadius: 14, padding: '18px 14px', background: 'var(--surface)' }}>
            {(p.pop || p.current) && (
              <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: 'var(--ink)', color: 'var(--on-ink, #fff)', fontSize: 8, fontWeight: 700, padding: '2px 9px', borderRadius: 99, whiteSpace: 'nowrap', letterSpacing: '0.06em' }}>
                {p.current ? 'CURRENT PLAN' : 'MOST POPULAR'}
              </div>
            )}
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-mute)', marginBottom: 8 }}>{p.name}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.04em', lineHeight: 1 }}>
              {p.price}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--ink-mute)' }}>/mo</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 5, marginBottom: 14 }}>{p.credits}</div>
            <div style={{ background: p.pop ? 'var(--ink)' : 'transparent', color: p.pop ? 'var(--on-ink, #fff)' : 'var(--ink-mute)', border: p.pop ? 'none' : '1px solid var(--border)', borderRadius: 8, padding: '8px 0', fontSize: 12, fontWeight: 600, textAlign: 'center' }}>
              {p.current ? 'Current plan' : p.pop ? 'Upgrade →' : 'Select'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Step definitions ──────────────────────────────────────────────────────────
const STEPS: {
  Icon: () => React.ReactElement
  label: string
  title: string
  body: ReactNode
  illustration: React.ReactElement
  tip: string | null
  cta: string
  href: string | null
}[] = [
  {
    Icon: IconSpark,
    label: 'Welcome',
    title: 'Your AI content studio is ready.',
    illustration: <IlluDashboard />,
    body: <>ContentFlow turns your product into <strong>scroll-stopping ads</strong>, <strong>lifestyle shoots</strong>, and <strong>branded content</strong> — <strong>fully AI-generated</strong>. No photographer, no crew, no agency. Follow this short guide to set everything up correctly before you start creating.</>,
    tip: null,
    cta: 'Start the setup',
    href: null,
  },
  {
    Icon: IconSpark,
    label: 'Brand',
    title: 'Set up your brand identity.',
    illustration: <IlluBrand />,
    body: <><strong>Brand</strong> is your identity layer — your logo, company name, description, colors, tone of voice, and target audience. Everything you fill in here <strong>auto-populates the UGC builder, scripts, and captions</strong> so you never retype it. <strong>Your individual products live separately in Product Studio</strong> — Brand describes who you are, Product Studio is where you add what you sell.</>,
    tip: 'Tip: fill in your tone of voice and target audience — these two fields have the biggest impact on how your AI-generated scripts and captions sound.',
    cta: 'Set up brand',
    href: '/settings/brand',
  },
  {
    Icon: IconBox,
    label: 'Product',
    title: 'Add your products in Product Studio.',
    illustration: <IlluProductStudio />,
    body: <>Each product you sell lives in <strong>Product Studio</strong>. Upload photos from <strong>multiple angles</strong>, add a name and description, and the AI builds a full product sheet. Those <strong>reference photos carry into every shoot, ad, and campaign</strong> you run — and your Campaigns dropdown will show exactly the products you added here. <strong>The more angles you provide, the better every result looks.</strong></>,
    tip: 'Tip: upload at least 3 angles — front, back, and a detail shot. This dramatically improves consistency across all generated content.',
    cta: 'Open Product Studio',
    href: '/generate/products',
  },
  {
    Icon: IconPerson,
    label: 'Actor',
    title: 'Create your AI actor.',
    illustration: <IlluInfluencerStudio />,
    body: <>Your AI actor is the <strong>face of your brand content</strong>. Go to <strong>Studios → Influencers</strong> and <strong>let the AI generate a unique actor for you</strong> — just give it a name, personality, and niche. You can optionally upload a reference photo to guide the look. ContentFlow builds a full <strong>character sheet</strong> — a reusable identity that stays consistent across every ad, scene, and shoot.</>,
    tip: 'Pro tip: describe a specific look in the personality field — age, style, energy. The more precise you are, the more consistent your actor will be across shoots.',
    cta: 'Open Influencer Studio',
    href: '/influencers',
  },
  {
    Icon: IconCalendar,
    label: 'Campaign',
    title: 'Plan your campaign.',
    illustration: <IlluCampaigns />,
    body: <>Campaigns let you map out a <strong>full content strategy</strong> in one place. Select your product, pick your actor, choose a goal (launch, awareness, or conversion), and the AI generates a <strong>complete shot list with scripts and hooks</strong>. You can then generate each shot directly from the <strong>campaign planner</strong> without starting from scratch each time.</>,
    tip: 'Pro tip: build a launch campaign before your next product drop. It pre-generates 10–20 pieces of content you can deploy over weeks.',
    cta: 'Open Campaigns',
    href: '/campaigns',
  },
  {
    Icon: IconCamera,
    label: 'Shoot',
    title: 'Generate lifestyle content.',
    illustration: <IlluShooting />,
    body: <>With your product and actor saved, the Studios become your <strong>production engine</strong>. In <strong>Product Studio</strong> you can shoot your product in any aesthetic — golden hour lifestyle, studio white, street editorial, or custom scenes you describe. In <strong>Influencer Studio</strong>, shoot your actor in branded scenes, outfits, and settings. Every output is <strong>production-ready</strong>.</>,
    tip: 'Pro tip: create a Scene in Studios → Scenes first to lock in a specific environment. Then use that scene across multiple shoots for a cohesive look.',
    cta: 'Start shooting',
    href: '/generate/products',
  },
  {
    Icon: IconZap,
    label: 'Upgrade',
    title: 'Ready for UGC ads and video?',
    illustration: <IlluBilling />,
    body: <><strong>UGC Package</strong> and <strong>AI Video generation</strong> — talking-head ads, podcast ads, and scroll-stop video — require a <strong>paid plan</strong>. These features use our most advanced models and are currently available to upgraded accounts. When you&apos;re ready to produce your first ad, <strong>upgrade and the full studio unlocks immediately</strong>.</>,
    tip: null,
    cta: 'View upgrade options',
    href: '/settings/billing',
  },
]

// ── Component ─────────────────────────────────────────────────────────────────
export default function OnboardingTour() {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)
  const [confirmSkip, setConfirmSkip] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (typeof localStorage === 'undefined') return
    if (localStorage.getItem('cf-new-user') === '1') setVisible(true)
  }, [])

  function dismiss() {
    localStorage.removeItem('cf-new-user')
    setVisible(false)
    setConfirmSkip(false)
  }

  function goToStep(i: number) {
    setStep(i)
    const target = STEPS[i]
    if (target.href) router.push(target.href)
  }

  function next() {
    if (step < STEPS.length - 1) goToStep(step + 1)
    else dismiss()
  }

  if (!visible) return null

  const current = STEPS[step]
  const progress = (step / (STEPS.length - 1)) * 100

  return (
    <>
      {/* Backdrop */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }} />

      {/* Tour card — two-panel flex container */}
      <div style={{
        position: 'fixed', zIndex: 1000,
        bottom: 32, right: 32,
        display: 'flex', flexDirection: 'row',
        borderRadius: 20,
        overflow: 'hidden',
        border: '1px solid var(--border)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.2), 0 8px 24px rgba(0,0,0,0.1)',
        animation: 'tourIn 0.35s cubic-bezier(0.16,1,0.3,1)',
      }}>

        {/* LEFT panel — illustration */}
        <div className="tour-illu-panel" style={{
          width: 380, height: 560, flexShrink: 0,
          borderRight: '1px solid var(--border)',
          overflow: 'hidden', position: 'relative',
          background: 'var(--bg)',
        }}>
          {/* Slight overlay when confirmSkip is active */}
          {confirmSkip && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.12)', zIndex: 1 }} />
          )}
          {/* Scale wrapper: inner content at 760px, scaled 50% → 380px */}
          <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: 760 }}>
            {current.illustration}
          </div>
        </div>

        {/* RIGHT panel — step content */}
        <div style={{
          width: 380, flexShrink: 0, height: 560,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          background: 'var(--bg)',
        }}>
          {/* Progress bar — 3px full-width at top */}
          <div style={{ height: 3, background: 'var(--border)', flexShrink: 0 }}>
            <div style={{ height: '100%', background: 'var(--ink)', width: `${progress}%`, transition: 'width 0.4s ease' }} />
          </div>

          {/* Scrollable content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Header row: pills + skip */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {/* Step pills */}
              <div style={{ display: 'flex', gap: 4 }}>
                {STEPS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => goToStep(i)}
                    title={s.label}
                    style={{
                      padding: '3px 8px', borderRadius: 999, border: 'none', cursor: 'pointer',
                      fontSize: 10.5, fontWeight: 600, fontFamily: 'var(--font-mono)',
                      letterSpacing: '0.04em', textTransform: 'uppercase',
                      background: i === step ? 'var(--ink)' : i < step ? 'var(--border)' : 'transparent',
                      color: i === step ? 'var(--on-ink)' : i < step ? 'var(--ink-dim)' : 'var(--ink-mute)',
                      transition: 'all 0.2s',
                    }}
                  >
                    {i < step ? '✓' : i + 1}
                  </button>
                ))}
              </div>

              {/* Skip all */}
              <button
                onClick={() => setConfirmSkip(true)}
                style={{ fontSize: 12, color: 'var(--ink-mute)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
              >
                Skip all
              </button>
            </div>

            {/* Skip confirmation */}
            {confirmSkip && (
              <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(234,88,12,0.06)', border: '1px solid rgba(234,88,12,0.2)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#9a3412' }}>Not recommended</div>
                <div style={{ fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>Skipping the guide means you may miss key setup steps. Your content quality will be lower without a product and actor configured first.</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setConfirmSkip(false)}
                    style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid rgba(234,88,12,0.3)', background: 'transparent', fontSize: 12, fontWeight: 600, color: '#9a3412', cursor: 'pointer' }}
                  >
                    Keep going
                  </button>
                  <button
                    onClick={dismiss}
                    style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', background: 'rgba(234,88,12,0.12)', fontSize: 12, fontWeight: 600, color: '#9a3412', cursor: 'pointer' }}
                  >
                    Skip anyway
                  </button>
                </div>
              </div>
            )}

            {/* Icon + step label + body + tip + footer */}
            {!confirmSkip && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)', flexShrink: 0 }}>
                    <current.Icon />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)', marginBottom: 3 }}>
                      {step === 0 ? 'Getting started' : `Step ${step} of ${STEPS.length - 1}`}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.25 }}>{current.title}</div>
                  </div>
                </div>

                {/* Body */}
                <div style={{ fontSize: 13.5, color: 'var(--ink-dim)', lineHeight: 1.7 }}>{current.body}</div>

                {/* Tip */}
                {current.tip && (
                  <div style={{ padding: '10px 13px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 12.5, color: 'var(--ink-dim)', lineHeight: 1.6 }}>
                    <span style={{ fontWeight: 700, color: 'var(--ink)', marginRight: 4 }}>Tip.</span>
                    {current.tip.replace('Pro tip: ', '')}
                  </div>
                )}

                {/* Footer */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 2 }}>
                  {step > 0 ? (
                    <button
                      onClick={() => goToStep(step - 1)}
                      style={{ fontSize: 13, color: 'var(--ink-mute)', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0', display: 'flex', alignItems: 'center', gap: 5 }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                      Back
                    </button>
                  ) : <span />}

                  <button
                    onClick={next}
                    style={{
                      padding: '10px 20px', borderRadius: 11, border: 'none',
                      background: step === STEPS.length - 1 ? '#16a34a' : 'var(--ink)',
                      color: 'var(--on-ink)',
                      fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
                      letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 7,
                      transition: 'background 0.2s',
                    }}
                  >
                    {current.cta}
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes tourIn {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (max-width: 820px) {
          .tour-illu-panel { display: none !important; }
        }
      `}</style>
    </>
  )
}
