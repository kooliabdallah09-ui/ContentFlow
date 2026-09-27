// End card — the animated brand / offer / CTA slate appended to the end of
// an exported ad. Shared by the Remotion composition that draws it
// (components/remotion/EndCard.tsx), the editor panel that previews it, and
// the in-browser renderer that bakes it into the export (lib/end-card-render.ts).

export type EndCardAspect = '9:16' | '1:1' | '16:9'

// A type alias, not an interface: Remotion's Player and renderMediaOnWeb
// require props assignable to Record<string, unknown>.
export type EndCardProps = {
  brandName: string
  logoUrl: string | null
  imageUrl: string | null
  // 'product' = a physical product photo, shown whole on a soft stage.
  // 'screenshot' = an app / site screen, shown in a device or window frame.
  imageKind: 'product' | 'screenshot'
  imageAspect: number   // width / height of imageUrl, sizes the frame
  headline: string
  offer: string
  cta: string
  website: string
  accent: string        // #rrggbb
  theme: 'dark' | 'light'
}

export const END_CARD_FPS = 30
export const END_CARD_SECONDS = 3.5
export const END_CARD_FRAMES = Math.round(END_CARD_FPS * END_CARD_SECONDS)

// Matches the editor's export resolutions, so the card is rendered at the
// exact size it gets spliced in at and is never rescaled.
export const END_CARD_SIZE: Record<EndCardAspect, [number, number]> = {
  '9:16': [1080, 1920],
  '1:1':  [1080, 1080],
  '16:9': [1920, 1080],
}

export const DEFAULT_ACCENT = '#FF5A36'

export const ACCENT_SWATCHES = ['#FF5A36', '#2F6BFF', '#7C5CFF', '#16A34A', '#F5B400', '#FF3D8B', '#0EA5B7']

export const CTA_SUGGESTIONS = {
  physical: ['Shop now', 'Get yours', 'Order today', 'Shop the drop'],
  app:      ['Try it free', 'Download now', 'Start free', 'Get the app'],
} as const

export function ctaDefault(kind: EndCardProps['imageKind']): string {
  return kind === 'screenshot' ? CTA_SUGGESTIONS.app[0] : CTA_SUGGESTIONS.physical[0]
}

// "https://www.glow.co/shop?ref=1" → "glow.co/shop". The card shows where to
// go, not a URL to copy, so protocol, www and query are noise.
export function displayWebsite(url: string | null | undefined): string {
  if (!url) return ''
  return url.trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h.padEnd(6, '0').slice(0, 6)
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(v => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Text color for a button filled with `hex`. White whenever it clears WCAG's
 * 3:1 for large bold text — white-on-saturated is the ad convention, even
 * where black would score higher — and near-black only on light fills.
 */
export function readableOn(hex: string): string {
  return 1.05 / (luminance(hex) + 0.05) >= 3 ? '#FFFFFF' : '#111111'
}

/** `hex` at `alpha` (0–1) as an rgba() string. */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r},${g},${b},${alpha})`
}

/** Linear mix of two hex colors; t=0 → a, t=1 → b. */
export function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  return '#' + ca.map((v, i) => Math.round(v + (cb[i] - v) * t).toString(16).padStart(2, '0')).join('')
}

// brand_profiles.brand_colors is free text ("Cyan, White, Dark Gray" or
// "#0EA5E9 / #111"), so each token goes through the browser's own CSS color
// parser. The first one that reads as a real accent wins; near-white and
// near-black are skipped because they vanish on one of the two themes.
// Browser-only (uses a canvas); returns null on the server.
export function accentFromBrandColors(text: string | null | undefined): string | null {
  if (!text || typeof document === 'undefined') return null
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return null
  const tokens = text.split(/[,/;|+\n]+|\band\b/i).map(t => t.trim()).filter(Boolean)
  for (const token of tokens) {
    for (const candidate of [token, token.replace(/\s+/g, '')]) {
      ctx.fillStyle = '#010203'
      ctx.fillStyle = candidate
      const parsed = String(ctx.fillStyle)
      if (!/^#[0-9a-f]{6}$/i.test(parsed) || parsed === '#010203') continue
      const l = luminance(parsed)
      if (l > 0.8 || l < 0.03) break
      return parsed.toUpperCase()
    }
  }
  return null
}
