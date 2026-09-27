// App-UI props: windows, chat bar, speech bubbles, leaderboard bars,
// sliders, pills, podium — the "story told inside an interface" pieces.
// Every positioned piece takes x / y as its CENTER, in px.

import type { CSSProperties, ReactNode } from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { pop } from './anim'
import { COLORS, FONT, INK, PAPER, type KitColor, color as resolve, useUnit } from './theme'

const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

/** Cream paper with a faint dot grid. Wrap every ad in one Stage. */
export function Stage({ background = 'paper', dots = true, children }: { background?: KitColor; dots?: boolean; children?: ReactNode }) {
  const { width, height } = useVideoConfig()
  return (
    <AbsoluteFill style={{ background: resolve(background, 'paper'), fontFamily: FONT, color: INK, textRendering: 'auto' }}>
      {dots && (
        <svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }}>
          <defs>
            <pattern id="kit-dots" width={36} height={36} patternUnits="userSpaceOnUse">
              <circle cx={18} cy={18} r={2.2} fill={INK} opacity={0.09} />
            </pattern>
          </defs>
          <rect width={width} height={height} fill="url(#kit-dots)" />
        </svg>
      )}
      {children}
    </AbsoluteFill>
  )
}

/** A desktop-app window: title bar with three dots, white body. Children are positioned inside the body. */
export function AppWindow({ x, y, width, height, title, badge, at, children }: {
  x: number; y: number; width: number; height: number
  title?: string
  /** Small muted tag on the right of the title bar, e.g. "live". */
  badge?: string
  /** Pop in at this frame. */
  at?: number
  children?: ReactNode
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const u = useUnit()
  const p = at === undefined ? 1 : pop(frame, at, fps, 0.4)
  const bar = 76 * u
  return (
    <div style={{
      position: 'absolute', left: x - width / 2, top: y - height / 2, width, height,
      background: COLORS.white, border: `${5 * u}px solid ${INK}`, borderRadius: 28 * u, overflow: 'hidden',
      boxShadow: `0 ${10 * u}px 0 rgba(38,35,46,0.14)`,
      opacity: interpolate(p, [0, 0.3], [0, 1], CLAMP), transform: `scale(${0.85 + p * 0.15})`,
    }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: bar, borderBottom: `${5 * u}px solid ${INK}`, display: 'flex', alignItems: 'center', padding: `0 ${24 * u}px` }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 16 * u, height: 16 * u, borderRadius: 99, border: `${4 * u}px solid ${INK}`, marginRight: 9 * u }} />
        ))}
        <div style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 36 * u, fontWeight: 700 }}>{title}</div>
        {badge && <div style={{ position: 'absolute', right: 28 * u, fontSize: 26 * u, fontWeight: 600, opacity: 0.45 }}>{badge}</div>}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: bar, bottom: 0 }}>{children}</div>
    </div>
  )
}

/** Chat input bar. `progress` 0→1 types `text` out; empty text shows the placeholder. */
export function ChatInput({ x, y, width, text = '', placeholder = 'Message…', progress = 1 }: {
  x: number; y: number; width: number; text?: string; placeholder?: string; progress?: number
}) {
  const frame = useCurrentFrame()
  const u = useUnit()
  const h = 88 * u
  const shown = text.slice(0, Math.round(text.length * Math.min(1, Math.max(0, progress))))
  const caret = shown.length > 0 && progress < 1 && frame % 16 < 8
  return (
    <div style={{
      position: 'absolute', left: x - width / 2, top: y - h / 2, width, height: h,
      border: `${4 * u}px solid ${INK}`, borderRadius: 999, background: PAPER,
      display: 'flex', alignItems: 'center', padding: `0 ${14 * u}px 0 ${28 * u}px`, boxSizing: 'border-box',
    }}>
      <div style={{ flex: 1, fontSize: 34 * u, fontWeight: 500, opacity: shown ? 1 : 0.4, whiteSpace: 'nowrap', overflow: 'hidden' }}>
        {shown || placeholder}{caret ? '|' : ''}
      </div>
      <div style={{ width: 54 * u, height: 54 * u, borderRadius: 99, background: INK }} />
    </div>
  )
}

type Tail = 'down-left' | 'down-right' | 'left' | 'right' | 'none'

