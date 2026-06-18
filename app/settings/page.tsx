'use client'

import Link from 'next/link'
import { User, CreditCard, Briefcase, Link2, ArrowUpRight } from 'lucide-react'

// Editorial settings hub. Cards link to the dedicated sub-pages —
// account, billing, brand, integrations.
const TILES = [
  {
    href: '/settings/account',
    icon: <User size={20} />,
    title: 'Account',
    body: 'Your name, email, password, sign-out.',
  },
  {
    href: '/settings/billing',
    icon: <CreditCard size={20} />,
    title: 'Billing & credits',
    body: 'Plans, credit packs, transaction history.',
  },
  {
    href: '/settings/brand',
    icon: <Briefcase size={20} />,
    title: 'Brand profile',
    body: 'Set the voice every UGC generation inherits.',
  },
  {
    href: '/settings/integrations',
    icon: <Link2 size={20} />,
    title: 'Integrations',
    body: 'Connect TikTok, Instagram, X — coming soon.',
  },
]

export default function SettingsPage() {
  return (
    <main className="content">
      <div className="page-meta">Settings</div>
      <h1 className="page-title">Settings &amp; <em>preferences</em></h1>
      <p className="page-sub">Manage your account, plan, brand voice, and connected platforms.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginTop: 34 }} className="settings-grid">
        {TILES.map(t => (
          <Link
            key={t.href}
            href={t.href}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 14,
              padding: 22,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 16,
              transition: 'box-shadow 160ms, transform 160ms',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow = 'var(--shadow-lg)'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = 'none'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 11,
              background: 'var(--ink)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {t.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>{t.title}</h3>
                <ArrowUpRight size={16} strokeWidth={1.8} />
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--ink-dim)', lineHeight: 1.5 }}>{t.body}</p>
            </div>
          </Link>
        ))}
      </div>

      <style>{`
        @media (max-width: 700px) {
          .settings-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  )
}
