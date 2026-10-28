'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/auth'
import { showError, showSuccess } from '@/lib/notifications'
import { PLANNER_DURATIONS, itemCost, videoCost, type PlanKind } from '@/lib/planner-cost'
import { GOALS, PLAN_FORMATS, PLAN_PLATFORMS } from '@/lib/planner-playbook'
import { generatePlanItem } from '@/lib/planner-generate'

// The weekly Content Planner: a plan of posts the user approves, edits and
// generates one by one. Building the plan is free; credits are only taken by
// the generators when Generate is pressed.

interface Plan {
  id: string; week_start: string; product_name: string; product_description: string
  goal: string; platforms: string[]; posts_per_week: number; status: string
}
interface Item {
  id: string; position: number; day_offset: number; time_of_day: string; platform: string
  kind: PlanKind; format: string; stage: string; hook: string; alts: string[]; visual: string
  duration_s: number | null; quality: string; slides: number | null; enabled: boolean
  status: 'idle' | 'generating' | 'ready' | 'failed'; result: Record<string, unknown> | null; is_winner: boolean
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const STAGE_LABEL: Record<string, string> = { attention: 'Attention', trust: 'Trust', sale: 'Sale' }

function dateOf(weekStart: string, offset: number) {
  const [y, m, d] = weekStart.split('-').map(Number)
  const dt = new Date(y, m - 1, d + offset)
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const css = `
.pl-item{background:var(--surface);border:1px solid var(--border);border-radius:14px;margin-bottom:10px;overflow:hidden;transition:transform .18s,box-shadow .18s,border-color .18s;animation:pl-rise .45s both cubic-bezier(.2,.7,.2,1)}
.pl-item:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(0,0,0,.07);border-color:var(--border-strong)}
.pl-item.skip{opacity:.5}
@keyframes pl-rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.pl-head{display:grid;grid-template-columns:78px 72px 1fr auto;gap:16px;padding:14px 16px;align-items:start}
.pl-thumb{position:relative;width:72px;height:104px;border-radius:10px;overflow:hidden;border:1px solid var(--border);display:grid;place-items:center}
.pl-thumb svg{width:20px;height:20px;fill:#fff;opacity:.9}
.pl-thumb .b{position:absolute;right:5px;bottom:5px;font-family:var(--font-mono);font-size:10.5px;color:#fff;background:rgba(0,0,0,.55);padding:1px 5px;border-radius:5px}
.pl-thumb::after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.28) 50%,transparent 70%);transform:translateX(-100%)}
.pl-item.live .pl-thumb::after{animation:pl-sheen 1.1s linear infinite}
.pl-item.done .pl-thumb::after{animation:pl-sheen 3.2s ease-in-out infinite}
@keyframes pl-sheen{to{transform:translateX(100%)}}
.pl-tags{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:7px}
.pl-tag{font-size:11.5px;padding:2px 8px;border-radius:99px;border:1px solid var(--border);color:var(--ink-2);background:var(--surface-2)}
.pl-tag.fmt{background:var(--accent-soft);border-color:transparent;color:var(--accent);font-weight:500}
.pl-tl{display:flex;gap:2px;margin-top:9px;height:18px}
.pl-tl span{display:flex;align-items:center;padding:0 7px;font-size:10.5px;border-radius:4px;background:var(--surface-2);color:var(--ink-mute);white-space:nowrap;overflow:hidden;font-family:var(--font-mono)}
.pl-tl span.h{background:var(--accent-soft);color:var(--accent);font-weight:500}
.pl-right{display:flex;flex-direction:column;align-items:flex-end;gap:8px;min-width:130px}
.pl-prog{width:150px}
.pl-prog .t{height:4px;border-radius:9px;background:var(--surface-2);overflow:hidden}
.pl-prog .t i{display:block;height:100%;background:var(--accent);width:40%;animation:pl-slide 1.4s ease-in-out infinite}
@keyframes pl-slide{0%{margin-left:-40%}100%{margin-left:100%}}
.pl-edit{border-top:1px solid var(--border);background:var(--bg);padding:16px;display:grid;grid-template-columns:1fr 1fr;gap:18px}
.pl-edit h4{font-size:11.5px;font-weight:500;color:var(--ink-mute);margin:0 0 8px;text-transform:uppercase;letter-spacing:.06em}
.pl-chip{padding:6px 11px;border:1px solid var(--border);border-radius:99px;font-size:12.5px;background:var(--surface);cursor:pointer;color:var(--ink)}
.pl-chip.on{background:var(--ink);color:var(--on-ink);border-color:var(--ink)}
.pl-opt{display:flex;gap:9px;align-items:flex-start;padding:9px 11px;border:1px solid var(--border);border-radius:9px;background:var(--surface);margin-bottom:6px;cursor:pointer;font-size:13.5px}
.pl-opt.on{border-color:var(--ink)}
.pl-btn{height:30px;padding:0 12px;border-radius:9px;border:1px solid var(--border-strong);background:var(--surface);font-weight:500;font-size:12.5px;cursor:pointer;color:var(--ink);white-space:nowrap}
.pl-btn:hover{background:var(--surface-2)}
.pl-btn.primary{background:var(--accent);border-color:var(--accent);color:var(--accent-ink,#fff)}
.pl-btn.lg{height:36px;padding:0 16px;font-size:13px}
.pl-btn[disabled]{opacity:.5;pointer-events:none}
.pl-seg{display:inline-flex;border:1px solid var(--border);border-radius:8px;overflow:hidden;background:var(--surface)}
.pl-seg button{padding:5px 11px;font-size:12.5px;color:var(--ink-mute);background:none;border:0;cursor:pointer}
.pl-seg button.on{background:var(--ink);color:var(--on-ink)}
.pl-pill{display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 12px;border:1px solid var(--border);background:var(--surface);border-radius:999px;font-size:13px}
.pl-input{width:100%;padding:9px 11px;border:1px solid var(--border);border-radius:9px;background:var(--surface);color:var(--ink);font:inherit;font-size:14px}
.pl-dock{position:sticky;bottom:0;margin:24px -4px 0;background:var(--bg);border-top:1px solid var(--border);padding:12px 4px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
@media (max-width:760px){.pl-head{grid-template-columns:1fr;gap:10px}.pl-thumb{width:100%;height:56px}.pl-right{flex-direction:row;align-items:center;justify-content:space-between;width:100%}.pl-edit{grid-template-columns:1fr}}
@media (prefers-reduced-motion:reduce){.pl-item,.pl-thumb::after,.pl-prog .t i{animation:none!important;transition:none!important}}
`

export default function PlannerPage() {
  const [loading, setLoading] = useState(true)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [creditsLeft, setCreditsLeft] = useState(0)
  const [building, setBuilding] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [stage, setStage] = useState<Record<string, string>>({})
  const [runningAll, setRunningAll] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)

  // Setup form
  const [url, setUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [image, setImage] = useState<{ base64: string; mimeType: string } | null>(null)
  const [goal, setGoal] = useState<string>('sales')
  const [platforms, setPlatforms] = useState<string[]>(['TikTok', 'Instagram'])
  const [perWeek, setPerWeek] = useState(5)

  const token = useCallback(async () => {
    const supabase = getSupabase()
    const { data } = supabase ? await supabase.auth.getSession() : { data: null }
    return data?.session?.access_token ?? ''
  }, [])

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/planner/plan', { headers: { Authorization: `Bearer ${await token()}` } })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load your plan')
      setPlan(data.plan); setItems(data.items ?? []); setCreditsLeft(data.creditsLeft ?? 0)
      setNeedsSetup(!!data.needsSetup)
      if (!data.plan) setSetupOpen(true)
    } catch (err) {
      showError("Couldn't load the planner", err instanceof Error ? err.message : 'Try again')
    } finally {
      setLoading(false)
    }
  }, [token])

  // Load once on mount; load() sets state after the fetch resolves.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  async function importUrl() {
    if (!url.trim()) return
    setImporting(true)
    try {
      const res = await fetch(`/api/product-url?brand=1&url=${encodeURIComponent(url.trim())}`, {
        headers: { Authorization: `Bearer ${await token()}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not read that page')
      setName(data.productName || '')
      setDescription([data.productDescription, data.benefits].filter(Boolean).join('\n'))
      const m = (data.brand?.image as string | undefined)?.match(/^data:([^;]+);base64,(.+)$/)
      setImage(m ? { mimeType: m[1], base64: m[2] } : null)
    } catch (err) {
      showError("Couldn't read that page", err instanceof Error ? err.message : 'Describe the product below instead.')
    } finally {
      setImporting(false)
    }
  }

  async function buildPlan(fromPlan?: Plan) {
    const body = fromPlan
      ? { productName: fromPlan.product_name, productDescription: fromPlan.product_description, goal: fromPlan.goal, platforms: fromPlan.platforms, postsPerWeek: fromPlan.posts_per_week }
      : { productName: name, productDescription: description, goal, platforms, postsPerWeek: perWeek }
    setBuilding(true)
    try {
      const res = await fetch('/api/planner/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not build the plan')
      setPlan(data.plan); setItems(data.items); setCreditsLeft(data.creditsLeft)
      setSetupOpen(false); setOpenId(null)
    } catch (err) {
      showError("Couldn't build the plan", err instanceof Error ? err.message : 'Try again')
    } finally {
      setBuilding(false)
    }
  }

  async function patchItem(id: string, fields: Record<string, unknown>) {
    // Optimistic update, then reconcile with what the server saved.
    setItems(prev => prev.map(i => (i.id === id ? ({ ...i, ...fields } as Item) : i)))
    try {
      const res = await fetch('/api/planner/items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ itemId: id, ...fields }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save')
      setItems(prev => prev.map(i => (i.id === id ? (data.item as Item) : i)))
    } catch (err) {
      showError("Couldn't save that change", err instanceof Error ? err.message : 'Try again')
      load()
    }
  }

  async function approve() {
    if (!plan) return
    const next = plan.status === 'approved' ? 'draft' : 'approved'
    setPlan({ ...plan, status: next })
    await fetch('/api/planner/items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
      body: JSON.stringify({ planId: plan.id, status: next }),
    })
  }

  async function refreshCredits() {
    try {
      const res = await fetch('/api/planner/plan', { headers: { Authorization: `Bearer ${await token()}` } })
      const data = await res.json()
      if (res.ok) setCreditsLeft(data.creditsLeft ?? 0)
    } catch { /* non-fatal */ }
  }

  async function generate(item: Item) {
    if (!plan || item.status === 'generating') return
    const cost = itemCost(item)
    if (cost > creditsLeft) {
      showError('Not enough credits', `This post needs ${cost} credits and you have ${creditsLeft}.`)
      return
    }
    patchItem(item.id, { status: 'generating' })
    const tk = await token()
    const out = await generatePlanItem(
      { kind: item.kind, format: item.format, hook: item.hook, visual: item.visual, platform: item.platform, duration_s: item.duration_s, quality: item.quality, slides: item.slides },
      { name: plan.product_name, description: plan.product_description, image },
      tk,
      label => setStage(s => ({ ...s, [item.id]: label })),
    )
    setStage(s => Object.fromEntries(Object.entries(s).filter(([k]) => k !== item.id)))
    if (out.ok) {
      await patchItem(item.id, { status: 'ready', result: out.result })
      showSuccess(`${DAYS[item.day_offset]} post is in your Library`)
    } else {
      await patchItem(item.id, { status: 'failed', result: { error: out.error } })
      showError('Generation failed', out.error)
    }
    refreshCredits()
  }

  async function generateAll() {
    setRunningAll(true)
    let remaining = creditsLeft
    for (const it of items) {
      const c = itemCost(it)
      if (it.enabled && it.status === 'idle' && c <= remaining) {
        remaining -= c
        await generate(it)
      }
    }
    setRunningAll(false)
  }

  const todo = useMemo(() => items.filter(i => i.enabled && (i.status === 'idle' || i.status === 'failed')), [items])
  const total = todo.reduce((s, i) => s + itemCost(i), 0)
  const fits = total <= creditsLeft
  const fitList = (() => {
    let rem = creditsLeft; let n = 0; let c = 0
    for (const i of todo) { const k = itemCost(i); if (k <= rem) { rem -= k; c += k; n++ } }
    return { n, c }
  })()
  const fullVideos = todo.filter(i => i.kind === 'video' && i.quality === 'full')
  const draftSave = fullVideos.reduce((s, i) => s + videoCost(i.duration_s ?? 15, 'full') - videoCost(i.duration_s ?? 15, 'draft'), 0)

  const label: React.CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 6, display: 'block' }
  const card: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', padding: 18 }

  if (loading) return <div style={{ padding: 40, color: 'var(--ink-mute)' }}>Loading your plan…</div>

  const showSetup = setupOpen || !plan

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 24px 60px' }}>
      <style>{css}</style>
      <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', margin: 0, display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        {plan && !showSetup ? (
          <>Week of <em style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, color: 'var(--accent)' }}>{dateOf(plan.week_start, 0)}</em></>
        ) : (
          <>Plan your <em style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, color: 'var(--accent)' }}>week</em></>
        )}
        {plan && !showSetup && (
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="pl-btn" onClick={() => setSetupOpen(true)}>New plan</button>
            <button className="pl-btn" disabled={building} onClick={() => buildPlan(plan)}>{building ? 'Rebuilding…' : 'Rebuild plan'}</button>
          </span>
        )}
      </h1>
      <p style={{ color: 'var(--ink-mute)', margin: '4px 0 20px' }}>
        {showSetup
          ? 'Pick a product and how often you want to post. We build the week, you edit it, then generate only what you want.'
          : <>Built for <b style={{ color: 'var(--ink)', fontWeight: 500 }}>{plan?.product_name}</b>. Building the plan is free. Credits are only taken when you press Generate.</>}
      </p>

      {needsSetup && (
        <div style={{ ...card, marginBottom: 14, borderColor: 'var(--danger)', fontSize: 13.5 }}>
          The planner database tables are not set up yet. Run <code>migrations/021_add_weekly_planner.sql</code> in Supabase, then reload.
        </div>
      )}

      {showSetup && (
        <div style={{ ...card, display: 'grid', gap: 16 }}>
          <div>
            <span style={label}>1. Your product</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="pl-input" placeholder="Paste your product page link (optional)" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && importUrl()} />
              <button className="pl-btn lg" disabled={importing || !url.trim()} onClick={importUrl}>{importing ? 'Reading…' : 'Import'}</button>
            </div>
            <input className="pl-input" style={{ marginTop: 8 }} placeholder="Product name" value={name} onChange={e => setName(e.target.value)} />
            <textarea className="pl-input" style={{ marginTop: 8, minHeight: 84, resize: 'vertical' }} placeholder="What it is, who it is for, what makes it different" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div>
            <span style={label}>2. Goal</span>
            <div className="pl-seg">{GOALS.map(g => <button key={g} className={goal === g ? 'on' : ''} onClick={() => setGoal(g)}>{g[0].toUpperCase() + g.slice(1)}</button>)}</div>
          </div>
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
            <div>
              <span style={label}>3. Platforms</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {PLAN_PLATFORMS.map(p => (
                  <button key={p} className={`pl-chip ${platforms.includes(p) ? 'on' : ''}`}
                    onClick={() => setPlatforms(prev => prev.includes(p) ? (prev.length > 1 ? prev.filter(x => x !== p) : prev) : [...prev, p])}>{p}</button>
                ))}
              </div>
            </div>
            <div>
              <span style={label}>4. Posts per week</span>
              <div className="pl-seg">{[3, 4, 5, 6, 7].map(n => <button key={n} className={perWeek === n ? 'on' : ''} onClick={() => setPerWeek(n)}>{n}</button>)}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="pl-btn primary lg" disabled={building || !name.trim() || !description.trim()} onClick={() => buildPlan()}>
              {building ? 'Building your week…' : 'Build my plan'}
            </button>
            {plan && <button className="pl-btn lg" onClick={() => setSetupOpen(false)}>Back to this week</button>}
            <span style={{ fontSize: 12.5, color: 'var(--ink-mute)' }}>Free. About 20 seconds.</span>
          </div>
        </div>
      )}

      {plan && !showSetup && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            <span className="pl-pill"><span style={{ color: 'var(--ink-mute)' }}>Goal</span> <b style={{ fontWeight: 500 }}>{plan.goal[0].toUpperCase() + plan.goal.slice(1)}</b></span>
            <span className="pl-pill"><span style={{ color: 'var(--ink-mute)' }}>Platforms</span> <b style={{ fontWeight: 500 }}>{plan.platforms.join(', ')}</b></span>
            <span className="pl-pill"><span style={{ color: 'var(--ink-mute)' }}>Posts per week</span> <b style={{ fontWeight: 500 }}>{plan.posts_per_week}</b></span>
          </div>

          <div style={{ ...card, display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-mute)' }}>Still to generate</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 500 }}>
                  {total} <span style={{ fontSize: 13, color: 'var(--ink-mute)', fontWeight: 400 }}>of {creditsLeft} credits you have</span>
                </div>
              </div>
              <span style={{ fontSize: 12.5, fontWeight: 500, padding: '4px 10px', borderRadius: 99, background: fits ? 'var(--accent-soft)' : 'var(--surface-2)', color: fits ? 'var(--good)' : 'var(--danger)' }}>
                {total === 0 ? 'All done' : fits ? 'Fits your credits' : `Short by ${total - creditsLeft} credits`}
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, total / Math.max(creditsLeft, 1) * 100)}%`, background: fits ? 'var(--ink)' : 'var(--accent)', transition: 'width .25s' }} />
            </div>
            {!fits && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 13, color: 'var(--ink-2)' }}>
                <span style={{ flex: 1, minWidth: 220 }}>
                  This plan needs {total} credits and you have {creditsLeft}.
                  {fullVideos.length > 0 && <> Switching {fullVideos.length} video{fullVideos.length === 1 ? '' : 's'} to Draft saves {draftSave}.</>} Or generate the first {fitList.n} that fit. Nothing is spent until you press Generate.
                </span>
                {fullVideos.length > 0 && <button className="pl-btn" onClick={() => fullVideos.forEach(i => patchItem(i.id, { quality: 'draft' }))}>Switch videos to Draft</button>}
                <Link href="/settings/billing" className="pl-btn" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Add credits</Link>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '26px 0 10px' }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>This week&apos;s posts</h2>
            <span style={{ fontSize: 12.5, color: 'var(--ink-mute)' }}>Captions are free with every ad</span>
          </div>

          {items.map((it, idx) => {
            const live = it.status === 'generating'
            const done = it.status === 'ready'
            const cost = itemCost(it)
            const hue = [(idx * 67 + 14) % 360, (idx * 67 + 330) % 360]
            const kindLabel = it.kind === 'video' ? `UGC video · ${it.duration_s}s · ${it.quality === 'draft' ? 'Draft' : 'Full'}` : it.kind === 'carousel' ? `Carousel · ${it.slides} slides` : 'Image post'
            const body = (it.duration_s ?? 15) - 5
            return (
              <div key={it.id} className={`pl-item${it.enabled ? '' : ' skip'}${live ? ' live' : ''}${done ? ' done' : ''}`} style={{ animationDelay: `${idx * 70}ms` }}>
                <div className="pl-head">
                  <div style={{ fontSize: 12.5 }}>
                    <b style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{DAYS[it.day_offset]}</b>
                    <span style={{ color: 'var(--ink-mute)' }}>{dateOf(plan.week_start, it.day_offset)} · {it.time_of_day}</span>
                  </div>
                  <div className="pl-thumb" style={{ background: `linear-gradient(160deg,hsl(${hue[0]} 62% 52%),hsl(${hue[1]} 55% 32%))` }}>
                    <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    <span className="b">{it.kind === 'video' ? `${it.duration_s}s` : it.kind === 'carousel' ? `${it.slides} slides` : 'photo'}</span>
                  </div>
                  <div>
                    <div className="pl-tags">
                      <span className="pl-tag fmt">{it.format}</span><span className="pl-tag">{it.platform}</span>
                      <span className="pl-tag">{kindLabel}</span><span className="pl-tag">{STAGE_LABEL[it.stage] ?? it.stage}</span>
                    </div>
                    <div style={{ fontSize: 15.5, fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1.35 }}>{it.hook}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-mute)', marginTop: 4 }}>
                      <b style={{ fontWeight: 500, color: 'var(--ink-2)' }}>{it.kind === 'video' ? 'First frame' : 'Idea'}:</b> {it.visual}
                    </div>
                    {it.kind === 'video' && (
                      <div className="pl-tl">
                        <span className="h" style={{ flex: 2 }}>Hook 2s</span><span style={{ flex: body }}>Story {body}s</span><span style={{ flex: 3 }}>CTA 3s</span>
                      </div>
                    )}
                    {it.status === 'failed' && <div style={{ fontSize: 12.5, color: 'var(--danger)', marginTop: 6 }}>{String((it.result as { error?: string } | null)?.error ?? 'Generation failed')}. No credits were kept for the failed part.</div>}
                  </div>
                  <div className="pl-right">
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 500 }}>{it.enabled ? cost : 0} <small style={{ color: 'var(--ink-mute)', fontWeight: 400, fontSize: 11.5 }}>cr</small></div>
                    {live && <div className="pl-prog"><div className="t"><i /></div><div style={{ fontSize: 11.5, color: 'var(--ink-mute)', marginTop: 4, textAlign: 'right' }}>{stage[it.id] ?? 'Working…'}</div></div>}
                    {done && <div style={{ fontSize: 12, color: 'var(--good)' }}>Ready in Library</div>}
                    <div style={{ display: 'flex', gap: 6 }}>
                      {done ? (
                        <button className="pl-btn" onClick={() => patchItem(it.id, { is_winner: !it.is_winner })} title="Mark it if this post worked">{it.is_winner ? '★ Worked' : '☆ Worked well?'}</button>
                      ) : (
                        <>
                          <button className="pl-btn" onClick={() => setOpenId(openId === it.id ? null : it.id)}>{openId === it.id ? 'Close' : 'Edit'}</button>
                          <button className="pl-btn primary" disabled={!it.enabled || live || runningAll} onClick={() => generate(it)}>{it.status === 'failed' ? 'Retry' : 'Generate'}</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {openId === it.id && !done && (
                  <div className="pl-edit">
                    <div>
                      <h4>Format to copy</h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {PLAN_FORMATS.filter(f => f.kind === it.kind).map(f => (
                          <button key={f.label} className={`pl-chip ${f.label === it.format ? 'on' : ''}`} onClick={() => patchItem(it.id, { format: f.label })}>{f.label}</button>
                        ))}
                      </div>
                      {it.kind === 'video' && (
                        <>
                          <h4 style={{ marginTop: 16 }}>Length</h4>
                          <div className="pl-seg">{PLANNER_DURATIONS.map(d => <button key={d} className={it.duration_s === d ? 'on' : ''} onClick={() => patchItem(it.id, { duration_s: d })}>{d}s</button>)}</div>
                          <h4 style={{ marginTop: 16 }}>Quality</h4>
                          <div className="pl-seg">
                            <button className={it.quality === 'draft' ? 'on' : ''} onClick={() => patchItem(it.id, { quality: 'draft' })}>Draft · {videoCost(it.duration_s ?? 15, 'draft')} cr</button>
                            <button className={it.quality === 'full' ? 'on' : ''} onClick={() => patchItem(it.id, { quality: 'full' })}>Full · {videoCost(it.duration_s ?? 15, 'full')} cr</button>
                          </div>
                          <p style={{ marginTop: 10, fontSize: 12, color: 'var(--ink-mute)' }}>Planned videos are 10s or longer so there is room for a story. 5s clips live in Hook batch, for testing openings.</p>
                        </>
                      )}
                    </div>
                    <div>
                      <h4>Hook (about the viewer, not the product)</h4>
                      {(it.alts?.length ? it.alts : [it.hook]).map(a => (
                        <label key={a} className={`pl-opt ${a === it.hook ? 'on' : ''}`}>
                          <input type="radio" name={`h-${it.id}`} checked={a === it.hook} onChange={() => patchItem(it.id, { hook: a })} style={{ marginTop: 3 }} />
                          <span>{a}</span>
                        </label>
                      ))}
                    </div>
                    <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button className="pl-btn" onClick={() => patchItem(it.id, { enabled: !it.enabled })}>{it.enabled ? 'Remove from plan' : 'Add back'}</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          <div className="pl-dock">
            <span style={{ flex: 1, fontSize: 13, color: 'var(--ink-mute)' }}>
              <b style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{items.filter(i => i.enabled).length}</b> posts planned · <b style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{total}</b> credits to go
            </span>
            <button className="pl-btn lg" onClick={approve}>{plan.status === 'approved' ? 'Plan approved ✓' : 'Approve plan'}</button>
            <button className="pl-btn primary lg" disabled={fitList.n === 0 || runningAll} onClick={generateAll}>
              {runningAll ? 'Generating…' : `Generate all that fit · ${fitList.c} cr`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