/** Speech bubble that pops in at `at`. */
export function SpeechBubble({ x, y, text, tail = 'down-left', at = 0, size = 50, maxWidth = 760, color = 'white' }: {
  x: number; y: number; text: string; tail?: Tail; at?: number; size?: number; maxWidth?: number; color?: KitColor
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const u = useUnit()
  const p = pop(frame, at, fps, 0.7)
  if (frame < at) return null
  const fill = resolve(color, 'white')
  const bw = 5 * u
  // The tail is a square rotated 45°, with ink on two sides, centered on the
  // bubble's border: its outer half pokes out as the point, its inner half
  // is painted over the border in the fill color. (SVG tails positioned off
  // the box weren't drawn by the web renderer.)
  const sq = 28 * u
  const poke = sq * Math.SQRT1_2 - bw / 2
  const tailStyle: Record<Exclude<Tail, 'none'>, CSSProperties> = {
    'down-left': { left: 40 * u, top: '100%', marginTop: -sq / 2 + bw / 2, borderRight: `${bw}px solid ${INK}`, borderBottom: `${bw}px solid ${INK}` },
    'down-right': { right: 40 * u, top: '100%', marginTop: -sq / 2 + bw / 2, borderRight: `${bw}px solid ${INK}`, borderBottom: `${bw}px solid ${INK}` },
    left: { left: -sq / 2 - bw / 2, top: '50%', marginTop: -sq / 2, borderLeft: `${bw}px solid ${INK}`, borderBottom: `${bw}px solid ${INK}` },
    right: { right: -sq / 2 - bw / 2, top: '50%', marginTop: -sq / 2, borderTop: `${bw}px solid ${INK}`, borderRight: `${bw}px solid ${INK}` },
  }
  // The renderer also clips a transformed element's children to its box, so
  // the popping wrapper is padded on the tail's side to keep the point inside.
  const pad: CSSProperties =
    tail === 'down-left' || tail === 'down-right' ? { paddingBottom: poke } :
    tail === 'left' ? { paddingLeft: poke } :
    tail === 'right' ? { paddingRight: poke } : {}
  const origin = tail === 'down-left' ? '15% 100%' : tail === 'down-right' ? '85% 100%' : tail === 'left' ? '0% 50%' : tail === 'right' ? '100% 50%' : '50% 50%'
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%)` }}>
      <div style={{ ...pad, transformOrigin: origin, transform: `scale(${p})`, opacity: interpolate(p, [0, 0.2], [0, 1], CLAMP) }}>
        <div style={{
          position: 'relative', background: fill, border: `${bw}px solid ${INK}`, borderRadius: 32 * u,
          padding: `${16 * u}px ${30 * u}px`, fontSize: size * u, fontWeight: 600, lineHeight: 1.15, textAlign: 'center',
          // Sized to the text, but wraps instead of spilling out once it hits maxWidth.
          width: 'max-content', maxWidth,
        }}>
          {tail !== 'none' && (
            <div style={{ position: 'absolute', width: sq, height: sq, background: fill, boxSizing: 'border-box', transform: 'rotate(45deg)', ...tailStyle[tail] }} />
          )}
          {/* Positioned so it paints above the tail in both the browser and the renderer (which paints in DOM order). */}
          <span style={{ position: 'relative' }}>{text}</span>
        </div>
      </div>
    </div>
  )
}

/** Round rank badge; #1 is gold. */
export function RankBadge({ x, y, rank, size = 76 }: { x: number; y: number; rank: number; size?: number }) {
  const u = useUnit()
  const s = size * u
  return (
    <div style={{
      position: 'absolute', left: x - s / 2, top: y - s / 2, width: s, height: s, borderRadius: 99,
      background: rank === 1 ? COLORS.yellow : COLORS.white, border: `${4 * u}px solid ${INK}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: s * 0.38, fontWeight: 700, boxSizing: 'border-box',
    }}>
      #{rank}
    </div>
  )
}

const BAR_BADGE = 76
const BAR_GAP = 20

/** Leaderboard bar: optional rank badge + a pill track filled to `value` (0–1). Animate `value` yourself. */
export function RaceBar({ x, y, width, value, color = 'teal', rank, label, height = 70 }: {
  x: number; y: number; width: number; value: number; color?: KitColor; rank?: number; label?: string; height?: number
}) {
  const u = useUnit()
  const h = height * u
  const lead = rank ? (BAR_BADGE + BAR_GAP) * u : 0
  const trackW = width - lead
  const inner = trackW - 10 * u
  const fill = Math.max(h - 10 * u, Math.min(1, Math.max(0, value)) * inner)
  const left = x - width / 2
  return (
    <>
      {rank !== undefined && <RankBadge x={left + (BAR_BADGE * u) / 2} y={y} rank={rank} size={BAR_BADGE} />}
      <div style={{
        position: 'absolute', left: left + lead, top: y - h / 2, width: trackW, height: h,
        background: '#F3EDDC', border: `${5 * u}px solid ${INK}`, borderRadius: 999, boxSizing: 'border-box', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: fill, background: resolve(color), borderRadius: 999 }} />
        {label && <div style={{ position: 'absolute', left: 30 * u, top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontSize: 30 * u, fontWeight: 600, opacity: 0.55 }}>{label}</div>}
      </div>
    </>
  )
}

