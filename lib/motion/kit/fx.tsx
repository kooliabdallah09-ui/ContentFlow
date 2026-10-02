// Payoff effects and ad copy: confetti, comic bursts, banners, captions,
// product shots, the call-to-action button. x / y are CENTERS, in px.

import type { ReactNode } from 'react'
import { Img, interpolate, random, useCurrentFrame, useVideoConfig } from 'remotion'
import { ease, glide, pop } from './anim'
import { COLORS, INK, type KitColor, color as resolve, useUnit } from './theme'

const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const CONFETTI_COLORS = [COLORS.coral, COLORS.yellow, COLORS.teal, COLORS.purple, COLORS.pink, COLORS.blue]

/** Confetti shower from the top edge, starting at `at`. */
export function Confetti({ at = 0, count = 70, duration = 90, seed = 1 }: { at?: number; count?: number; duration?: number; seed?: number }) {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const u = useUnit()
  const t = frame - at
  if (t < 0 || t > duration + 60) return null
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const r = (k: string) => random(`${seed}-${i}-${k}`)
        const delay = r('d') * 20
        const lt = Math.max(0, t - delay)
        const x0 = r('x') * width
        const fall = lt * (8 + r('v') * 10) * u + 0.12 * lt * lt * u
        const x = x0 + Math.sin(lt / 9 + r('p') * 6) * 30 * u
        const y = -40 * u + fall
        if (y > height + 40) return null
        const w = (10 + r('w') * 12) * u
        const round = r('s') > 0.7
        return (
          <div key={i} style={{
            position: 'absolute', left: x, top: y, width: w, height: round ? w : w * 0.5,
            borderRadius: round ? 99 : 2 * u, background: CONFETTI_COLORS[Math.floor(r('c') * CONFETTI_COLORS.length)],
            transform: `rotate(${lt * (6 + r('r') * 10)}deg)`, opacity: lt > 0 ? 1 : 0,
          }} />
        )
      })}
    </>
  )
}

