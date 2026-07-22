'use client'

// A drop-in replacement for the plain spinner shown during a Product Studio /
// Influencer Studio shoot. The old UI was a static disc that stalled at
// "Shoot" for 20-60s and users bailed. This component:
//
//  - Runs a plausible progress bar toward ~95% over an ETA that scales with
//    shot count + model quality. Never hits 100% until the caller resolves.
//  - Rotates through a director's-shot-list of status messages every ~2.8s so
//    the user feels like something specific is happening at each moment.
//  - Shows elapsed vs estimated so the user knows if it's dragging.
//  - Has a subtle gradient shimmer that hints at motion even between messages.
//
// It's a display-only component — the actual fetch stays in the caller. Pass
// `active` (the shooting boolean), `estimatedSeconds`, and an optional label.

import { useEffect, useRef, useState } from 'react'
import { Camera } from 'lucide-react'

const MESSAGES = [
  'Studying the brief…',
  'Directing the shot…',
  'Blocking composition…',
  'Choosing the light…',
  'Warming the palette…',
  'Framing the subject…',
  'Rolling camera…',
  'Rendering pixels…',
  'Sharpening details…',
  'Balancing shadows…',
  'Colour-grading…',
  'Final polish…',
  'Almost there…',
]

interface ShootProgressProps {
  active: boolean
  // Rough per-batch estimate. The bar targets 95% at this time; if the render
  // takes longer we cap and let the shimmer + messages carry the wait.
  estimatedSeconds: number
  // Compact = small pill that replaces the button (for sticky composers).
  // Full = wider row with description underneath.
  size?: 'compact' | 'full'
  // Optional custom label prefix — e.g. "Shooting 3 photos".
  label?: string
}

export function ShootProgress({ active, estimatedSeconds, size = 'compact', label = 'Shooting' }: ShootProgressProps) {
  const [pct, setPct] = useState(0)
  const [msgIdx, setMsgIdx] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef<number>(0)

  useEffect(() => {
    if (!active) {
      setPct(0)
      setMsgIdx(0)
      setElapsed(0)
      startRef.current = 0
      return
    }
    startRef.current = Date.now()
    // Progress ramp — target 95% at estimatedSeconds, then decay slowly.
    const progressTick = window.setInterval(() => {
      const e = (Date.now() - startRef.current) / 1000
      setElapsed(Math.round(e))
      // Ease-out curve toward 95% at t = estimatedSeconds, then approach 99%
      // asymptotically so it never fully completes until active flips off.
      const target = e < estimatedSeconds
        ? 95 * (1 - Math.pow(1 - e / estimatedSeconds, 2))
        : 95 + (99 - 95) * (1 - Math.exp(-(e - estimatedSeconds) / 12))
      setPct(target)
    }, 200)
    const messageTick = window.setInterval(() => {
      setMsgIdx(i => (i + 1) % MESSAGES.length)
    }, 2800)
    return () => {
      window.clearInterval(progressTick)
      window.clearInterval(messageTick)
    }
  }, [active, estimatedSeconds])

  if (!active) return null

  const remaining = Math.max(0, estimatedSeconds - elapsed)

  if (size === 'compact') {
    // Compact pill that fits where the button lived. Keeps the same footprint
    // (~140px min-width) so the composer layout doesn't reflow.
    return (
      <div
        style={{
          position: 'relative',
          display: 'inline-flex',
          flexDirection: 'column',
          gap: 4,
          padding: '9px 16px',
          borderRadius: 11,
          background: 'var(--ink)',
          color: 'var(--on-ink)',
          minWidth: 180,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {/* Shimmering progress fill behind the content */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            width: `${pct}%`,
            background: 'linear-gradient(90deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.05) 60%, rgba(255,255,255,0.18) 100%)',
            transition: 'width 300ms linear',
            pointerEvents: 'none',
          }}
        />
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600 }}>
          <Camera size={14} />
          <span>{label}</span>
          <span style={{ opacity: 0.7, marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', fontSize: 11.5 }}>
            {elapsed}s{remaining > 0 ? ` / ~${estimatedSeconds}s` : ''}
          </span>
        </div>
        <div style={{ position: 'relative', fontSize: 11, opacity: 0.85, fontStyle: 'italic', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {MESSAGES[msgIdx]}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 16px', borderRadius: 12, background: 'var(--surface-2, var(--surface))', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Camera size={16} />
        <span style={{ fontWeight: 600, fontSize: 13.5 }}>{label}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--ink-mute)', fontVariantNumeric: 'tabular-nums' }}>
          {elapsed}s / ~{estimatedSeconds}s
        </span>
      </div>
      <div style={{ position: 'relative', height: 6, borderRadius: 999, background: 'var(--hover)', overflow: 'hidden' }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${pct}%`,
            background: 'var(--ink)',
            transition: 'width 300ms linear',
          }}
        />
      </div>
      <span style={{ fontSize: 12, color: 'var(--ink-mute)', fontStyle: 'italic' }}>{MESSAGES[msgIdx]}</span>
    </div>
  )
}

// Rough per-shot estimate for image generation via Nano Banana Pro / NB2.
// These are conservative — real times swing wide with reference count and
// server load, but the progress-bar UX is calibrated to feel accurate.
export function estimateShootSeconds({
  count,
  quality,
  hasStyleRef = false,
  hasInfluencer = false,
  coProductCount = 0,
}: {
  count: number
  quality: 'nb2' | 'pro' | '4k'
  hasStyleRef?: boolean
  hasInfluencer?: boolean
  coProductCount?: number
}): number {
  const perShot = quality === 'nb2' ? 8 : quality === '4k' ? 28 : 16
  const refBoost = (hasStyleRef ? 3 : 0) + (hasInfluencer ? 4 : 0) + Math.min(coProductCount, 3) * 2
  return Math.max(6, Math.round(count * (perShot + refBoost)))
}
