// Nano Banana = Gemini 2.5 Flash Image, called via Replicate (consolidates all third-party
// generation under one provider). Multi-image-fusion native: takes a product reference image
// + a scene prompt and returns a generated image preserving the product's exact packaging
// while compositing it into a new scene.

const REPLICATE_BASE = 'https://api.replicate.com/v1'
const NANO_BANANA_MODEL = 'google/nano-banana'

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

Vertical 9:16 format. The product is visible and the action with it is unmistakable.`

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
): Promise<NanoBananaResult> {
  const prompt = `Using the attached reference image as the exact product (preserve packaging, label text, colours, shape, and proportions exactly as shown — do not redesign or restyle), generate a hyper-realistic phone-selfie photograph for a UGC ad first frame.

CHARACTER: ${characterPrompt}

SCENE: ${scene}

PRODUCT PLACEMENT: held in the character's hand mid-lift toward the face, fingers wrapped naturally around the bottle, label angled slightly toward camera but not perfectly square. The product is the exact one from the reference image.

CAMERA: handheld selfie, slight tilt (2°), iPhone front camera framing — face to mid-chest visible, product visible in hand at mid-chest height. Slightly off-centre composition, weight toward one side.

EXPRESSION: caught mid-moment — not a finished pose. Mid-smile starting, eyes alive and focused on the camera, mouth just parting to speak. Specific micro-expression, never a polished portrait smile.

REALISM ANCHORS — these must all be present:
- Skin texture: pores, slight unevenness, any blemishes from the character description preserved, no smoothing
- Eyes: asymmetric catchlight, warm iris detail, lid weight natural, slight asymmetry between left and right
- Hair: flyaways, slight frizz, irregular part, baby hairs visible
- Lighting: single soft natural source (window or overhead), not studio
- Background: identifiable scene, lived-in, not generic blur — soft but readable

Phone-camera-natural rendering: slight sensor grain in shadow areas, mild highlight clipping on the bright side of the face, no beauty filter, no over-sharpening, no glass-skin look, no commercial polish. The frame should read as a frozen second from a video that hasn't been recorded yet — a real person caught mid-moment on a real phone.

Vertical 9:16 format.`

  return callNanoBanana(prompt, productImageBase64, productMimeType)
}
