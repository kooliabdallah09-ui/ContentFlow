// Multi-shot UGC planner.
//
// The UGC pipeline can render one anchor talking-head clip (Kling v3 omni
// with native voice) and cut to N short silent b-roll cutaways (Seedance
// 2.0 image-to-video, 720p, ~2s each) on top of a continuous audio track.
// This module owns the "how many cuts and where" logic, plus the per-slot
// Nano Banana + Seedance prompts.
//
// Prompts are PRODUCT-CATEGORY aware. A "usage" cutaway for skincare is
// the same actor applying serum in a bathroom mirror with the phone
// propped on the counter; a "usage" cutaway for a drink is the same actor
// taking a sip at a kitchen counter. Character comes from image_input
// (the refined anchor frame), so we always instruct "same person as
// Image 1" — never re-describe them.
//
// Cadence chosen for real UGC feel:
//   <10s anchor  → 0 cutaways (too short for a cut to feel intentional)
//   10-14s       → 2 cutaways
//   15-24s       → 3 cutaways
//   25s+         → 4 cutaways
// Each cutaway is 2 seconds and is centred in an evenly-spaced slot within
// the anchor's middle (leaves 1s intro + 1s outro of the anchor visible).

export type CutawaySlot = 'apply' | 'hero' | 'reaction' | 'usage'

export interface CutawayPlan {
  count: number
  cutawayDuration: number      // seconds
  positions: number[]          // start offset within the anchor (seconds)
  slots: CutawaySlot[]
}

const CUTAWAY_DURATION = 2

export function planCutaways(anchorDurationSeconds: number): CutawayPlan {
  let count = 0
  if (anchorDurationSeconds >= 25) count = 4
  else if (anchorDurationSeconds >= 15) count = 3
  else if (anchorDurationSeconds >= 10) count = 2

  if (count === 0) {
    return { count: 0, cutawayDuration: CUTAWAY_DURATION, positions: [], slots: [] }
  }

  // Progression tells a mini-story: they show the product, apply it,
  // react to the result, then a wider usage beat.
  const order: CutawaySlot[] = ['hero', 'apply', 'reaction', 'usage']
  const slots = order.slice(0, count)

  // Evenly space cutaways in the middle (anchor visible 1s at start + 1s at
  // end, plus the gaps between cutaways).
  const usable = Math.max(CUTAWAY_DURATION * count, anchorDurationSeconds - 2)
  const spacing = usable / count
  const positions: number[] = []
  for (let i = 0; i < count; i++) {
    const centre = 1 + spacing * (i + 0.5)
    positions.push(Math.max(1, Math.min(anchorDurationSeconds - CUTAWAY_DURATION - 1, centre - CUTAWAY_DURATION / 2)))
  }
  return { count, cutawayDuration: CUTAWAY_DURATION, positions, slots }
}

// Category of the product being advertised. Drives the specific action,
// surface, and camera angle used in each b-roll cutaway. Inferred once
// per generation via inferProductCategory() below.
export type ProductCategory =
  | 'skincare'   // serums, moisturizers, mists, cleansers, toners
  | 'makeup'     // foundation, lipstick, mascara, palettes
  | 'haircare'   // shampoo, oil, styling cream
  | 'food'       // snacks, packaged food, ready meals
  | 'drink'      // coffee, tea, protein shake, water, soda
  | 'supplement' // vitamins, gummies, powders
  | 'apparel'    // t-shirt, hoodie, jacket, accessories worn on the upper body
  | 'footwear'   // sneakers, boots, sandals, cleats
  | 'gadget'     // physical hardware — headphones, gadgets, home gym
  | 'other'

// Ask Claude Haiku to place the product in one of the above buckets.
// Fail-soft: on any error we return 'other' and cutaway prompts fall back
// to their generic phrasing.
export async function inferProductCategory(input: {
  productName: string
  productDescription?: string
  productType?: string
}): Promise<ProductCategory> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return 'other'
  try {
    const anthropic = new Anthropic({ apiKey: key })
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 20,
      messages: [{
        role: 'user',
        content: `Categorise this PHYSICAL product into ONE of these tokens (return the token only, lowercase, nothing else):
skincare | makeup | haircare | food | drink | supplement | apparel | footwear | gadget | other

Use "footwear" for anything worn on the feet (sneakers, boots, sandals, cleats).
Use "apparel" for anything else worn on the body (t-shirts, hoodies, jackets, hats, jewelry).
The UGC pipeline is for physical products only — never software or apps.

Product: ${input.productName}
Type: ${input.productType ?? ''}
Description: ${(input.productDescription ?? '').slice(0, 400)}`,
      }],
    })
    const raw = (msg.content[0] as { type: 'text'; text: string }).text.trim().toLowerCase()
    const allowed: ProductCategory[] = ['skincare','makeup','haircare','food','drink','supplement','apparel','footwear','gadget','other']
    return (allowed as string[]).includes(raw) ? (raw as ProductCategory) : 'other'
  } catch { return 'other' }
}

