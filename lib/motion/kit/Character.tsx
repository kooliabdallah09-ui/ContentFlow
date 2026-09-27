// Mascot characters: simple candy-colored shapes with ink outlines and
// expressive faces. Drawn in SVG (captured natively by the web renderer);
// the text marks ("!!", "?!") are HTML so they use the kit font.
//
// Everything, marks included, must stay inside the VB box: the renderer
// clips a transformed element's children to the element's own box.

import { useCurrentFrame } from 'remotion'
import { COLORS, FONT, INK, type KitColor, color as resolve, tint, useUnit } from './theme'

export type CharacterShape = 'robot' | 'triangle' | 'blob' | 'square' | 'circle'
export type Expression =
  | 'neutral' | 'happy' | 'smug' | 'angry' | 'shocked'
  | 'dizzy' | 'sad' | 'determined' | 'love' | 'wink'
export type Mark = '!' | '!!' | '?' | '?!' | 'sweat' | 'stars' | 'hearts' | 'zzz'

// Body geometry in a 120×120 box. `top` is where a crown sits, `face` is the
// face center and scale.
const BODY: Record<CharacterShape, { top: number; face: [number, number, number] }> = {
  robot:    { top: 26, face: [60, 64, 0.95] },
  triangle: { top: 14, face: [60, 76, 0.85] },
  blob:     { top: 14, face: [60, 60, 1] },
  square:   { top: 16, face: [60, 62, 1] },
  circle:   { top: 15, face: [60, 60, 1] },
}
const FEET = 106
// The SVG canvas extends past the body so crowns, antennas and marks fit.
const VB = { x: -30, y: -40, w: 180, h: 170 }

function Body({ shape, fill }: { shape: CharacterShape; fill: string }) {
  const s = { fill, stroke: INK, strokeWidth: 5, strokeLinejoin: 'round' as const }
  switch (shape) {
    case 'robot':
      return (
        <g>
          <line x1={60} y1={27} x2={60} y2={11} stroke={INK} strokeWidth={5} strokeLinecap="round" />
          <circle cx={60} cy={9} r={6} fill={COLORS.yellow} stroke={INK} strokeWidth={4} />
          <rect x={16} y={26} width={88} height={78} rx={20} {...s} />
          <rect x={28} y={40} width={64} height={48} rx={13} fill={tint(fill, 0.6)} stroke={INK} strokeWidth={4} />
        </g>
      )
    case 'triangle':
      return <path d="M52,22 Q60,8 68,22 L105,91 Q112,104 96,104 L24,104 Q8,104 15,91 Z" {...s} />
    case 'blob':
      return <path d="M60,14 C90,13 107,34 106,63 C105,91 88,106 60,106 C31,106 13,90 14,62 C15,33 31,15 60,14 Z" {...s} />
    case 'square':
      return <rect x={14} y={16} width={92} height={90} rx={26} {...s} />
    case 'circle':
      return <circle cx={60} cy={61} r={46} {...s} />
  }
}

