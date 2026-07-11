'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/auth'
import { canAccessFormats } from '@/lib/pov-access'
import { FORMAT_TEMPLATES, FORMAT_CATEGORIES, type FormatTemplate, type FormatCategory } from '@/lib/formats'

const VIBE_COLORS: Record<FormatTemplate['vibe'], string> = {
  bold: '#EF4444',
  calm: '#3B82F6',
  urgent: '#F59E0B',
  aesthetic: '#8B5CF6',
  funny: '#EC4899',
  warm: '#F97316',
  clinical: '#10B981',
  raw: '#6B7280',
}

export default function FormatsPage() {
  const [access, setAccess] = useState<'checking' | 'allowed' | 'blocked'>('checking')
  const [selected, setSelected] = useState<FormatTemplate | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<FormatCategory | 'all'>('all')

  useEffect(() => {
    (async () => {
      const supabase = getSupabase()
      if (!supabase) { setAccess('blocked'); return }
      const { data: sess } = await supabase.auth.getSession()
      setAccess(canAccessFormats(sess?.session?.user?.email) ? 'allowed' : 'blocked')
    })()
  }, [])

  const visible = useMemo(
    () => (categoryFilter === 'all' ? FORMAT_TEMPLATES : FORMAT_TEMPLATES.filter(f => f.category === categoryFilter)),
    [categoryFilter],
  )

  if (access === 'checking') {
    return <main style={{ maxWidth: 720, margin: '0 auto', padding: '80px 32px', textAlign: 'center', color: 'var(--ink-dim)' }}>Loading…</main>
  }

  if (access === 'blocked') {
    return (
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '80px 32px' }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: 'var(--ink-dim)', marginBottom: 8 }}>
          STUDIO / FORMAT LIBRARY
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 42, fontWeight: 400, margin: '0 0 16px' }}>
          Format <em>Library</em>
        </h1>
        <p style={{ fontSize: 15, color: 'var(--ink-dim)', lineHeight: 1.7, maxWidth: 560 }}>
          40 pre-built templates — pick one, we auto-configure the script, scene, and editor overlays.
        </p>
        <div style={{ marginTop: 24, padding: '20px 24px', border: '1px solid var(--line)', borderRadius: 14, background: 'var(--surface)', display: 'inline-flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>🚧</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Private beta</div>
            <div style={{ fontSize: 13, color: 'var(--ink-dim)' }}>Public launch after we settle the pipeline.</div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 32px 100px' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: 'var(--ink-dim)', marginBottom: 8 }}>
          STUDIO / FORMAT LIBRARY
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 42, fontWeight: 400, margin: '0 0 8px', letterSpacing: '-0.01em' }}>
          Format <em>Library</em>
        </h1>
        <p style={{ fontSize: 14.5, color: 'var(--ink-dim)', margin: 0, maxWidth: 620, lineHeight: 1.55 }}>
          {FORMAT_TEMPLATES.length} templates covering every viral video shape on TikTok, Reels, and Shorts. Each configures the script, scene, and editor overlays automatically.
        </p>
      </div>

      {/* Category filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        <button
          onClick={() => setCategoryFilter('all')}
          style={pill(categoryFilter === 'all')}
        >
          All · {FORMAT_TEMPLATES.length}
        </button>
        {FORMAT_CATEGORIES.map(c => {
          const count = FORMAT_TEMPLATES.filter(f => f.category === c.id).length
          return (
            <button
              key={c.id}
              onClick={() => setCategoryFilter(c.id)}
              title={c.description}
              style={pill(categoryFilter === c.id)}
            >
              {c.label} · {count}
            </button>
          )
        })}
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {visible.map(f => (
          <button
            key={f.id}
            onClick={() => setSelected(f)}
            style={{
              textAlign: 'left',
              padding: 18,
              border: '1px solid var(--border)',
              borderRadius: 14,
              background: 'var(--surface)',
              cursor: 'pointer',
              display: 'flex', flexDirection: 'column', gap: 8,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'var(--ink)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{f.name}</div>
              <div
                title={f.vibe}
                style={{
                  fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
                  color: '#fff', background: VIBE_COLORS[f.vibe], padding: '2px 7px', borderRadius: 4,
                  textTransform: 'uppercase',
                }}
              >
                {f.vibe}
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-dim)', lineHeight: 1.5, minHeight: 34 }}>{f.tagline}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              <PillTag>{f.category}</PillTag>
              <PillTag>{f.durations[0]}s+</PillTag>
              {f.needsProduct && <PillTag>Product photo</PillTag>}
              {f.needsUI && <PillTag>UI shot</PillTag>}
              {f.audio === 'silent' || f.audio === 'music-driven' ? <PillTag>No voice</PillTag> : null}
            </div>
          </button>
        ))}
      </div>

      {/* Detail modal */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24, zIndex: 100,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 720, maxHeight: '90vh', overflowY: 'auto',
              background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 18,
              padding: 28,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 4 }}>
              <div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-dim)', letterSpacing: '0.06em' }}>
                  {selected.category.toUpperCase()} · {selected.pipeline.toUpperCase()}
                </div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 400, margin: '4px 0 0' }}>
                  {selected.name}
                </h2>
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', fontSize: 12.5, cursor: 'pointer', color: 'var(--ink)' }}
              >
                Close
              </button>
            </div>
            <p style={{ fontSize: 14.5, color: 'var(--ink-dim)', lineHeight: 1.6, margin: '10px 0 20px' }}>
              {selected.tagline}
            </p>

            <Section title="When to use">
              <p style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6, margin: 0 }}>{selected.whenToUse}</p>
            </Section>

            <Section title="Setup">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, fontSize: 13, color: 'var(--ink-2)' }}>
                <KV k="Pipeline" v={selected.pipeline} />
                <KV k="Vibe" v={selected.vibe} />
                <KV k="Durations" v={selected.durations.map(d => `${d}s`).join(' · ')} />
                <KV k="Audio" v={selected.audio} />
                <KV k="Caption style" v={selected.captionStyle} />
                <KV k="Script" v={selected.needsScript} />
                <KV k="Product photo" v={selected.needsProduct ? 'yes' : 'no'} />
                <KV k="UI screenshot" v={selected.needsUI ? 'yes' : 'no'} />
              </div>
            </Section>

            <Section title="Script scaffold">
              <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.7 }}>
                <p style={{ margin: '0 0 6px' }}><strong>Hook:</strong> {selected.scriptScaffold.hook || '—'}</p>
                <p style={{ margin: '0 0 6px' }}><strong>Body:</strong> {selected.scriptScaffold.body || '—'}</p>
                <p style={{ margin: '0 0 6px' }}><strong>CTA:</strong> {selected.scriptScaffold.cta || '—'}</p>
                <p style={{ margin: '0', fontStyle: 'italic', color: 'var(--ink-mute)' }}>Tone: {selected.scriptScaffold.toneHint}</p>
              </div>
            </Section>

            <Section title={`Overlays (${selected.overlays.length})`}>
              {selected.overlays.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--ink-mute)' }}>None — the base clip carries the message.</div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.7 }}>
                  {selected.overlays.map((o, i) => {
                    const chip = (v: string) => (
                      <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, background: 'var(--surface-2)', padding: '1px 5px', borderRadius: 4 }}>{v}</code>
                    )
                    return (
                      <li key={i}>
                        {o.kind === 'text' && <>Text · {chip(o.template)} · {o.style}</>}
                        {o.kind === 'image-slot' && <>Image slot · {chip(o.slot)}</>}
                        {o.kind === 'icon-field' && <>Icon field · {chip(o.iconSlot)} · {o.density}</>}
                        {o.kind === 'background-swap' && <>Background · {chip(o.slot)}</>}
                      </li>
                    )
                  })}
                </ul>
              )}
            </Section>

            <Section title="Good for">
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.7 }}>
                {selected.examples.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </Section>

            {/* Route to the right generator / renderer. The app-demo composite
                has its own test harness for now. Other templates land in the
                matching generator. */}
            <div style={{ display: 'flex', gap: 10, marginTop: 8, justifyContent: 'flex-end' }}>
              <Link
                href={
                  selected.id === 'app-demo-composite' ? '/generate/formats/app-demo' :
                  selected.pipeline === 'pov' ? '/generate/pov' :
                  selected.pipeline === 'editor-only' ? '/editor' :
                  '/generate/ugc'
                }
                style={{
                  padding: '12px 22px', borderRadius: 11,
                  background: 'var(--ink)', color: 'var(--on-ink)', border: 'none',
                  fontSize: 14, fontWeight: 600, textDecoration: 'none',
                }}
              >
                Use this format →
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function pill(active: boolean): React.CSSProperties {
  return {
    padding: '8px 14px', borderRadius: 999,
    border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
    background: active ? 'var(--ink)' : 'transparent',
    color: active ? 'var(--on-ink)' : 'var(--ink)',
    fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
    transition: 'all 0.12s',
  }
}

function PillTag({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 10.5, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
      color: 'var(--ink-mute)', background: 'var(--bg)', padding: '2px 7px', borderRadius: 4,
      border: '1px solid var(--border)',
    }}>
      {children}
    </span>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', color: 'var(--ink-dim)', marginBottom: 8 }}>
        {title.toUpperCase()}
      </div>
      {children}
    </div>
  )
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{k}</span>
      <span style={{ fontSize: 13.5, color: 'var(--ink)', textTransform: 'capitalize' }}>{v}</span>
    </div>
  )
}
