import { createSign } from 'node:crypto'

const REPLICATE_BASE = 'https://api.replicate.com/v1'
const GOOGLE_GENAI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
// Nano Banana Pro (gemini-3-pro-image, GA June 2026) is only served on
// Vertex's global endpoint — no regional variant. Nano Banana 2 lives in
// the standard regional endpoints, default us-central1.
const VERTEX_REGION_PRO = process.env.GOOGLE_VERTEX_REGION_PRO || 'global'
const VERTEX_REGION_NB2 = process.env.GOOGLE_VERTEX_REGION || 'us-central1'
// Nano Banana Pro — the premium image model. Better identity preservation
// + label fidelity than nano-banana-2. Used for hero frames + product
// refinement + cutaway frames. Routed to Google direct when
// GOOGLE_GENAI_API_KEY is set (cheaper + eats the $300 trial credit),
// otherwise falls back to Replicate.
const NANO_BANANA_MODEL = 'google/nano-banana-pro'
// Gemini API model IDs — override via env if Google renames them.
const GOOGLE_PRO_MODEL = process.env.GOOGLE_NANO_BANANA_PRO_MODEL || 'gemini-3-pro-image'
const GOOGLE_NB2_MODEL = process.env.GOOGLE_NANO_BANANA_MODEL || 'gemini-2.5-flash-image'

interface NanoBananaResult {
  imageBase64: string
  mimeType: string
}

// Vertex AI auth — mint an OAuth access token from the service-account JSON in
// GOOGLE_VERTEX_SA_JSON. We sign a JWT with the SA private key and exchange it
// at oauth2.googleapis.com/token. Tokens live for an hour, so cache in-module.
interface VertexServiceAccount {
  client_email: string
  private_key: string
  project_id: string
}
let vertexTokenCache: { token: string; expiresAt: number } | null = null
let vertexSaCache: VertexServiceAccount | null = null

function getVertexSA(): VertexServiceAccount | null {
  if (vertexSaCache) return vertexSaCache
  const raw = process.env.GOOGLE_VERTEX_SA_JSON
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as VertexServiceAccount
    if (!parsed.client_email || !parsed.private_key || !parsed.project_id) return null
    vertexSaCache = parsed
    return parsed
  } catch {
    console.warn('[nanobanana] GOOGLE_VERTEX_SA_JSON is not valid JSON — falling back')
    return null
  }
}

function base64url(input: Buffer | string) {
  return (typeof input === 'string' ? Buffer.from(input) : input)
    .toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

async function getVertexAccessToken(sa: VertexServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (vertexTokenCache && vertexTokenCache.expiresAt > now + 60) return vertexTokenCache.token

  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))
  const signInput = `${header}.${claims}`
  const signer = createSign('RSA-SHA256')
  signer.update(signInput)
  const signature = base64url(signer.sign(sa.private_key))
  const jwt = `${signInput}.${signature}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Vertex token exchange failed ${res.status}: ${err.slice(0, 300)}`)
  }
  const data = await res.json() as { access_token: string; expires_in: number }
  vertexTokenCache = { token: data.access_token, expiresAt: now + data.expires_in }
  return data.access_token
}

