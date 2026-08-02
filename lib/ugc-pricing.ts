// Single source of truth for UGC package pricing.
// Shared between UGCPackageBuilder (client) and the animate API route (server).
//
// Pricing: 1.4× markup on (Seedance raw $/s × duration) + NB Pro + Claude overhead.
// 1 credit = $0.025 USD.
//
// Seedance 2.0 BytePlus token pricing:
//   tokens = duration × W × H × fps / 1024
//   unit price per resolution: 720p $7.00/M · 1080p $7.70/M · 4K $4.00/M · 480p est.$5.50/M

export type UGCResolution = '480p' | '720p' | '1080p' | '4k'
export type UGCEngine = 'seedance-2' | 'seedance-mini' | 'omni-flash'

const MARKUP    = 1.4
const NB_PRO    = 0.075  // one reference frame per video
const CLAUDE    = 0.010  // script + prompt calls
const CR_VALUE  = 0.025  // 1 credit = $0.025 USD

// Raw Seedance 2.0 cost per second at portrait 9:16 (actual BytePlus rates)
const SEEDANCE_RAW_PER_S: Record<UGCResolution, number> = {
  '480p':  (480  * 854   * 24) / 1024 / 1_000_000 * 5.5,  // ~$0.0529/s (est. $5.50/M)
  '720p':  (720  * 1280  * 24) / 1024 / 1_000_000 * 7.0,  //  $0.1512/s ($7.00/M)
  '1080p': (1080 * 1920  * 24) / 1024 / 1_000_000 * 7.7,  //  $0.3742/s ($7.70/M)
  '4k':    (2160 * 3840  * 24) / 1024 / 1_000_000 * 4.0,  //  $0.7776/s ($4.00/M)
}

// Seedance Mini: roughly half the token rate of Seedance 2.0, capped at 720p.
const SEEDANCE_MINI_RAW_PER_S: Record<'480p' | '720p', number> = {
  '480p': SEEDANCE_RAW_PER_S['480p'] / 2,  // ~$0.026/s
  '720p': SEEDANCE_RAW_PER_S['720p'] / 2,  // ~$0.076/s
}

// Veo 3.1 Fast on Vertex — admin-only. Google public rate × 1.4 markup.
const OMNI_FLASH_RAW_PER_S: Record<'720p' | '1080p', number> = {
  '720p':  0.40,  // $0.40/s Google Vertex Veo 3.1 Fast
  '1080p': 0.65,
}

// Derived cr/s table (for display in the resolution picker)
export const SEEDANCE_CR_PER_SECOND: Record<UGCResolution, number> = {
  '480p':  Math.ceil(SEEDANCE_RAW_PER_S['480p']  * MARKUP / CR_VALUE),  // ~3 cr/s
  '720p':  Math.ceil(SEEDANCE_RAW_PER_S['720p']  * MARKUP / CR_VALUE),  // ~9 cr/s
  '1080p': Math.ceil(SEEDANCE_RAW_PER_S['1080p'] * MARKUP / CR_VALUE),  // ~21 cr/s
  '4k':    Math.ceil(SEEDANCE_RAW_PER_S['4k']    * MARKUP / CR_VALUE),  // ~44 cr/s
}

export const SEEDANCE_MINI_CR_PER_SECOND: Record<'480p' | '720p', number> = {
  '480p': Math.ceil(SEEDANCE_MINI_RAW_PER_S['480p'] * MARKUP / CR_VALUE),  // ~2 cr/s
  '720p': Math.ceil(SEEDANCE_MINI_RAW_PER_S['720p'] * MARKUP / CR_VALUE),  // ~5 cr/s
}

export function ugcPackageCost(
  durationSeconds: number,
  resolution: UGCResolution,
  engine: UGCEngine = 'seedance-2',
): number {
  let rawPerS: number

  if (engine === 'seedance-mini') {
    const res = resolution === '480p' ? '480p' : '720p'
    rawPerS = SEEDANCE_MINI_RAW_PER_S[res]
  } else if (engine === 'omni-flash') {
    const res = resolution === '1080p' ? '1080p' : '720p'
    rawPerS = OMNI_FLASH_RAW_PER_S[res]
  } else {
    rawPerS = SEEDANCE_RAW_PER_S[resolution] ?? SEEDANCE_RAW_PER_S['1080p']
  }

  const totalUSD = (rawPerS * durationSeconds + NB_PRO + CLAUDE) * MARKUP
  return Math.ceil(totalUSD / CR_VALUE)
}