/** x of the fill's leading edge on a RaceBar — stand a character there. */
export function raceBarTip(x: number, width: number, value: number, hasRank = true, height = 70): number {
  const lead = hasRank ? BAR_BADGE + BAR_GAP : 0
  const inner = width - lead - 10
  return x - width / 2 + lead + 5 + Math.max(height - 10, Math.min(1, Math.max(0, value)) * inner)
}

/** Two-color slider; `value` 0–1 is the knob position. */
export function Slider({ x, y, width, value, leftColor = 'teal', rightColor = 'coral' }: {
  x: number; y: number; width: number; value: number; leftColor?: KitColor; rightColor?: KitColor
}) {
  const u = useUnit()
  const h = 28 * u
  const kx = sliderKnobX(x, width, value)
  const k = 66 * u
  return (
    <>
      <div style={{ position: 'absolute', left: x - width / 2, top: y - h / 2, width, height: h, borderRadius: 99, border: `${4 * u}px solid ${INK}`, overflow: 'hidden', boxSizing: 'border-box', background: resolve(rightColor) }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: kx - (x - width / 2), background: resolve(leftColor) }} />
      </div>
      <div style={{ position: 'absolute', left: kx - k / 2, top: y - k / 2, width: k, height: k, borderRadius: 99, background: COLORS.white, border: `${5 * u}px solid ${INK}`, boxSizing: 'border-box' }} />
    </>
  )
}

export function sliderKnobX(x: number, width: number, value: number): number {
  return x - width / 2 + Math.min(1, Math.max(0, value)) * width
}

/** A sagging rope between two points — tug-of-war, leashes, cables. */
export function Rope({ from, to, sag = 40, color = '#B07A3C', thickness = 6 }: {
  from: [number, number]; to: [number, number]; sag?: number; color?: string; thickness?: number
}) {
  const { width, height } = useVideoConfig()
  const u = useUnit()
  const mx = (from[0] + to[0]) / 2
  const my = (from[1] + to[1]) / 2 + sag * u
  return (
    <svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }}>
      <path d={`M${from[0]},${from[1]} Q${mx},${my} ${to[0]},${to[1]}`} fill="none" stroke={color} strokeWidth={thickness * u} strokeLinecap="round" />
    </svg>
  )
}

/** Pill button / tag. Filled with its color, or white with an outline. */
export function Pill({ x, y, text, color = 'teal', filled = true, at, size = 36 }: {
  x: number; y: number; text: string; color?: KitColor; filled?: boolean; at?: number; size?: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const u = useUnit()
  const p = at === undefined ? 1 : pop(frame, at, fps)
  const bg = filled ? resolve(color) : COLORS.white
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) scale(${p})` }}>
      <div style={{
        padding: `${10 * u}px ${34 * u}px`, borderRadius: 999, border: `${4 * u}px solid ${INK}`, background: bg,
        fontSize: size * u, fontWeight: 700, whiteSpace: 'nowrap', color: filled ? COLORS.white : INK,
      }}>
        {text}
      </div>
    </div>
  )
}

/** Full-width ground line at `y`. */
export function Ground({ y }: { y: number }) {
  const u = useUnit()
  return <div style={{ position: 'absolute', left: 0, right: 0, top: y - 2.5 * u, height: 5 * u, background: INK }} />
}

// Step heights as a share of the podium's width, so it scales with it.
const PODIUM = { first: 0.2, second: 0.12, third: 0.08 }

/** Three-step podium standing on the ground line at `y` (its bottom edge). */
export function Podium({ x, y, width = 640 }: { x: number; y: number; width?: number }) {
  const u = useUnit()
  const w = width / 3
  const block = (cx: number, share: number, n: number) => (
    <div key={n} style={{
      position: 'absolute', left: cx - w / 2 + 3 * u, top: y - share * width, width: w - 6 * u, height: share * width,
      background: COLORS.white, border: `${5 * u}px solid ${INK}`, borderRadius: `${10 * u}px ${10 * u}px 0 0`, boxSizing: 'border-box',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: w * (n === 1 ? 0.26 : 0.18), fontWeight: 700,
    }}>
      {n}
    </div>
  )
  return <>{block(x - w, PODIUM.second, 2)}{block(x, PODIUM.first, 1)}{block(x + w, PODIUM.third, 3)}</>
}

/** Where to stand characters on a Podium (use with anchor="bottom"). */
export function podiumSpots(x: number, y: number, width = 640) {
  const w = width / 3
  return {
    first: { x, y: y - PODIUM.first * width },
    second: { x: x - w, y: y - PODIUM.second * width },
    third: { x: x + w, y: y - PODIUM.third * width },
  }
}
