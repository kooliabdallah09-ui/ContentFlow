// Pulls a site's share image, logo and brand colours out of its HTML.
// Pure: finds URLs and colours, never touches the network.

import { decodeEntities, pickMeta } from '@/lib/preview-scraper'

export type BrandFromHtml = {
  /** Candidate share images, best first. */
  images: string[]
  /** Candidate logos, best first. Raster only: SVG and .ico are skipped. */
  logos: string[]
  /** Up to 3 saturated brand colours as #rrggbb, best first. */
  colors: string[]
}

function resolve(href: string | null | undefined, base: string): string | null {
  if (!href) return null
  try {
    const u = new URL(decodeEntities(href.trim()), base)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

const attr = (tag: string, name: string) => tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1] ?? null
const notVector = (url: string) => !/\.(svg|ico)(\?|#|$)/i.test(url)

function logoCandidates(html: string, base: string): string[] {
  const out: string[] = []
  // Organization.logo in JSON-LD: the site's own statement of what its logo is.
  const ld = html.match(/"logo"\s*:\s*(?:"([^"]+)"|\{[^{}]*?"(?:url|contentUrl)"\s*:\s*"([^"]+)")/i)
  out.push(resolve((ld?.[1] ?? ld?.[2])?.replace(/\\\//g, '/'), base) ?? '')

  const touch: { url: string; size: number }[] = []
  const icons: { url: string; size: number }[] = []
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = attr(tag, 'rel')?.toLowerCase() ?? ''
    const url = resolve(attr(tag, 'href'), base)
    if (!url || !notVector(url)) continue
    const size = Number(attr(tag, 'sizes')?.match(/\d+/)?.[0] ?? 0)
    if (rel.includes('apple-touch-icon')) touch.push({ url, size })
    else if (/(^|\s)icon(\s|$)/.test(rel) && (size === 0 || size >= 64)) icons.push({ url, size })
  }
  const bySize = (a: { size: number }, b: { size: number }) => b.size - a.size
  out.push(...touch.sort(bySize).map(t => t.url), ...icons.sort(bySize).map(i => i.url))
  return [...new Set(out.filter(u => u && notVector(u)))].slice(0, 2)
}

function normalizeHex(raw: string): string | null {
  const m = raw.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!m) return null
  const h = m[1].length === 3 ? [...m[1]].map(c => c + c).join('') : m[1]
  return `#${h.toLowerCase()}`
}

// Brand colours are saturated and mid-light; greys, pastels, near-white and near-black are not.
function isBrandish(hex: string): boolean {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1))
  return s >= 0.4 && l >= 0.2 && l <= 0.8
}

function brandColors(html: string): string[] {
  const declared = ['theme-color', 'msapplication-TileColor'].map(n => pickMeta(html, n))
  // Stylesheets linked from the page aren't fetched; inline CSS covers Framer and many Shopify themes.
  const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n') + (html.match(/\sstyle\s*=\s*["'][^"']*["']/gi) ?? []).join('\n')
  const counts = new Map<string, number>()
  for (const m of css.matchAll(/#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
    const hex = normalizeHex(m[0])
    if (hex) counts.set(hex, (counts.get(hex) ?? 0) + 1)
  }
  const frequent = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([hex]) => hex)
  const all = [...declared.map(d => (d ? normalizeHex(d) : null)), ...frequent]
  return [...new Set(all.filter((h): h is string => !!h && isBrandish(h)))].slice(0, 3)
}

export function extractBrand(html: string, pageUrl: string): BrandFromHtml {
  const images = [pickMeta(html, 'og:image'), pickMeta(html, 'twitter:image')]
    .map(h => resolve(h, pageUrl))
    .filter((u): u is string => !!u)
  return { images: [...new Set(images)], logos: logoCandidates(html, pageUrl), colors: brandColors(html) }
}

/** The most common brand-looking colours in an image's pixels (RGBA, e.g. from a small canvas). */
export function dominantColors(rgba: ArrayLike<number>, max = 3): string[] {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>()
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3] < 200) continue
    const key = ((rgba[i] >> 5) << 6) | ((rgba[i + 1] >> 5) << 3) | (rgba[i + 2] >> 5)
    const b = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
    b.n++
    b.r += rgba[i]
    b.g += rgba[i + 1]
    b.b += rgba[i + 2]
    buckets.set(key, b)
  }
  const toHex = (rgb: number[]) => `#${rgb.map(v => v.toString(16).padStart(2, '0')).join('')}`
  const picked: number[][] = []
  for (const b of [...buckets.values()].sort((x, y) => y.n - x.n)) {
    const rgb = [b.r, b.g, b.b].map(v => Math.round(v / b.n))
    // Neighbouring buckets are shades of one colour: keep only the most common.
    if (isBrandish(toHex(rgb)) && picked.every(p => Math.hypot(p[0] - rgb[0], p[1] - rgb[1], p[2] - rgb[2]) > 70)) picked.push(rgb)
    if (picked.length === max) break
  }
  return picked.map(toHex)
}