// Vertex AI path — same models as AI Studio Gemini API, but billed against
// the Cloud project so the $300 trial credit is actually consumed.
async function callNanoBananaVertex(
  prompt: string,
  referenceImages: Array<{ base64: string; mimeType: string }> | undefined,
  aspectRatio: '1:1' | '4:3' | '3:4' | '16:9' | '9:16' | undefined,
  model: 'pro' | 'nb2',
  resolution: '1K' | '2K' | '4K' | undefined,
  sa: VertexServiceAccount,
): Promise<NanoBananaResult> {
  const modelId = model === 'nb2' ? GOOGLE_NB2_MODEL : GOOGLE_PRO_MODEL
  const parts: Array<Record<string, unknown>> = [{ text: prompt }]
  if (referenceImages?.length) {
    for (const r of referenceImages) {
      parts.push({ inlineData: { mimeType: r.mimeType, data: r.base64 } })
    }
  }
  const imageConfig: Record<string, unknown> = {}
  if (aspectRatio) imageConfig.aspectRatio = aspectRatio
  if (resolution && model === 'pro') imageConfig.imageSize = resolution

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      ...(Object.keys(imageConfig).length ? { imageConfig } : {}),
    },
  }

  const token = await getVertexAccessToken(sa)
  // Global endpoint drops the region prefix from the hostname; regional
  // endpoints (us-central1 etc.) keep it. Nano Banana Pro is global-only.
  const region = model === 'pro' ? VERTEX_REGION_PRO : VERTEX_REGION_NB2
  const host = region === 'global' ? 'aiplatform.googleapis.com' : `${region}-aiplatform.googleapis.com`
  const url = `https://${host}/v1/projects/${sa.project_id}/locations/${region}/publishers/google/models/${modelId}:generateContent`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(250000),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Vertex Nano Banana error ${res.status}: ${err.slice(0, 400)}`)
  }
  const data = await res.json()
  const candidateParts = data?.candidates?.[0]?.content?.parts as Array<{ inlineData?: { data: string; mimeType: string } }> | undefined
  const imgPart = candidateParts?.find(p => p.inlineData?.data)
  if (!imgPart?.inlineData?.data) {
    throw new Error(`Vertex Nano Banana returned no image: ${JSON.stringify(data).slice(0, 400)}`)
  }
  return {
    imageBase64: imgPart.inlineData.data,
    mimeType: imgPart.inlineData.mimeType || 'image/png',
  }
}

// Google Gemini API path — image generation via generateContent, IMAGE modality.
// Same interface as the Replicate path so `callNanoBanana` can pick between them
// with just an env-var check.
async function callNanoBananaGoogle(
  prompt: string,
  referenceImages: Array<{ base64: string; mimeType: string }> | undefined,
  aspectRatio: '1:1' | '4:3' | '3:4' | '16:9' | '9:16' | undefined,
  model: 'pro' | 'nb2',
  resolution: '1K' | '2K' | '4K' | undefined,
): Promise<NanoBananaResult> {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY!
  const modelId = model === 'nb2' ? GOOGLE_NB2_MODEL : GOOGLE_PRO_MODEL

  const parts: Array<Record<string, unknown>> = [{ text: prompt }]
  if (referenceImages?.length) {
    for (const r of referenceImages) {
      parts.push({ inlineData: { mimeType: r.mimeType, data: r.base64 } })
    }
  }

  const imageConfig: Record<string, unknown> = {}
  if (aspectRatio) imageConfig.aspectRatio = aspectRatio
  // Gemini API image resolution knob — 4K only supported on the Pro model.
  if (resolution && model === 'pro') imageConfig.imageSize = resolution

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      ...(Object.keys(imageConfig).length ? { imageConfig } : {}),
    },
  }

  const url = `${GOOGLE_GENAI_BASE}/models/${modelId}:generateContent?key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google Nano Banana error ${res.status}: ${err.slice(0, 400)}`)
  }
  const data = await res.json()
  const candidateParts = data?.candidates?.[0]?.content?.parts as Array<{ inlineData?: { data: string; mimeType: string } }> | undefined
  const imgPart = candidateParts?.find(p => p.inlineData?.data)
  if (!imgPart?.inlineData?.data) {
    throw new Error(`Google Nano Banana returned no image: ${JSON.stringify(data).slice(0, 400)}`)
  }
  return {
    imageBase64: imgPart.inlineData.data,
    mimeType: imgPart.inlineData.mimeType || 'image/png',
  }
}

// Submit Nano Banana sync (Prefer: wait) — image gen is fast (~5–8s), no need to poll.
// Returns the generated image as base64 (fetched from Replicate's CDN URL).
// If referenceImages is omitted or empty, runs pure text-to-image (no reference fusion).
async function callNanoBanana(
  prompt: string,
  referenceImages?: Array<{ base64: string; mimeType: string }>,
  aspectRatio?: '1:1' | '4:3' | '3:4' | '16:9' | '9:16',
  model: 'pro' | 'nb2' = 'pro',
  resolution?: '1K' | '2K' | '4K',
): Promise<NanoBananaResult> {
  // Provider: Vertex AI with fallback to AI Studio (GOOGLE_GENAI_API_KEY) on 429.
  const sa = getVertexSA()
  const genaiKey = process.env.GOOGLE_GENAI_API_KEY

  if (sa) {
    let lastErr: unknown
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 3000))
      try {
        return await callNanoBananaVertex(prompt, referenceImages, aspectRatio, model, resolution, sa)
      } catch (e) {
        lastErr = e
        const msg = e instanceof Error ? e.message : ''
        if (!msg.includes('429')) throw e   // non-rate-limit errors → fail fast
        console.warn(`[nanobanana] Vertex 429, retry ${attempt + 1}/2`)
      }
    }
    // Vertex exhausted — try AI Studio fallback before giving up
    if (genaiKey) {
      console.warn('[nanobanana] Vertex quota exhausted, falling back to AI Studio')
      return await callNanoBananaGoogle(prompt, referenceImages, aspectRatio, model, resolution)
    }
    throw lastErr
  }

  if (genaiKey) {
    return await callNanoBananaGoogle(prompt, referenceImages, aspectRatio, model, resolution)
  }

  throw new Error('No image provider configured — set GOOGLE_VERTEX_SA_JSON or GOOGLE_GENAI_API_KEY')
}

// Generate a first frame for Sora 2 from a plain text prompt — no reference image.
// Used by the standalone /generate/video page when the user doesn't upload a ref.
// Output is a 9:16-friendly hyper-realistic still that Sora will animate forward.
export async function generateTextToImage(prompt: string): Promise<NanoBananaResult> {
  const wrapped = `${prompt}\n\nRender as a hyper-realistic phone-camera photograph in vertical 9:16 portrait orientation. Soft natural lighting. Real attractive person — clear healthy even skin with a natural subtle glow, LIGHT natural makeup (mascara, subtle blush, tinted lip). Barely-there real-skin micro-texture (very subtle pores only). Do NOT add moles, freckle clusters, or red patches on the nose or cheeks unless the source prompt explicitly asks for them. AVOID plastic-glossy over-smoothed skin AND avoid tacked-on imperfections that scream AI. Individual features come from bone structure and subtle asymmetries, not blemishes. Should read as a candid moment captured on a real phone of a genuinely attractive person, not a stock-model render.\n\nSTRICT: The image is the raw photo only. Do NOT render any phone-camera UI, shutter button, viewfinder chrome, record button, timer, focus reticle, on-screen icons, screen bezels, camera app overlay, watermark, timestamp, text label, or any other UI element ANYWHERE in the frame. Zero overlays. No circles, no capture rings, no phone frame. The output is a clean bare photograph — nothing on top of the pixels.`
  return callNanoBanana(wrapped, undefined, '9:16')
}

// Generic image generator for /generate/image. Accepts an optional reference
// image — when present, Nano Banana 2 runs image-to-image (preserves product,
// composition, etc. from the reference). When absent, it's pure text-to-image.
// Style + ratio hints get baked into the prompt so the user's chip selection
// actually influences the output.
export async function generateNanoBananaImage(
  prompt: string,
  options: {
    style?: 'realistic' | 'artistic' | 'professional' | 'minimalist'
    ratio?: '1:1' | '4:5' | '9:16' | '16:9'
    referenceImageBase64?: string
    referenceImageMimeType?: string
    // Multiple references (takes precedence over the single-ref fields).
    referenceImages?: Array<{ base64: string; mimeType: string }>
    // Override the product-preservation ref hint (e.g. identity refs for people).
    referenceHint?: string
    // 'pro' (default) = Nano Banana Pro; 'nb2' = Nano Banana 2 — about half
    // the cost, weaker identity fidelity, more prone to small mistakes.
    model?: 'pro' | 'nb2'
    // NB Pro output resolution — '4K' costs ~1.7x the 1K/2K rate.
    resolution?: '1K' | '2K' | '4K'
    // Raw mode: send the prompt verbatim — no style/ratio/reference hint
    // wrapping. Aspect ratio + resolution still go as API params.
    raw?: boolean
  } = {},
): Promise<NanoBananaResult> {
  const styleHint =
    options.style === 'artistic'     ? 'Lifestyle shot — natural, candid, environment visible, soft daylight, hand-held feel.' :
    options.style === 'professional' ? 'Studio product photograph — clean seamless background, controlled directional lighting, sharp focus on the subject, slight reflection or shadow on the surface.' :
    options.style === 'minimalist'   ? 'Flat-lay overhead composition — neutral surface, subject centered, balanced negative space, soft even lighting, top-down angle.' :
                                       'Hyper-realistic product photograph — soft natural lighting, real surface texture, slight depth-of-field, no commercial gloss or AI gloss.'

  const ratioHint =
    options.ratio === '4:5'  ? 'Portrait 4:5 framing.' :
    options.ratio === '9:16' ? 'Vertical 9:16 framing.' :
    options.ratio === '16:9' ? 'Wide 16:9 framing.' :
                               'Square 1:1 framing.'

  const hasRefs = (options.referenceImages?.length ?? 0) > 0 || !!options.referenceImageBase64
  const refHint = hasRefs
    ? `\n\n${options.referenceHint ?? 'Use the attached reference image as the EXACT subject — preserve packaging, label text, colours, shape and proportions exactly. Apply the prompt as the scene + styling around the subject; do NOT redesign the subject itself.'}`
    : ''

  // Nano Banana 2 accepts 1:1, 4:3, 3:4, 16:9, 9:16. Our UI offers 4:5 too
  // (Instagram portrait) — map it to 3:4 which is the closest supported ratio.
  const nbRatio: '1:1' | '4:3' | '3:4' | '16:9' | '9:16' | undefined =
    options.ratio === '4:5' ? '3:4' : options.ratio

  const composed = options.raw ? prompt : `${prompt}\n\n${styleHint} ${ratioHint}${refHint}`
  const refs = options.referenceImages?.length
    ? options.referenceImages
    : (options.referenceImageBase64 && options.referenceImageMimeType
        ? [{ base64: options.referenceImageBase64, mimeType: options.referenceImageMimeType }]
        : undefined)
  return callNanoBanana(composed, refs, nbRatio, options.model ?? 'pro', options.resolution)
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
  aspectRatio: '9:16' | '1:1' | '16:9' | '3:4' = '9:16',
): Promise<NanoBananaResult> {
  const prompt = `Using the attached reference image as the exact product (preserve packaging, label text, colours, shape, and proportions exactly as shown — do not redesign or restyle), generate a hyper-realistic phone-camera photograph for a UGC ad B-roll frame.

