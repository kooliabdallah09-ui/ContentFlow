// Timing helpers. Everything is a pure function of the current frame —
// Remotion renders frames out of order, so nothing may depend on state or
// wall-clock time.

import type { CSSProperties, ReactNode } from 'react'
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { useUnit } from './theme'

const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

/** 0→1 with a little overshoot, starting at frame `at`. */
export function pop(frame: number, at: number, fps: number, bounce = 0.6): number {
  return spring({ frame: frame - at, fps, config: { damping: 9 + (1 - bounce) * 16, mass: 0.6, stiffness: 180 } })
}

/** 0→1 with no overshoot, starting at frame `at`. */
export function glide(frame: number, at: number, fps: number): number {
  return spring({ frame: frame - at, fps, config: { damping: 200 } })
}

/** Clamped, eased interpolate: ease(frame, [10, 30], [0, 400]). */
export function ease(frame: number, input: [number, number], output: [number, number]): number {
  return interpolate(frame, input, output, { ...CLAMP, easing: Easing.inOut(Easing.cubic) })
}

type Entrance = 'scale' | 'up' | 'down' | 'left' | 'right' | 'fade'

/** Animates its children in at frame `at` (and out at `outAt`, if given). */
export function Pop({ at = 0, outAt, from = 'scale', bounce = 0.6, style, children }: {
  at?: number
  outAt?: number
  from?: Entrance
  bounce?: number
  style?: CSSProperties
  children: ReactNode
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const u = useUnit()
  const p = pop(frame, at, fps, bounce) * (outAt === undefined ? 1 : 1 - glide(frame, outAt, fps))
  const d = (1 - p) * 120 * u
  const transform =
    from === 'scale' ? `scale(${p})` :
    from === 'up' ? `translateY(${d}px)` :
    from === 'down' ? `translateY(${-d}px)` :
    from === 'left' ? `translateX(${-d}px)` :
    from === 'right' ? `translateX(${d}px)` : 'none'
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: interpolate(p, [0, 0.25], [0, 1], CLAMP), transform, ...style }}>
      {children}
    </div>
  )
}

/** Gentle idle float, for anything that should feel alive while it waits. */
export function Float({ amount = 10, speed = 1, seed = 0, children }: { amount?: number; speed?: number; seed?: number; children: ReactNode }) {
  const frame = useCurrentFrame()
  const u = useUnit()
  const y = Math.sin((frame / 30) * Math.PI * speed + seed) * amount * u
  return <div style={{ position: 'absolute', inset: 0, transform: `translateY(${y}px)` }}>{children}</div>
}

/** Rattles its children for `duration` frames from `at` — impacts, anger, alarms. */
export function Shake({ at, duration = 12, intensity = 14, children }: { at: number; duration?: number; intensity?: number; children: ReactNode }) {
  const frame = useCurrentFrame()
  const u = useUnit()
  const t = frame - at
  const live = t >= 0 && t < duration
  const decay = live ? 1 - t / duration : 0
  const x = live ? Math.sin(t * 2.7) * intensity * decay * u : 0
  const r = live ? Math.sin(t * 3.3) * 2 * decay : 0
  return <div style={{ position: 'absolute', inset: 0, transform: `translateX(${x}px) rotate(${r}deg)` }}>{children}</div>
}

/**
 * Camera move over the whole scene: zoom around a focus point. Animate
 * `zoom` / `focusX` / `focusY` from the frame for push-ins and punch zooms.
 */
export function Camera({ zoom = 1, focusX, focusY, children }: { zoom?: number; focusX?: number; focusY?: number; children: ReactNode }) {
  const { width, height } = useVideoConfig()
  const fx = focusX ?? width / 2
  const fy = focusY ?? height / 2
  return (
    <div style={{ position: 'absolute', inset: 0, transformOrigin: `${fx}px ${fy}px`, transform: `scale(${zoom})` }}>
      {children}
    </div>
  )
}
