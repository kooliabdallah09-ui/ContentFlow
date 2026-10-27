'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/auth'

interface Item { type: string; date: string; credits: number }
interface AnalyticsData {
  items?: Item[]
  totalGenerated: number
  totalCreditsUsed: number
  generationsByType: Record<string, number>
  creditsByType: Record<string, number>
  recentActivity: Item[]
}
interface CreditsData { balance: number; plan: string; monthlyCredits: number; resetDate: string }
interface DatedItem extends Item { ago: number }
interface Bucket { credits: number; count: number; label: string; short: string }

const TYPE_LABELS: Record<string, string> = {
  ugc: 'UGC video', video: 'AI video', image: 'Image', social: 'Social & captions',
  voice: 'Voiceover', 'screen-demo': 'Screen demo', carousel: 'Carousel',
}
// Muted, warm-leaning palette: readable on both the light and dark theme.
const TYPE_COLORS: Record<string, string> = {
  video: '#B4332E', ugc: '#D98E5F', image: '#6B7A99', social: '#7C9A82',
  voice: '#C9A94F', 'screen-demo': '#8E6E95', carousel: '#4F8A8B',
}
const FALLBACK_COLOR = '#8A8A93'
const colorOf = (t: string) => TYPE_COLORS[t] ?? FALLBACK_COLOR
const labelOf = (t: string) => TYPE_LABELS[t] ?? t

const RANGES = [
  { id: '7d', label: '7 days', days: 7 },
  { id: '30d', label: '30 days', days: 30 },
  { id: '90d', label: '90 days', days: 90 },
  { id: 'all', label: 'All time', days: 0 },
] as const
type RangeId = typeof RANGES[number]['id']

const DAY = 86_400_000
const dayStart = (iso: string) => { const d = new Date(iso); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() }
const fmtDay = (ms: number) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const fmtNum = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : String(Math.round(v))

function niceMax(v: number) {
  if (v <= 0) return 10
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  const f = v / p
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

/* ───────────── Charts ───────────── */

function BarChart({ buckets }: { buckets: Bucket[] }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const H = 240, padL = 40, padR = 8, padT = 14, padB = 28
  const innerW = Math.max(0, width - padL - padR)
  const innerH = H - padT - padB
  const n = buckets.length
  const max = niceMax(Math.max(0, ...buckets.map(b => b.credits)))
  const slot = n ? innerW / n : 0
  const bw = Math.max(3, Math.min(30, slot * 0.6))
  const y = (v: number) => padT + innerH - (v / max) * innerH
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 84))))
  const hb = hover !== null ? buckets[hover] : null

  return (
    <div ref={ref} className="an-chart" style={{ height: H }}>
      {width > 0 && (
        <svg
          width={width} height={H} role="img" aria-label="Credits spent over time"
          onMouseLeave={() => setHover(null)}
          onMouseMove={e => {
            const r = e.currentTarget.getBoundingClientRect()
            const i = Math.floor((e.clientX - r.left - padL) / slot)
            setHover(i >= 0 && i < n ? i : null)
          }}
        >
          {[0, 0.5, 1].map(f => (
            <g key={f}>
              <line x1={padL} x2={width - padR} y1={y(f * max)} y2={y(f * max)} stroke="var(--border)" strokeDasharray={f === 0 ? undefined : '3 4'} />
              <text x={padL - 8} y={y(f * max) + 4} textAnchor="end" className="an-axis">{fmtNum(f * max)}</text>
            </g>
          ))}
          {hover !== null && <rect x={padL + slot * hover} y={padT} width={slot} height={innerH} rx={6} fill="var(--surface-2)" />}
          {buckets.map((b, i) => {
            const x = padL + slot * i + (slot - bw) / 2
            const h = Math.max(b.credits > 0 ? 3 : 0, (b.credits / max) * innerH)
            return (
              <g key={i}>
                {b.credits === 0 && n <= 31 && <rect x={x + bw / 2 - 1.5} y={padT + innerH - 3} width={3} height={3} rx={1.5} fill="var(--border-strong)" />}
                {b.credits > 0 && (
                  <rect
                    className="an-bar" x={x} y={padT + innerH - h} width={bw} height={h} rx={Math.min(5, bw / 2)}
                    fill="var(--brand)" opacity={hover === null || hover === i ? 1 : 0.5}
                    style={{ animationDelay: `${Math.min(i * 14, 500)}ms` }}
                  />
                )}
                {i % every === 0 && (
                  <text x={padL + slot * i + slot / 2} y={H - 8} textAnchor="middle" className="an-axis">{b.short}</text>
                )}
              </g>
            )
          })}
        </svg>
      )}
      {hb && hover !== null && (
        <div className="an-tip" style={{ left: Math.min(Math.max(padL + slot * (hover + 0.5), 70), Math.max(70, width - 70)), top: Math.max(8, y(hb.credits) - 10) }}>
          <b>{hb.credits.toLocaleString()} cr</b>
          <span>{hb.count} {hb.count === 1 ? 'creation' : 'creations'}</span>
          <span className="an-tip-d">{hb.label}</span>
        </div>
      )}
    </div>
  )
}