ACTION HAPPENING IN THIS FRAME: ${actionDescription}

The frame must capture the action mid-moment — frozen at the exact peak of motion, NOT before or after. Examples of what 'mid-moment' means: mid-spray with droplets visible in the air, fingers mid-application with product trail on the skin, hand mid-lift bringing the product toward the face, mouth mid-bite, glass mid-tilt with liquid in motion. The viewer should feel they paused a video at the exact action peak.

SCENE: ${scene}, lived-in and identifiable but not the focus.

CAMERA: phone-camera close-up — hands, body parts (neck, jawline, wrist, lips, fingers), partial face only (chin to nose, or eyes only, or side profile). NEVER a full face portrait — this is a B-roll, the full face belongs to the A-roll. Slight handheld tilt 2°, off-centre composition.

LIGHTING: single soft natural source, real shadow, no studio look, no rim light.

REALISM ANCHORS:
- Skin: clear, healthy, even-toned with a natural subtle glow. LIGHT natural makeup (mascara, subtle blush, tinted lip). Barely-there real-skin micro-texture only. NO added moles, freckle clusters, or red patches — those read as tacked-on AI imperfections and look worse than smooth skin. Also NOT glass-doll plastic. Individuality comes from bone structure and subtle asymmetries.
- Motion blur: subtle on the moving parts (hand, liquid, fabric) — proves it's a frozen second from a video
- Product still locked to the reference image: same packaging, same label text, same colour

