// Motion kit theme — the flat, ink-outlined "cartoon UI" look: cream paper,
// thick dark outlines, candy colors, rounded Fredoka type.
//
// Everything in the kit is drawn by @remotion/web-renderer in the user's
// browser, which supports only part of CSS: stacking is DOM order (no
// z-index), gradients are linear only, no filter/backdrop-filter, no
// box-shadow spread. Inline SVG is captured natively, so shapes are SVG.

import { useVideoConfig } from 'remotion'
import { loadFont } from '@remotion/google-fonts/Fredoka'

export const { fontFamily: FONT } = loadFont('normal', { weights: ['500', '600', '700'], subsets: ['latin'] })

export const INK = '#26232E'
export const PAPER = '#FBF4DE'

export const COLORS = {
  teal: '#3CC7B5',
  coral: '#FF6B6B',
  yellow: '#FFC83D',
  purple: '#7C6CF2',
  pink: '#FF8FB8',
  blue: '#4D8DFF',
  green: '#5FCB78',
  orange: '#FF9A3D',
  white: '#FFFFFF',
  gray: '#E9E3D1',
  ink: INK,
  paper: PAPER,
} as const

export type KitColor = keyof typeof COLORS | (string & {})

/** A kit color name ("teal") or any CSS color ("#123456"). */
export function color(c: KitColor | undefined, fallback: KitColor = 'teal'): string {
  const key = (c ?? fallback) as string
  return (COLORS as Record<string, string>)[key] ?? key
}

/**
 * 1 unit = 1px at 1080 on the short edge. Everything in the kit is sized in
 * units, so one layout works at 1080×1920, 1080×1080 and 1920×1080.
 */
export function useUnit(): number {
  const { width, height } = useVideoConfig()
  return Math.min(width, height) / 1080
}

/** Mixes a hex color toward white; t=0 → c, t=1 → white. */
export function tint(hex: string, t: number): string {
  const h = hex.replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(h)) return hex
  const n = parseInt(h, 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.round(v + (255 - v) * t))
  return '#' + ch.map(v => v.toString(16).padStart(2, '0')).join('')
}
