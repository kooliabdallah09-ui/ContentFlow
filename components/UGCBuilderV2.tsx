'use client'

// UGC Builder v2 — hybrid chat + structured summary + advanced accordion.
// Ships behind ?v=2 on /generate/ugc so we can preview without disturbing
// the existing UGCPackageBuilder. Once approved, this becomes the default.
//
// Architecture:
//   [Top]    Chat input — user types "make me a UGC ad for my X…" and
//            Sonnet parses it into structured fields (/api/ugc/parse-brief).
//   [Middle] Structured summary card — every field with a pencil-edit
//            icon. Tap → opens a Sheet with the appropriate picker.
//   [Below]  Advanced accordion — scroll-stop hooks, engine choice,
//            aspect ratio override, direction override.
//   [Sticky] Generate button — always thumb-reachable with live cost.
//
// State: owned by this component. Backend calls reuse existing endpoints:
//   /api/ugc/hero-frames  (frames render)
//   /api/ugc/animate      (final generation)
//   /api/ugc/script       (script draft)
//   /api/ugc/parse-brief  (new — parses NL → fields)

import { useState } from 'react'
import { Send, Loader2, ChevronDown, Sparkles, Package, User2, Film, Clock, Monitor, Wand2, MessageSquareQuote, Music } from 'lucide-react'
import { getSupabase } from '@/lib/auth'
import { showError } from '@/lib/notifications'

// ── Field shapes ────────────────────────────────────────────────────
interface BuilderState {
  // What
  productName: string
  productDescription: string
  // Who
  creatorName: string      // "Auto (AI picks)" or a saved influencer name
  creatorId?: string       // saved-actor id if picked
  // How
  format: string           // "Talking head", "Unbox", "POV", etc.
  formatKey?: string       // campaign-format key
  aspect: 'portrait' | 'square' | 'landscape' | 'tall45'
  duration: 5 | 10 | 15 | 20 | 30
  resolution: '480p' | '720p' | '1080p' | '4k'
  engine: 'seedance-2' | 'seedance-mini'
  // Extras
  direction: string        // user's freeform brief
  language: string
  musicMood?: string
  // Advanced (admin only)
  scrollStopHook: boolean
}

const INITIAL: BuilderState = {
  productName: '',
  productDescription: '',
  creatorName: 'Auto — AI picks',
  format: 'Auto',
  aspect: 'portrait',
  duration: 10,
  resolution: '1080p',
  engine: 'seedance-2',
  direction: '',
  language: 'English',
  scrollStopHook: false,
}

const ASPECT_LABELS: Record<BuilderState['aspect'], string> = {
  portrait: '9:16 portrait',
  tall45: '4:5 tall',
  square: '1:1 square',
  landscape: '16:9 landscape',
}

// ── Component ──────────────────────────────────────────────────────
interface UGCBuilderV2Props {
  onGenerate: (state: BuilderState) => Promise<void>
  isLoading: boolean
  creditBalance: number
}