Phone-camera-natural rendering: slight sensor grain, mild highlight clipping where appropriate, no beauty filter, no commercial polish, no over-sharpening. Should look like a real person paused a UGC video at the action peak, NOT like a marketing campaign still.

Render in ${aspectRatio} aspect ratio. The product is visible and the action with it is unmistakable.${customInstructions?.trim() ? `\n\nUSER INSTRUCTIONS (HIGH PRIORITY — apply to mood/expression/scene where applicable, override defaults where they conflict):\n${customInstructions.trim()}` : ''}`

  return callNanoBanana(prompt, [{ base64: productImageBase64, mimeType: productMimeType }], aspectRatio)
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
  aspectRatio: '9:16' | '1:1' | '16:9' | '3:4' = '9:16',
): Promise<NanoBananaResult> {
  const placementBlock = kind === 'product'
    ? `Hero shot composition — the subject is dominant in frame at a slight angle, on a clean surface (marble / wood / linen / counter top) appropriate for the subject type. No character, no hands, no other objects competing for attention.`
    : `Lifestyle context — the subject sits naturally in its environment (next to props that suggest the use case: jewelry, a coffee mug, a tote bag, a vanity tray, a notebook + pen). The subject is still the visual anchor but the scene tells a small story. No character, no hands.`

  const prompt = `Using the attached reference image as the EXACT subject, generate a hyper-realistic phone-camera photograph for a UGC ad B-roll frame.