// Per-category × per-slot framing details. Each entry describes:
//   surface: where the product / action sits (bathroom counter, kitchen bar, etc.)
//   action:  what the character does with the product
//   angle:   the camera setup (mirror + phone propped, front handheld, macro etc.)
//   framing: MCU / CU / MS / macro / WS
// These are prompted into Nano Banana with 'same person as Image 1' guardrails
// so the character stays identical to the anchor talking-head.
interface SlotDetail {
  surface: string
  action: string
  angle: string
  framing: string
}

const CATEGORY_SLOTS: Record<ProductCategory, Record<CutawaySlot, SlotDetail>> = {
  skincare: {
    hero:     { surface: 'the bathroom counter next to a cotton pad and a small towel', action: 'the product sitting undisturbed, cap on, label facing camera', angle: 'macro side-lit, shallow depth of field on the label, background soft-blurred', framing: 'macro ECU' },
    apply:    { surface: 'a bathroom mirror above the sink, phone visibly propped on the counter recording', action: 'the same person applies the product to their face — dispenses onto fingertips, presses / pats onto cheeks and forehead', angle: 'the camera is the propped phone; we see them in the mirror front-on, phone silhouette faintly in-frame at the bottom, natural bathroom light', framing: 'MS through the mirror' },
    reaction: { surface: 'same bathroom mirror', action: 'same person examines their skin in the mirror, subtle satisfied breath, mouth-corner lift', angle: 'mirror shot, same phone-propped setup, close on the face', framing: 'MCU through the mirror' },
    usage:    { surface: 'bathroom or vanity counter with a couple of skincare bottles nearby', action: 'same person is mid-routine — patting product in with fingertips, small circular motions', angle: 'handheld phone-camera front view, waist-up, natural light from the side', framing: 'MS' },
  },
  makeup: {
    hero:     { surface: 'a small vanity or dresser with a brush and open compact', action: 'product on the surface, cap or lid off, label sharp', angle: 'macro side-lit, brush blurred in foreground', framing: 'macro ECU' },
    apply:    { surface: 'a lit vanity mirror, phone propped in a small tripod on the vanity', action: 'same person applies the product — dabbing / brushing / gliding onto face', angle: 'mirror shot, we see them front-on, phone visible faintly, warm vanity light', framing: 'MS through the mirror' },
    reaction: { surface: 'same vanity mirror', action: 'same person turns their head slightly, subtle smile, small nod at the reflection', angle: 'mirror shot, phone-propped', framing: 'MCU through the mirror' },
    usage:    { surface: 'vanity with makeup laid out', action: 'same person doing a small touch-up, product in one hand', angle: 'handheld phone-camera front view, waist-up', framing: 'MS' },
  },
  haircare: {
    hero:     { surface: 'a bathroom counter with a folded towel', action: 'the bottle upright, damp hair strand in soft focus behind it', angle: 'macro, warm bathroom light, label sharp', framing: 'macro ECU' },
    apply:    { surface: 'a bathroom mirror above the sink, phone propped on the counter', action: 'same person works product into damp hair with both hands', angle: 'mirror shot, phone-propped, we see them front-on', framing: 'MS through the mirror' },
    reaction: { surface: 'same bathroom mirror', action: 'same person tosses hair back gently, subtle satisfied smile', angle: 'mirror shot, phone-propped, close on the face', framing: 'MCU through the mirror' },
    usage:    { surface: 'bathroom or bedroom', action: 'same person combing through / styling hair', angle: 'handheld phone-camera, waist-up, natural light', framing: 'MS' },
  },
  food: {
    hero:     { surface: 'a wooden board or ceramic plate on a kitchen counter, small garnish nearby', action: 'the product sitting plated, packaging next to it, label visible', angle: 'top-down 45° macro with soft window light', framing: 'macro CU' },
    apply:    { surface: 'kitchen counter, plate and utensil ready', action: 'same person opens the packaging / plates the food / picks up a piece', angle: 'over-the-shoulder or handheld phone view of the hands and food', framing: 'MS OTS' },
    reaction: { surface: 'kitchen table', action: 'same person takes a small bite, small satisfied nod, quick lip-press', angle: 'handheld phone camera front-on at eating height', framing: 'MCU' },
    usage:    { surface: 'kitchen or living room', action: 'same person seated, eating naturally, product visible on the table', angle: 'handheld phone camera waist-up', framing: 'MS' },
  },
  drink: {
    hero:     { surface: 'a kitchen counter or wooden coaster, condensation visible', action: 'the bottle / can / cup upright, label sharp, small drop rolling down', angle: 'macro side-lit, backlit haze', framing: 'macro CU' },
    apply:    { surface: 'kitchen counter next to a glass or mug', action: 'same person pours / cracks open / stirs the drink', angle: 'hands-and-drink front handheld phone view', framing: 'MS' },
    reaction: { surface: 'kitchen or couch', action: 'same person takes a small sip, exhales softly, subtle smile', angle: 'handheld phone camera front-on', framing: 'MCU' },
    usage:    { surface: 'kitchen, desk, or living-room', action: 'same person drinking naturally, holding the drink loosely', angle: 'handheld phone camera waist-up', framing: 'MS' },
  },
  supplement: {
    hero:     { surface: 'a kitchen counter with a glass of water', action: 'bottle upright, a couple of pills / gummies / a scoop next to it', angle: 'macro side-lit, label sharp', framing: 'macro CU' },
    apply:    { surface: 'kitchen counter, glass of water ready', action: 'same person takes the pill / gummy / mixes the powder', angle: 'handheld phone camera front-on, waist-up', framing: 'MS' },
    reaction: { surface: 'kitchen', action: 'same person swallows, small satisfied breath, quick nod', angle: 'handheld phone camera front-on', framing: 'MCU' },
    usage:    { surface: 'kitchen or bathroom', action: 'same person adding the routine into their morning — pouring water, taking the supplement, small casual movements', angle: 'handheld phone camera waist-up', framing: 'MS' },
  },
  apparel: {
    hero:     { surface: 'a wooden hanger against a plain wall or laid flat on a bed', action: 'the garment shown from the front, tag / label visible', angle: 'flat-lay top-down or hanger front-on, soft natural light', framing: 'macro CU on the fabric detail' },
    apply:    { surface: 'a full-length mirror in a bedroom, phone propped on a dresser', action: 'same person slipping it on / adjusting the fit', angle: 'mirror shot, phone-propped, we see them front-on', framing: 'WS through the mirror' },
    reaction: { surface: 'same full-length mirror', action: 'same person adjusts collar / turns to check fit, subtle satisfied smile', angle: 'mirror shot, phone-propped', framing: 'MS through the mirror' },
    usage:    { surface: 'bedroom, street, or coffee shop', action: 'same person wearing the item naturally, small casual movement (walking / sitting / adjusting a sleeve)', angle: 'handheld phone camera front-on or side, waist-up', framing: 'MS' },
  },
  footwear: {
    hero:     { surface: 'a light wooden floor or a clean entryway mat next to a folded pair of socks', action: 'the sneakers placed side-profile with laces neat, one shoe slightly angled toward camera to show the branding and silhouette', angle: 'macro from a low three-quarter angle, soft natural light coming in from a window, brand mark and lace treatment sharp', framing: 'macro CU on the side profile' },
    apply:    { surface: 'the edge of a bed or a low bench near a doorway', action: 'same person seated, hands lacing them up and pulling the tongue straight, foot resting on the opposite knee then set down', angle: 'phone-camera looking DOWN at the feet from the person\'s perspective — a natural first-person tie-up POV', framing: 'CU on hands + feet + shoes' },
    reaction: { surface: 'a full-length mirror in the entryway or bedroom, phone propped on a nearby shelf', action: 'same person stands up, small ankle turn to check the profile, subtle satisfied nod', angle: 'mirror shot from the phone-propped position, we see them front-on head-to-toe', framing: 'WS through the mirror' },
    usage:    { surface: 'a sidewalk, gym floor, café entrance, or apartment hallway', action: 'same person walks naturally, sneakers taking every step — this is a stride shot', angle: 'handheld phone-camera at knee height following the feet, waist-DOWN framing, sneakers front-and-centre for the whole clip', framing: 'MS waist-down / feet-forward' },
  },
  gadget: {
    hero:     { surface: 'a desk or side table with a soft mat', action: 'the gadget sitting upright / plugged in, small LED glow if applicable, label / logo visible', angle: 'macro side-lit, product-forward, background soft-blurred', framing: 'macro CU' },
    apply:    { surface: 'a desk / kitchen counter', action: 'same person turns it on / picks it up / uses the primary function', angle: 'over-the-shoulder or handheld phone view, hands and gadget in-frame', framing: 'MS OTS' },
    reaction: { surface: 'same setting', action: 'same person nods, subtle smile, quiet exhale as the gadget does its thing', angle: 'handheld phone camera front-on', framing: 'MCU' },
    usage:    { surface: 'natural setting for the gadget (desk, living room, gym)', action: 'same person using it in-context, product visible in-hand', angle: 'handheld phone camera waist-up', framing: 'MS' },
  },
  other: {
    hero:     { surface: 'a matching surface for the product', action: 'product sitting undisturbed, label sharp', angle: 'macro side-lit, background soft-blurred', framing: 'macro ECU' },
    apply:    { surface: 'a natural indoor surface for using the product', action: 'same person handling / using the product with their hands', angle: 'handheld phone camera front-on, hands and product in-frame', framing: 'MS' },
    reaction: { surface: 'same setting', action: 'same person reacts subtly — small nod, mouth-corner lift', angle: 'handheld phone camera front-on', framing: 'MCU' },
    usage:    { surface: 'a natural setting for the product', action: 'same person using it in-context', angle: 'handheld phone camera waist-up', framing: 'MS' },
  },
}

