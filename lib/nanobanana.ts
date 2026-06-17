// Nano Banana 2 / Nano Banana Pro / Gemini 3 Pro Image — same model, different names.
// Successor to the original Nano Banana (Gemini 2.5 Flash Image). Substantially better at
// preserving label text, handwritten logos, and small print on product packaging — exactly
// the fidelity weakness that caused brand bottles to render as generic shapes.
//
// Cost: ~$0.12 per image (vs ~$0.04 on the original). Speed: ~10-12s (vs ~5-8s).
// Same input schema (prompt + image_input array + output_format), drop-in swap.
const REPLICATE_BASE = 'https://api.replicate.com/v1'
const NANO_BANANA_MODEL = 'google/nano-banana-pro'

interface NanoBananaResult {
  imageBase64: string
  mimeType: string
}

// Submit Nano Banana sync (Prefer: wait) — image gen is fast (~5–8s), no need to poll.
// Returns the generated image as base64 (fetched from Replicate's CDN URL).
async function callNanoBanana(prompt: string, referenceImageBase64: string, referenceMimeType: string): Promise<NanoBananaResult> {
  const apiKey = process.env.REPLICATE_API_TOKEN
  if (!apiKey) throw new Error('REPLICATE_API_TOKEN not configured')

  const dataUrl = `data:${referenceMimeType};base64,${referenceImageBase64}`

  const res = await fetch(`${REPLICATE_BASE}/models/${NANO_BANANA_MODEL}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Prefer: 'wait', // sync mode — block until completion (typically 5-8s)
    },
    body: JSON.stringify({
      input: {
        prompt,
        image_input: [dataUrl],
        output_format: 'png',
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Replicate Nano Banana error ${res.status}: ${err.slice(0, 400)}`)
  }

  const data = await res.json()

  // Replicate may return either a completed prediction (Prefer: wait succeeded) or a still-
  // processing one (Prefer: wait timed out). Handle both.
  if (data.status === 'failed' || data.error) {
    throw new Error(`Replicate Nano Banana failed: ${data.error || JSON.stringify(data).slice(0, 300)}`)
  }

  let output = data.output
  if (data.status !== 'succeeded') {
    // Fallback: poll until done if Prefer: wait didn't get there
    const id = data.id
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const poll = await fetch(`${REPLICATE_BASE}/predictions/${id}`, { headers: { Authorization: `Bearer ${apiKey}` } })
      const pollData = await poll.json()
      if (pollData.status === 'succeeded') { output = pollData.output; break }
      if (pollData.status === 'failed' || pollData.status === 'canceled') {
        throw new Error(`Replicate Nano Banana failed during poll: ${JSON.stringify(pollData).slice(0, 300)}`)
      }
    }
    if (!output) throw new Error('Replicate Nano Banana did not complete within 60s')
  }

  // Output is either a single URL string or an array — normalize to the first URL
  const imageUrl = Array.isArray(output) ? output[0] : output
  if (typeof imageUrl !== 'string') {
    throw new Error(`Replicate Nano Banana returned unexpected output: ${JSON.stringify(output).slice(0, 300)}`)
  }

  // Fetch the generated image and convert to base64 so the existing orchestrate code
  // (which uploads base64 to Supabase) keeps working without changes.
  const imgRes = await fetch(imageUrl)
  if (!imgRes.ok) throw new Error(`Failed to fetch Nano Banana output: ${imgRes.statusText}`)
  const buf = Buffer.from(await imgRes.arrayBuffer())
  const mimeType = imgRes.headers.get('content-type') || 'image/png'
  return { imageBase64: buf.toString('base64'), mimeType }
}

