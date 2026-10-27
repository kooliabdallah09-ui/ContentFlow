'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DriveConnectBanner } from '@/components/DriveConnectBanner'
import Link from 'next/link'
import { getSupabase } from '@/lib/auth'
import { useIsMobile } from '@/hooks/useIsMobile'
import { MobileDashboard } from './MobileDashboard'

interface LibraryItem {
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

interface WatchedAd {
  id: string
  competitor: string
  platform: string | null
  first_seen_at: string | null
  died_at: string | null
  teardown: { hook?: string } | null
}

const DEMO = 'https://hqtlrfpzgrflbnkxxvhm.supabase.co/storage/v1/object/public/ugc-assets/demo/'
const EXAMPLE_URLS = ['allbirds.com/products/tree-runner', 'gymshark.com/products/crest-hoodie', 'ridge.com/products/wallet', 'yourstore.com/products/best-seller']

function timeAgo(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  if (secs < 172800) return 'yesterday'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysBetween(from: string | null, to: string | null) {
  if (!from) return 0
  const end = to ? new Date(to).getTime() : Date.now()
  return Math.max(0, Math.floor((end - new Date(from).getTime()) / 86_400_000))
}

// Example product links type themselves into the empty field.
function TypedExample() {
  const [text, setText] = useState('')
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const t = setTimeout(() => setText(EXAMPLE_URLS[0]), 0)
      return () => clearTimeout(t)
    }
    let u = 0, i = 0, deleting = false
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      const s = EXAMPLE_URLS[u]
      setText(s.slice(0, i))
      if (!deleting && i < s.length) { i++; timer = setTimeout(tick, 45 + Math.random() * 50) }
      else if (!deleting) { deleting = true; timer = setTimeout(tick, 2200) }
      else if (i > 0) { i--; timer = setTimeout(tick, 18) }
      else { deleting = false; u = (u + 1) % EXAMPLE_URLS.length; timer = setTimeout(tick, 350) }
    }
    timer = setTimeout(tick, 0)
    return () => clearTimeout(timer)
  }, [])
  return <span className="dash-typed">{text}<span className="dash-caret" /></span>
}

