// What the mobile "Create" sheet and the mobile home screen offer, with
// prices taken from the same constants the generators charge from, so the
// labels can't drift again (they used to say 40 cr for a UGC ad).

import { CREDIT_COSTS } from './planConfig'
import { TIER_DURATION_CREDITS, DURATION_OPTIONS } from './tiers'

// Charged by /api/campaigns/plan.
export const CAMPAIGN_PLAN_CREDITS = 5

// Cheapest Seedance video on /generate/video: Mini at 480p, per second.
// Keep in step with SEEDANCE_MINI_CR_PER_SECOND there.
const VIDEO_FROM_CR_PER_SECOND = 3

export type CreateIcon = 'Video' | 'Image' | 'Social' | 'Voice' | 'Monitor' | 'Calendar'

export type CreateOption = {
  href: string
  label: string
  sub: string
  cost: string
  icon: CreateIcon
  tint: string
}

const ugcFrom = Math.min(...DURATION_OPTIONS.map(d => TIER_DURATION_CREDITS.standard[d]))

export const CREATE_OPTIONS: CreateOption[] = [
  { href: '/generate/ugc',    label: 'UGC Package', sub: 'Full talking-head ad',      cost: `from ${ugcFrom} cr`,                  icon: 'Video',    tint: '#F1E6C9' },
  { href: '/generate/image',  label: 'Image',       sub: 'Product & creative shots',  cost: `from ${CREDIT_COSTS.image} cr`,       icon: 'Image',    tint: '#E8EDE4' },
  { href: '/generate/social', label: 'Social post', sub: 'Caption + optional visual', cost: `from ${CREDIT_COSTS.social} cr`,      icon: 'Social',   tint: '#F0EDE3' },
  { href: '/generate/voice',  label: 'Voiceover',   sub: 'Script to studio audio',    cost: `from ${CREDIT_COSTS.voice} cr`,       icon: 'Voice',    tint: '#F0E7E4' },
  { href: '/generate/video',  label: 'Video',       sub: 'Any format, per second',    cost: `from ${VIDEO_FROM_CR_PER_SECOND} cr/s`, icon: 'Monitor',  tint: '#E8EDE4' },
  { href: '/campaigns',       label: 'Campaign',    sub: 'A month, planned',          cost: `${CAMPAIGN_PLAN_CREDITS} cr to plan`, icon: 'Calendar', tint: '#EDEAE0' },
]
