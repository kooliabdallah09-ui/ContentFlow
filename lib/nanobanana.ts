// Gemini 2.5 Flash Image — "Nano Banana"
// Multi-image-fusion native: takes a product reference image + a scene prompt and returns
// a generated image that preserves the product's exact packaging/text while compositing it
// into a new scene. Used as the source frame for B-roll image-to-video (Kling) and, in the
// Hero tier, as the source frame for the A-roll talking head (Sora 2).

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const MODEL = 'gemini-2.5-flash-image'

interface NanoBananaResult {
  imageBase64: string
  mimeType: string
}

async function callNanoBanana(prompt: string, referenceImageBase64: string, referenceMimeType: string): Promise<NanoBananaResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

  const res = await fetch(`${GEMINI_BASE}/models/${MODEL}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: referenceMimeType, data: referenceImageBase64 } },
        ],
      }],
      generation_config: { response_modalities: ['IMAGE'] },
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Nano Banana error ${res.status}: ${JSON.stringify(err)}`)
  }

  const data = await res.json()
  const parts = data?.candidates?.[0]?.content?.parts ?? []
  const imagePart = parts.find((p: { inline_data?: unknown }) => (p as { inline_data?: { data: string } }).inline_data)
  const inline = (imagePart as { inline_data?: { data: string; mime_type: string } } | undefined)?.inline_data
  if (!inline?.data) throw new Error(`Nano Banana returned no image. Response: ${JSON.stringify(data).slice(0, 500)}`)

  return { imageBase64: inline.data, mimeType: inline.mime_type || 'image/png' }
}

// Generate a product close-up hero shot for B-roll 1. The product appearance comes entirely
// from the attached reference image — the prompt only directs scene/composition/lighting.
export async function generateProductHeroShot(
  productImageBase64: string,
  productMimeType: string,
  productName: string,
  scene: string,
): Promise<NanoBananaResult> {
  const prompt = `Using the attached reference image as the exact product (preserve packaging, label text, colours, shape, and proportions exactly as shown — do not redesign or restyle), generate a cinematic product photograph of ${productName} in a ${scene} context.

The product is the hero of the shot — held at a slight angle so the label is readable but not perfectly square to camera, soft natural lighting from one side casting gentle shadow, shot from a phone-natural angle (not perfectly centred, slight perspective). Vertical 9:16 composition. No people visible in the frame, no hands holding the product. Lifestyle context implied by the background — soft, partially blurred, identifiable as the right space but not distracting.

Phone-camera-natural rendering: slight grain in the shadow areas, natural colour, no beauty filter, no studio-lighting look, no commercial product-shot polish. Should look like a real person snapped this on their iPhone, not a marketing photo.`

  return callNanoBanana(prompt, productImageBase64, productMimeType)
}

// Generate a character + product hero frame for the A-roll talking head (used in Hero tier).
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
