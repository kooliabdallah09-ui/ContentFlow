// Two-person prompt chain for the UGC pipeline.
//
// Sister module to lib/ugc-character-prompt.ts. Produces a single Nano
// Banana Pro image prompt that composes TWO characters into one frame,
// with format-specific staging (street interview / couple sharing /
// roommate rec).
//
// PERSON A is always the "main" influencer (the one the user picked).
// PERSON B is either a second saved influencer (co-star mode) or an
// anonymous auto-generated stranger/friend/partner appropriate to the
// format.

import Anthropic from '@anthropic-ai/sdk'
import { getCampaignFormat } from '@/lib/campaign-formats'

// Two-person shot-direction overrides per format. Mirrors the solo
// SHOT_DIRECTIONS map in ugc-character-prompt.ts.
export const TWO_PERSON_SHOT_DIRECTIONS: Record<string, string> = {
  'interview-man-on-street':
    'OUTDOOR STREET INTERVIEW framing. PERSON A (the interviewer) stands on the LEFT side of frame holding the reference product (or a small handheld mic) toward PERSON B. PERSON B (the stranger being stopped) is on the RIGHT, mid-reaction — surprised, laughing, or curious. Real city sidewalk / pedestrian street background — storefronts, passers-by softly blurred, natural daylight. Shot on a phone, handheld feel, chest-up two-shot. Both people clearly in frame.',
  'couple-sharing':
    'INDOOR HOME LIFESTYLE two-shot. PERSON A and PERSON B are together in a warm living-room or kitchen setting — couch, throw blanket, kitchen island, morning coffee cups on the counter — cozy natural window light. One of them is offering / handing the reference product to the other, or they are looking at it together. Close physical proximity, relaxed intimate energy. Chest-up framing, both faces clearly visible, camera slightly angled like an iPhone selfie held by one of them or a friend.',
  'roommate-rec':
    'SHARED APARTMENT casual two-shot. PERSON A and PERSON B look like roommates / close friends mid-conversation — one is enthusiastically recommending the reference product to the other, who is listening with a mildly skeptical or amused expression. Casual home setting (dorm-room, small kitchen, living-room clutter — plants, mugs, a laptop on the coffee table). Both wearing loungewear / casual everyday clothes. Handheld-phone framing, both chest-up, natural indoor daylight.',
}

function twoPersonShotBlock(formatKey: string): string {
  const override = TWO_PERSON_SHOT_DIRECTIONS[formatKey]
  const fmt = getCampaignFormat(formatKey)
  const spec = fmt?.sonnetSpec ?? ''
  const parts: string[] = []
  if (override) parts.push(`Framing/composition: ${override}`)
  if (spec) parts.push(`Format intent: ${spec}`)
  if (!parts.length) return ''
  return `\n\nSHOT DIRECTION (two-person format: ${formatKey}):\n- ${parts.join('\n- ')}`
}

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

const SECOND_CHARACTER_SYSTEM = `You draft a single one-line description of a SECOND character to appear alongside a main influencer in a two-person UGC ad.

Rules:
- One sentence, 15-30 words, present-tense.
- Give age as a band ("mid-20s", "early 30s"). Neutral gender-presentation unless the format implies otherwise.
- The second character should feel DIFFERENT from the main influencer — different age band, different vibe, different hair — so the pairing reads natural, not like siblings.
- No brand names, no handles, no hashtags.
- Just the sentence — no preamble, no quotes.`

const TWO_PERSON_IMAGE_SYSTEM = `You are an image-prompt engineer for Nano Banana Pro. You expand a two-character brief into a complete image prompt for a realistic two-person UGC hero frame.

Rules — non-negotiable:
- Output ONE paragraph, 100-200 words. Plain prose. No lists, no headers, no fences.
- Two people are in the frame. Refer to them explicitly as PERSON A and PERSON B and describe each ONCE with their identity cues (age band, hair, wardrobe, expression). Do not describe the same person twice.
- Respect the SHOT DIRECTION block exactly — it dictates framing, staging, setting, and who holds the product.
- Real, individual attractive people — clear healthy even-toned skin with a natural subtle glow, LIGHT natural makeup only where relevant, barely-there real-skin micro-texture. Do NOT add moles, freckle clusters, or red patches on the nose or cheeks — those read as tacked-on AI imperfections. AVOID the plastic-glass over-smoothed AI-influencer look. Natural hair with a few flyaways.
- Wardrobe casual and specific ("cream ribbed tank top", "oversized denim shirt") not "trendy outfit". Give each person a distinct outfit.
- If a physical product is provided as a reference image, one of the two people is holding it naturally — chest height, label angled slightly toward the camera. NEVER re-describe the product's packaging — write "the reference product" and let the image_input carry the exact appearance.
- Absolute bans: cinematic film grain, anamorphic lens flare, studio softbox lighting, Instagram-model perfection, on-screen text, watermarks, app UI, phone bezel, timestamps.

Output ONLY the finished prompt — no preamble, no notes, no quotation marks around the whole thing.`