// Generate a B-roll action frame showing a SPECIFIC application action mid-motion.
// Used as the start_image for Kling image-to-video — Kling extends the action forward.
// Two beats per video: actionBeat='application' (the using moment), actionBeat='reaction'
// (the result/sensory moment). Both anchor the real product via the reference image.
export async function generateActionFrame(
  productImageBase64: string,
  productMimeType: string,
  productName: string,
  actionDescription: string,
  scene: string,
  customInstructions?: string,
): Promise<NanoBananaResult> {
  const prompt = `Using the attached reference image as the exact product (preserve packaging, label text, colours, shape, and proportions exactly as shown — do not redesign or restyle), generate a hyper-realistic phone-camera photograph for a UGC ad B-roll frame.

ACTION HAPPENING IN THIS FRAME: ${actionDescription}

The frame must capture the action mid-moment — frozen at the exact peak of motion, NOT before or after. Examples of what 'mid-moment' means: mid-spray with droplets visible in the air, fingers mid-application with product trail on the skin, hand mid-lift bringing the product toward the face, mouth mid-bite, glass mid-tilt with liquid in motion. The viewer should feel they paused a video at the exact action peak.

SCENE: ${scene}, lived-in and identifiable but not the focus.

CAMERA: phone-camera close-up — hands, body parts (neck, jawline, wrist, lips, fingers), partial face only (chin to nose, or eyes only, or side profile). NEVER a full face portrait — this is a B-roll, the full face belongs to the A-roll. Slight handheld tilt 2°, off-centre composition.

LIGHTING: single soft natural source, real shadow, no studio look, no rim light.

REALISM ANCHORS:
- Skin texture: pores, hair, slight imperfections, no smoothing
- Motion blur: subtle on the moving parts (hand, liquid, fabric) — proves it's a frozen second from a video
- Product still locked to the reference image: same packaging, same label text, same colour

Phone-camera-natural rendering: slight sensor grain, mild highlight clipping where appropriate, no beauty filter, no commercial polish, no over-sharpening. Should look like a real person paused a UGC video at the action peak, NOT like a marketing campaign still.

Vertical 9:16 format. The product is visible and the action with it is unmistakable.${customInstructions?.trim() ? `\n\nUSER INSTRUCTIONS (HIGH PRIORITY — apply to mood/expression/scene where applicable, override defaults where they conflict):\n${customInstructions.trim()}` : ''}`

  return callNanoBanana(prompt, productImageBase64, productMimeType)
}

// Product-only hero frame for B-rolls — NO character, NO hands, just the product on a
// surface, lit and composed for an ad-style still. The reference image bytes are the
// product, and Nano Banana is told to preserve every label/shape/color detail. Result
// goes to Kling image-to-video for subtle motion (camera push, light shift, slow rotation).
//
// Used for B-roll shots Claude tagged as kind:'product' or kind:'lifestyle' — those used
// to skip Nano Banana entirely and hand a text description to Kling text-to-video, which
// hallucinated a generic bottle.
export async function generateProductOnlyFrame(
  productImageBase64: string,
  productMimeType: string,
  productName: string,
  shotDescription: string,
  scene: string,
  kind: 'product' | 'lifestyle',
  customInstructions?: string,
): Promise<NanoBananaResult> {
  const placementBlock = kind === 'product'
    ? `Hero shot composition — the product is the SOLE subject, dominant in frame at slight angle, on a clean surface (marble / wood / linen / counter top) appropriate for the product type. No character, no hands, no other objects competing for attention.`
    : `Lifestyle context — the product sits naturally in its environment (next to props that suggest the use case: jewelry, a coffee mug, a tote bag, a vanity tray). The product is still the visual anchor but the scene tells a small story. No character, no hands.`

  const prompt = `Using the attached reference image as the EXACT product, generate a hyper-realistic phone-camera photograph for a UGC ad B-roll frame.

PRODUCT FIDELITY — these are the only things that matter, never change them:
- Bottle / container shape, size, and silhouette: match the reference exactly
- Label text, font, layout, illustration: every letter and mark visible in the reference must appear in the output, readable and unstyled
- Colors: liquid color, packaging color, cap color — match the reference exactly
- Material finish: glass vs plastic vs metal — match the reference

DO NOT redesign, restyle, or substitute a generic product. If the reference shows an UpCircle Face Toner with a handwritten "UpCircle" script logo, peachy/cream liquid, and the words "FACE TONER" in a black box at the bottom, the output must show that exact bottle with all those exact details legible.

SHOT INTENT: ${shotDescription}

${placementBlock}

SCENE: ${scene}, soft and lived-in, but not the focus — the product is.

CAMERA: phone-camera close-up, slight handheld tilt 2°, mid-distance framing (the product fills roughly the central third of the frame). Slightly off-centre composition. NEVER a perfectly centered catalog shot.

LIGHTING: single soft natural source (window or overhead). Real shadow under the product. Catchlight on glass/plastic. No studio softbox, no ring light, no rim light.

REALISM ANCHORS:
- Visible label text and any printed details, readable
- Slight surface texture on the support (grain in wood, crystals in marble, weave in linen)
- Subtle dust / fingerprints on glossy surfaces — proves it's a real shot, not a render
- No motion blur (product is at rest)
- No floating composition — the product physically sits on the surface with a real shadow

Phone-camera-natural rendering: subtle sensor grain, no beauty filter, no over-sharpening, no commercial polish. Should read as a frozen second from a real iPhone video, NOT a marketing campaign still.

Vertical 9:16 format. The product label is readable.${customInstructions?.trim() ? `\n\nUSER INSTRUCTIONS (HIGH PRIORITY — apply to mood/scene/composition where applicable, override defaults where they conflict):\n${customInstructions.trim()}` : ''}`

  return callNanoBanana(prompt, productImageBase64, productMimeType)
}

