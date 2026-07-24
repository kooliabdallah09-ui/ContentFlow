'use client'

// Format Library — visual gallery of all 28 ContentFlow campaign formats.
// Clicking a card opens a new campaign anchored to that format.

import { useMemo, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { CAMPAIGN_FORMATS, type CampaignFormat } from '@/lib/campaign-formats'

type CategoryKey = CampaignFormat['category']
type FilterKey = 'all' | CategoryKey

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  'solo': 'Solo',
  'two-person': 'Two-person',
  'motion': 'Motion',
  'transformation': 'Transformation',
  'photo': 'Photo',
  'other': 'Other',
}

const CATEGORY_ORDER: CategoryKey[] = ['solo', 'two-person', 'motion', 'transformation', 'photo', 'other']

const chip = (active: boolean): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center',
  padding: '7px 13px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  border: `1.5px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
  background: active ? 'var(--ink)' : 'var(--surface)',
  color: active ? 'var(--on-ink)' : 'var(--ink-2)',
  transition: 'all 0.12s',
})

const infoChip: CSSProperties = {
  display: 'inline-flex', alignItems: 'center',
  padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600,
  border: '1px solid var(--border)', background: 'var(--surface-2, var(--surface))',
  color: 'var(--ink-2)', letterSpacing: '0.02em',
}

export default function FormatLibraryPage() {
  const [filter, setFilter] = useState<FilterKey>('all')

  const grouped = useMemo(() => {
    const map = new Map<CategoryKey, CampaignFormat[]>()
    for (const f of CAMPAIGN_FORMATS) {
      if (filter !== 'all' && f.category !== filter) continue
      const arr = map.get(f.category) ?? []
      arr.push(f)
      map.set(f.category, arr)
    }
    return CATEGORY_ORDER
      .map(cat => ({ category: cat, formats: map.get(cat) ?? [] }))
      .filter(g => g.formats.length > 0)
  }, [filter])

  const filterOptions: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'solo', label: 'Solo' },
    { key: 'two-person', label: 'Two-person' },
    { key: 'motion', label: 'Motion' },
    { key: 'transformation', label: 'Transformation' },
    { key: 'photo', label: 'Photo' },
  ]

  return (
    <main className="content" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="page-head" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="page-meta"><span>Create</span><span>/</span><span>Format Library</span></div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 40, margin: 0, lineHeight: 1.1 }}>
          Format <em>Library</em>
        </h1>
        <p style={{ fontSize: 14, color: 'var(--ink-dim)', maxWidth: 680, marginTop: 4 }}>
          28 proven UGC formats. Pick one to start a new campaign anchored to it.
        </p>
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '20px 0 28px' }}>
        {filterOptions.map(opt => (
          <button key={opt.key} onClick={() => setFilter(opt.key)} style={chip(filter === opt.key)}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Grouped grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
        {grouped.map(({ category, formats }) => (
          <section key={category}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, margin: 0 }}>
                {CATEGORY_LABELS[category]}
              </h2>
              <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>{formats.length} format{formats.length === 1 ? '' : 's'}</span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 14,
              }}
            >
              {formats.map(f => (
                <Link
                  key={f.key}
                  href={`/campaigns?format=${encodeURIComponent(f.key)}`}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 10,
                    padding: 16,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 14,
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'border-color 0.12s, transform 0.12s',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--ink)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.25 }}>
                      {f.label}
                    </span>
                    <span
                      style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                        padding: '3px 7px', borderRadius: 6,
                        background: 'var(--surface-2, var(--hover))',
                        color: 'var(--ink-2)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {CATEGORY_LABELS[f.category]}
                    </span>
                  </div>
                  <p style={{ fontSize: 12.5, color: 'var(--ink-dim)', margin: 0, lineHeight: 1.5, flex: 1 }}>
                    {f.tagline}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingTop: 6, borderTop: '1px dashed var(--border)' }}>
                    <span style={infoChip}>{f.defaultAspect}</span>
                    <span style={infoChip}>
                      {f.defaultDuration === 0 ? 'Photo' : `${f.defaultDuration}s`}
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)' }}>
                      ~{f.creditHint} cr
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