STEP 1 — CLASSIFY THE REFERENCE:

Is the reference an app/website/UI screenshot? Look for: rectangular composition with software interface elements (buttons, menus, icons, panels, status bars), flat colours, crisp UI typography, recognisable app layout.

If YES (UI screenshot):
  Render a modern smartphone on the surface, lying flat or propped on a small stand at a 15-25° angle. The phone's screen shows the EXACT UI from the reference image — every menu, button, colour, text label, icon pixel-faithful. Use a current iPhone form factor with thin bezels. The phone is the physical subject; the screenshot IS the on-screen content. NEVER substitute it for a bottle, jar, box, or any 3D consumer product shape.

If NO (real 3D product):
  Treat the reference as a physical product.

STEP 2 — PRODUCT FIDELITY (for both cases) — these are the only things that matter, never change them:
- Shape, silhouette, proportions: match the reference exactly
- All visible text, font, layout, illustrations, icons: every letter and mark must appear in the output, readable and unstyled
- Colors: every colour from the reference — match exactly
- Material finish: glass / plastic / metal / glass-fronted-phone — match the reference

DO NOT redesign, restyle, or substitute a generic product. If the reference shows an UpCircle Face Toner with a handwritten "UpCircle" script logo, render that exact bottle. If the reference shows a SaaS dashboard with a green sidebar and "Analytics" header, render a phone screen with that exact dashboard.

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

Render in ${aspectRatio} aspect ratio. The product label is readable.${customInstructions?.trim() ? `\n\nUSER INSTRUCTIONS (HIGH PRIORITY — apply to mood/scene/composition where applicable, override defaults where they conflict):\n${customInstructions.trim()}` : ''}`

  return callNanoBanana(prompt, [{ base64: productImageBase64, mimeType: productMimeType }], aspectRatio)
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
// When actorPortraitBase64 is provided, it is passed as the first reference image so Nano
// Banana uses it as the face/character reference; the product image follows as the second.
export async function generateCharacterWithProduct(
  productImageBase64: string,
  productMimeType: string,
  productName: string,
  characterPrompt: string,
  scene: string,
  customInstructions?: string,
  aspectRatio: '9:16' | '1:1' | '16:9' | '3:4' = '9:16',
  actorPortraitBase64?: string,
  actorPortraitMimeType?: string,
  // Additional photos of the SAME product (e.g. candy: package + the
  // candies themselves). Appended as extra references with a prompt note.
  extraProductRefs?: Array<{ base64: string; mimeType: string }>,
): Promise<NanoBananaResult> {
  // Adaptive product placement — the reference image can be either a physical product
  // (skincare bottle, perfume) OR a screenshot of a software UI / app. Telling Nano
  // Banana to "wrap fingers around the bottle" caused it to literally render the UI
  // as a water bottle. The new prompt makes the model decide:
  //   - physical product → hold in hand
  //   - UI / screenshot → show on a phone or laptop screen in frame
  //   - logo / packaging artwork → on a visible product in the scene
  // No hardcoded shape words ('bottle', 'jar') so it stops hallucinating containers.
  const actorImageBlock = actorPortraitBase64 && actorPortraitMimeType
    ? `IMAGE REFERENCES:
- Image 1 (character): use this person's exact face, hair, skin, and body proportions. Match their appearance precisely — do NOT redesign or alter their look.
- Image 2 (product): use this as the product the character holds or displays.

`
    : ''

  const prompt = `${actorImageBlock}Using the attached ${actorPortraitBase64 ? 'second reference image' : 'reference image'} as the exact subject (preserve every detail — packaging, label text, UI layout, colours, shape, proportions — do not redesign or restyle), generate a hyper-realistic phone-selfie photograph for a UGC ad first frame.

