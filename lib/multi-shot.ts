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
  | 'skincare'    // serums, moisturizers, mists, cleansers, toners
  | 'makeup'      // foundation, lipstick, mascara, palettes
  | 'haircare'    // shampoo, oil, styling cream
  | 'fragrance'   // perfume, cologne, EDT / EDP, body mist
  | 'food'        // snacks, packaged food, ready meals
  | 'drink'       // coffee, tea, protein shake, water, soda
  | 'supplement'  // vitamins, gummies, powders
  | 'cookware'    // pans, blenders, coffee makers, kitchen tools
  | 'household'   // cleaning sprays, wipes, laundry, detergent
  | 'homewares'   // candles, mugs, throws, plates, home decor
  | 'apparel'     // t-shirt, hoodie, jacket, hat
  | 'footwear'    // sneakers, boots, sandals, cleats
  | 'jewelry'     // earrings, necklaces, rings, bracelets, watches
  | 'eyewear'     // glasses, sunglasses, blue-light frames
  | 'bag'         // backpacks, handbags, totes, crossbody
  | 'headphones'  // airpods, earbuds, over-ear cans
  | 'gadget'      // remaining hardware — cameras, smart-home, chargers
  | 'fitness'     // dumbbells, mats, resistance bands, foam rollers
  | 'pet'         // pet food, treats, toys, accessories
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
skincare | makeup | haircare | fragrance | food | drink | supplement | cookware | household | homewares | apparel | footwear | jewelry | eyewear | bag | headphones | gadget | fitness | pet | other

Disambiguation rules:
- footwear = worn on feet (sneakers, boots, sandals)
- apparel = worn on body but NOT feet, NOT jewelry, NOT eyewear, NOT bag
- jewelry = earrings, necklaces, rings, bracelets, watches
- eyewear = glasses, sunglasses, blue-light frames
- bag = backpacks, handbags, totes, crossbody
- headphones = airpods, earbuds, over-ear cans (any personal-audio hardware)
- gadget = other electronics / hardware that doesn't fit headphones or fitness
- cookware = kitchen tools used for cooking (pans, blenders, coffee makers)
- household = cleaning / laundry / non-food kitchen consumables
- homewares = decor, candles, mugs, throws, plates
- fitness = home gym gear (dumbbells, mats, bands, foam rollers)
- pet = anything for pets
- fragrance = perfume, cologne, body mist (separate from skincare)

The UGC pipeline is for physical products only — never software or apps. If truly ambiguous, use 'other'.