function Spark({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(1, ...values)
  const pts = values.map((v, i) => `${values.length === 1 ? 50 : (i / (values.length - 1)) * 100},${26 - (v / max) * 22}`)
  if (values.length < 2) return <div className="an-spark" />
  return (
    <svg className="an-spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden>
      <path d={`M0,28 L${pts.join(' L')} L100,28 Z`} fill={color} opacity={0.1} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function Donut({ slices, total }: { slices: { key: string; value: number }[]; total: number }) {
  const [hi, setHi] = useState<number | null>(null)
  const R = 60, C = 2 * Math.PI * R
  const lens = slices.map(sl => (total ? (sl.value / total) * C : 0))
  const offsets = lens.map((_, i) => lens.slice(0, i).reduce((a, b) => a + b, 0))
  const active = hi !== null ? slices[hi] : null
  return (
    <svg viewBox="0 0 160 160" className="an-donut" role="img" aria-label="Credits by type">
      <circle cx={80} cy={80} r={R} fill="none" stroke="var(--surface-2)" strokeWidth={16} />
      {slices.map((s, i) => {
        const seg = Math.max(0, lens[i] - (slices.length > 1 ? 2 : 0))
        return (
          <circle
            key={s.key} cx={80} cy={80} r={R} fill="none" stroke={colorOf(s.key)}
            strokeWidth={hi === i ? 20 : 16} strokeDasharray={`${seg} ${C - seg}`} strokeDashoffset={-offsets[i]}
            transform="rotate(-90 80 80)" style={{ transition: 'stroke-width .15s', cursor: 'pointer' }}
            onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)}
          />
        )
      })}
      <text x={80} y={78} textAnchor="middle" className="an-donut-n">{(active ? active.value : total).toLocaleString()}</text>
      <text x={80} y={96} textAnchor="middle" className="an-donut-l">{active ? labelOf(active.key) : 'credits spent'}</text>
    </svg>
  )
}

function Heatmap({ items, today }: { items: DatedItem[]; today: number }) {
  const WEEKS = 26
  const counts = new Map<number, number>()
  items.forEach(i => counts.set(i.ago, (counts.get(i.ago) ?? 0) + 1))
  const todayDow = new Date(today).getDay()
  const gridStart = today - ((WEEKS - 1) * 7 + todayDow) * DAY
  const cols: ({ ms: number; c: number } | null)[][] = []
  let max = 0, total = 0, busiest = { ms: 0, c: 0 }
  for (let w = 0; w < WEEKS; w++) {
    const col: ({ ms: number; c: number } | null)[] = []
    for (let d = 0; d < 7; d++) {
      const ms = gridStart + (w * 7 + d) * DAY
      if (ms > today) { col.push(null); continue }
      const c = counts.get(Math.round((today - ms) / DAY)) ?? 0
      total += c; if (c > max) max = c; if (c > busiest.c) busiest = { ms, c }
      col.push({ ms, c })
    }
    cols.push(col)
  }
  const level = (c: number) => c === 0 ? 0 : Math.max(1, Math.ceil((c / Math.max(1, max)) * 4))
  const fill = (l: number) => l === 0 ? 'var(--surface-2)' : `color-mix(in srgb, var(--brand) ${[0, 28, 48, 72, 100][l]}%, var(--surface-2))`
  let lastMonth = -1
  let lastLabelCol = -10
  return (
    <div>
      <div className="an-heat-scroll">
        <div className="an-heat">
          <div className="an-heat-days"><span /><span>Mon</span><span /><span>Wed</span><span /><span>Fri</span><span /></div>
          <div>
            <div className="an-heat-months">
              {cols.map((col, w) => {
                const first = col.find(Boolean)
                const m = first ? new Date(first.ms).getMonth() : -1
                const show = m !== lastMonth && first && w - lastLabelCol >= 3
                if (first) lastMonth = m
                if (show) lastLabelCol = w
                return <span key={w}>{show ? new Date(first.ms).toLocaleDateString('en-US', { month: 'short' }) : ''}</span>
              })}
            </div>
            <div className="an-heat-grid">
              {cols.map((col, w) => (
                <div key={w}>
                  {col.map((cell, d) => cell
                    ? <i key={d} title={`${cell.c} ${cell.c === 1 ? 'creation' : 'creations'} · ${fmtDay(cell.ms)}`} style={{ background: fill(level(cell.c)) }} />
                    : <i key={d} style={{ background: 'transparent' }} />)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="an-heat-foot">
        <span>{total} {total === 1 ? 'creation' : 'creations'} in {WEEKS} weeks{busiest.c > 0 ? ` · busiest day ${fmtDay(busiest.ms)} (${busiest.c})` : ''}</span>
        <span className="an-legend">Less {[0, 1, 2, 3, 4].map(l => <i key={l} style={{ background: fill(l) }} />)} More</span>
      </div>
    </div>
  )
}

/* ───────────── Page ───────────── */

function Delta({ cur, prev, neutral }: { cur: number; prev: number; neutral?: boolean }) {
  if (prev === 0 && cur === 0) return null
  if (prev === 0) return <span className="an-delta up">new</span>
  const pct = Math.round(((cur - prev) / prev) * 100)
  if (pct === 0) return <span className="an-delta">no change</span>
  return <span className={`an-delta ${neutral ? '' : pct > 0 ? 'up' : 'down'}`}>{pct > 0 ? '▲' : '▼'} {Math.abs(pct)}%</span>
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [credits, setCredits] = useState<CreditsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<RangeId>('30d')
  const [today] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() })

  useEffect(() => {
    async function load() {
      const supabase = getSupabase()
      if (!supabase) { setLoading(false); return }
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) { setLoading(false); return }
      const headers = { Authorization: `Bearer ${token}` }
      const [a, c] = await Promise.allSettled([
        fetch('/api/analytics', { headers }),
        fetch('/api/credits/balance', { headers }),
      ])
      if (a.status === 'fulfilled' && a.value.ok) setData(await a.value.json())
      if (c.status === 'fulfilled' && c.value.ok) setCredits(await c.value.json())
      setLoading(false)
    }
    load()
  }, [])

  const items: DatedItem[] = useMemo(() => {
    const raw = data?.items ?? data?.recentActivity ?? []
    return raw
      .map(i => ({ ...i, credits: i.credits || 0, ago: Math.max(0, Math.round((today - dayStart(i.date)) / DAY)) }))
      .sort((a, b) => a.ago - b.ago)
  }, [data, today])

  const view = useMemo(() => {
    const oldest = items.reduce((m, i) => Math.max(m, i.ago), 0)
    const cfg = RANGES.find(r => r.id === range)!
    const N = cfg.days || Math.min(364, Math.max(14, oldest + 1))
    const size = N > 45 ? 7 : 1
    const nb = Math.ceil(N / size)
    const buckets: Bucket[] = Array.from({ length: nb }, (_, k) => {
      const b = nb - 1 - k
      const from = today - (b * size + size - 1) * DAY
      const to = today - b * size * DAY
      return { credits: 0, count: 0, short: fmtDay(from), label: size === 1 ? new Date(from).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : `${fmtDay(from)} – ${fmtDay(to)}` }
    })
    let cur = 0, curCount = 0, prev = 0, prevCount = 0
    const byType = new Map<string, { count: number; credits: number }>()
    for (const it of items) {
      if (it.ago < N) {
        const b = buckets[nb - 1 - Math.floor(it.ago / size)]
        b.credits += it.credits; b.count += 1
        cur += it.credits; curCount += 1
        const t = byType.get(it.type) ?? { count: 0, credits: 0 }
        t.count += 1; t.credits += it.credits; byType.set(it.type, t)
      } else if (cfg.days && it.ago < N * 2) {
        prev += it.credits; prevCount += 1
      }
    }
    const types = [...byType.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.credits - a.credits || b.count - a.count)
    return { N, size, buckets, cur, curCount, prev, prevCount, types, hasPrev: !!cfg.days }
  }, [items, range, today])

  const avg = view.curCount ? Math.round(view.cur / view.curCount) : 0
  const rangeLabel = range === 'all' ? 'all time' : `last ${view.N} days`
  const monthly = credits?.monthlyCredits ?? 0
  const planName = credits?.plan ? credits.plan.charAt(0).toUpperCase() + credits.plan.slice(1) : 'Free'
  const maxTypeCount = Math.max(1, ...view.types.map(t => t.count))
  const recent = items.slice(0, 8)
  const maxRecent = Math.max(1, ...recent.map(r => r.credits))
  const dayLabel = (ago: number) => ago === 0 ? 'Today' : ago === 1 ? 'Yesterday' : fmtDay(today - ago * DAY)

  return (
    <main className="content">
      <div className="an-head an-rise">
        <div>
          <div className="page-meta">Analytics</div>
          <h1 className="page-title">Your content, <em>by the numbers.</em></h1>
        </div>
        <div className="an-seg" role="tablist" aria-label="Date range">
          {RANGES.map(r => (
            <button key={r.id} role="tab" aria-selected={range === r.id} className={range === r.id ? 'on' : ''} onClick={() => setRange(r.id)}>{r.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="an-skel-wrap">
          <div className="an-kpis">{[0, 1, 2, 3].map(i => <div key={i} className="an-card an-skel" style={{ height: 118 }} />)}</div>
          <div className="an-card an-skel" style={{ height: 330 }} />
        </div>
      ) : items.length === 0 ? (
        <div className="an-card an-empty an-rise">
          <h2>Nothing to chart yet</h2>
          <p>Once you make your first ad, your spend, activity and favourite formats show up here.</p>
          <Link href="/generate/ugc" className="an-cta">Make your first ad</Link>
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="an-kpis">
            <div className="an-card an-kpi an-rise" style={{ animationDelay: '.05s' }}>
              <div className="an-label">Created</div>
              <div className="an-num">{view.curCount.toLocaleString()}</div>
              <div className="an-sub">{view.hasPrev && <Delta cur={view.curCount} prev={view.prevCount} />}<span>{rangeLabel}</span></div>
              <Spark values={view.buckets.map(b => b.count)} color="var(--ink-dim)" />
            </div>
            <div className="an-card an-kpi an-rise" style={{ animationDelay: '.1s' }}>
              <div className="an-label">Credits spent</div>
              <div className="an-num">{view.cur.toLocaleString()}</div>
              <div className="an-sub">{view.hasPrev && <Delta cur={view.cur} prev={view.prev} neutral />}<span>{rangeLabel}</span></div>
              <Spark values={view.buckets.map(b => b.credits)} color="var(--brand)" />
            </div>
            <div className="an-card an-kpi an-rise" style={{ animationDelay: '.15s' }}>
              <div className="an-label">Avg. cost per creation</div>
              <div className="an-num">{avg}<small> cr</small></div>
              <div className="an-sub"><span>{view.curCount ? `across ${view.curCount} ${view.curCount === 1 ? 'creation' : 'creations'}` : 'no creations yet'}</span></div>
              <Spark values={view.buckets.map(b => (b.count ? b.credits / b.count : 0))} color="var(--ink-dim)" />
            </div>
            <div className="an-card an-kpi an-rise" style={{ animationDelay: '.2s' }}>
              <div className="an-label">Credits left</div>
              <div className="an-num">{credits ? credits.balance.toLocaleString() : '—'}</div>
              <div className="an-sub"><span>{monthly > 0 ? `of ${monthly.toLocaleString()} / month` : `${planName} plan · rolls over`}</span></div>
              <div className="an-meter"><i style={{ width: `${monthly > 0 && credits ? Math.min(100, (credits.balance / monthly) * 100) : 100}%` }} /></div>
            </div>
          </div>

          {/* Spend over time */}
          <section className="an-card an-rise" style={{ animationDelay: '.25s', marginTop: 16 }}>
            <div className="an-card-h">
              <div>
                <h2>Credits spent</h2>
                <p>{view.size === 1 ? 'Per day' : 'Per week'} · {rangeLabel}</p>
              </div>
              <div className="an-big">{view.cur.toLocaleString()}<small> cr</small>{view.hasPrev && <Delta cur={view.cur} prev={view.prev} neutral />}</div>
            </div>
            <BarChart buckets={view.buckets} />
          </section>

          {/* Breakdown */}
          <div className="an-two">
            <section className="an-card an-rise" style={{ animationDelay: '.3s' }}>
              <div className="an-card-h"><div><h2>Where credits go</h2><p>{rangeLabel}</p></div></div>
              {view.cur === 0 ? (
                <div className="an-none">No credits spent in this period.</div>
              ) : (
                <div className="an-donut-row">
                  <Donut slices={view.types.filter(t => t.credits > 0).map(t => ({ key: t.key, value: t.credits }))} total={view.cur} />
                  <ul className="an-legend-list">
                    {view.types.filter(t => t.credits > 0).map(t => (
                      <li key={t.key}>
                        <i style={{ background: colorOf(t.key) }} />
                        <span>{labelOf(t.key)}</span>
                        <b>{Math.round((t.credits / view.cur) * 100)}%</b>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <section className="an-card an-rise" style={{ animationDelay: '.35s' }}>
              <div className="an-card-h"><div><h2>What you make</h2><p>Creations and cost per type</p></div></div>
              {view.types.length === 0 ? (
                <div className="an-none">Nothing created in this period.</div>
              ) : (
                <div className="an-types">
                  {view.types.map(t => (
                    <div key={t.key} className="an-type">
                      <div className="an-type-top">
                        <span><i style={{ background: colorOf(t.key) }} />{labelOf(t.key)}</span>
                        <span className="an-type-m">{t.count} · ~{Math.round(t.credits / Math.max(1, t.count))} cr each</span>
                      </div>
                      <div className="an-track"><div style={{ width: `${(t.count / maxTypeCount) * 100}%`, background: colorOf(t.key) }} /></div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Activity heatmap */}
          <section className="an-card an-rise" style={{ animationDelay: '.4s', marginTop: 16 }}>
            <div className="an-card-h"><div><h2>Activity</h2><p>Creations per day, last 26 weeks</p></div></div>
            <Heatmap items={items} today={today} />
          </section>

          {/* Recent */}
          <section className="an-card an-rise" style={{ animationDelay: '.45s', marginTop: 16 }}>
            <div className="an-card-h"><div><h2>Recent activity</h2><p>Your latest creations</p></div><Link href="/library" className="an-link">Open library</Link></div>
            <div className="an-recent">
              {recent.map((r, i) => (
                <div key={i} className="an-row">
                  <span className="an-row-t"><i style={{ background: colorOf(r.type) }} />{labelOf(r.type)}</span>
                  <span className="an-row-bar"><i style={{ width: `${(r.credits / maxRecent) * 100}%`, background: colorOf(r.type) }} /></span>
                  <span className="an-row-cr">{r.credits} cr</span>
                  <span className="an-row-d">{dayLabel(r.ago)}</span>
                </div>
              ))}
            </div>
          </section>

          <div className="an-note an-rise" style={{ animationDelay: '.5s' }}>
            Social performance (views, reach, conversions from Instagram and TikTok) will appear here once those integrations are live.
          </div>
        </>
      )}

      <style>{`
        .an-rise { opacity: 0; transform: translateY(10px); animation: an-rise .6s cubic-bezier(.2,.8,.2,1) forwards; }
        @keyframes an-rise { to { opacity: 1; transform: none; } }
        .an-bar { transform-box: fill-box; transform-origin: 50% 100%; animation: an-grow .6s cubic-bezier(.2,.8,.2,1) backwards; transition: opacity .15s; }
        @keyframes an-grow { from { transform: scaleY(0); } }
        @media (prefers-reduced-motion: reduce) { .an-rise { opacity: 1; transform: none; animation: none; } .an-bar { animation: none; } }

        .an-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
        .an-head .page-title { margin: 4px 0 0; }
        .an-seg { display: inline-flex; padding: 3px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
        .an-seg button { padding: 6px 12px; border: 0; background: transparent; border-radius: 7px; font-size: 13px; color: var(--ink-dim); cursor: pointer; font-family: inherit; white-space: nowrap; }
        .an-seg button:hover { color: var(--ink); }
        .an-seg button.on { background: var(--ink); color: var(--on-ink); font-weight: 500; }

        .an-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 20px 22px; min-width: 0; }
        .an-card-h { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
        .an-card-h h2 { margin: 0; font-size: 15px; font-weight: 600; letter-spacing: -0.01em; }
        .an-card-h p { margin: 3px 0 0; font-size: 12.5px; color: var(--ink-dim); }
        .an-link { font-size: 13px; color: var(--ink-dim); }
        .an-link:hover { color: var(--ink); }
        .an-big { font-family: var(--font-mono); font-size: 26px; font-weight: 500; letter-spacing: -0.03em; display: flex; align-items: baseline; gap: 8px; white-space: nowrap; }
        .an-big small, .an-num small { font-size: 13px; color: var(--ink-dim); font-weight: 400; letter-spacing: 0; }

        .an-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
        .an-kpi { display: flex; flex-direction: column; gap: 6px; padding: 18px 20px 14px; }
        .an-label { font-size: 12.5px; color: var(--ink-dim); }
        .an-num { font-family: var(--font-mono); font-size: 30px; font-weight: 500; letter-spacing: -0.04em; line-height: 1.05; color: var(--ink); }
        .an-sub { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--ink-dim); min-height: 18px; }
        .an-spark { width: 100%; height: 28px; margin-top: 8px; display: block; }
        .an-meter { height: 4px; border-radius: 99px; background: var(--surface-3); margin-top: 14px; overflow: hidden; }
        .an-meter i { display: block; height: 100%; background: var(--ink); border-radius: 99px; }
        .an-delta { font-family: var(--font-mono); font-size: 11px; padding: 1px 6px; border-radius: 99px; background: var(--surface-2); color: var(--ink-dim); }
        .an-delta.up { background: var(--good-soft); color: var(--good); }
        .an-delta.down { background: var(--danger-soft); color: var(--danger); }

        .an-chart { position: relative; width: 100%; }
        .an-chart svg { display: block; overflow: visible; }
        .an-axis { font-family: var(--font-mono); font-size: 10.5px; fill: var(--ink-fade); }
        .an-tip { position: absolute; transform: translate(-50%, -100%); background: var(--ink); color: var(--on-ink); padding: 7px 10px; border-radius: 8px; font-size: 12px; display: flex; flex-direction: column; gap: 1px; pointer-events: none; white-space: nowrap; box-shadow: var(--shadow-lg); z-index: 3; }
        .an-tip b { font-family: var(--font-mono); font-weight: 500; font-size: 13px; }
        .an-tip span { opacity: .75; }
        .an-tip-d { opacity: .55 !important; font-size: 11px; }

        .an-two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; margin-top: 16px; }
        .an-donut-row { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }
        .an-donut { width: 172px; height: 172px; flex-shrink: 0; }
        .an-donut-n { font-family: var(--font-mono); font-size: 22px; font-weight: 500; fill: var(--ink); letter-spacing: -0.03em; }
        .an-donut-l { font-size: 10px; fill: var(--ink-dim); }
        .an-legend-list { list-style: none; margin: 0; padding: 0; flex: 1; min-width: 140px; display: flex; flex-direction: column; gap: 10px; }
        .an-legend-list li { display: flex; align-items: center; gap: 10px; font-size: 13px; }
        .an-legend-list li span { flex: 1; color: var(--ink-2); }
        .an-legend-list li b { font-family: var(--font-mono); font-weight: 500; font-size: 12.5px; }
        .an-legend-list i, .an-type i, .an-row-t i { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; display: inline-block; }
        .an-types { display: flex; flex-direction: column; gap: 16px; }
        .an-type-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 13px; color: var(--ink-2); margin-bottom: 7px; }
        .an-type-top > span:first-child { display: flex; align-items: center; gap: 9px; }
        .an-type-m { font-family: var(--font-mono); font-size: 11.5px; color: var(--ink-dim); }
        .an-track { height: 6px; border-radius: 99px; background: var(--surface-2); overflow: hidden; }
        .an-track div { height: 100%; border-radius: 99px; transition: width .5s cubic-bezier(.2,.8,.2,1); }
        .an-none { font-size: 13px; color: var(--ink-dim); padding: 24px 0; }

        .an-heat-scroll { overflow-x: auto; padding-bottom: 4px; }
        .an-heat { display: flex; gap: 8px; width: max-content; min-width: 100%; }
        .an-heat-days { display: grid; grid-template-rows: 16px repeat(7, 20px); gap: 4px; font-size: 10.5px; color: var(--ink-fade); padding-top: 0; }
        .an-heat-days span { line-height: 20px; }
        .an-heat-months { display: grid; grid-template-columns: repeat(26, 20px); gap: 4px; height: 16px; font-size: 10.5px; color: var(--ink-fade); line-height: 16px; }
        .an-heat-months span { white-space: nowrap; overflow: visible; }
        .an-heat-grid { display: grid; grid-template-columns: repeat(26, 20px); gap: 4px; margin-top: 4px; }
        .an-heat-grid > div { display: grid; grid-template-rows: repeat(7, 20px); gap: 4px; }
        .an-heat-grid i { width: 20px; height: 20px; border-radius: 5px; display: block; }
        .an-heat-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-top: 12px; font-size: 12.5px; color: var(--ink-dim); }
        .an-legend { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; }
        .an-legend i { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }

        .an-recent { display: flex; flex-direction: column; }
        .an-row { display: grid; grid-template-columns: 150px minmax(0, 1fr) 64px 84px; align-items: center; gap: 16px; padding: 11px 0; border-top: 1px solid var(--border-soft); font-size: 13px; }
        .an-row:first-child { border-top: 0; }
        .an-row-t { display: flex; align-items: center; gap: 10px; color: var(--ink-2); font-weight: 500; }
        .an-row-bar { height: 4px; border-radius: 99px; background: var(--surface-2); overflow: hidden; }
        .an-row-bar i { display: block; height: 100%; border-radius: 99px; opacity: .85; }
        .an-row-cr { font-family: var(--font-mono); font-size: 12px; text-align: right; color: var(--ink-2); }
        .an-row-d { font-size: 12.5px; color: var(--ink-dim); text-align: right; }
        .an-note { margin-top: 16px; padding: 14px 18px; border: 1px dashed var(--border-strong); border-radius: 12px; font-size: 12.5px; color: var(--ink-dim); line-height: 1.5; }

        .an-empty { text-align: center; padding: 56px 24px; }
        .an-empty h2 { margin: 0 0 6px; font-size: 18px; font-weight: 600; }
        .an-empty p { margin: 0 auto 18px; max-width: 380px; color: var(--ink-dim); font-size: 13.5px; }
        .an-cta { display: inline-block; padding: 9px 16px; border-radius: 9px; background: var(--brand); color: var(--on-brand); font-size: 13.5px; font-weight: 500; }
        .an-skel { animation: an-pulse 1.4s ease-in-out infinite; background: var(--surface-2); border-color: transparent; }
        @keyframes an-pulse { 50% { opacity: .55; } }
        .an-skel-wrap { display: flex; flex-direction: column; gap: 16px; }

        @media (max-width: 1000px) { .an-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } .an-two { grid-template-columns: 1fr; } }
        @media (max-width: 640px) {
          .an-row { grid-template-columns: minmax(0, 1fr) 56px 72px; }
          .an-row-bar { display: none; }
          .an-big { font-size: 22px; }
          .an-card { padding: 16px; }
        }
      `}</style>
    </main>
  )
}