export interface TwoPersonPromptInput {
  productName: string
  productDescription: string
  hasProductImage: boolean
  videoDirection?: string
  formatKey: string                    // one of the two-person format keys
  personADescription: string           // main influencer, from their character_idea / handle / niche
  personBDescription?: string          // second saved influencer if picked; else auto-drafted
  requiredScene?: string               // optional scene override
}

export interface TwoPersonPromptOutput {
  characterIdeaA: string
  characterIdeaB: string
  imagePrompt: string
}

export async function draftSecondCharacter(input: {
  productName: string
  productDescription: string
  formatKey: string
  personADescription: string
  videoDirection?: string
}): Promise<string> {
  const fallback = input.formatKey === 'interview-man-on-street'
    ? 'a mid-30s passer-by in casual weekend clothes, mildly amused expression'
    : input.formatKey === 'couple-sharing'
      ? 'a late-20s partner in a cozy oversized sweater, warm relaxed energy'
      : 'a mid-20s roommate in loungewear, easygoing skeptical vibe'

  if (!anthropic) return fallback

  const roleHint = input.formatKey === 'interview-man-on-street'
    ? 'a random stranger being stopped on the street for an interview'
    : input.formatKey === 'couple-sharing'
      ? 'a romantic partner at home'
      : 'a close friend / roommate at home'

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      system: SECOND_CHARACTER_SYSTEM,
      messages: [{
        role: 'user',
        content: `Main character (PERSON A) is: ${input.personADescription}.
The second character (PERSON B) plays the role of ${roleHint} in a UGC ad for ${input.productName}${input.productDescription ? ` — ${input.productDescription.slice(0, 200)}` : ''}.${input.videoDirection ? `\nVideo direction: ${input.videoDirection.slice(0, 200)}` : ''}

Write the one-line description of PERSON B. Make them feel visibly different from PERSON A (different age band, different vibe).`,
      }],
    })
    const raw = (msg.content[0] as { type: 'text'; text: string }).text.trim()
    return raw.replace(/^["'“”]|["'“”]$/g, '').split('\n')[0].slice(0, 200) || fallback
  } catch {
    return fallback
  }
}

export async function buildTwoPersonPrompt(input: TwoPersonPromptInput): Promise<TwoPersonPromptOutput> {
  const productLine = `The product is ${input.productName}${input.productDescription ? ` — ${input.productDescription.slice(0, 300)}` : ''}.`
  const directionLine = input.videoDirection?.trim()
    ? `The video direction is: "${input.videoDirection.trim().slice(0, 200)}".`
    : ''

  const personB = input.personBDescription
    ?? await draftSecondCharacter({
      productName: input.productName,
      productDescription: input.productDescription,
      formatKey: input.formatKey,
      personADescription: input.personADescription,
      videoDirection: input.videoDirection,
    })

  const fallbackPrompt = `Hyper-realistic phone photo of two people in one frame. PERSON A is ${input.personADescription}. PERSON B is ${personB}. Both real, attractive, clear healthy even-toned skin with subtle natural glow, natural hair, casual specific wardrobe. Handheld two-shot, natural daylight, chest-up framing, both faces clearly visible. ${input.hasProductImage ? 'One of them is holding the reference product naturally at chest height, label angled slightly toward the camera.' : ''} No studio lighting, no on-screen text, no phone bezel.${input.requiredScene ? ` Scene: ${input.requiredScene}.` : ''}`

  if (!anthropic) {
    return { characterIdeaA: input.personADescription, characterIdeaB: personB, imagePrompt: fallbackPrompt }
  }

  let imagePrompt = fallbackPrompt
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 900,
      system: TWO_PERSON_IMAGE_SYSTEM,
      messages: [{
        role: 'user',
        content: `PERSON A (main influencer): ${input.personADescription}
PERSON B (${input.personBDescription ? 'co-star, second saved influencer' : 'auto-generated'}): ${personB}
${productLine}
${directionLine}
Product image ${input.hasProductImage ? 'IS' : 'is NOT'} attached as a reference image.${twoPersonShotBlock(input.formatKey)}${input.requiredScene ? `\n\nSCENE OVERRIDE — CRITICAL: the scene MUST be: ${input.requiredScene}. Ignore any location implied by reference photos — keep ONLY faces / hair / identity from them.` : ''}

Write the finished Nano Banana Pro image prompt now.`,
      }],
    })
    const raw = (msg.content[0] as { type: 'text'; text: string }).text.trim()
    imagePrompt = raw
      .replace(/^```(?:\w+)?\n?/i, '')
      .replace(/\n?```$/, '')
      .replace(/^["'“”]|["'“”]$/g, '')
      .trim() || fallbackPrompt
  } catch { /* fall through */ }

  return { characterIdeaA: input.personADescription, characterIdeaB: personB, imagePrompt }
}
