// End card composition — see lib/end-card.ts for the props and timing.
//
// Drawn twice: by the Remotion Player for the editor's live preview, and by
// @remotion/web-renderer for the export. The web renderer paints the DOM
// onto a canvas itself and supports only a subset of CSS, so this sticks to
// it: stacking is DOM order (no z-index), gradients are linear only, no
// filter/backdrop-filter (unsupported in Safari exports), and box-shadows
// have no spread.

import { useState } from 'react'
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { loadFont } from '@remotion/google-fonts/Inter'
import { type EndCardProps, mixHex, readableOn, withAlpha } from '@/lib/end-card'

const { fontFamily } = loadFont('normal', { weights: ['500', '700', '800'], subsets: ['latin'] })

const SMOOTH = { damping: 200 }
const POP = { damping: 13, mass: 0.7, stiffness: 170 }
const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

// Beat sheet, in frames at 30fps: everything has landed by ~1.4s, leaving
// two clean seconds to read the offer and the button.
const T = { brand: 3, hero: 5, headline: 12, offer: 26, cta: 32, site: 40, pulse: 56 }

// Average advance of Inter ExtraBold at -0.035em tracking, spaces included,
// as a fraction of font size. Measured at 0.47–0.49 on real headlines; 0.5
// leaves margin. Only used to pick line breaks — each line can still wrap.
const HEADLINE_EM_PER_CHAR = 0.5

// Splits words into the fewest lines that fit `maxChars`, with the breaks
// chosen to make the lines as even as possible — so a headline never ends on
// one orphaned word. Plain wrapping can't do this here (each word is its own
// animated span, and text-wrap: balance doesn't apply to flex items).
function balanceLines(words: string[], maxChars: number): string[][] {
  const m = words.length
  const lenOf = (i: number, j: number) => words.slice(i, j).join(' ').length
  // best[k][j] = smallest possible longest line when words[0..j) fill k lines.
  const best: number[][] = [[0, ...Array(m).fill(Infinity)]]
  const cut: number[][] = [Array(m + 1).fill(0)]
  let n = 0
  // Add lines until the most even split also fits; the total length alone
  // underestimates this whenever a break can't fall mid-word.
  do {
    n++
    best[n] = Array(m + 1).fill(Infinity)
    cut[n] = Array(m + 1).fill(0)
    for (let j = n; j <= m; j++) {
      for (let i = n - 1; i < j; i++) {
        const worst = Math.max(best[n - 1][i], lenOf(i, j))
        if (worst < best[n][j]) { best[n][j] = worst; cut[n][j] = i }
      }
    }
  } while (best[n][m] > maxChars && n < m)
  const lines: string[][] = []
  for (let k = n, j = m; k > 0; k--) {
    const i = cut[k][j]
    lines.unshift(words.slice(i, j))
    j = i
  }
  return lines
}

