// Character-prompt chain for the new UGC pipeline.
//
// Two-model chain:
//   1. Haiku turns the product + freeform user direction into a "character
//      idea" one-liner (age band, vibe, niche). Example output:
//        "a mid-20s influencer who posts everyday skincare routines"
//   2. Sonnet turns that idea + optional custom persona details into a
//      full Nano Banana Pro image prompt for the hero frame — realistic,
//      shot-on-iPhone, ready to render.
//
// Both calls are fail-soft: if either errors we fall back to a plain
// template. Cheap: ~$0.02 per generation total.

import Anthropic from '@anthropic-ai/sdk'
import type { CharacterProfile } from '@/components/CharacterBuilder'

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

export interface CharacterPromptInput {
  productName: string
  productDescription: string
  productCategory?: string          // 'skincare', 'apparel', … from inferProductCategory
  videoDirection?: string           // e.g. "clean unbox", "morning routine"
  customPersona?: CharacterProfile  // optional user overrides from CharacterBuilder
  hasProductImage: boolean
}

export interface CharacterPromptOutput {
  characterIdea: string   // Haiku's one-liner (kept for save-actor metadata)
  imagePrompt: string     // Sonnet's Nano Banana Pro prompt
}

const HAIKU_SYSTEM = `You draft a single one-line "character idea" for a UGC influencer that fits a product.

Rules:
- One sentence, 15-30 words, present-tense.
- Age given as a band, never a number ("mid-20s", "late 20s", "early 30s").
- Include the niche or vibe the influencer is known for, tied to the product ("posts everyday skincare routines", "reviews budget kitchen gear", "shares dorm-room outfits").
- Neutral gender-presentation unless the user's persona overrides. Say "influencer" not "woman"/"man".
- No brand names, no invented account handles, no hashtags.
- Just the sentence — no preamble, no quotes.`

const SONNET_SYSTEM = `You are an image-prompt engineer for Nano Banana Pro. You expand a one-line character idea into a complete image prompt for a realistic AI-influencer selfie hero frame.

Rules — non-negotiable:
- Output ONE paragraph, 80-160 words. Plain prose. No lists, no headers, no fences.
- Front-camera phone selfie feel — the character is looking directly at the camera, holding the phone at arm's length.
- Environment: a believable everyday setting matching the character's niche (kitchen, bedroom, bathroom vanity, café, home office, park bench, etc.). Natural indoor daylight or golden hour outside. NO studio backdrops, NO ring lights, NO glass-skin gloss.
- Real skin texture: pores, faint imperfections, no beauty filter. Natural hair with a few flyaways. Wardrobe should be casual and specific ("cream ribbed tank top", "oversized denim shirt"), not "trendy outfit".
- If the persona has any locked-in fields (gender, age band, ethnicity, hair, unique features, wardrobe, accessories, scene, mood), respect them EXACTLY. Do not swap them.
- If a physical product is provided as a reference image, the character is holding it naturally in one hand at chest height, label angled slightly toward the camera. NEVER re-describe the product's packaging — write "the reference product" and let the image_input carry the exact appearance.
- If no physical product exists, the character is just doing a natural selfie in their environment (still hero-frame framing, chest-up, camera-facing).
- Absolute bans: cinematic film grain, anamorphic lens flare, dramatic side lighting, studio softbox, Instagram-model perfection, on-screen text, watermarks, app UI, phone bezel, timestamps.

Output ONLY the finished prompt — no preamble, no notes, no quotation marks around the whole thing.`

function personaBlock(p?: CharacterProfile): string {
  if (!p) return ''
  const parts: string[] = []
  if (p.gender)         parts.push(`gender-presentation: ${p.gender}`)
  if (p.age)            parts.push(`age band: ${p.age}`)
  if (p.ethnicity)      parts.push(`ethnicity: ${p.ethnicity}`)
  if (p.hair)           parts.push(`hair: ${p.hair}`)
  if (p.uniqueFeatures) parts.push(`unique features: ${p.uniqueFeatures}`)
  if (p.outfit)         parts.push(`wearing: ${p.outfit}`)
  if (p.accessories)    parts.push(`accessories: ${p.accessories}`)
  if (p.scene)          parts.push(`setting: ${p.scene}`)
  if (p.mood)           parts.push(`mood: ${p.mood}`)
  if (!parts.length) return ''
  return `\n\nUser persona locks (must respect exactly):\n- ${parts.join('\n- ')}`
}

export async function buildCharacterPrompt(input: CharacterPromptInput): Promise<CharacterPromptOutput> {
  const productLine = `The product is ${input.productName}${input.productDescription ? ` — ${input.productDescription.slice(0, 300)}` : ''}${input.productCategory ? ` (category: ${input.productCategory})` : ''}.`
  const directionLine = input.videoDirection?.trim()
    ? `The video direction is: "${input.videoDirection.trim().slice(0, 200)}".`
    : ''

  // Fallback used when Anthropic is unavailable.
  const fallbackIdea = `a real everyday influencer who posts about ${input.productName}`
  const fallbackImagePrompt = `Hyper-realistic phone selfie of an adult influencer, chest-up, warm natural daylight in a believable everyday setting, real skin texture with pores and small imperfections, casual specific wardrobe, looking directly at the camera at arm's length. ${input.hasProductImage ? 'Holding the reference product naturally in one hand at chest height with the label angled slightly toward the camera.' : ''} NO studio lighting, NO beauty filter, NO on-screen text, NO app UI.${personaBlock(input.customPersona)}`

  if (!anthropic) {
    return { characterIdea: fallbackIdea, imagePrompt: fallbackImagePrompt }
  }

  // Step 1 — Haiku: character idea.
  let characterIdea = fallbackIdea
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 90,
      system: HAIKU_SYSTEM,
      messages: [{
        role: 'user',
        content: `${productLine}\n${directionLine}\n\nWrite the one-line character idea.`,
      }],
    })
    const raw = (msg.content[0] as { type: 'text'; text: string }).text.trim()
    // Strip surrounding quotes just in case.
    characterIdea = raw.replace(/^["'“”]|["'“”]$/g, '').split('\n')[0].slice(0, 200) || fallbackIdea
  } catch { /* fall through with fallback */ }

  // Step 2 — Sonnet: full image prompt.
  let imagePrompt = fallbackImagePrompt
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 700,
      system: SONNET_SYSTEM,
      messages: [{
        role: 'user',
        content: `Character idea: ${characterIdea}
${productLine}
${directionLine}
Product image ${input.hasProductImage ? 'IS' : 'is NOT'} attached to Nano Banana Pro as a reference image.${personaBlock(input.customPersona)}

Write the finished Nano Banana Pro image prompt now.`,
      }],
    })
    const raw = (msg.content[0] as { type: 'text'; text: string }).text.trim()
    imagePrompt = raw
      .replace(/^```(?:\w+)?\n?/i, '')
      .replace(/\n?```$/, '')
      .replace(/^["'“”]|["'“”]$/g, '')
      .trim() || fallbackImagePrompt
  } catch { /* fall through with fallback */ }

  return { characterIdea, imagePrompt }
}