// Nano Banana hero-frame prompt for each cutaway slot. Fed the refined
// hero frame (character + product) as the identity anchor so the cutaway
// character stays visually consistent with the anchor clip.
export function cutawayFramePrompt(
  slot: CutawaySlot,
  productName: string,
  scene: string,
  category: ProductCategory = 'other',
): string {
  const d = CATEGORY_SLOTS[category][slot]
  // Slot-specific character presence. Hero shot is product-only; the other
  // three slots ARE the actor from Image 1.
  const characterClause = slot === 'hero'
    ? `The character from Image 1 is NOT in the frame. This is a product-only beat.`
    : `The person in this shot is the SAME actor as Image 1 — preserve their face, skin, hair, wardrobe, and body proportions exactly. Do NOT re-design or restyle them. If the shot uses a mirror, we see their reflection front-on and the propped phone should be faintly visible.`

  return `Two reference images are attached.
Image 1 (character + product anchor): the actor holding / with the product in the anchor talking-head shot. Their face, skin, hair, wardrobe, body proportions, and the product's packaging must be preserved wherever they appear in the new shot.
Image 2 (product close-up): use this for the product's label text, logo, colours, and exact geometry. Every letter of the label must match Image 2.

Render a hyper-realistic phone-camera photograph — a b-roll cutaway for a UGC ad about ${productName}.

SHOT TYPE: ${d.framing}.
ACTION: ${d.action}.
CAMERA ANGLE: ${d.angle}.
SURFACE / SETTING: ${d.surface}, consistent with the anchor scene (${scene}).
${characterClause}

Realism rules — non-negotiable:
- Soft natural light (window / bathroom / kitchen light), NEVER studio softbox or ring-light glare.
- Real skin texture with pores and micro-imperfections. No beauty filter, no glass-skin gloss.
- Handheld phone-camera feel — slight sensor grain, no over-sharpening. If the phone is propped (mirror shots), the camera is nearly static with tiny drift.
- No captions, no text overlays, no watermarks, no logos other than the real product label.
- If the shot uses a mirror, the reflection is the primary subject — the actor is captured through the mirror, not from behind.

Aspect ratio: match the anchor image.`
}

