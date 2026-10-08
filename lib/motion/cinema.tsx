// Cinema kit: colour themes, finishing layers and transitions for motion ads
// rendered in real Chrome (server render). Needs full CSS: SVG filters,
// blur, blend modes and clip-path — the in-browser canvas renderer can't
// draw most of this.

import type { CSSProperties, ReactNode } from 'react'
import { AbsoluteFill, Img, Sequence, interpolate, random, useCurrentFrame, useVideoConfig, Easing } from 'remotion'
import { Video } from '@remotion/media'

const CL = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
export const expo = Easing.bezier(0.16, 1, 0.3, 1)
export const ease = (f: number, a: number, b: number, from = 0, to = 1) => interpolate(f, [a, b], [from, to], { ...CL, easing: expo })

// ---------------------------------------------------------------- themes

/** A colour theme maps an image's luminance onto a ramp of colours (shadows → highlights). */
export type Theme = { id: string; ramp: string[]; contrast?: number }

export const THEMES = {
  oxblood: { id: 'oxblood', ramp: ['#050303', '#3a0a0b', '#8f1d1d', '#d9a07a', '#f5ecdf'], contrast: 1.15 },
  noir: { id: 'noir', ramp: ['#000000', '#1c1c1c', '#7a7a7a', '#f2f2f2'], contrast: 1.35 },
  tealOrange: { id: 'tealOrange', ramp: ['#03141a', '#0d4a55', '#7a8a7a', '#e39a52', '#fff1dc'], contrast: 1.1 },
  neon: { id: 'neon', ramp: ['#05010f', '#2a0a5e', '#c2187a', '#ff8ad8', '#fff0fb'], contrast: 1.2 },
  bleach: { id: 'bleach', ramp: ['#0a0c0d', '#3b4246', '#9aa3a6', '#e9ece9'], contrast: 1.4 },
} satisfies Record<string, Theme>

const hex = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255)

/** Put once at the top of the ad: defines the SVG filter `url(#theme-<id>)`. */
export function ThemeDefs({ theme }: { theme: Theme }) {
  const ch = [0, 1, 2].map(c => theme.ramp.map(h => hex(h)[c].toFixed(3)).join(' '))
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }}>
      <filter id={`theme-${theme.id}`} colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values="0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0" />
        <feComponentTransfer>
          <feFuncR type="table" tableValues={ch[0]} />
          <feFuncG type="table" tableValues={ch[1]} />
          <feFuncB type="table" tableValues={ch[2]} />
        </feComponentTransfer>
      </filter>
    </svg>
  )
}

export const graded = (theme: Theme, extra = '') => `contrast(${theme.contrast ?? 1}) url(#theme-${theme.id}) ${extra}`

// ---------------------------------------------------------------- finishing

/** Animated film grain + vignette + gentle gate weave. Put last. */
export function Finish({ grain = 0.16, vignette = 0.7 }: { grain?: number; vignette?: number }) {
  const f = useCurrentFrame()
  const seed = Math.floor(f / 2) % 60
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: grain, mixBlendMode: 'overlay' }}>
        <filter id={`grain${seed}`}><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed} stitchTiles="stitch" /></filter>
        <rect width="100%" height="100%" filter={`url(#grain${seed})`} />
      </svg>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,${vignette}) 100%)` }} />
    </AbsoluteFill>
  )
}

// ---------------------------------------------------------------- shots

export type Enter = 'cut' | 'zoom' | 'whip' | 'glitch' | 'iris' | 'wipe' | 'blur' | 'drop'

/** How a layer looks `t` frames into its entrance (len frames long). */
function enterStyle(kind: Enter, t: number, len: number, W: number, H: number, seed: string): CSSProperties {
  const p = ease(t, 0, len)
  switch (kind) {
    case 'zoom': return { transform: `scale(${1.6 - 0.6 * p})`, filter: `blur(${(1 - p) * 26}px)`, opacity: Math.min(1, p * 2) }
    case 'whip': return { transform: `translateX(${(1 - p) * W * 1.1}px) skewX(${(1 - p) * -8}deg)`, filter: `blur(${(1 - p) * 40}px)` }
    case 'blur': return { filter: `blur(${(1 - p) * 30}px)`, opacity: p }
    case 'drop': return { transform: `translateY(${(1 - p) * -H}px)`, filter: `blur(${(1 - p) * 30}px)` }
    case 'iris': return { clipPath: `circle(${p * 75}% at 50% 50%)` }
    case 'wipe': return { clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` }
    case 'glitch': {
      const on = t < len
      return on ? { transform: `translateX(${(random(`${seed}${Math.floor(t)}`) - 0.5) * 120 * (1 - p)}px)`, filter: `contrast(${1 + (1 - p)}) saturate(${1 + (1 - p) * 2})` } : {}
    }
    default: return {}
  }
}

