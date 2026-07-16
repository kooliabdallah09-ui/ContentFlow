const REPLICATE_BASE = 'https://api.replicate.com/v1'
// Nano Banana Pro — the premium image model on Replicate. Better identity
// preservation + label fidelity than nano-banana-2, at ~2-3x the cost per
// image. Used for hero frames + product refinement + cutaway frames.
const NANO_BANANA_MODEL = 'google/nano-banana-pro'

interface NanoBananaResult {
  imageBase64: string
  mimeType: string
}

// Submit Nano Banana sync (Prefer: wait) — image gen is fast (~5–8s), no need to poll.
// Returns the generated image as base64 (fetched from Replicate's CDN URL).
// If referenceImages is omitted or empty, runs pure text-to-image (no reference fusion).
async function callNanoBanana(
  prompt: string,
  referenceImages?: Array<{ base64: string; mimeType: string }>,
  aspectRatio?: '1:1' | '4:3' | '3:4' | '16:9' | '9:16',
): Promise<NanoBananaResult> {
  const apiKey = process.env.REPLICATE_API_TOKEN
  if (!apiKey) throw new Error('REPLICATE_API_TOKEN not configured')

  const input: Record<string, unknown> = { prompt, output_format: 'png' }
  if (aspectRatio) input.aspect_ratio = aspectRatio
  if (referenceImages?.length) {
    input.image_input = referenceImages.map(r => `data:${r.mimeType};base64,${r.base64}`)
  }

  const res = await fetch(`${REPLICATE_BASE}/models/${NANO_BANANA_MODEL}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Prefer: 'wait', // sync mode — block until completion (typically 5-8s)
    },
    body: JSON.stringify({ input }),
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

// Generate a first frame for Sora 2 from a plain text prompt — no reference image.
// Used by the standalone /generate/video page when the user doesn't upload a ref.
// Output is a 9:16-friendly hyper-realistic still that Sora will animate forward.
export async function generateTextToImage(prompt: string): Promise<NanoBananaResult> {
  const wrapped = `${prompt}\n\nRender as a hyper-realistic phone-camera photograph in vertical 9:16 portrait orientation. Soft natural lighting, real skin texture and imperfections, no beauty filter, no studio polish, no commercial gloss. Should read as a candid moment captured on a real phone.`
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

  const refHint = options.referenceImageBase64
    ? '\n\nUse the attached reference image as the EXACT subject — preserve packaging, label text, colours, shape and proportions exactly. Apply the prompt as the scene + styling around the subject; do NOT redesign the subject itself.'
    : ''

  // Nano Banana 2 accepts 1:1, 4:3, 3:4, 16:9, 9:16. Our UI offers 4:5 too
  // (Instagram portrait) — map it to 3:4 which is the closest supported ratio.
  const nbRatio: '1:1' | '4:3' | '3:4' | '16:9' | '9:16' | undefined =
    options.ratio === '4:5' ? '3:4' : options.ratio

  const composed = `${prompt}\n\n${styleHint} ${ratioHint}${refHint}`
  const refs = options.referenceImageBase64 && options.referenceImageMimeType
    ? [{ base64: options.referenceImageBase64, mimeType: options.referenceImageMimeType }]
    : undefined
  return callNanoBanana(composed, refs, nbRatio)
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
  aspectRatio: '9:16' | '1:1' | '16:9' = '9:16',
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
  aspectRatio: '9:16' | '1:1' | '16:9' = '9:16',
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
  aspectRatio: '9:16' | '1:1' | '16:9' = '9:16',
  actorPortraitBase64?: string,
  actorPortraitMimeType?: string,
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
- Skin texture: pores, slight unevenness, any blemishes from the character description preserved, no smoothing
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
  return callNanoBanana(prompt, refs, aspectRatio)
}

// Generate a character in front of a large screen displaying the app/software UI.
// The UI screenshot is passed as a reference image — Nano Banana renders the person
// sitting or standing in front of a monitor/TV that faithfully shows the uploaded UI.
// No green screen, no chroma key — the composite is baked into the generated image.
export async function generateCharacterInFrontOfUI(
  uiScreenshotBase64: string,
  uiScreenshotMimeType: string,
  characterPrompt: string,
  aspectRatio: '9:16' | '1:1' | '16:9' = '9:16',
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
- Skin texture: pores, natural micro-imperfections, no beauty filter
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
  aspectRatio: '9:16' | '1:1' | '16:9' = '9:16',
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
  aspectRatio: '9:16' | '1:1' | '16:9' = '9:16',
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
  aspectRatio: '9:16' | '1:1' | '16:9' = '9:16',
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