// Seedance 2.0 motion prompt per slot. Silent, 2 seconds. Product-aware.
export function cutawayMotionPrompt(slot: CutawaySlot, productName: string, category: ProductCategory = 'other'): string {
  const d = CATEGORY_SLOTS[category][slot]
  const base = `Two-second silent b-roll cutaway. No speech, no captions, no watermark. Handheld phone-camera feel unless the shot is a mirror-with-propped-phone setup (in which case the camera is nearly static with tiny drift). Soft natural light throughout.`
  switch (slot) {
    case 'hero':
      return `${base} Extreme close-up product beat: ${productName} on ${d.surface}. The product rotates ~10° over the two seconds so the label catches the light. Subtle rack focus from foreground element to the product label. No people, no hands. Product only.`
    case 'apply':
      return `${base} ${d.framing}: the same actor from Image 1 ${d.action.toLowerCase()}. Motion is small and tactile — no big gestures, no product-waving, no shaking. Product stays roughly where it starts, label visible. If in a mirror, they are looking at their reflection while doing the action. Camera setup: ${d.angle}.`
    case 'reaction':
      return `${base} ${d.framing}: the same actor from Image 1. Small satisfied breath in, subtle mouth-corner lift, quiet exhale. Eyes soft — NOT wide. No head-tilt bigger than a nod. No teeth-grin. Camera setup: ${d.angle}.`
    case 'usage':
      return `${base} ${d.framing}: the same actor from Image 1 ${d.action.toLowerCase()}. Motion is natural and continuous — the shot catches them mid-routine, not performing. Product visible but not raised toward camera. Camera setup: ${d.angle}.`
  }
}