export function UGCBuilderV2({ onGenerate, isLoading, creditBalance }: UGCBuilderV2Props) {
  const [state, setState] = useState<BuilderState>(INITIAL)
  const [chatInput, setChatInput] = useState('')
  const [parsing, setParsing] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  // Cost estimate — rough, mirrors the existing pricing formula for the
  // Seedance rate at the chosen resolution × duration.
  const cost = estimateCost(state)

  // Ready to generate = we at least know what the product is.
  const canGenerate = state.productName.trim().length > 0

  async function handleParse() {
    const brief = chatInput.trim()
    if (!brief || parsing) return
    setParsing(true)
    try {
      const supabase = getSupabase()
      const { data: sess } = await supabase!.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) throw new Error('Not signed in')

      const res = await fetch('/api/ugc/parse-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ brief, current: state }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Parse failed (${res.status})`)
      }
      const patch = await res.json()
      // Merge partial patch — parser only returns fields it's confident about.
      setState(prev => ({ ...prev, ...patch }))
      setChatInput('')
    } catch (e) {
      showError('Couldn\'t parse that', e instanceof Error ? e.message : 'Try again with more detail')
    } finally {
      setParsing(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 120 /* room for sticky footer */ }}>

      {/* ── Chat input ────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 12, color: 'var(--ink-mute)', fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          <Sparkles size={13} strokeWidth={2} />
          Tell me what to make
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <textarea
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleParse()
            }}
            disabled={parsing || isLoading}
            rows={2}
            placeholder='e.g. "UGC ad for my Pynk serum — mid-20s brunette woman, morning routine, 10s, 1080p"'
            style={{
              flex: 1, minWidth: 0,
              padding: '10px 12px',
              fontSize: 14, lineHeight: 1.5, fontFamily: 'inherit',
              background: 'var(--bg-elev, transparent)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              color: 'var(--ink)',
              outline: 'none',
              resize: 'none',
            }}
          />
          <button
            type="button"
            onClick={handleParse}
            disabled={!chatInput.trim() || parsing || isLoading}
            aria-label="Fill fields from brief"
            style={{
              flexShrink: 0,
              width: 42, height: 42, borderRadius: 10,
              background: chatInput.trim() ? 'var(--ink)' : 'var(--surface-2)',
              color: chatInput.trim() ? 'var(--on-ink)' : 'var(--ink-mute)',
              border: 'none',
              display: 'grid', placeItems: 'center',
              cursor: chatInput.trim() && !parsing ? 'pointer' : 'not-allowed',
              transition: 'background 120ms',
            }}
          >
            {parsing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--ink-fade)' }}>
          Tip: name the product, describe the creator, mention any format/duration/style. Sonnet fills the summary below.
        </div>
      </div>

      {/* ── Structured summary ───────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 12, color: 'var(--ink-mute)', fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.06em', textTransform: 'uppercase', paddingLeft: 4 }}>
          Summary
        </div>
        <SummaryRow
          icon={<Package size={16} />}
          label="Product"
          value={state.productName || 'Not set — required'}
          valueColor={state.productName ? undefined : 'var(--danger)'}
          onEdit={() => {/* TODO: sheet */}}
        />
        <SummaryRow
          icon={<User2 size={16} />}
          label="Creator"
          value={state.creatorName}
          onEdit={() => {/* TODO */}}
        />
        <SummaryRow
          icon={<Film size={16} />}
          label="Format"
          value={state.format}
          onEdit={() => {/* TODO */}}
        />
        <SummaryRow
          icon={<Monitor size={16} />}
          label="Look"
          value={`${ASPECT_LABELS[state.aspect]} · ${state.resolution.toUpperCase()}`}
          onEdit={() => {/* TODO */}}
        />
        <SummaryRow
          icon={<Clock size={16} />}
          label="Length"
          value={`${state.duration}s`}
          onEdit={() => {/* TODO */}}
        />
        {state.direction.trim() && (
          <SummaryRow
            icon={<MessageSquareQuote size={16} />}
            label="Direction"
            value={state.direction.length > 80 ? state.direction.slice(0, 80) + '…' : state.direction}
            onEdit={() => {/* TODO */}}
          />
        )}
      </div>

      {/* ── Advanced accordion ───────────────────────────────────── */}
      <div style={{ borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <button
          type="button"
          onClick={() => setAdvancedOpen(o => !o)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px',
            background: 'var(--surface)', border: 'none', cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
            <Wand2 size={14} strokeWidth={2} />
            Advanced
          </span>
          <ChevronDown size={16} style={{ transform: advancedOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 180ms' }} />
        </button>
        {advancedOpen && (
          <div style={{ padding: '4px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--border-soft, var(--border))' }}>
            <AdvancedRow label="Engine" value={state.engine === 'seedance-2' ? 'Seedance 2.0 (best)' : 'Seedance Mini (cheaper)'}>
              <ToggleGroup
                options={[
                  { value: 'seedance-2', label: 'Seedance 2.0' },
                  { value: 'seedance-mini', label: 'Mini' },
                ]}
                value={state.engine}
                onChange={v => setState(s => ({ ...s, engine: v as BuilderState['engine'] }))}
              />
            </AdvancedRow>
            <AdvancedRow label="Music" value={state.musicMood ?? 'None'}>
              <ToggleGroup
                options={[
                  { value: '', label: 'None' },
                  { value: 'upbeat', label: 'Upbeat' },
                  { value: 'chill', label: 'Chill' },
                  { value: 'cinematic', label: 'Cinematic' },
                ]}
                value={state.musicMood ?? ''}
                onChange={v => setState(s => ({ ...s, musicMood: v || undefined }))}
              />
            </AdvancedRow>
            <AdvancedRow label="Language" value={state.language}>
              <select
                value={state.language}
                onChange={e => setState(s => ({ ...s, language: e.target.value }))}
                style={{
                  padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--surface)', fontFamily: 'inherit', fontSize: 13,
                }}
              >
                <option>English</option>
                <option>French</option>
                <option>Spanish</option>
                <option>Arabic</option>
              </select>
            </AdvancedRow>
          </div>
        )}
      </div>

      {/* ── Sticky Generate footer ───────────────────────────────── */}
      <div style={{
        position: 'sticky', bottom: 0, marginLeft: -16, marginRight: -16,
        padding: 'calc(12px + env(safe-area-inset-bottom, 0)) 16px 14px',
        background: 'linear-gradient(to top, var(--bg) 60%, transparent)',
        display: 'flex', flexDirection: 'column', gap: 8,
        zIndex: 30,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--ink-mute)', padding: '0 4px' }}>
          <span>Cost: <strong style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono, monospace)' }}>{cost} cr</strong></span>
          <span>Balance: <strong style={{ color: cost > creditBalance ? 'var(--danger)' : 'var(--ink)', fontFamily: 'var(--font-mono, monospace)' }}>{creditBalance.toLocaleString()} cr</strong></span>
        </div>
        <button
          type="button"
          onClick={() => onGenerate(state)}
          disabled={!canGenerate || isLoading || cost > creditBalance}
          style={{
            width: '100%', padding: '14px', borderRadius: 12,
            background: canGenerate && cost <= creditBalance ? 'var(--ink)' : 'var(--surface-2)',
            color: canGenerate && cost <= creditBalance ? 'var(--on-ink)' : 'var(--ink-mute)',
            border: 'none',
            fontSize: 15, fontWeight: 700, letterSpacing: '-0.005em',
            cursor: canGenerate && !isLoading && cost <= creditBalance ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {isLoading ? <><Loader2 size={16} className="animate-spin" /> Working…</> : <>Generate — {cost} cr</>}
        </button>
      </div>
    </div>
  )
}

// ── Bits ───────────────────────────────────────────────────────────
function SummaryRow({
  icon, label, value, onEdit, valueColor,
}: {
  icon: React.ReactNode
  label: string
  value: string
  onEdit: () => void
  valueColor?: string
}) {
  return (
    <button
      type="button"
      onClick={onEdit}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        width: '100%', padding: '12px 14px',
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
        cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)',
        textAlign: 'left',
      }}
    >
      <span style={{
        width: 32, height: 32, borderRadius: 9,
        background: 'var(--surface-2, rgba(0,0,0,0.05))',
        display: 'grid', placeItems: 'center',
        color: 'var(--ink-mute)', flexShrink: 0,
      }}>
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: 'var(--font-mono, monospace)', marginBottom: 2 }}>
          {label}
        </div>
        <div style={{ fontSize: 14, fontWeight: 500, color: valueColor ?? 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value}
        </div>
      </div>
      <ChevronDown size={14} style={{ color: 'var(--ink-fade)', transform: 'rotate(-90deg)', flexShrink: 0 }} />
    </button>
  )
}

function AdvancedRow({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{label}</span>
        <span style={{ fontSize: 11.5, color: 'var(--ink-mute)' }}>{value}</span>
      </div>
      <div>{children}</div>
    </div>
  )
}

function ToggleGroup({ options, value, onChange }: {
  options: Array<{ value: string; label: string }>
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map(o => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              padding: '6px 12px', borderRadius: 999,
              border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
              background: active ? 'var(--ink)' : 'var(--surface)',
              color: active ? 'var(--on-ink)' : 'var(--ink)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >{o.label}</button>
        )
      })}
    </div>
  )
}

// ── Cost estimator ────────────────────────────────────────────────
// Mirrors the pricing math in lib/tiers — Seedance rate at chosen res
// × duration in seconds, with a base fee. Kept in-file for now so this
// component is drop-in without any other file changes.
function estimateCost(s: BuilderState): number {
  const perSec = s.engine === 'seedance-mini' ? 3 : (
    s.resolution === '4k'   ? 22 :
    s.resolution === '1080p' ? 15 :
    s.resolution === '720p'  ? 9  :
                               6
  )
  const base = 10 // script + voice + stitch
  return base + perSec * s.duration + (s.scrollStopHook ? 120 : 0)
}