/** Comic-book starburst with a word in it ("BONK!", "WOW", "-50%"). */
export function Burst({ x, y, text, size = 260, color = 'yellow', at = 0, rotate = -8 }: {
  x: number; y: number; text: string; size?: number; color?: KitColor; at?: number; rotate?: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const u = useUnit()
  if (frame < at) return null
  const p = pop(frame, at, fps, 0.9)
  const s = size * u
  const spikes = 14
  const pts = Array.from({ length: spikes * 2 }, (_, i) => {
    const a = (i / (spikes * 2)) * Math.PI * 2
    const r = i % 2 === 0 ? 48 : 34 + (i % 4 === 1 ? 4 : 0)
    return `${50 + Math.cos(a) * r},${50 + Math.sin(a) * r}`
  }).join(' ')
  return (
    <div style={{ position: 'absolute', left: x - s / 2, top: y - s / 2, width: s, height: s, transform: `rotate(${rotate + (1 - p) * -30}deg) scale(${p})` }}>
      <svg width={s} height={s} viewBox="0 0 100 100" style={{ position: 'absolute', left: 0, top: 0 }}>
        <polygon points={pts} fill={resolve(color)} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      </svg>
      {/* Shrinks with the text so longer words ("FOUND IT!") stay inside the star. */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: s * Math.min(0.2, 1.1 / Math.max(5, text.length)), fontWeight: 700, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
        {text}
      </div>
    </div>
  )
}

/** Dark banner with bright text — the "NEW #1" moment. */
export function Banner({ x, y, text, at = 0, color = 'ink', textColor = 'yellow', size = 72, rotate = -3 }: {
  x: number; y: number; text: string; at?: number; color?: KitColor; textColor?: KitColor; size?: number; rotate?: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const u = useUnit()
  if (frame < at) return null
  const p = pop(frame, at, fps, 0.8)
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) rotate(${rotate}deg) scale(${p})` }}>
      <div style={{
        background: resolve(color), color: resolve(textColor), padding: `${14 * u}px ${48 * u}px`, borderRadius: 20 * u,
        fontSize: size * u, fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: '0.03em',
        boxShadow: `0 ${10 * u}px 0 rgba(38,35,46,0.18)`,
      }}>
        {text}
      </div>
    </div>
  )
}

/**
 * Big ad copy, word by word. Words listed in `highlight` get `highlightColor`.
 * Lines break on "\n" or at `maxWidth`.
 */
export function Caption({ x, y, text, size = 84, color = 'ink', highlight = [], highlightColor = 'coral', at = 0, stagger = 3, maxWidth = 920, align = 'center' }: {
  x: number; y: number; text: string; size?: number; color?: KitColor; highlight?: string[]; highlightColor?: KitColor
  at?: number; stagger?: number; maxWidth?: number; align?: 'center' | 'left'
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const u = useUnit()
  const marks = new Set(highlight.map(h => h.toLowerCase()))
  let i = 0
  return (
    <div style={{
      position: 'absolute', left: align === 'center' ? x - maxWidth / 2 : x, top: y, width: maxWidth, transform: 'translateY(-50%)',
      display: 'flex', flexDirection: 'column', alignItems: align === 'center' ? 'center' : 'flex-start',
      fontSize: size * u, fontWeight: 700, lineHeight: 1.08, letterSpacing: '-0.01em', color: resolve(color, 'ink'),
    }}>
      {text.split('\n').map((line, li) => (
        <div key={li} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: align === 'center' ? 'center' : 'flex-start', columnGap: size * 0.26 * u }}>
          {line.split(/\s+/).filter(Boolean).map(word => {
            const p = pop(frame, at + i++ * stagger, fps, 0.5)
            const bare = word.replace(/[^\p{L}\p{N}%#$€£+-]/gu, '').toLowerCase()
            return (
              <span key={i} style={{
                display: 'inline-block', color: marks.has(bare) ? resolve(highlightColor) : undefined,
                opacity: interpolate(p, [0, 0.3], [0, 1], CLAMP), transform: `translateY(${(1 - p) * 40 * u}px)`,
              }}>
                {word}
              </span>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/** A product photo (or any image) on a white card with a hard ink shadow. */
export function ProductShot({ x, y, src, size = 440, at = 0, rotate = -3, fit = 'cover' }: {
  x: number; y: number; src?: string | null; size?: number; at?: number; rotate?: number; fit?: 'cover' | 'contain'
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const u = useUnit()
  if (!src) return null
  const p = pop(frame, at, fps, 0.5)
  const s = size * u
  return (
    <div style={{
      position: 'absolute', left: x - s / 2, top: y - s / 2, width: s, height: s,
      background: COLORS.white, border: `${6 * u}px solid ${INK}`, borderRadius: 36 * u, overflow: 'hidden',
      boxShadow: `${12 * u}px ${14 * u}px 0 ${INK}`,
      transform: `rotate(${rotate}deg) scale(${p})`, opacity: interpolate(p, [0, 0.3], [0, 1], CLAMP),
    }}>
      <Img src={src} style={{ width: '100%', height: '100%', objectFit: fit }} />
    </div>
  )
}

/** A screenshot of the brand's real website in a browser window (16:10 body). Pushes in toward (focusX, focusY), fractions of the page, from at+20 for `duration` frames. Renders nothing if src is null. */
export function SiteShot({ x, y, src, width = 900, at = 0, rotate = 0, focusX = 0.5, focusY = 0.25, zoomTo = 1, duration = 90 }: {
  x: number; y: number; src?: string | null; width?: number; at?: number; rotate?: number
  focusX?: number; focusY?: number; zoomTo?: number; duration?: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const u = useUnit()
  if (!src) return null
  const p = pop(frame, at, fps, 0.5)
  const w = width * u
  const bar = 56 * u
  const body = w * 0.625
  const zoom = ease(frame, [at + 20, at + 20 + duration], [1, zoomTo])
  return (
    <div style={{
      position: 'absolute', left: x - w / 2, top: y - (body + bar) / 2, width: w, height: body + bar,
      background: COLORS.white, border: `${6 * u}px solid ${INK}`, borderRadius: 28 * u, overflow: 'hidden',
      boxShadow: `${12 * u}px ${14 * u}px 0 ${INK}`,
      transform: `rotate(${rotate}deg) scale(${p})`, opacity: interpolate(p, [0, 0.3], [0, 1], CLAMP),
    }}>
      <div style={{ height: bar, borderBottom: `${5 * u}px solid ${INK}`, display: 'flex', alignItems: 'center', padding: `0 ${20 * u}px` }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 14 * u, height: 14 * u, borderRadius: 99, border: `${4 * u}px solid ${INK}`, marginRight: 8 * u }} />
        ))}
      </div>
      <div style={{ position: 'relative', width: '100%', height: body, overflow: 'hidden' }}>
        <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover', transformOrigin: `${focusX * 100}% ${focusY * 100}%`, transform: `scale(${zoom})` }} />
      </div>
    </div>
  )
}

/** The call-to-action button: pops in, then "gets pressed" at `pressAt`. */
export function CtaButton({ x, y, text, color = 'coral', at = 0, pressAt, size = 58 }: {
  x: number; y: number; text: string; color?: KitColor; at?: number; pressAt?: number; size?: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const u = useUnit()
  if (frame < at) return null
  const p = pop(frame, at, fps, 0.7)
  const press = pressAt === undefined ? 0 : Math.max(0, 1 - Math.abs(frame - pressAt - 3) / 4)
  const shadow = (10 - press * 8) * u
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) scale(${p})` }}>
      <div style={{
        padding: `${24 * u}px ${64 * u}px`, borderRadius: 999, background: resolve(color), color: COLORS.white,
        border: `${6 * u}px solid ${INK}`, boxShadow: `0 ${shadow}px 0 ${INK}`, transform: `translateY(${press * 8 * u}px)`,
        fontSize: size * u, fontWeight: 700, whiteSpace: 'nowrap',
      }}>
        {text}
      </div>
    </div>
  )
}

