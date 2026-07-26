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
import { getCampaignFormat } from '@/lib/campaign-formats'

// Hard-coded shot-direction overrides per solo format. Sonnet writes the
// image prompt around this framing instead of defaulting to a generic
// chest-up selfie. Formats not listed here fall back to the default
// medium talking-head selfie framing.
const SHOT_DIRECTIONS: Record<string, string> = {
  'camera-pov':          'FIRST-PERSON POV shot. Only the character\'s HANDS and forearms are visible entering frame from the bottom or side. NO face, NO selfie. Camera is at eye level looking out at the world/product from the character\'s viewpoint. The setting drives the composition.',
  'pov-vlog':            'POV-vlog framing. Camera held out slightly overhead by the character, capturing them casually in the shot from a friendly POV angle — they are engaged with the product/environment, not posing. Setting is clearly visible.',
  'get-ready-with-me':   'Bathroom mirror or vanity framing — the character is captured in a mirror doing a morning / getting-ready routine (skincare, hair, makeup, coffee). Product sits naturally on the counter or is being picked up. Warm morning light. Bathroom or vanity tiles/decor visible.',
  'selfie-testimonial':  'Arm\'s-length front-camera phone selfie, slightly-tilted amateur phone-camera perspective (very slight upward or side tilt, not perfectly level). The character\'s arm holding the phone can be subtly implied at the edge. Feels unscripted and casual, like they hit record mid-thought.',
  'hot-take':            'TIGHT close-up talking-head, framed shoulders-up or chin-up. Character stares directly into the camera with a slightly annoyed / incredulous expression — eyebrows raised or slight scoff. High engagement, confrontational energy.',
  'before-after':        'This is the BEFORE half of a transformation. Show the PROBLEM STATE clearly — messy hair, dull skin, cluttered space, tired expression, un-styled outfit, whatever "before" means for this product category. Product NOT yet visible or off to the side unused. Lighting flatter, less flattering.',
  'mess-to-fresh':       'Messy start state — clear visual chaos relevant to the product (cluttered kitchen counter, dirty surface, tangled hair, unmade bed, etc.). Character in the middle of the mess, product visible and about to be used.',
  'unboxing':            'Product is still IN its package / sealed box, held by the character at chest height. Character has anticipatory / excited expression, about to open it. Package label clearly visible.',
  'tv-spot':             'Cinematic WIDER shot, not a phone selfie. Considered composition — the character is IN a specific meaningful setting (kitchen, living room, café, outdoors) with intentional lighting. Ad-polish look but still authentic and human. Chest-up or waist-up framing.',
  'tutorial':            'Step-1 setup framing — materials and product laid out on a clean surface (counter, desk, table), viewed slightly from above or straight-on. Character\'s hands or upper body visible getting ready to begin. Instructional / organized energy.',
  'things-i-wish-i-knew': 'Medium selfie framing. Character is mid-gesture COUNTING on fingers or holding up a finger to indicate a list point ("one thing…"). Direct-to-camera, list-teaching energy.',
  'secret-hack-reveal':  'Medium shot, product held prominently at chest height in one hand. Character\'s posture and expression suggest they are ABOUT to reveal something — slightly leaning in, knowing smile or raised brow, "wait for it" energy.',
}

function shotDirectionBlock(formatKey?: string, formatSpec?: string): string {
  if (!formatKey) return ''
  const override = SHOT_DIRECTIONS[formatKey]
  const fmt = getCampaignFormat(formatKey)
  const spec = formatSpec || fmt?.sonnetSpec || ''
  if (!override && !spec) return ''
  const parts: string[] = []
  if (override) parts.push(`Framing/composition override for this format: ${override}`)
  if (spec)     parts.push(`Format intent: ${spec}`)
  return `\n\nSHOT DIRECTION (format: ${formatKey}) — this OVERRIDES the default "chest-up front-camera selfie" framing:\n- ${parts.join('\n- ')}`
}

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
  formatKey?: string                // campaign format key (e.g. 'camera-pov', 'get-ready-with-me')
  formatSpec?: string               // format's sonnetSpec — optional override for lookup
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
- Default framing is a front-camera phone selfie feel — the character is looking directly at the camera, holding the phone at arm's length. HOWEVER: if the user message contains a "SHOT DIRECTION" block, that framing/composition OVERRIDES this default entirely (e.g. hands-only POV, mirror shot, close-up, cinematic wider shot, before-state, etc.). Respect the override exactly.
- Environment: a believable everyday setting matching the character's niche (kitchen, bedroom, bathroom vanity, café, home office, park bench, etc.). Natural indoor daylight or golden hour outside. NO studio backdrops, NO ring lights, NO glass-skin gloss.
- Real, individual attractive person — clear healthy even-toned skin with a natural subtle glow, LIGHT natural makeup (mascara, subtle blush, tinted lip). Barely-there real-skin micro-texture only. Do NOT add moles, freckle clusters, or red patches on the nose or cheeks — those read as tacked-on AI imperfections. Individuality comes from bone structure and slight asymmetries. Also AVOID the plastic-glass over-smoothed AI-influencer look. Natural hair with a few flyaways. Wardrobe should be casual and specific ("cream ribbed tank top", "oversized denim shirt"), not "trendy outfit".
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
  const fallbackImagePrompt = `Hyper-realistic phone selfie of a real attractive adult UGC creator (clear healthy even skin with a natural subtle glow, LIGHT natural makeup, barely-there real-skin micro-texture, no added moles or freckle clusters, NOT the plastic AI-influencer look), chest-up, warm natural daylight in a believable everyday setting, casual specific wardrobe, looking directly at the camera at arm's length. ${input.hasProductImage ? 'Holding the reference product naturally in one hand at chest height with the label angled slightly toward the camera.' : ''} NO studio lighting, NO beauty filter over-processing, NO on-screen text, NO app UI.${personaBlock(input.customPersona)}`

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
Product image ${input.hasProductImage ? 'IS' : 'is NOT'} attached to Nano Banana Pro as a reference image.${personaBlock(input.customPersona)}${shotDirectionBlock(input.formatKey, input.formatSpec)}

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
