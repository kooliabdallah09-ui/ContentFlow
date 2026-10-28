// The planner's marketing playbook, v1. Versioned in the repo so it can be
// reviewed and changed like code. It states rules of thumb, not statistics:
// nothing here claims a number about how posts perform. Posting times are
// starting points to test, and the weekly "winner" marks are how the plan
// learns what works for each store.
//
// Sources of the ideas: TikTok's own creative guidance (hook in the first
// seconds, plain user-made look, test one thing at a time) and practitioner
// advice to copy formats that already work instead of inventing topics.

export const PLAYBOOK_VERSION = 1

export type Stage = 'attention' | 'trust' | 'sale'
export type Kind = 'video' | 'carousel' | 'image'

export interface PlanFormat {
  label: string
  kind: Kind
  // The structure to copy, in one line. Shown to the model, not invented per post.
  skeleton: string
}

// A format is the shape of the post. It matters more than the topic.
export const PLAN_FORMATS: PlanFormat[] = [
  { label: 'Before & after', kind: 'video', skeleton: 'Open on the problem state, cut to the product, end on the changed state.' },
  { label: 'Reaction', kind: 'video', skeleton: 'Creator reacts to something surprising about the product, in real time.' },
  { label: 'Challenge', kind: 'video', skeleton: 'Set a small challenge with a clear time frame, show the first step.' },
  { label: 'Day in the life', kind: 'video', skeleton: 'Follow one moment of the day where the product quietly fits in.' },
  { label: 'Walk-up question', kind: 'video', skeleton: 'Creator asks a stranger or friend one curious question about the product.' },
  { label: 'Comparison', kind: 'carousel', skeleton: 'Slide 1 poses the choice, middle slides compare side by side, last slide gives the verdict.' },
  { label: 'Myth vs fact', kind: 'carousel', skeleton: 'Each slide states a common belief about the category, then corrects it with what the product info supports.' },
  { label: 'Step by step', kind: 'carousel', skeleton: 'A short how-to where the product is one of the steps.' },
  { label: 'Product moment', kind: 'image', skeleton: 'One clean photo of the product in a real setting, one line of caption.' },
  { label: 'Behind the scenes', kind: 'image', skeleton: 'A candid photo of how it is made, packed or chosen.' },
]

export const formatsFor = (kind: Kind) => PLAN_FORMATS.filter(f => f.kind === kind).map(f => f.label)

// Post stages: attention posts get noticed, trust posts earn belief, sale posts
// ask for the order. Every week has all three, with at least one sale post.
const STAGE_SEQ: Record<number, Stage[]> = {
  1: ['sale'],
  2: ['attention', 'sale'],
  3: ['attention', 'trust', 'sale'],
  4: ['attention', 'trust', 'attention', 'sale'],
  5: ['attention', 'trust', 'attention', 'sale', 'trust'],
  6: ['attention', 'trust', 'attention', 'trust', 'sale', 'attention'],
  7: ['attention', 'trust', 'attention', 'sale', 'trust', 'attention', 'sale'],
}

// Which weekdays to post on (0 = Monday), spread through the week.
const DAY_SEQ: Record<number, number[]> = {
  1: [3],
  2: [1, 4],
  3: [0, 2, 4],
  4: [0, 2, 4, 5],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
}

// Starting points to test. Not a claim about when audiences are online.
const TIMES = ['18:00', '12:30', '19:00', '18:00', '10:00', '12:30', '18:30']

// Planned videos are 10s or 15s so there is room for a short story, not just a hook.
const VIDEO_DURATIONS = [15, 10, 15, 10]

export interface Slot {
  position: number
  dayOffset: number
  time: string
  stage: Stage
  kind: Kind
  platform: string
  durationSeconds?: number
  slides?: number
}

export const PLAN_PLATFORMS = ['TikTok', 'Instagram'] as const

// The plan's skeleton is decided here, deterministically, so every week is
// balanced. The model only writes the creative for each slot.
export function buildSlots(postsPerWeek: number, platforms: string[]): Slot[] {
  const n = Math.min(Math.max(Math.round(postsPerWeek) || 5, 1), 7)
  const stages = STAGE_SEQ[n]
  const days = DAY_SEQ[n]
  const wantTikTok = platforms.includes('TikTok') || !platforms.includes('Instagram')
  const wantInsta = platforms.includes('Instagram')
  let videoNo = 0
  let trustNo = 0
  return stages.map((stage, i) => {
    const kind: Kind = stage === 'trust' ? (trustNo++ % 2 === 0 ? 'carousel' : 'image') : 'video'
    let platform: string
    if (kind === 'video') {
      // Alternate platforms when both are picked.
      platform = wantTikTok && wantInsta ? (videoNo % 2 === 0 ? 'TikTok' : 'Instagram Reels') : wantInsta ? 'Instagram Reels' : 'TikTok'
    } else {
      platform = wantInsta ? 'Instagram' : 'TikTok'
    }
    const slot: Slot = { position: i, dayOffset: days[i], time: TIMES[i % TIMES.length], stage, kind, platform }
    if (kind === 'video') slot.durationSeconds = VIDEO_DURATIONS[videoNo++ % VIDEO_DURATIONS.length]
    if (kind === 'carousel') slot.slides = 5
    return slot
  })
}

export const GOALS = ['sales', 'awareness', 'launch'] as const
export type Goal = typeof GOALS[number]

export const GOAL_NOTES: Record<Goal, string> = {
  sales: 'Lean on proof and clear reasons to buy. The sale post should have a direct, low-pressure ask.',
  awareness: 'Lean on curiosity and entertainment. The sale post can be a soft invitation to look.',
  launch: 'Treat the product as new. Lead with what it is and why it exists, and make the sale post about getting it first.',
}

export const STAGE_BRIEF: Record<Stage, string> = {
  attention: 'Stop the scroll with curiosity or surprise. No selling yet.',
  trust: 'Earn belief: show how it works, compare, or answer a doubt.',
  sale: 'Ask for the order. One clear reason to act now that the product info supports. Never invent offers or discounts.',
}

export const MONDAY = (from = new Date()): string => {
  // The next Monday on or after today, as YYYY-MM-DD (local date).
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const add = (8 - d.getDay()) % 7
  d.setDate(d.getDate() + add)
  const pad = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