CHARACTER: ${characterPrompt}

SCENE: ${scene}

REFERENCE IMAGE INTERPRETATION — STEP 1: classify the reference image before generating. Use these visual cues:

Is the reference an app/website/UI screenshot? Look for:
- Rectangular composition with software interface elements (buttons, menus, icons, sidebars, status bars, text content arranged in panels)
- Flat colours and crisp UI typography rather than photographic depth
- Browser chrome, mobile OS bars, or recognisable app layout
- Screenshots are almost always taken on a 16:9 or 9:16 RECTANGLE — not a freeform 3D product

If YES (UI screenshot) — RENDER A PHONE:
  The character holds a modern smartphone in one hand, screen tilted ~10° toward the camera. The phone's screen shows the EXACT UI from the reference image — every menu, button, colour, text label, icon must appear pixel-faithful. The phone is the physical object; the screenshot IS the screen content, not a held printout. Use a current iPhone form factor with thin bezels. The character's body partially blurs at the edges (selfie depth-of-field) but the phone screen stays in sharp focus so the UI is readable. NEVER substitute the UI for a generic product like a bottle, jar, or box.

If NO (it's a real 3D product like a bottle, jar, box, food, device, makeup, etc.):
  The character holds the product in one hand at mid-chest height, mid-lift toward the camera, fingers wrapped naturally around it, label angled slightly toward camera but not perfectly square.

If the reference is only a LOGO with transparent background:
  Place the character with a laptop or phone visible in scene, with the logo subtly present in the environment (laptop sticker, t-shirt, mug, screen) — do not make the logo into a held physical object.

CRITICAL: if you've classified the reference as a UI screenshot, the output MUST show a phone with that screen. Do NOT under any circumstances render it as a bottle, dropper, or any other 3D product shape.

CAMERA: handheld selfie, slight tilt (2°), iPhone front camera framing — face to mid-chest visible, hand/product/device visible at mid-chest height. Slightly off-centre composition, weight toward one side.

EXPRESSION: caught mid-moment — not a finished pose. Mid-smile starting, eyes alive and focused on the camera, mouth just parting to speak. Specific micro-expression, never a polished portrait smile.

REALISM ANCHORS — these must all be present:
- Skin: clear, healthy, even-toned with a natural subtle glow. LIGHT natural makeup (mascara, subtle blush, tinted lip). Barely-there real-skin micro-texture only. NO added moles, freckle clusters, or red patches on the nose or cheeks — those read as tacked-on AI imperfections. Individual face through bone structure and slight bone-level asymmetries, NOT through blemishes. Also NOT plastic AI-influencer template.
- Eyes: asymmetric catchlight, warm iris detail, lid weight natural, slight asymmetry between left and right
- Hair: flyaways, slight frizz, irregular part, baby hairs visible
- Lighting: single soft natural source (window or overhead), not studio
- Background: identifiable ${scene}, lived-in, not generic blur — soft but readable, must clearly read as ${scene}

Phone-camera-natural rendering: slight sensor grain in shadow areas, mild highlight clipping on the bright side of the face, no beauty filter, no over-sharpening, no glass-skin look, no commercial polish. The frame should read as a frozen second from a video that hasn't been recorded yet — a real person caught mid-moment on a real phone.

Render in ${aspectRatio} aspect ratio.${customInstructions?.trim() ? `\n\nUSER INSTRUCTIONS (HIGH PRIORITY — apply to the character's expression, pose, or scene; override defaults where they conflict):\n${customInstructions.trim()}` : ''}`

  const refs: Array<{ base64: string; mimeType: string }> = actorPortraitBase64 && actorPortraitMimeType
    ? [
        { base64: actorPortraitBase64, mimeType: actorPortraitMimeType },
        { base64: productImageBase64, mimeType: productMimeType },
      ]
    : [{ base64: productImageBase64, mimeType: productMimeType }]
  let finalPrompt = prompt
  if (extraProductRefs?.length) {
    refs.push(...extraProductRefs)
    finalPrompt += `\n\nMULTIPLE PRODUCT PHOTOS: the last ${extraProductRefs.length + 1} reference image(s) all show the SAME product from different sides or states (e.g. the sealed package AND the contents inside). Use them together to render the product faithfully — packaging exact from the package photo, contents exact from the contents photo. They are ONE product, not several.`
  }
  return callNanoBanana(finalPrompt, refs, aspectRatio)
}

// Generate a character in front of a large screen displaying the app/software UI.
// The UI screenshot is passed as a reference image — Nano Banana renders the person
// sitting or standing in front of a monitor/TV that faithfully shows the uploaded UI.
// No green screen, no chroma key — the composite is baked into the generated image.
export async function generateCharacterInFrontOfUI(
  uiScreenshotBase64: string,
  uiScreenshotMimeType: string,
  characterPrompt: string,
  aspectRatio: '9:16' | '1:1' | '16:9' | '3:4' = '9:16',
  actorPortraitBase64?: string,
  actorPortraitMimeType?: string,
): Promise<NanoBananaResult> {
  const actorBlock = actorPortraitBase64
    ? `IMAGE REFERENCES:
- Image 1 (person): use this person's exact face, hair, skin tone, and features. Match their appearance precisely — do NOT redesign or alter their look.
- Image 2 (UI screenshot): this is the app interface that must appear on the large screen in the background.

`
    : `IMAGE REFERENCE: This is the app/software UI — it must appear faithfully on a large screen behind the character.\n\n`

  const prompt = `${actorBlock}Generate a hyper-realistic UGC-style portrait for a software ad first frame.

CHARACTER: ${characterPrompt}. The character is NOT holding any phone or device. Both hands are relaxed at their sides or one hand gestures naturally toward camera.

SCENE: The character stands or sits slightly off-centre in front of a large wall-mounted monitor or TV screen that fills much of the background. The screen displays the EXACT app interface from the reference image — every panel, button, colour, text, and layout element must be faithfully reproduced on the screen. The screen is bright and crisp, clearly readable even with slight depth-of-field.

FRAMING: handheld selfie framing, face to mid-chest visible, slightly off-centre composition. The large screen behind them is partially visible above/around the character — gives context that this is a software demo environment (desk area, office corner, or casual home-office setup).

EXPRESSION: caught mid-sentence — eyebrow slightly raised, eyes alive and looking directly at camera, mouth just opening to speak. Confident, knowing expression like sharing a shortcut.

REALISM:
- Skin: clear, healthy, even-toned with a natural subtle glow. LIGHT natural makeup (mascara, subtle blush, tinted lip). Barely-there real-skin micro-texture only. NO added moles, freckle clusters, or red patches — those look like AI-tacked-on flaws. Individual features come from bone structure and subtle asymmetries. Also NOT plastic-smooth AI-influencer skin.
- Hair: flyaways, slight frizz
- Lighting: the screen's glow adds a soft blue/white fill light on the character from behind/above — this is realistic for someone standing in front of a lit screen
- Background: the large screen behind them, soft depth-of-field so edges blur naturally

CRITICAL: The character does NOT hold, touch, or interact with any device. The UI appears only on the background screen. The character is the focal point; the screen provides context.

Phone-camera-natural rendering: slight sensor grain, no studio polish. Should read as a real person filming themselves in front of their workspace.

Render in ${aspectRatio} aspect ratio.`

  const refs: Array<{ base64: string; mimeType: string }> = []
  if (actorPortraitBase64 && actorPortraitMimeType) {
    refs.push({ base64: actorPortraitBase64, mimeType: actorPortraitMimeType })
  }
  refs.push({ base64: uiScreenshotBase64, mimeType: uiScreenshotMimeType })

  return callNanoBanana(prompt, refs, aspectRatio)
}

// Convert a user's portrait photo into a UGC-format selfie frame (no product).
// Used when a custom photo is uploaded but no product is provided — Nano Banana
// preserves the person's face while applying the UGC scene and selfie framing.
export async function ugcifyPortrait(
  portraitBase64: string,
  portraitMimeType: string,
  scene: string,
  characterPrompt: string,
  aspectRatio: '9:16' | '1:1' | '16:9' | '3:4' = '9:16',
): Promise<NanoBananaResult> {
  const prompt = `Using the attached photo as a character reference, generate a hyper-realistic UGC selfie portrait.

CHARACTER: Match the person in the reference photo exactly — same face, hair, skin tone, and features. Do NOT redesign or alter their appearance.

SCENE: ${scene}

CAMERA: handheld selfie, slight tilt (2°), iPhone front camera framing — face to mid-chest visible, slightly off-centre composition.

EXPRESSION: caught mid-moment — not a finished pose. Mid-smile starting, eyes alive and focused on the camera.

REALISM ANCHORS:
- Skin texture: pores, slight unevenness, natural micro-imperfections, no beauty filter
- Eyes: asymmetric catchlight, warm iris detail, natural asymmetry
- Hair: flyaways, slight frizz, irregular part
- Lighting: single soft natural source (window or overhead)
- Background: identifiable ${scene}, lived-in, soft but readable

Phone-camera-natural rendering: slight sensor grain, no over-sharpening, no glass-skin look. Should read as a real person caught mid-moment on a real phone.

Render in ${aspectRatio} aspect ratio.`

  return callNanoBanana(prompt, [{ base64: portraitBase64, mimeType: portraitMimeType }], aspectRatio)
}

// Multi-shot cutaway frame renderer. Uses the refined anchor frame as the
// identity anchor (Image 1) and the clean product photo as the label anchor
// (Image 2) so cutaways share the same character + product with the main
// talking-head clip. Prompt is slot-specific and comes from lib/multi-shot.
export async function renderCutawayFrame(
  anchorFrameBase64: string,
  anchorFrameMimeType: string,
  productBase64: string,
  productMimeType: string,
  prompt: string,
  aspectRatio: '9:16' | '1:1' | '16:9' | '3:4' = '9:16',
): Promise<NanoBananaResult> {
  return callNanoBanana(
    prompt,
    [
      { base64: anchorFrameBase64, mimeType: anchorFrameMimeType },
      { base64: productBase64, mimeType: productMimeType },
    ],
    aspectRatio,
  )
}

// Pass 2 — product refinement / anti-Arcads pixel lock.
//
// The hero-frame render (pass 1) can scramble label text, logos, and small
// packaging details. This helper takes the already-generated hero frame plus
// the ORIGINAL clean product photo and asks Nano Banana to composite the
// exact product pixels into the character's hand, preserving everything else
// (face, hair, hands, background, lighting). Called only once — after the
// user picks one of the 4 frames from the picker — so we spend ~$0.03 per
// package, not $0.12.
export async function refineProductInFrame(
  frameBase64: string,
  frameMimeType: string,
  productBase64: string,
  productMimeType: string,
  productName: string,
  aspectRatio: '9:16' | '1:1' | '16:9' | '3:4' = '9:16',
): Promise<NanoBananaResult> {
  const prompt = `Two images are attached.
- Image 1 (SCENE): a first-frame photograph of a person holding or displaying a product. Preserve EVERYTHING in this image — the person's face, skin, hair, hands, wardrobe, background, lighting, mood, camera framing, and depth of field — with pixel-level fidelity. Do NOT redesign the person, background, or scene. Do NOT alter their expression or pose.
- Image 2 (PRODUCT): a clean reference photo of ${productName}. This is the source of truth for the packaging's exact label text, logo, colours, geometry, proportions, and any typography.

TASK: Replace whatever product-shaped object is currently in the person's hand (or on their body / in front of them) in Image 1 with the EXACT product from Image 2. Match the product's real orientation, real label text (letter-for-letter), real logo mark, real colours, real materials, and real proportions. If the object in Image 1 is misspelled, blurred, or a rough approximation, replace it entirely with the product from Image 2.

Then relight the newly composited product so it sits believably in the SCENE's original lighting — same key direction, same skin tone bounce, matching shadow softness, matching specular highlights on the packaging. The product should feel physically present in the character's grip, not pasted on. Preserve the character's finger positions naturally around the new product shape.

DO NOT change:
- The person's identity, face, or expression
- The person's hair, skin texture, wardrobe
- The scene's background, props, or ambient lighting
- The overall composition, framing, or aspect ratio
- Any part of the image that is not the product itself

DO NOT add: text overlays, watermarks, captions, or extra objects.

Output a single hyper-realistic phone-camera photograph, rendered in ${aspectRatio} aspect ratio.`

  return callNanoBanana(
    prompt,
    [
      { base64: frameBase64, mimeType: frameMimeType },
      { base64: productBase64, mimeType: productMimeType },
    ],
    aspectRatio,
  )
}
