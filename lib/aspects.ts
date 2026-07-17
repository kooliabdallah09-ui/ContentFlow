// Aspect ratio definitions for the UGC pipeline. Drives:
//   - Nano Banana frame generation (aspect_ratio input)
//   - Sora 2 video size (must exactly match the reference frame)
//   - Shotstack stitch output dimensions

export type UGCAspect = 'portrait' | 'tall45' | 'square' | 'landscape'

export interface AspectConfig {
  id: UGCAspect
  label: string
  hint: string
  // Sora 2 + reference frame dimensions (must match exactly)
  soraSize: string       // 'WxH' string Sora expects
  width: number
  height: number
  // Nano Banana Pro aspect_ratio input value
  nanoBananaRatio: '9:16' | '1:1' | '16:9' | '3:4'
  // Shotstack render output dimensions
  shotstackSize: { width: number; height: number }
  cssRatio: string       // for the preview <video> aspectRatio CSS
}

export const ASPECTS: Record<UGCAspect, AspectConfig> = {
  portrait: {
    id: 'portrait',
    label: 'Portrait',
    hint: '9:16 · TikTok / Reels / Shorts',
    soraSize: '720x1280',
    width: 720,
    height: 1280,
    nanoBananaRatio: '9:16',
    shotstackSize: { width: 1080, height: 1920 },
    cssRatio: '9 / 16',
  },
  tall45: {
    id: 'tall45',
    label: 'Portrait 4:5',
    hint: '4:5 · Instagram feed posts',
    // Seedance + Nano Banana support 3:4 (closest to 4:5); export at 1080x1350.
    soraSize: '864x1080',
    width: 864,
    height: 1080,
    nanoBananaRatio: '3:4',
    shotstackSize: { width: 1080, height: 1350 },
    cssRatio: '4 / 5',
  },
  square: {
    id: 'square',
    label: 'Square',
    hint: '1:1 · Instagram feed',
    soraSize: '1024x1024',
    width: 1024,
    height: 1024,
    nanoBananaRatio: '1:1',
    shotstackSize: { width: 1080, height: 1080 },
    cssRatio: '1 / 1',
  },
  landscape: {
    id: 'landscape',
    label: 'Landscape',
    hint: '16:9 · YouTube / X / web embeds',
    soraSize: '1280x720',
    width: 1280,
    height: 720,
    nanoBananaRatio: '16:9',
    shotstackSize: { width: 1920, height: 1080 },
    cssRatio: '16 / 9',
  },
}

export const DEFAULT_ASPECT: UGCAspect = 'portrait'

export function getAspect(id?: string): AspectConfig {
  if (id && (id === 'portrait' || id === 'tall45' || id === 'square' || id === 'landscape')) {
    return ASPECTS[id]
  }
  return ASPECTS[DEFAULT_ASPECT]
}