// Backwards-compat wrapper — keeps generateProductHeroShot importable even though the new
// pipeline calls generateActionFrame directly with explicit action descriptions.
export async function generateProductHeroShot(
  productImageBase64: string,
  productMimeType: string,
  productName: string,
  scene: string,
): Promise<NanoBananaResult> {
  return generateActionFrame(
    productImageBase64,
    productMimeType,
    productName,
    `hand holding the product mid-lift toward the camera, fingers wrapped naturally around it, label angled slightly toward camera`,
    scene,
  )
}

// Generate a character + product hero frame for the A-roll talking head (Premium / Hero tiers).
// Same product-fidelity rules; the prompt describes the character and scene from scratch.
export async function generateCharacterWithProduct(
  productImageBase64: string,
  productMimeType: string,
  productName: string,
  characterPrompt: string,
  scene: string,
  customInstructions?: string,
): Promise<NanoBananaResult> {
  // Adaptive product placement — the reference image can be either a physical product
  // (skincare bottle, perfume) OR a screenshot of a software UI / app. Telling Nano
  // Banana to "wrap fingers around the bottle" caused it to literally render the UI
  // as a water bottle. The new prompt makes the model decide:
  //   - physical product → hold in hand
  //   - UI / screenshot → show on a phone or laptop screen in frame
  //   - logo / packaging artwork → on a visible product in the scene
  // No hardcoded shape words ('bottle', 'jar') so it stops hallucinating containers.
  const prompt = `Using the attached reference image as the exact subject (preserve every detail — packaging, label text, UI layout, colours, shape, proportions — do not redesign or restyle), generate a hyper-realistic phone-selfie photograph for a UGC ad first frame.

CHARACTER: ${characterPrompt}

SCENE: ${scene}

REFERENCE IMAGE INTERPRETATION — read the reference image carefully first, then pick ONE placement that fits what it actually shows:
- If the reference is a PHYSICAL PRODUCT (bottle, jar, box, food, device, makeup, etc.): the character holds the product in one hand at mid-chest height, mid-lift toward the camera, fingers wrapped naturally around it, label angled slightly toward camera but not perfectly square.
- If the reference is a SCREENSHOT OF A SOFTWARE APP, WEBSITE, OR PHONE/LAPTOP UI: the character is holding a smartphone in one hand, screen tilted toward the camera, and the phone's screen shows the EXACT UI from the reference image (preserve every UI element, colour, text). Do not render the UI as a physical object — it lives on a phone screen.
- If the reference is a LOGO ONLY: place the character with a laptop or phone visible in scene, with the logo subtly present in the environment (laptop sticker, t-shirt, mug, screen) — do not make the logo into a held physical object.

CAMERA: handheld selfie, slight tilt (2°), iPhone front camera framing — face to mid-chest visible, hand/product/device visible at mid-chest height. Slightly off-centre composition, weight toward one side.

EXPRESSION: caught mid-moment — not a finished pose. Mid-smile starting, eyes alive and focused on the camera, mouth just parting to speak. Specific micro-expression, never a polished portrait smile.

REALISM ANCHORS — these must all be present:
- Skin texture: pores, slight unevenness, any blemishes from the character description preserved, no smoothing
- Eyes: asymmetric catchlight, warm iris detail, lid weight natural, slight asymmetry between left and right
- Hair: flyaways, slight frizz, irregular part, baby hairs visible
- Lighting: single soft natural source (window or overhead), not studio
- Background: identifiable ${scene}, lived-in, not generic blur — soft but readable, must clearly read as ${scene}

Phone-camera-natural rendering: slight sensor grain in shadow areas, mild highlight clipping on the bright side of the face, no beauty filter, no over-sharpening, no glass-skin look, no commercial polish. The frame should read as a frozen second from a video that hasn't been recorded yet — a real person caught mid-moment on a real phone.

Vertical 9:16 format.${customInstructions?.trim() ? `\n\nUSER INSTRUCTIONS (HIGH PRIORITY — apply to the character's expression, pose, or scene; override defaults where they conflict):\n${customInstructions.trim()}` : ''}`

  return callNanoBanana(prompt, productImageBase64, productMimeType)
}
