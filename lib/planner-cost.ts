import { ugcPackageCost } from './ugc-pricing'

// What each kind of planned post costs. Videos reuse the real pricing
// function; image and carousel prices mirror their generators
// (app/api/content/generate/image: Pro 2K = 10 cr, .../carousel: 5 cr a slide).

export type PlanKind = 'video' | 'carousel' | 'image'
export type PlanQuality = 'draft' | 'full'

// Planned videos are never short: 10s or 15s today. 20s and 30s are chained
// clips and stay off the list until a real render of each has been checked.
export const PLANNER_DURATIONS = [10, 15] as const
export const IMAGE_POST_COST = 10
export const CAROUSEL_SLIDE_COST = 5
export const CAROUSEL_SLIDES = 5

export interface CostableItem {
  kind: string
  duration_s?: number | null
  quality?: string | null
  slides?: number | null
  enabled?: boolean
}

export function videoCost(durationSeconds: number, quality: PlanQuality): number {
  return ugcPackageCost(durationSeconds, '720p', quality === 'draft' ? 'seedance-mini' : 'seedance-2')
}

export function itemCost(it: CostableItem): number {
  if (it.enabled === false) return 0
  if (it.kind === 'video') return videoCost(it.duration_s ?? 15, it.quality === 'draft' ? 'draft' : 'full')
  if (it.kind === 'carousel') return (it.slides ?? CAROUSEL_SLIDES) * CAROUSEL_SLIDE_COST
  return IMAGE_POST_COST
}