function ThumbMedia({ item }: { item: LibraryItem }) {
  const src = item.metadata?.video || item.storage_url
  const isVideo = !!src && /\.(mp4|mov|webm)(\?|$)/i.test(src)
  const img = item.metadata?.image || (!isVideo ? item.storage_url : '')
  if (isVideo) return <video src={`${src}#t=0.5`} muted loop playsInline preload="metadata" />
  if (img && /^https?:\/\//.test(img)) return <img src={img} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = 'none' }} />
  return null
}

export default function DashboardPage() {
  const router = useRouter()
  const [userName, setUserName] = useState('Creator')
  const [recentItems, setRecentItems] = useState<LibraryItem[]>([])
  const [rendering, setRendering] = useState<LibraryItem[]>([])
  const [recentLoading, setRecentLoading] = useState(true)
  const [credits, setCredits] = useState<CreditsData | null>(null)
  const [brandName, setBrandName] = useState<string | null>(null)
  const [hooks, setHooks] = useState<WatchedAd[]>([])
  const [url, setUrl] = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const hours = new Date().getHours()
  const greeting = hours < 12 ? 'Good morning' : hours < 18 ? 'Good afternoon' : 'Good evening'

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) return

    supabase.auth.getUser().then(({ data }: { data: { user: { user_metadata?: { full_name?: string }; email?: string } | null } }) => {
      const name = data.user?.user_metadata?.full_name || data.user?.email?.split('@')[0]
      if (name) setUserName(name)
    })

    supabase.auth.getSession().then(async ({ data }: { data: { session: { access_token?: string } | null } }) => {
      const token = data.session?.access_token
      if (!token) { setRecentLoading(false); return }
      const headers = { Authorization: `Bearer ${token}` }

      const [libRes, creditsRes, brandRes, watchRes] = await Promise.allSettled([
        fetch('/api/library', { headers }),
        fetch('/api/credits/balance', { headers }),
        fetch('/api/brand/load', { headers }),
        fetch('/api/watchlist', { headers }),
      ])

      if (libRes.status === 'fulfilled' && libRes.value.ok) {
        const { items } = await libRes.value.json() as { items?: LibraryItem[] }
        const all = items || []
        const recentCutoff = Date.now() - 3 * 3_600_000
        setRendering(all.filter(i => i.status === 'generating' && new Date(i.created_at).getTime() > recentCutoff).slice(0, 4))
        setRecentItems(all.filter(i => i.status === 'completed' || i.status === 'ready').slice(0, 5))
      }
      if (creditsRes.status === 'fulfilled' && creditsRes.value.ok) {
        setCredits(await creditsRes.value.json())
      }
      if (brandRes.status === 'fulfilled' && brandRes.value.ok) {
        const bd = await brandRes.value.json()
        if (bd.profile?.company_name) setBrandName(bd.profile.company_name)
      }
      if (watchRes.status === 'fulfilled' && watchRes.value.ok) {
        const { ads } = await watchRes.value.json() as { ads?: WatchedAd[] }
        setHooks((ads || []).filter(a => !a.died_at && a.teardown?.hook).slice(0, 3))
      }
      setRecentLoading(false)
    })
  }, [])

  const isMobile = useIsMobile()
  if (isMobile) {
    return (
      <MobileDashboard
        userName={userName}
        greeting={greeting}
        recentItems={recentItems}
        recentLoading={recentLoading}
        credits={credits}
        brandName={brandName}
      />
    )
  }

  const generate = () => {
    const raw = url.trim()
    if (!raw) { router.push('/generate/ugc'); return }
    const full = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    router.push(`/generate/ugc?url=${encodeURIComponent(full)}`)
  }

  const first = userName.split(/[\s._-]+/)[0] || userName
  const displayName = first.charAt(0).toUpperCase() + first.slice(1)

  return (
    <main className="content">
      <h1 className="dash-hello dash-rise">{greeting}, <em>{displayName}.</em></h1>
      <div className="dash-live dash-rise" style={{ animationDelay: '.05s' }}>
        {rendering.length > 0 ? (
          <><span className="dash-pulse" /><span><b>{rendering.length}</b> {rendering.length === 1 ? 'ad' : 'ads'} rendering</span></>
        ) : (
          <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
        )}
        {brandName && <><span className="dash-dot">·</span><Link href="/settings/brand">{brandName}</Link></>}
      </div>

      {/* Stage: the one main action */}
      <section className="dash-stage dash-rise" style={{ animationDelay: '.1s' }}>
        <div className="dash-grain" />
        <div className="dash-stage-l">
          <div className="dash-eyebrow">New ad</div>
          <h2>One product page. <em>A week of ads.</em></h2>
          <form className="dash-url" onSubmit={e => { e.preventDefault(); generate() }}>
            <label className="dash-url-in" onClick={() => inputRef.current?.focus()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>
              <span className="dash-url-field">
                <input
                  ref={inputRef}
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder=""
                  aria-label="Product page link"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                />
                {!url && !focused && <TypedExample />}
                {!url && focused && <span className="dash-typed dash-hint">Paste a Shopify, TikTok Shop or Amazon link</span>}
              </span>
            </label>
            <button type="submit" className="dash-go">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/></svg>
              Generate ads
            </button>
          </form>
          <div className="dash-spec" aria-label="Default settings">
            <div><small>Length</small><span>10s</span></div>
            <div><small>Ratio</small><span>9:16</span></div>
            <div><small>Quality</small><span>1080p</span></div>
            <div><small>Voice</small><span className="on">On</span></div>
          </div>
          <div className="dash-foot">
            <span>Or start from</span>
            <Link href="/generate/ugc">A product photo</Link>
            <Link href="/generate/teardown">A competitor&apos;s ad</Link>
            <Link href="/generate/image">Product shots</Link>
          </div>
        </div>
        <div className="dash-stage-r">
          <div className="dash-eyebrow dash-eyebrow-r"><span>Example output</span><span>9:16</span></div>
          <div className="dash-fan">
            <div className="dash-p"><video src={`${DEMO}ugc-2.mp4`} muted autoPlay loop playsInline /></div>
            <div className="dash-p"><video src={`${DEMO}ugc-1.mp4`} muted autoPlay loop playsInline /></div>
            <div className="dash-p"><video src={`${DEMO}cinemotion-carthys.mp4`} muted autoPlay loop playsInline /></div>
          </div>
          <div className="dash-cap"><div>01<b>Talking head</b></div><div>02<b>Unboxing</b></div><div>03<b>Product motion</b></div></div>
        </div>
      </section>

      <DriveConnectBanner />

      {rendering.length > 0 && (
        <section className="dash-sec dash-rise" style={{ animationDelay: '.15s' }}>
          <div className="dash-sec-h"><h2>In progress</h2><Link href="/library">View all</Link></div>
          <div className="dash-jobs">
            {rendering.map(item => (
              <Link key={item.id} href="/library" className="dash-job">
                <div className="dash-job-th"><ThumbMedia item={item} /></div>
                <div className="dash-job-meta">
                  <div className="dash-job-title">{item.metadata?.productName || item.content_type || 'Untitled'}</div>
                  <div className="dash-job-sub">Started {timeAgo(item.created_at)}</div>
                </div>
                <div className="dash-job-prog"><div className="dash-bar"><i /></div><span>Rendering</span></div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="dash-sec dash-rise" style={{ animationDelay: '.2s' }}>
        <div className="dash-sec-h"><h2>Hooks worth copying <span className="dash-sec-sub">· from your watchlist</span></h2><Link href="/watchlist">Open watchlist</Link></div>
        {hooks.length > 0 ? (
          <div className="dash-hooks">
            {hooks.map(ad => (
              <div key={ad.id} className="dash-hook">
                <div className="dash-hook-top">
                  <span>{ad.competitor}{ad.platform ? ` · ${ad.platform}` : ''}</span>
                  <span className="dash-up">{daysBetween(ad.first_seen_at, ad.died_at)}d running</span>
                </div>
                <q>{String(ad.teardown?.hook).slice(0, 120)}</q>
                <div className="dash-hook-bot">
                  <span>Still live</span>
                  <Link href={`/generate/ugc?hook=${encodeURIComponent(String(ad.teardown?.hook).slice(0, 300))}`} className="dash-use">Use this hook</Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="dash-empty">
            Save competitor ads to your watchlist and the hooks that keep running show up here, ready to reuse.
            <Link href="/generate/teardown">Break down an ad</Link>
          </div>
        )}
      </section>

      <section className="dash-sec dash-rise" style={{ animationDelay: '.25s' }}>
        <div className="dash-sec-h"><h2>Recent ads</h2><Link href="/library">Open library</Link></div>
        {recentLoading ? (
          <div className="dash-grid">{[0, 1, 2, 3, 4].map(i => <div key={i} className="dash-card dash-skel" />)}</div>
        ) : recentItems.length === 0 ? (
          <div className="dash-empty">Your finished ads will show up here.<Link href="/generate/ugc">Make your first ad</Link></div>
        ) : (
          <div className="dash-grid">
            {recentItems.map(item => {
              const title = item.metadata?.productName || item.content_type || 'Untitled'
              const tag = item.content_type === 'ugc' ? 'UGC' : (item.content_type || '').toUpperCase()
              return (
                <Link key={item.id} href="/library" className="dash-card"
                  onMouseEnter={e => e.currentTarget.querySelector('video')?.play().catch(() => {})}
                  onMouseLeave={e => e.currentTarget.querySelector('video')?.pause()}>
                  <div className="dash-thumb">
                    <ThumbMedia item={item} />
                    {tag && <span className="dash-tag">{tag}</span>}
                    <span className="dash-play"><span><svg width="14" height="14" viewBox="0 0 24 24" fill="#111"><path d="M7 4l13 8-13 8z"/></svg></span></span>
                  </div>
                  <div className="dash-card-b">
                    <div className="dash-card-t">{title}</div>
                    <div className="dash-card-m">{timeAgo(item.created_at)}</div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      <section className="dash-sec dash-rise" style={{ animationDelay: '.3s' }}>
        <div className="dash-sec-h"><h2>More tools</h2></div>
        <div className="dash-tools">
          {[
            { href: '/generate/image', t: 'Image', m: 'Product photos', d: 'M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6' },
            { href: '/generate/video', t: 'Video', m: 'From a prompt', d: 'M2 6h14v12H2zM22 8l-6 4 6 4z' },
            { href: '/generate/voice', t: 'Voiceover', m: '30+ languages', d: 'M9 2h6v12H9zM5 10a7 7 0 0 0 14 0M12 19v3' },
            { href: '/generate/social', t: 'Captions & social', m: 'Posts and carousels', d: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
            { href: '/editor', t: 'Video editor', m: 'Trim, captions, music', d: 'M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12' },
            { href: '/generate/teardown', t: 'Ad teardown', m: 'Free, no credits', d: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3' },
          ].map(tool => (
            <Link key={tool.href} href={tool.href} className="dash-tool">
              <span className="dash-tool-ic"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d={tool.d} /></svg></span>
              <span><span className="dash-tool-t">{tool.t}</span><span className="dash-tool-m">{tool.m}</span></span>
            </Link>
          ))}
        </div>
      </section>

      <style>{`
        .dash-rise { opacity: 0; transform: translateY(10px); animation: dash-rise .6s cubic-bezier(.2,.8,.2,1) forwards; }
        @keyframes dash-rise { to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .dash-rise { opacity: 1; transform: none; animation: none; } }

        .dash-hello { margin: 0; font-size: 30px; line-height: 1.15; font-weight: 600; letter-spacing: -0.025em; }
        .dash-live { display: flex; align-items: center; gap: 8px; margin-top: 8px; font-size: 13.5px; color: var(--ink-dim); flex-wrap: wrap; }
        .dash-live b { color: var(--ink); font-weight: 500; }
        .dash-live a { color: var(--ink); text-decoration: underline; text-underline-offset: 3px; text-decoration-color: var(--border-strong); }
        .dash-dot { color: var(--ink-fade); }
        .dash-pulse { width: 8px; height: 8px; border-radius: 50%; background: var(--good); position: relative; flex-shrink: 0; }
        .dash-pulse::after { content: ""; position: absolute; inset: 0; border-radius: 50%; background: var(--good); animation: dash-ping 1.8s cubic-bezier(0,0,.2,1) infinite; }
        @keyframes dash-ping { 75%, 100% { transform: scale(2.6); opacity: 0; } }

        /* Stage: flat warm charcoal panel in both themes */
        .dash-stage { --s-ink: #F2EEE6; --s-ink-2: rgba(242,238,230,.72); --s-ink-3: rgba(242,238,230,.42); --s-line: rgba(242,238,230,.1); --cream: #E6D8C3; --red: #C8322B;
          position: relative; margin-top: 22px; border-radius: 18px; overflow: hidden; background: #1A1816; color: var(--s-ink);
          display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); min-height: 320px; border: 1px solid #2A2724; }
        .dash-grain { position: absolute; inset: 0; pointer-events: none; opacity: .07; mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
        .dash-stage-l { position: relative; padding: 28px 30px 22px; display: flex; flex-direction: column; min-width: 0; }
        .dash-eyebrow { font-family: var(--font-mono); font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--s-ink-3); }
        .dash-stage h2 { font-size: 30px; line-height: 1.12; font-weight: 600; letter-spacing: -0.025em; margin: 12px 0 22px; color: var(--s-ink); text-wrap: balance; }
        .dash-stage h2 em { font-size: 35px; color: var(--cream) !important; }
        .dash-url { display: flex; gap: 8px; }
        .dash-url-in { flex: 1; min-width: 0; display: flex; align-items: center; gap: 9px; height: 44px; padding: 0 13px; border: 1px solid var(--s-line); border-radius: 10px; background: #100F0E; color: var(--s-ink); cursor: text; }
        .dash-url-in svg { color: var(--s-ink-3); flex-shrink: 0; }
        .dash-url-field { position: relative; flex: 1; min-width: 0; height: 100%; display: flex; align-items: center; }
        .dash-url-field input { position: absolute; inset: 0; width: 100%; background: transparent; border: 0; outline: 0 !important; color: var(--s-ink); font-size: 14.5px; font-family: inherit; box-shadow: none !important; padding: 0; }
        .dash-typed { font-size: 14.5px; color: var(--s-ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none; }
        .dash-hint { color: var(--s-ink-3); }
        .dash-caret { display: inline-block; width: 1.5px; height: 17px; background: var(--cream); margin-left: 1px; vertical-align: -3px; animation: dash-blink 1s steps(1) infinite; }
        @keyframes dash-blink { 50% { opacity: 0; } }
        .dash-go { height: 44px; padding: 0 18px; border-radius: 10px; background: var(--red); color: #fff; font-weight: 500; font-size: 14px; display: flex; align-items: center; gap: 8px; white-space: nowrap; border: 0; cursor: pointer; transition: background .15s; }
        .dash-go:hover { background: #B02A24; }
        .dash-spec { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin-top: 16px; border-top: 1px solid var(--s-line); border-bottom: 1px solid var(--s-line); }
        .dash-spec > div { padding: 10px 12px; border-left: 1px solid var(--s-line); }
        .dash-spec > div:first-child { border-left: 0; padding-left: 0; }
        .dash-spec small { display: block; font-family: var(--font-mono); font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--s-ink-3); }
        .dash-spec span { display: block; margin-top: 3px; font-size: 13.5px; color: var(--s-ink); }
        .dash-spec span.on::before { content: ""; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #7FB685; margin-right: 7px; vertical-align: 1px; }
        .dash-foot { display: flex; align-items: center; gap: 16px; margin-top: auto; padding-top: 16px; font-size: 13px; color: var(--s-ink-3); flex-wrap: wrap; }
        .dash-foot > span:first-child { flex-basis: 100%; }
        .dash-foot a { color: var(--s-ink-2); }
        .dash-foot a:hover { color: var(--s-ink); }
        .dash-stage-r { position: relative; background: #211E1B; border-left: 1px solid #2A2724; display: flex; flex-direction: column; padding: 22px 22px 18px; min-width: 0; }
        .dash-eyebrow-r { display: flex; justify-content: space-between; }
        .dash-fan { position: relative; flex: 1; min-height: 220px; }
        .dash-p { position: absolute; top: 50%; left: 50%; width: 118px; aspect-ratio: 9/16; border-radius: 10px; overflow: hidden; background: #2A2724; box-shadow: 0 14px 30px -12px rgba(0,0,0,.6); border: 1px solid rgba(242,238,230,.12); transition: transform .5s cubic-bezier(.2,.8,.2,1); }
        .dash-p video { width: 100%; height: 100%; object-fit: cover; display: block; }
        .dash-p:nth-child(1) { transform: translate(-128%, -48%) rotate(-4deg); }
        .dash-p:nth-child(2) { transform: translate(-50%, -52%); z-index: 2; width: 128px; }
        .dash-p:nth-child(3) { transform: translate(28%, -48%) rotate(4deg); }
        .dash-stage:hover .dash-p:nth-child(1) { transform: translate(-134%, -49%) rotate(-6deg); }
        .dash-stage:hover .dash-p:nth-child(3) { transform: translate(34%, -49%) rotate(6deg); }
        .dash-cap { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; font-family: var(--font-mono); font-size: 10.5px; color: var(--s-ink-3); border-top: 1px solid var(--s-line); padding-top: 10px; }
        .dash-cap b { display: block; color: var(--s-ink-2); font-weight: 500; font-family: var(--font-sans); font-size: 12px; margin-top: 2px; }

        .dash-sec { margin-top: 34px; }
        .dash-sec-h { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 12px; }
        .dash-sec-h h2 { margin: 0; font-size: 15px; font-weight: 600; letter-spacing: -0.01em; }
        .dash-sec-sub { font-weight: 400; color: var(--ink-dim); }
        .dash-sec-h a { font-size: 13px; color: var(--ink-dim); }
        .dash-sec-h a:hover { color: var(--ink); }

        .dash-jobs { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; }
        .dash-job { display: flex; align-items: center; gap: 14px; padding: 12px 14px; border-top: 1px solid var(--border); color: inherit; }
        .dash-job:first-child { border-top: 0; }
        .dash-job:hover { background: var(--bg); }
        .dash-job-th { width: 36px; height: 48px; border-radius: 6px; background: var(--surface-2); overflow: hidden; flex-shrink: 0; position: relative; }
        .dash-job-th img, .dash-job-th video { width: 100%; height: 100%; object-fit: cover; filter: saturate(.6); }
        .dash-job-th::after { content: ""; position: absolute; left: 0; right: 0; height: 30%; background: linear-gradient(transparent, rgba(255,255,255,.55), transparent); animation: dash-scan 2.2s linear infinite; }
        @keyframes dash-scan { from { top: -30%; } to { top: 100%; } }
        .dash-job-meta { min-width: 0; }
        .dash-job-title { font-weight: 500; font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dash-job-sub { font-size: 12.5px; color: var(--ink-dim); }
        .dash-job-prog { width: 160px; margin-left: auto; font-size: 12px; color: var(--ink-dim); }
        .dash-job-prog span { display: block; margin-top: 5px; }
        .dash-bar { height: 4px; background: var(--surface-2); border-radius: 99px; overflow: hidden; }
        .dash-bar i { display: block; height: 100%; width: 40%; background: var(--ink); border-radius: 99px; animation: dash-slide 1.6s ease-in-out infinite alternate; }
        @keyframes dash-slide { from { margin-left: 0; } to { margin-left: 60%; } }
        @media (prefers-reduced-motion: reduce) { .dash-bar i, .dash-job-th::after, .dash-pulse::after, .dash-caret { animation: none; } }

        .dash-hooks { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 12px; }
        .dash-hook { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 16px; display: flex; flex-direction: column; gap: 12px; transition: transform .2s, box-shadow .2s, border-color .2s; }
        .dash-hook:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); border-color: var(--border-strong); }
        .dash-hook-top, .dash-hook-bot { display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: var(--ink-dim); gap: 8px; }
        .dash-up { font-family: var(--font-mono); font-size: 11.5px; color: var(--good); background: var(--good-soft); padding: 2px 7px; border-radius: 99px; white-space: nowrap; }
        .dash-hook q { font-family: var(--font-display); font-size: 21px; line-height: 1.2; color: var(--ink); quotes: "\\201C" "\\201D"; flex: 1; }
        .dash-use { font-size: 12.5px; font-weight: 500; color: var(--ink); padding: 5px 10px; border-radius: 7px; border: 1px solid var(--border); white-space: nowrap; }
        .dash-use:hover { background: var(--ink); color: var(--on-ink); border-color: var(--ink); }
        .dash-empty { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding: 18px 20px; border: 1px dashed var(--border-strong); border-radius: 14px; font-size: 13.5px; color: var(--ink-dim); }
        .dash-empty a { color: var(--ink); font-weight: 500; text-decoration: underline; text-underline-offset: 3px; }

        .dash-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; }
        .dash-card { display: block; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; color: inherit; transition: transform .2s, box-shadow .2s, border-color .2s; }
        .dash-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-lg); border-color: var(--border-strong); }
        .dash-skel { aspect-ratio: 9/14; background: var(--surface-2); animation: dash-pulse-bg 1.4s ease-in-out infinite; }
        @keyframes dash-pulse-bg { 50% { opacity: .55; } }
        .dash-thumb { aspect-ratio: 9/12; background: var(--surface-2); position: relative; overflow: hidden; }
        .dash-thumb video, .dash-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .dash-tag { position: absolute; left: 8px; top: 8px; font-size: 11px; font-weight: 500; padding: 2px 7px; border-radius: 6px; background: rgba(0,0,0,.55); color: #fff; backdrop-filter: blur(6px); }
        .dash-play { position: absolute; inset: 0; display: grid; place-items: center; opacity: 0; transition: opacity .2s; background: linear-gradient(transparent 60%, rgba(0,0,0,.35)); }
        .dash-card:hover .dash-play { opacity: 1; }
        .dash-play > span { width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,.9); display: grid; place-items: center; padding-left: 2px; }
        .dash-card-b { padding: 10px 12px; }
        .dash-card-t { font-size: 13.5px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dash-card-m { font-size: 12px; color: var(--ink-dim); margin-top: 2px; }

        .dash-tools { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
        .dash-tool { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; color: inherit; transition: border-color .15s; }
        .dash-tool:hover { border-color: var(--border-strong); }
        .dash-tool-ic { width: 32px; height: 32px; border-radius: 8px; background: var(--surface-2); display: grid; place-items: center; color: var(--ink-2); flex-shrink: 0; }
        .dash-tool-t { display: block; font-size: 13.5px; font-weight: 500; }
        .dash-tool-m { display: block; font-size: 12px; color: var(--ink-dim); }

        @media (max-width: 1100px) { .dash-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
        @media (max-width: 900px) {
          .dash-stage { grid-template-columns: 1fr; }
          .dash-stage-r { display: none; }
        }
        @media (max-width: 640px) {
          .dash-url { flex-direction: column; }
          .dash-url-in { flex: none; }
          .dash-go { justify-content: center; }
          .dash-spec { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .dash-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
      `}</style>
    </main>
  )
}