Product: ${input.productName}
Type: ${input.productType ?? ''}
Description: ${(input.productDescription ?? '').slice(0, 400)}`,
      }],
    })
    const raw = (msg.content[0] as { type: 'text'; text: string }).text.trim().toLowerCase()
    const allowed: ProductCategory[] = [
      'skincare','makeup','haircare','fragrance',
      'food','drink','supplement',
      'cookware','household','homewares',
      'apparel','footwear','jewelry','eyewear','bag',
      'headphones','gadget','fitness','pet','other',
    ]
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
  fragrance: {
    hero:     { surface: 'a marble or wooden vanity next to a small glass tray, morning window light behind the bottle so the liquid glows', action: 'the bottle upright with atomizer facing camera, label + brand mark sharp, faint backlit haze on the glass', angle: 'macro side-lit with the window as the key, shallow depth of field', framing: 'macro CU' },
    apply:    { surface: 'a bathroom or bedroom mirror, phone propped on the vanity', action: 'same person angles the bottle toward the side of the neck / inner wrist and gives a single gentle press', angle: 'mirror shot, phone-propped, three-quarter angle so we see the spray moment', framing: 'MCU through the mirror' },
    reaction: { surface: 'same vanity mirror', action: 'same person lifts the wrist toward the nose, a soft inhale and a small mouth-corner lift', angle: 'mirror shot, phone-propped, close on the face and wrist', framing: 'MCU through the mirror' },
    usage:    { surface: 'a bedroom or entryway, coat and keys on a hook', action: 'same person finishing the getting-ready routine — quick spray, tuck the bottle back on the vanity, glance toward the door', angle: 'handheld phone-camera waist-up', framing: 'MS' },
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
  cookware: {
    hero:     { surface: 'a clean stovetop or wooden kitchen counter with ingredients arranged nearby (herbs, produce, eggs)', action: 'the cookware placed at hero angle — pan tilted slightly toward camera, blender jug upright on base, coffee maker with cup underneath — brand mark visible', angle: 'top-down 45° macro with soft window light, shallow depth of field', framing: 'macro CU' },
    apply:    { surface: 'the same stovetop or counter with prepped ingredients', action: 'same person pours batter into the pan / drops fruit into the blender / clicks the coffee brew — hands and cookware in-frame', angle: 'over-the-shoulder or handheld phone camera looking down at the surface', framing: 'MS OTS' },
    reaction: { surface: 'kitchen counter, plated result nearby', action: 'same person tastes the cooked / brewed / blended output — small satisfied nod, quick lip-press', angle: 'handheld phone camera front-on', framing: 'MCU' },
    usage:    { surface: 'kitchen mid-cook', action: 'same person mid-action — flipping, stirring, pouring — the cookware doing its job', angle: 'handheld phone camera waist-up with the stovetop / counter in-frame', framing: 'MS' },
  },
  household: {
    hero:     { surface: 'the target surface for the product (kitchen counter for a spray, laundry basket for a detergent, bathroom tile for a wipe)', action: 'bottle / packaging upright with a folded cloth or spray target nearby, label + brand sharp', angle: 'macro side-lit, soft daylight through a nearby window', framing: 'macro CU' },
    apply:    { surface: 'the surface being cleaned / laundry being loaded', action: 'same person sprays / wipes / pours the product onto the target with a natural motion', angle: 'handheld phone camera at counter height, hands + product + surface in-frame', framing: 'MS' },
    reaction: { surface: 'same area, freshly cleaned', action: 'same person glances at the clean result, a subtle satisfied breath, small eyebrow lift', angle: 'handheld phone camera front-on', framing: 'MCU' },
    usage:    { surface: 'kitchen, bathroom, or laundry room mid-chore', action: 'same person mid-cleaning routine — wiping down a counter, folding laundry, spraying a mirror', angle: 'handheld phone camera waist-up', framing: 'MS' },
  },
  homewares: {
    hero:     { surface: 'a styled surface that matches the item — coffee table for a candle, open shelf for a mug, folded on a bed for a throw', action: 'the item as the hero of the tableau with matching supporting props (a book, a small plant, a linen napkin)', angle: 'natural window light from the side, top-down or three-quarter, soft shadows', framing: 'macro CU on the item' },
    apply:    { surface: 'the target spot in the home (side table, shelf, couch, bed)', action: 'same person places / lights / arranges the item — striking a match to light the candle, setting the mug on the shelf, laying the throw on the couch', angle: 'handheld phone camera side-on, hands and item in-frame', framing: 'MS' },
    reaction: { surface: 'a step back from the placement', action: 'same person takes a step back, small satisfied breath, subtle mouth-corner lift as they take in the arrangement', angle: 'handheld phone camera front-on', framing: 'MCU' },
    usage:    { surface: 'the room lived-in with the item integrated', action: 'same person using the room naturally — sipping from the mug on the couch, reading next to the candle, curled under the throw', angle: 'handheld phone camera waist-up', framing: 'MS' },
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
  jewelry: {
    hero:     { surface: 'a small velvet tray or open jewelry box on a wooden dresser, morning window light', action: 'the piece placed centre-frame with the metal catching light and any stones sparkling, brand mark / hallmark visible', angle: 'macro top-down or three-quarter with a small light glint on the metal, shallow depth of field', framing: 'macro ECU' },
    apply:    { surface: 'a vanity or bedroom mirror with the phone propped on a shelf', action: 'same person puts the piece on — clasping a necklace, sliding an earring in, latching a bracelet or watch — hands and piece visible in the mirror', angle: 'mirror shot, phone-propped, close on the neck / ear / wrist', framing: 'MCU through the mirror' },
    reaction: { surface: 'same mirror, piece now worn', action: 'same person angles the neck / ear / wrist toward the mirror, subtle satisfied breath, small mouth-corner lift', angle: 'mirror shot with a macro-close feel on the piece against skin', framing: 'CU through the mirror on the worn piece' },
    usage:    { surface: 'a full-length mirror or entryway', action: 'same person in a full outfit with the piece worn as part of the look, small natural movement (adjusting a sleeve, tucking hair behind the ear so the earring shows)', angle: 'mirror shot or handheld phone camera three-quarter, waist-up', framing: 'MS' },
  },
  eyewear: {
    hero:     { surface: 'a hardcover book, open case, or wooden desk with a folded newspaper', action: 'the frames side-profile with a small light glint on the lens and hinge', angle: 'macro side-on, natural light from a window, shallow depth of field on the temple + brand mark', framing: 'macro CU' },
    apply:    { surface: 'a bathroom or vanity mirror with the phone propped', action: 'same person slides the frames on, two-handed, small adjustment at the temples', angle: 'mirror shot, phone-propped, three-quarter angle so we see both the frames and the face', framing: 'MCU through the mirror' },
    reaction: { surface: 'same mirror', action: 'same person tilts the head slightly to check the side profile, subtle mouth-corner lift', angle: 'mirror shot, phone-propped, close on the face', framing: 'MCU through the mirror' },
    usage:    { surface: 'a café, park bench, or sunlit apartment window', action: 'same person wearing the frames in-context, small natural movement (reading, sipping coffee, looking out a window)', angle: 'handheld phone camera three-quarter, waist-up, natural daylight', framing: 'MS' },
  },
  bag: {
    hero:     { surface: 'a wooden hook by the door, a linen chair, or the edge of a bed with a couple of items styled around it (keys, wallet, a book)', action: 'the bag hero-forward with the strap draped naturally and any brand mark / hardware visible', angle: 'macro three-quarter with soft natural light, shallow depth of field on the material texture and logo', framing: 'macro CU' },
    apply:    { surface: 'a bed or table where the bag lies open', action: 'same person opens the bag and places items inside — wallet, keys, sunglasses, laptop — hands and bag interior visible', angle: 'handheld phone camera top-down or three-quarter, hands + bag in-frame', framing: 'MS' },
    reaction: { surface: 'a full-length or wall mirror with the phone propped nearby', action: 'same person shoulders / holds the bag and does a small turn to check the look in the mirror, subtle satisfied nod', angle: 'mirror shot, phone-propped, three-quarter angle', framing: 'MS through the mirror' },
    usage:    { surface: 'a sidewalk, café, or apartment hallway', action: 'same person carrying the bag naturally — walking, sitting, adjusting the strap', angle: 'handheld phone camera at hip / shoulder height following them, three-quarter angle', framing: 'MS' },
  },
  headphones: {
    hero:     { surface: 'a wooden desk, coffee table, or bedside stand — for AirPods / earbuds, the CASE is OPEN with the buds nestled inside; for over-ear cans, they sit on a stand or laid flat with the ear cups facing camera', action: 'the headphones / open case as the hero with any brand mark and materials sharp, small pool of window light on the metal / plastic', angle: 'macro three-quarter, shallow depth of field on the logo and driver / driver grille', framing: 'macro CU' },
    apply:    { surface: 'the same person\'s hands', action: 'same person takes the buds out of the case and slides them into their ears, or lifts the over-ear cans and settles them over the head, adjusting once', angle: 'handheld phone camera at chest / face height, hands + headphones + head in-frame', framing: 'MCU' },
    reaction: { surface: 'wherever they wear them (desk, kitchen, couch)', action: 'same person\'s head settles, eyes soften as the audio starts, tiny nod on a beat, subtle mouth-corner lift', angle: 'handheld phone camera front-on', framing: 'MCU' },
    usage:    { surface: 'a desk with a laptop, a sidewalk / commute, or a home gym', action: 'same person wearing the headphones in-context — typing at the laptop, walking outside, mid-workout — small natural movement', angle: 'handheld phone camera three-quarter, waist-up', framing: 'MS' },
  },
  gadget: {
    hero:     { surface: 'a desk or side table with a soft mat', action: 'the gadget sitting upright / plugged in, small LED glow if applicable, label / logo visible', angle: 'macro side-lit, product-forward, background soft-blurred', framing: 'macro CU' },
    apply:    { surface: 'a desk / kitchen counter', action: 'same person turns it on / picks it up / uses the primary function', angle: 'over-the-shoulder or handheld phone view, hands and gadget in-frame', framing: 'MS OTS' },
    reaction: { surface: 'same setting', action: 'same person nods, subtle smile, quiet exhale as the gadget does its thing', angle: 'handheld phone camera front-on', framing: 'MCU' },
    usage:    { surface: 'natural setting for the gadget (desk, living room, gym)', action: 'same person using it in-context, product visible in-hand', angle: 'handheld phone camera waist-up', framing: 'MS' },
  },
  fitness: {
    hero:     { surface: 'a rolled or half-unrolled yoga mat on a wood or concrete floor with matching gear laid out nearby', action: 'the piece(s) — dumbbells stacked, resistance bands coiled, foam roller centre-frame, kettlebell upright — brand marks visible', angle: 'top-down or three-quarter macro with soft daylight, shallow depth of field', framing: 'macro CU' },
    apply:    { surface: 'the same mat / floor', action: 'same person grabs the gear and gets into position — picks up the dumbbell into a curl, wraps the band around a foot, sits onto the mat with hands on the roller', angle: 'handheld phone camera at floor / knee height, gear and hands in-frame', framing: 'MS' },
    reaction: { surface: 'same space, mid-set or post-set', action: 'same person exhales after a rep, quick wipe of the forehead with the back of the wrist, small satisfied nod', angle: 'handheld phone camera front-on', framing: 'MCU' },
    usage:    { surface: 'a home gym / bedroom corner / living room set up as a workout space', action: 'same person mid-exercise — a rep of a curl, a stretch on the mat, a band pull — natural continuous motion', angle: 'handheld phone camera three-quarter, waist-up or full-body depending on the movement', framing: 'MS' },
  },
  pet: {
    hero:     { surface: 'a wooden floor with a pet bed, bowl, or favorite spot next to the product', action: 'the product placed hero-forward with the pet\'s bowl or toy nearby as supporting prop, label visible', angle: 'top-down or three-quarter macro, warm home light, shallow depth of field', framing: 'macro CU' },
    apply:    { surface: 'a pet bowl on the floor, a treat jar on a counter, or the pet\'s play area', action: 'same person opens / scoops / offers the product to the pet — filling the bowl, offering a treat, clipping on a collar or harness', angle: 'handheld phone camera at pet height, hands + product + pet in-frame', framing: 'MS' },
    reaction: { surface: 'floor with the pet enjoying', action: 'the PET reacts — dog wagging while eating, cat purring next to the bowl, dog chasing the toy — the human is off-camera or partly visible in the background', angle: 'handheld phone camera at pet height, pet as subject', framing: 'MCU on the pet' },
    usage:    { surface: 'the pet\'s natural space (living room floor, backyard, kitchen)', action: 'the pet using / eating / playing with the product naturally, human hand possibly ruffling fur once', angle: 'handheld phone camera at pet height, three-quarter angle', framing: 'MS' },
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
