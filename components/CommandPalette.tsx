'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/auth'

interface CommandItem {
  id: string
  group: string
  label: string
  sub?: string
  shortcut?: string
  onSelect: () => void
}

const PAGES: Array<{ label: string; href: string; group: string; sub?: string }> = [
  { label: 'Dashboard', href: '/dashboard', group: 'Navigation' },
  { label: 'Library', href: '/library', group: 'Navigation' },
  { label: 'Analytics', href: '/analytics', group: 'Navigation' },
  { label: 'Chat', href: '/ask', group: 'Navigation' },
  { label: 'UGC Package', href: '/generate/ugc', group: 'Create', sub: 'Flagship talking-head ad' },
  { label: 'AI Video', href: '/generate/video', group: 'Create', sub: 'Seedance 2.0 cinematic video' },
  { label: 'Image', href: '/generate/image', group: 'Create', sub: 'Flux Pro image generation' },
  { label: 'Voiceover', href: '/generate/voice', group: 'Create', sub: 'ElevenLabs voice synthesis' },
  { label: 'Social caption', href: '/generate/social', group: 'Create' },
  { label: 'Screen Demo', href: '/generate/screen-demo', group: 'Create' },
  { label: 'Business Card', href: '/generate/business-card', group: 'Create' },
  { label: 'Brand settings', href: '/settings/brand', group: 'Settings' },
  { label: 'Integrations', href: '/settings/integrations', group: 'Settings' },
  { label: 'Account', href: '/settings/account', group: 'Settings' },
  { label: 'Billing', href: '/settings/billing', group: 'Settings' },
]

interface LibraryHit {
  id: string
  name?: string
  content_type: string
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [libraryHits, setLibraryHits] = useState<LibraryHit[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  // Fetch library on open for searching
  useEffect(() => {
    if (!open) return
    const supabase = getSupabase()
    if (!supabase) return
    supabase.auth.getSession().then(async ({ data }: { data: { session: { access_token?: string } | null } }) => {
      const token = data.session?.access_token
      if (!token) return
      const res = await fetch('/api/library', { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const { items } = await res.json()
        setLibraryHits(items?.slice(0, 30) ?? [])
      }
    })
  }, [open])

  const items: CommandItem[] = useMemo(() => {
    const q = query.toLowerCase().trim()

    const pageItems: CommandItem[] = PAGES
      .filter(p => !q || p.label.toLowerCase().includes(q) || p.group.toLowerCase().includes(q))
      .map(p => ({
        id: `page:${p.href}`,
        group: p.group,
        label: p.label,
        sub: p.sub,
        onSelect: () => { router.push(p.href); onClose() },
      }))

    const libItems: CommandItem[] = libraryHits
      .filter(h => {
        const name = (h.name || h.content_type || '').toLowerCase()
        return !q || name.includes(q)
      })
      .slice(0, 6)
      .map(h => ({
        id: `lib:${h.id}`,
        group: 'Library',
        label: h.name || h.content_type || 'Untitled',
        sub: h.content_type?.toUpperCase(),
        onSelect: () => { router.push('/library'); onClose() },
      }))

    return [...pageItems, ...libItems]
  }, [query, libraryHits, router, onClose])

  // Group items by group
  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>()
    items.forEach(it => {
      if (!map.has(it.group)) map.set(it.group, [])
      map.get(it.group)!.push(it)
    })
    return Array.from(map.entries())
  }, [items])

  // Reset active when items change
  useEffect(() => { setActive(0) }, [query])

  // Keyboard
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(items.length - 1, a + 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)) }
      else if (e.key === 'Enter') { e.preventDefault(); items[active]?.onSelect() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, items, active, onClose])

  if (!open) return null

  let runningIdx = -1

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(3px)',
        display: 'flex', justifyContent: 'center', paddingTop: '12vh',
      }}
    >
      <div style={{
        width: '100%', maxWidth: 580, margin: '0 16px',
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden', maxHeight: '70vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--border-soft)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search pages, library, settings…"
            style={{
              flex: 1, border: 'none', outline: 'none',
              fontSize: 15, background: 'transparent', color: 'var(--ink)',
            }}
          />
          <kbd style={{
            fontSize: 11, padding: '2px 6px', borderRadius: 5,
            background: 'var(--surface-2)', color: 'var(--ink-mute)',
            border: '1px solid var(--border)', fontFamily: 'var(--font-mono)',
          }}>ESC</kbd>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {grouped.length === 0 ? (
            <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            grouped.map(([group, gItems]) => (
              <div key={group}>
                <div style={{
                  padding: '10px 18px 6px', fontSize: 10.5, fontWeight: 700,
                  color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.07em',
                }}>{group}</div>
                {gItems.map(it => {
                  runningIdx++
                  const isActive = runningIdx === active
                  return (
                    <button
                      key={it.id}
                      onClick={it.onSelect}
                      onMouseEnter={() => setActive(items.indexOf(it))}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        width: '100%', padding: '10px 18px', border: 'none', cursor: 'pointer',
                        background: isActive ? 'var(--hover)' : 'transparent',
                        color: 'var(--ink)', textAlign: 'left',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 500 }}>{it.label}</span>
                        {it.sub && <span style={{ fontSize: 11.5, color: 'var(--ink-mute)' }}>{it.sub}</span>}
                      </div>
                      {isActive && <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>↵</span>}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        <div style={{
          padding: '8px 18px', borderTop: '1px solid var(--border-soft)',
          fontSize: 11, color: 'var(--ink-mute)',
          display: 'flex', justifyContent: 'space-between', gap: 12,
        }}>
          <span><kbd style={kbd}>↑</kbd> <kbd style={kbd}>↓</kbd> navigate</span>
          <span><kbd style={kbd}>↵</kbd> select</span>
          <span><kbd style={kbd}>ESC</kbd> close</span>
        </div>
      </div>
    </div>
  )
}

const kbd: React.CSSProperties = {
  fontSize: 10, padding: '1px 5px', borderRadius: 4,
  background: 'var(--surface-2)', border: '1px solid var(--border)',
  fontFamily: 'var(--font-mono)', color: 'var(--ink-mute)',
}
