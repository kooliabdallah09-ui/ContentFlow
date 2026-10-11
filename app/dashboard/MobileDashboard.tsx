'use client'

// Press Proof mobile Home: greeting, live renders, ticket tiles, recent posters.
// Same data as the desktop dashboard, passed in from the parent page.
// Styles live in globals.css under .mx-*.

import Link from 'next/link'
import { ArrowUpRight, Play } from 'lucide-react'
import { CREATE_OPTIONS } from '@/lib/create-options'
import { OptionIcon } from '@/components/mobile/BottomNav'

interface RecentItem {
  id: string
  content_type: string
  storage_url: string
  metadata: { productName?: string; video?: string; image?: string } | null
  created_at: string
  status: string
}

interface CreditsData {
  balance: number
  plan: string
  monthlyCredits: number
  resetDate: string
}

interface MobileDashboardProps {
  userName: string
  greeting: string
  recentItems: RecentItem[]
  recentLoading: boolean
  credits: CreditsData | null
  brandName: string | null
}

// Four of the create options, same prices as the Create sheet.
const CREATE_TILES = CREATE_OPTIONS.filter(o => ['/generate/ugc', '/generate/image', '/generate/voice', '/campaigns'].includes(o.href))
const STOCKS = ['var(--stock-coral)', 'var(--stock-butter)', 'var(--stock-mint)', 'var(--stock-lilac)']

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  if (secs < 172800) return 'Yesterday'
  const days = Math.floor(secs / 86400)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function contentTypeLabel(t: string): string {
  const s = t.toLowerCase()
  if (s.includes('video') || s.includes('ugc')) return 'VIDEO'
  if (s.includes('image') || s.includes('photo')) return 'IMAGE'
  if (s.includes('audio') || s.includes('voice')) return 'AUDIO'
  if (s.includes('carousel') || s.includes('social')) return 'SOCIAL'
  return t.split('_')[0].toUpperCase().slice(0, 6)
}

export function MobileDashboard({
  userName,
  greeting,
  recentItems,
  recentLoading,
  brandName,
}: MobileDashboardProps) {
  const cleanGreeting = greeting.replace(/,\s*$/, '')
  const firstName = userName.split(' ')[0]
  const cap = firstName.charAt(0).toUpperCase() + firstName.slice(1)

  const live = recentItems.filter(i => i.status === 'generating')
  const done = recentItems.filter(i => i.status === 'completed' || i.status === 'ready')

  return (
    <div data-mobile-native="true" className="mx-page">
      <h1 className="mx-greet">
        {cleanGreeting}, {cap}.<br />
        <span>{brandName ? `Working on ${brandName}.` : 'What are we making?'}</span>
      </h1>

      {live.length > 0 && (
        <div className="mx-live-list">
          {live.slice(0, 2).map(item => (
            <Link key={item.id} href="/library" data-press className="mx-live">
              <div className="mx-live-top">
                <span className="mx-live-name">{item.metadata?.productName ?? item.content_type.replace(/_/g, ' ')}</span>
                <span className="mx-pill">Rendering</span>
              </div>
              <div className="mx-prog"><i /></div>
              <div className="mx-mono">Started {timeAgo(item.created_at)}</div>
            </Link>
          ))}
        </div>
      )}

      <div className="mx-sec">
        <span className="mx-mono">Make something</span>
        <span className="mx-mono">Cost per run</span>
      </div>
      <div data-grid="keep" className="mx-tiles">
        {CREATE_TILES.map((t, i) => (
          <Link key={t.href} href={t.href} data-press className="mx-tile" style={{ ['--stock' as string]: STOCKS[i % STOCKS.length] }}>
            <ArrowUpRight className="mx-tile-arrow" size={14} strokeWidth={2.2} aria-hidden />
            {i === 0 ? <span className="mx-flag">Flagship</span> : <OptionIcon name={t.icon} tint="transparent" size={26} />}
            <span>
              <b>{t.label}</b>
              <span className="mx-mono mx-tile-cost">{t.cost}</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="mx-sec">
        <span className="mx-mono">Recent</span>
        <Link href="/library" className="mx-mono mx-link">See all</Link>
      </div>
      {recentLoading ? (
        <div className="mx-posters m-noscroll">
          {[0, 1, 2, 3].map(i => <div key={i} className="mx-poster"><div className="mx-poster-im mx-skel" /></div>)}
        </div>
      ) : done.length === 0 ? (
        <div className="mx-empty">Nothing here yet. Tap Create to make your first asset.</div>
      ) : (
        <div className="mx-posters m-noscroll">
          {done.map((item, i) => (
            <Link key={item.id} href={`/library?id=${item.id}`} data-press className="mx-poster">
              <div className="mx-poster-im" style={{ ['--stock' as string]: STOCKS[i % STOCKS.length] }}>
                {item.metadata?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.metadata.image} alt="" />
                ) : item.metadata?.video ? (
                  <video src={item.metadata.video} muted playsInline />
                ) : null}
                <span className="mx-tag">{contentTypeLabel(item.content_type)}</span>
                {item.metadata?.video && <span className="mx-play"><i><Play size={9} fill="currentColor" aria-hidden /></i></span>}
              </div>
              <span className="mx-poster-name">{item.metadata?.productName ?? item.content_type.replace(/_/g, ' ')}</span>
              <span className="mx-mono">{timeAgo(item.created_at)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