function Face({ expression, blink, look }: { expression: Expression; blink: number; look: number }) {
  const ink = { stroke: INK, strokeWidth: 4, strokeLinecap: 'round' as const, fill: 'none' }
  const ex = 15
  const ey = -4
  const dotEye = (cx: number) => (
    <g key={cx}>
      <ellipse cx={cx + look} cy={ey} rx={4.8} ry={5.8 * blink} fill={INK} />
      {blink > 0.6 && <circle cx={cx + look + 1.6} cy={ey - 2.2} r={1.6} fill="#fff" />}
    </g>
  )
  const lidEye = (cx: number) => <path key={cx} d={`M${cx - 5.5 + look},${ey - 1} A5.5,5.5 0 0,0 ${cx + 5.5 + look},${ey - 1} Z`} fill={INK} />
  const arcEye = (cx: number) => <path key={cx} d={`M${cx - 5.5},${ey + 2} Q${cx},${ey - 6} ${cx + 5.5},${ey + 2}`} {...ink} />
  const heart = (cx: number) => (
    <path key={cx} d={`M${cx},${ey + 5} C${cx - 9},${ey - 1} ${cx - 5},${ey - 9} ${cx},${ey - 4} C${cx + 5},${ey - 9} ${cx + 9},${ey - 1} ${cx},${ey + 5} Z`} fill={COLORS.coral} stroke={INK} strokeWidth={2} />
  )
  const xEye = (cx: number) => (
    <g key={cx}>
      <line x1={cx - 4.5} y1={ey - 4.5} x2={cx + 4.5} y2={ey + 4.5} {...ink} />
      <line x1={cx + 4.5} y1={ey - 4.5} x2={cx - 4.5} y2={ey + 4.5} {...ink} />
    </g>
  )

  switch (expression) {
    case 'happy':
      return <g>{arcEye(-ex)}{arcEye(ex)}<path d="M-11,7 Q0,22 11,7 Z" fill={INK} /></g>
    case 'smug':
      return <g>{lidEye(-ex)}{lidEye(ex)}<path d="M-8,11 Q2,15 10,6" {...ink} /></g>
    case 'angry':
      return (
        <g>
          {dotEye(-ex)}{dotEye(ex)}
          <line x1={-ex - 7} y1={ey - 11} x2={-ex + 5} y2={ey - 6} {...ink} />
          <line x1={ex + 7} y1={ey - 11} x2={ex - 5} y2={ey - 6} {...ink} />
          <path d="M-7,14 Q0,9 7,14" {...ink} />
        </g>
      )
    case 'shocked':
      return (
        <g>
          {[-ex, ex].map(cx => (
            <g key={cx}>
              <circle cx={cx} cy={ey} r={7.5} fill="#fff" stroke={INK} strokeWidth={3} />
              <circle cx={cx + look} cy={ey} r={3.5} fill={INK} />
            </g>
          ))}
          <ellipse cx={0} cy={13} rx={4.5} ry={6} fill={INK} />
        </g>
      )
    case 'dizzy':
      return <g>{xEye(-ex)}{xEye(ex)}<path d="M-9,12 q3,-4 6,0 t6,0 t6,0" {...ink} /></g>
    case 'sad':
      return (
        <g>
          {dotEye(-ex)}{dotEye(ex)}
          <line x1={-ex - 6} y1={ey - 7} x2={-ex + 4} y2={ey - 11} {...ink} />
          <line x1={ex + 6} y1={ey - 7} x2={ex - 4} y2={ey - 11} {...ink} />
          <path d="M-7,15 Q0,9 7,15" {...ink} />
        </g>
      )
    case 'determined':
      return (
        <g>
          {lidEye(-ex)}{lidEye(ex)}
          <line x1={-ex - 7} y1={ey - 9} x2={-ex + 5} y2={ey - 6} {...ink} />
          <line x1={ex + 7} y1={ey - 9} x2={ex - 5} y2={ey - 6} {...ink} />
          <path d="M-8,12 L8,10" {...ink} />
        </g>
      )
    case 'love':
      return <g>{heart(-ex)}{heart(ex)}<path d="M-8,9 Q0,17 8,9" {...ink} /></g>
    case 'wink':
      return <g>{arcEye(-ex)}{dotEye(ex)}<path d="M-8,9 Q0,17 8,9" {...ink} /></g>
    default:
      return <g>{dotEye(-ex)}{dotEye(ex)}<path d="M-7,10 Q0,15 7,10" {...ink} /></g>
  }
}

function Crown({ top }: { top: number }) {
  const y = top - 2
  return (
    <g>
      <path d={`M38,${y} L34,${y - 27} L48,${y - 14} L60,${y - 33} L72,${y - 14} L86,${y - 27} L82,${y} Z`} fill={COLORS.yellow} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
      {[34, 60, 86].map((cx, i) => <circle key={cx} cx={cx} cy={i === 1 ? y - 33 : y - 27} r={3.5} fill={COLORS.coral} stroke={INK} strokeWidth={2} />)}
    </g>
  )
}

function SymbolMark({ mark, frame }: { mark: Mark; frame: number }) {
  if (mark === 'sweat') {
    const d = (frame % 40) / 40
    return <path d="M8,6 C8,6 -1,18 -1,23 C-1,28 3,31 8,31 C13,31 17,28 17,23 C17,18 8,6 8,6 Z" transform={`translate(0 ${d * 10})`} fill={COLORS.blue} stroke={INK} strokeWidth={2.5} opacity={1 - d * 0.6} />
  }
  if (mark === 'stars') {
    return (
      <g>
        {[0, 1, 2].map(i => {
          const a = (frame / 30) * Math.PI * 2 * 0.7 + (i * Math.PI * 2) / 3
          const x = 60 + Math.cos(a) * 34
          const y = -6 + Math.sin(a) * 9
          return <path key={i} transform={`translate(${x} ${y}) scale(0.9)`} d="M0,-8 L2.4,-2.4 L8,0 L2.4,2.4 L0,8 L-2.4,2.4 L-8,0 L-2.4,-2.4 Z" fill={COLORS.yellow} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
        })}
      </g>
    )
  }
  if (mark === 'hearts') {
    return (
      <g>
        {[0, 1].map(i => {
          const t = ((frame + i * 20) % 40) / 40
          return <path key={i} transform={`translate(${96 + i * 14} ${2 - t * 26}) scale(${0.8 + i * 0.2})`} opacity={1 - t} d="M0,6 C-9,0 -5,-8 0,-3 C5,-8 9,0 0,6 Z" fill={COLORS.pink} stroke={INK} strokeWidth={2} />
        })}
      </g>
    )
  }
  return null
}