export function EndCard(props: EndCardProps) {
  const frame = useCurrentFrame()
  const { fps, width, height, durationInFrames } = useVideoConfig()

  // Everything is sized in u = 1/1080 of the short edge, so one layout
  // serves 1080×1920, 1080×1080 and 1920×1080 and scales down for preview.
  const u = Math.min(width, height) / 1080
  const layout = width > height * 1.2 ? 'landscape' : height > width * 1.2 ? 'portrait' : 'square'

  const dark = props.theme === 'dark'
  const ink = dark ? '#FFFFFF' : '#141414'
  const inkDim = dark ? 'rgba(255,255,255,0.62)' : 'rgba(20,20,20,0.58)'
  const base = dark ? '#0D0D11' : '#F6F4EF'
  const accent = props.accent

  const enter = (delay: number, config = SMOOTH) => spring({ frame: frame - delay, fps, config })
  const rise = (p: number, dist: number) => ({
    opacity: interpolate(p, [0, 0.6], [0, 1], CLAMP),
    transform: `translateY(${(1 - p) * dist * u}px)`,
  })

  const [logoFailed, setLogoFailed] = useState<string | null>(null)
  const [imageFailed, setImageFailed] = useState<string | null>(null)
  const logo = props.logoUrl && logoFailed !== props.logoUrl ? props.logoUrl : null
  const image = props.imageUrl && imageFailed !== props.imageUrl ? props.imageUrl : null

  // ── Brand: logo if there is one, else the name as a wordmark ──
  const brandP = enter(T.brand)
  const brand = logo ? (
    <Img
      src={logo}
      pauseWhenLoading
      onError={() => setLogoFailed(logo)}
      style={{ height: (layout === 'square' ? 70 : 84) * u, maxWidth: 440 * u, objectFit: 'contain', ...rise(brandP, -24) }}
    />
  ) : props.brandName.trim() ? (
    <div style={{ fontSize: (layout === 'square' ? 38 : 46) * u, fontWeight: 800, letterSpacing: '-0.02em', color: ink, ...rise(brandP, -24) }}>
      {props.brandName.trim()}
    </div>
  ) : null

  // ── Hero: product photo on a stage, or a screen in a device/window frame ──
  const heroMax = layout === 'portrait' ? { w: 820, h: 640 } : layout === 'square' ? { w: 560, h: 380 } : { w: 760, h: 700 }
  const aspect = Math.min(1.6, Math.max(0.62, props.imageAspect || 1))
  const heroW = Math.min(heroMax.w, heroMax.h * aspect) * u
  const heroH = heroW / aspect
  const heroP = enter(T.hero)
  const drift = interpolate(frame, [0, durationInFrames], [1, 1.045])
  const phone = props.imageKind === 'screenshot' && aspect < 0.8
  const windowFrame = props.imageKind === 'screenshot' && !phone

  const heroImg = image ? (
    <Img
      src={image}
      pauseWhenLoading
      onError={() => setImageFailed(image)}
      style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${drift})` }}
    />
  ) : null

  const hero = heroImg ? (
    <div style={{
      width: heroW + (phone ? 28 * u : 0),
      opacity: interpolate(heroP, [0, 0.5], [0, 1], CLAMP),
      transform: `translateY(${(1 - heroP) * 70 * u}px) scale(${0.9 + heroP * 0.1})`,
      borderRadius: (phone ? 70 : windowFrame ? 30 : 56) * u,
      padding: phone ? 14 * u : 0,
      background: phone
        ? (dark ? '#26262E' : '#141414')
        : (dark ? 'linear-gradient(160deg, #24242C, #17171D)' : '#FFFFFF'),
      border: `${1.5 * u}px solid ${dark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)'}`,
      boxShadow: dark
        ? `0 ${40 * u}px ${90 * u}px rgba(0,0,0,0.55)`
        : `0 ${30 * u}px ${70 * u}px rgba(0,0,0,0.16)`,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {windowFrame && (
        <div style={{ height: 46 * u, display: 'flex', alignItems: 'center', gap: 10 * u, paddingLeft: 22 * u, background: dark ? '#1C1C22' : '#F1EFEA' }}>
          {['#FF5F57', '#FEBC2E', '#28C840'].map(c => (
            <div key={c} style={{ width: 14 * u, height: 14 * u, borderRadius: 99, background: c }} />
          ))}
        </div>
      )}
      <div style={{ width: heroW, height: heroH, borderRadius: phone ? 56 * u : 0, overflow: 'hidden' }}>
        {heroImg}
      </div>
    </div>
  ) : null

  // ── Headline: words rise in one after another ──
  const words = props.headline.trim().split(/\s+/).filter(Boolean)
  const len = props.headline.trim().length
  // With no image the text is the whole card, so it gets the image's room.
  const headlineSize = (len <= 18 ? 104 : len <= 32 ? 88 : len <= 50 ? 74 : 62)
    * (layout === 'square' ? 0.74 : layout === 'landscape' ? 0.92 : 1)
    * (hero ? 1 : 1.3) * u
  const align = layout === 'landscape' ? 'flex-start' : 'center'
  const headlineMaxW = (layout === 'landscape' ? 860 : 900) * u
  const lines = balanceLines(words, Math.floor(headlineMaxW / (headlineSize * HEADLINE_EM_PER_CHAR)))
  let wordIndex = 0
  const headline = words.length > 0 ? (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: align, maxWidth: headlineMaxW,
      fontSize: headlineSize, fontWeight: 800, lineHeight: 1.04, letterSpacing: '-0.035em', color: ink,
    }}>
      {lines.map((line, li) => (
        <div key={li} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: align, columnGap: headlineSize * 0.26 }}>
          {line.map(w => {
            const i = wordIndex++
            return <span key={i} style={{ display: 'inline-block', ...rise(enter(T.headline + i * 2), 46) }}>{w}</span>
          })}
        </div>
      ))}
    </div>
  ) : null

  // ── Offer pill ──
  const offerP = enter(T.offer, POP)
  const offer = props.offer.trim() ? (
    <div style={{
      padding: `${14 * u}px ${30 * u}px`, borderRadius: 999,
      border: `${2.5 * u}px solid ${accent}`, background: withAlpha(accent, dark ? 0.16 : 0.1),
      color: ink, fontSize: (layout === 'square' ? 30 : 36) * u, fontWeight: 700, letterSpacing: '-0.01em',
      opacity: interpolate(offerP, [0, 0.4], [0, 1], CLAMP),
      transform: `scale(${0.7 + offerP * 0.3})`,
    }}>
      {props.offer.trim()}
    </div>
  ) : null

  // ── CTA button: pops in, then breathes so the eye lands on it ──
  const ctaP = enter(T.cta, POP)
  const breathe = frame > T.pulse ? 1 + 0.035 * Math.sin(((frame - T.pulse) / fps) * Math.PI * 2 * 0.9) : 1
  const cta = props.cta.trim() ? (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 18 * u,
      padding: `${30 * u}px ${68 * u}px`, borderRadius: 999,
      background: accent, color: readableOn(accent),
      fontSize: (layout === 'square' ? 38 : 46) * u, fontWeight: 800, letterSpacing: '-0.015em',
      boxShadow: `0 ${24 * u}px ${56 * u}px ${withAlpha(accent, dark ? 0.5 : 0.38)}`,
      opacity: interpolate(ctaP, [0, 0.35], [0, 1], CLAMP),
      transform: `scale(${(0.6 + ctaP * 0.4) * breathe})`,
    }}>
      <span>{props.cta.trim()}</span>
      <span style={{ transform: `translateX(${(breathe - 1) * 180 * u}px)` }}>→</span>
    </div>
  ) : null

  const siteP = enter(T.site)
  const site = props.website.trim() ? (
    <div style={{ fontSize: (layout === 'square' ? 27 : 32) * u, fontWeight: 600, color: inkDim, letterSpacing: '0.01em', ...rise(siteP, 16) }}>
      {props.website.trim()}
    </div>
  ) : null

  // One-off light sweep across the card as it opens (dark theme only — on
  // the light base a white sweep is invisible and an accent one looks dirty).
  const sweepX = interpolate(frame, [2, 26], [-0.6, 1.6], CLAMP)

  const textBlock = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: align, gap: (layout === 'square' ? 26 : 38) * u }}>
      {headline}
      {offer}
      {cta}
      {site}
    </div>
  )

  return (
    // textRendering pinned so the app's global `optimizeLegibility` isn't
    // inherited — the web renderer copies it onto its canvas, which rejects it.
    <AbsoluteFill style={{ fontFamily, background: base, textRendering: 'auto' }}>
      <AbsoluteFill style={{
        background: `linear-gradient(172deg, ${base} 0%, ${base} 42%, ${mixHex(base, accent, dark ? 0.28 : 0.17)} 100%)`,
      }} />
      <div style={{
        position: 'absolute', left: '-30%', width: '160%', height: '46%', bottom: '-8%',
        transform: 'rotate(-7deg)',
        background: `linear-gradient(180deg, transparent 0%, ${withAlpha(accent, dark ? 0.2 : 0.12)} 55%, transparent 100%)`,
        opacity: interpolate(frame, [0, 18], [0, 1], CLAMP),
      }} />
      {dark && (
        <div style={{
          position: 'absolute', top: 0, bottom: 0, width: '42%', left: 0,
          transform: `translateX(${sweepX * width}px) skewX(-12deg)`,
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.07) 50%, transparent 100%)',
        }} />
      )}

      {layout === 'landscape' ? (
        <AbsoluteFill style={{ flexDirection: 'row', alignItems: 'center', padding: `${90 * u}px ${120 * u}px`, gap: 90 * u }}>
          {hero && <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center' }}>{hero}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 44 * u, justifyContent: 'center' }}>
            {brand}
            {textBlock}
          </div>
        </AbsoluteFill>
      ) : (
        // Portrait keeps the CTA above the bottom ~20% that TikTok / Reels
        // cover with captions and buttons.
        <AbsoluteFill style={{
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: layout === 'portrait' ? `${150 * u}px ${90 * u}px ${380 * u}px` : `${70 * u}px ${80 * u}px`,
          gap: (layout === 'portrait' ? 50 : 30) * u,
        }}>
          {brand}
          {hero}
          {textBlock}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  )
}
