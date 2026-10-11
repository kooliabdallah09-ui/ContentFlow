'use client'

// "You" tab: profile, credits, every secondary page, theme and sign out.
// Built for the phone tab bar but works on desktop too.

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, LogOut } from 'lucide-react'
import { getSupabase } from '@/lib/auth'
import { useCredits } from '@/lib/CreditsContext'

const GROUPS: { label: string; items: { href: string; name: string; sub: string }[] }[] = [
  { label: 'Workspace', items: [
    { href: '/settings/brand', name: 'Brand', sub: 'Name, voice, colours and logo' },
    { href: '/ask', name: 'Chat', sub: 'Ask ContentFlow anything' },
    { href: '/analytics', name: 'Analytics', sub: 'What you made and spent' },
    { href: '/watchlist', name: 'Ad Watchlist', sub: 'Track competitor ads' },
  ] },
  { label: 'More tools', items: [
    { href: '/influencers', name: 'Influencer studio', sub: 'Persistent AI characters' },
    { href: '/generate/teardown', name: 'Ad Teardown', sub: 'Break down any ad' },
    { href: '/generate/business-card', name: 'Business card', sub: 'Design and export' },
    { href: '/editor', name: 'Video editor', sub: 'Trim, caption, export' },
  ] },
  { label: 'Account', items: [
    { href: '/settings/billing', name: 'Billing and credits', sub: 'Plan, usage, top-ups' },
    { href: '/settings/integrations', name: 'Integrations', sub: 'Google Drive and more' },
    { href: '/settings/account', name: 'Account', sub: 'Email and password' },
    { href: '/help', name: 'Help', sub: 'Guides and contact' },
  ] },
]

export default function YouPage() {
  const router = useRouter()
  const { balance, plan } = useCredits()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.getAttribute('data-theme') === 'dark')
    const supabase = getSupabase()
    supabase?.auth.getUser().then(({ data }: { data: { user: { email?: string; user_metadata?: Record<string, unknown> } | null } }) => {
      const u = data?.user
      if (!u) return
      setEmail(u.email ?? '')
      setName((u.user_metadata?.full_name as string) || (u.email ?? '').split('@')[0] || '')
    })
  }, [])

  const setTheme = (d: boolean) => {
    setDark(d)
    if (d) document.documentElement.setAttribute('data-theme', 'dark')
    else document.documentElement.removeAttribute('data-theme')
    try { localStorage.setItem('cf-theme', d ? 'dark' : 'light') } catch { /* private mode */ }
    window.dispatchEvent(new CustomEvent('cf-theme-change', { detail: d }))
  }

  const signOut = async () => {
    const supabase = getSupabase()
    if (supabase) { await supabase.auth.signOut(); router.push('/auth/login') }
  }

  const planLabel = ((plan ?? 'free') + ' plan').replace(/^\w/, c => c.toUpperCase())

  return (
    <main data-mobile-native="true" className="mx-page mx-you">
      <div className="mx-profile">
        <span className="mx-avatar">{(name || 'A').charAt(0).toUpperCase()}</span>
        <div>
          <b>{name || 'Your account'}</b>
          <small>{email}</small>
        </div>
      </div>

      <Link href="/settings/billing" data-press className="mx-ticket">
        <div>
          <span className="mx-mono">Credit balance</span>
          <b>{typeof balance === 'number' ? balance.toLocaleString() : '—'}</b>
        </div>
        <span className="mx-pill">{planLabel}</span>
      </Link>

      {GROUPS.map(g => (
        <section key={g.label} className="mx-group">
          <div className="mx-mono mx-group-label">{g.label}</div>
          <div className="mx-list">
            {g.items.map(i => (
              <Link key={i.href} href={i.href} data-press className="mx-li">
                <span><b>{i.name}</b><small>{i.sub}</small></span>
                <ChevronRight size={16} aria-hidden />
              </Link>
            ))}
          </div>
        </section>
      ))}

      <section className="mx-group">
        <div className="mx-mono mx-group-label">Appearance</div>
        <div className="mx-seg" role="group" aria-label="Theme">
          <button type="button" aria-pressed={!dark} onClick={() => setTheme(false)}>Light</button>
          <button type="button" aria-pressed={dark} onClick={() => setTheme(true)}>Dark</button>
        </div>
      </section>

      <button type="button" onClick={signOut} className="mx-signout"><LogOut size={15} aria-hidden /> Sign out</button>
    </main>
  )
}