/** Brand logo image, or the brand name as a wordmark when there's no image. */
export function Logo({ x, y, src, text, size = 120, at = 0 }: { x: number; y: number; src?: string | null; text?: string; size?: number; at?: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const u = useUnit()
  const p = glide(frame, at, fps)
  const style = { position: 'absolute' as const, left: x, top: y, transform: `translate(-50%, -50%) scale(${0.8 + p * 0.2})`, opacity: p }
  if (src) return <Img src={src} style={{ ...style, height: size * u, objectFit: 'contain' }} />
  return <div style={{ ...style, fontSize: size * 0.5 * u, fontWeight: 700, whiteSpace: 'nowrap' }}>{text}</div>
}

/** A number counting from `from` to `to` — stats, prices, "10x". */
export function Counter({ x, y, from = 0, to, at = 0, duration = 30, prefix = '', suffix = '', decimals = 0, size = 120, color = 'ink' }: {
  x: number; y: number; from?: number; to: number; at?: number; duration?: number; prefix?: string; suffix?: string; decimals?: number; size?: number; color?: KitColor
}) {
  const frame = useCurrentFrame()
  const u = useUnit()
  const v = interpolate(frame, [at, at + duration], [from, to], { ...CLAMP, easing: t => 1 - Math.pow(1 - t, 3) })
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%, -50%)', fontSize: size * u, fontWeight: 700, color: resolve(color, 'ink'), whiteSpace: 'nowrap', letterSpacing: '-0.02em' }}>
      {prefix}{v.toFixed(decimals)}{suffix}
    </div>
  )
}

/** Ticked list that checks off one item every `stagger` frames from `at`. */
export function Checklist({ x, y, items, at = 0, stagger = 12, size = 44, color = 'green' }: {
  x: number; y: number; items: string[]; at?: number; stagger?: number; size?: number; color?: KitColor
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const u = useUnit()
  const box = size * 1.1 * u
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', gap: 22 * u }}>
      {items.map((item, i) => {
        const p = pop(frame, at + i * stagger, fps, 0.6)
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 22 * u, opacity: interpolate(p, [0, 0.3], [0, 1], CLAMP), transform: `translateX(${(1 - p) * -40 * u}px)` }}>
            <div style={{ width: box, height: box, borderRadius: 14 * u, border: `${5 * u}px solid ${INK}`, background: resolve(color), display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
              <svg width={box * 0.6} height={box * 0.6} viewBox="0 0 24 24">
                <path d="M4,12.5 L10,18 L20,6" fill="none" stroke={COLORS.white} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div style={{ fontSize: size * u, fontWeight: 600, whiteSpace: 'nowrap' }}>{item}</div>
          </div>
        )
      })}
    </div>
  )
}

/** A phone outline; children are positioned inside its screen. */
export function PhoneFrame({ x, y, height = 900, at, children }: { x: number; y: number; height?: number; at?: number; children?: ReactNode }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const u = useUnit()
  const p = at === undefined ? 1 : pop(frame, at, fps, 0.4)
  const h = height * u
  const w = h * 0.49
  return (
    <div style={{
      position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h,
      background: COLORS.white, border: `${9 * u}px solid ${INK}`, borderRadius: 64 * u, overflow: 'hidden', boxSizing: 'border-box',
      boxShadow: `${12 * u}px ${14 * u}px 0 rgba(38,35,46,0.18)`, transform: `scale(${0.85 + p * 0.15})`, opacity: interpolate(p, [0, 0.3], [0, 1], CLAMP),
    }}>
      {children}
      <div style={{ position: 'absolute', left: '50%', top: 18 * u, width: 130 * u, height: 34 * u, marginLeft: -65 * u, borderRadius: 99, background: INK }} />
    </div>
  )
}