/**
 * A full-frame still or clip with a slow camera move, the theme grade and an
 * entrance transition. Wrap in a <Sequence>; later shots draw over earlier
 * ones, so overlapping Sequences give real transitions.
 */
export function Shot({ src, video, theme, enter = 'cut', enterLen = 10, from = 1.08, to = 1.2, panX = 0, panY = 0, trim = 0, rate = 1, gradeExtra = '', style }: {
  src?: string | null; video?: boolean; theme?: Theme; enter?: Enter; enterLen?: number; from?: number; to?: number; panX?: number; panY?: number
  trim?: number; rate?: number; gradeExtra?: string; style?: CSSProperties
}) {
  const f = useCurrentFrame()
  const { width: W, height: H, durationInFrames } = useVideoConfig()
  const len = Math.max(30, durationInFrames)
  const s = interpolate(f, [0, 120], [from, from + (to - from) * (120 / Math.min(len, 120))], { extrapolateRight: 'extend' })
  const x = interpolate(f, [0, 120], [0, panX])
  const y = interpolate(f, [0, 120], [0, panY])
  const e = enterStyle(enter, f, enterLen, W, H, String(src))
  const grade = theme ? graded(theme, gradeExtra) : gradeExtra || undefined
  const media: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }
  return (
    <AbsoluteFill style={{ overflow: 'hidden', ...e, filter: [grade, e.filter].filter(Boolean).join(' ') || undefined, ...style }}>
      <AbsoluteFill style={{ transform: `translate(${x}px, ${y}px) scale(${s})` }}>
        {src && (video
          ? <Video src={src} muted trimBefore={trim} playbackRate={rate} objectFit="cover" style={media} />
          : <Img src={src} style={media} />)}
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

/** Glitch slices: the children, cut into horizontal bands that slip sideways. */
export function Slices({ children, amount, bands = 9, seed = 's' }: { children: ReactNode; amount: number; bands?: number; seed?: string }) {
  const f = useCurrentFrame()
  if (amount <= 0.01) return <>{children}</>
  return (
    <AbsoluteFill>
      {Array.from({ length: bands }, (_, i) => {
        const top = (i / bands) * 100, bottom = 100 - ((i + 1) / bands) * 100
        const dx = (random(`${seed}${i}${Math.floor(f / 2)}`) - 0.5) * 180 * amount
        return (
          <AbsoluteFill key={i} style={{ clipPath: `inset(${top}% 0 ${bottom}% 0)`, transform: `translateX(${dx}px)` }}>{children}</AbsoluteFill>
        )
      })}
    </AbsoluteFill>
  )
}

/** A light or film-burn overlay clip, screened over everything. Starts `lead` frames before the cut so its peak lands on it. */
export function Overlay({ src, at, lead, len = 40, trim = 0, opacity = 1, theme, blend = 'screen' }: {
  src?: string | null; at: number; lead: number; len?: number; trim?: number; opacity?: number; theme?: Theme; blend?: CSSProperties['mixBlendMode']
}) {
  if (!src) return null
  return (
    <Sequence from={Math.max(0, at - lead)} durationInFrames={len} layout="none">
      <AbsoluteFill style={{ mixBlendMode: blend, opacity, filter: theme ? graded(theme) : undefined }}>
        <Video src={src} muted trimBefore={trim} objectFit="cover" style={{ width: '100%', height: '100%' }} />
      </AbsoluteFill>
    </Sequence>
  )
}

/** A white (or tinted) flash for 1-4 frames. */
export function Flash({ color = '#fff', len = 4, peak = 0.9 }: { color?: string; len?: number; peak?: number }) {
  const f = useCurrentFrame()
  return <AbsoluteFill style={{ background: color, opacity: interpolate(f, [0, len], [peak, 0], CL) }} />
}

/** Camera shake for impacts. */
export function Shake({ at, len = 10, amount = 22, children }: { at: number; len?: number; amount?: number; children: ReactNode }) {
  const f = useCurrentFrame()
  const k = f >= at && f < at + len ? (1 - (f - at) / len) * amount : 0
  return <AbsoluteFill style={{ transform: `translate(${(random(`x${f}`) - 0.5) * k}px, ${(random(`y${f}`) - 0.5) * k}px)` }}>{children}</AbsoluteFill>
}