export function Character({
  shape = 'robot',
  color = 'teal',
  expression = 'neutral',
  size = 220,
  x,
  y,
  anchor = 'center',
  rotate = 0,
  flip = false,
  look = 'center',
  bob = 4,
  squash = 0,
  crown = false,
  mark,
  seed = 0,
  opacity = 1,
}: {
  shape?: CharacterShape
  color?: KitColor
  expression?: Expression
  /** Body width in px. */
  size?: number
  /** Center x in px. */
  x: number
  /** Center y in px (or the feet, with anchor="bottom"). */
  y: number
  anchor?: 'center' | 'bottom'
  rotate?: number
  flip?: boolean
  look?: 'left' | 'right' | 'center'
  /** Idle bob amplitude in px; 0 to hold still. */
  bob?: number
  /** -1 (stretched tall) … 1 (squashed flat), for jumps and landings. */
  squash?: number
  crown?: boolean
  mark?: Mark | null
  /** Offsets idle bob and blink so two characters don't move in sync. */
  seed?: number
  opacity?: number
}) {
  const frame = useCurrentFrame()
  const u = useUnit()
  const k = (size * u) / 120
  const body = BODY[shape]
  const [fx, fy, fs] = body.face

  // Blink every ~2.7s for 5 frames, offset per seed.
  const cycle = (frame + seed * 23) % 80
  const blink = cycle < 5 ? Math.abs(Math.cos((cycle / 5) * Math.PI)) * 0.85 + 0.15 : 1
  const lookPx = look === 'left' ? -3 : look === 'right' ? 3 : 0
  const bobY = Math.sin((frame / 30) * Math.PI * 1.4 + seed) * bob * u

  const left = x - (60 - VB.x) * k
  const top = (anchor === 'bottom' ? y - (FEET - VB.y) * k : y - (60 - VB.y) * k) + bobY
  const sx = (flip ? -1 : 1) * (1 + squash * 0.14)
  const sy = 1 - squash * 0.18
  const isText = mark === '!' || mark === '!!' || mark === '?' || mark === '?!'

  return (
    <div style={{
      position: 'absolute', left, top, width: VB.w * k, height: VB.h * k, opacity,
      transformOrigin: `${(60 - VB.x) * k}px ${(FEET - VB.y) * k}px`,
      transform: `rotate(${rotate}deg) scale(${sx}, ${sy})`,
    }}>
      <svg width={VB.w * k} height={VB.h * k} viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}>
        <Body shape={shape} fill={resolve(color)} />
        <g transform={`translate(${fx} ${fy}) scale(${fs})`}>
          <Face expression={expression} blink={blink} look={lookPx} />
        </g>
        {shape === 'blob' && (
          <g opacity={0.55}>
            <ellipse cx={fx - 25} cy={fy + 9} rx={6} ry={3.5} fill={COLORS.pink} />
            <ellipse cx={fx + 25} cy={fy + 9} rx={6} ry={3.5} fill={COLORS.pink} />
          </g>
        )}
        {crown && <Crown top={body.top} />}
        {mark && !isText && <SymbolMark mark={mark} frame={frame} />}
      </svg>
      {isText && (
        <div style={{
          position: 'absolute', left: (104 - VB.x) * k, top: (-18 - VB.y) * k,
          transform: flip ? 'scaleX(-1)' : undefined,
          fontFamily: FONT, fontWeight: 700, fontSize: 34 * k, lineHeight: 1,
          color: COLORS.coral, letterSpacing: '0.02em',
        }}>
          {mark}
        </div>
      )}
      {mark === 'zzz' && (
        <div style={{ position: 'absolute', left: (90 - VB.x) * k, top: (-14 - VB.y) * k, fontFamily: FONT, fontWeight: 700, fontSize: 24 * k, color: INK, opacity: 0.7 }}>z z z</div>
      )}
    </div>
  )
}
