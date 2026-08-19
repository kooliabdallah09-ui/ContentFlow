// Identity reference sheet — a 16:9 mood-board collage of the same influencer
// in 6 different real-life candid situations. Used as the identity anchor for
// downstream photo shoots. Looks like a social media mood board, not a clinical
// 3D character turnaround — multiple angles/expressions help lock the face.

import { generateNanoBananaImage } from '@/lib/nanobanana'
import { SupabaseClient } from '@supabase/supabase-js'

const TURNAROUND_PROMPT = (appearancePrompt: string) => `Create a photorealistic 3-panel character reference sheet for a social media influencer. Use the uploaded portrait as the strict source of truth for this person's exact face, hair, skin tone, and features. The face must be clearly visible and identical in Panels 1 and 3; hair must be visible in all 3 panels.

Character: ${appearancePrompt}

Layout: A single 16:9 landscape image divided vertically into exactly 3 equal-width panels separated by thin dark seams. No text, no labels, no numbers, no watermarks, no UI anywhere.

PANEL 1 (left third) — Front-facing standing portrait, HEAD FULLY VISIBLE:
The person stands centered, facing camera directly. The frame INCLUDES the entire head with clear headroom above the hair, all the way down to just below the knees or to the feet if space permits. The FACE MUST BE FULLY VISIBLE with clear features (eyes open, natural neutral expression, looking straight at camera). Do NOT crop or omit the head under any circumstances. Arms relaxed at sides. Well-fitted casual outfit. Plain neutral studio backdrop (soft warm grey or beige).

PANEL 2 (middle third) — Back view standing portrait, FULL HEAD VISIBLE FROM BEHIND:
The SAME person from directly behind, standing in the same pose against the SAME backdrop, same outfit. Frame INCLUDES the entire head from behind — the back of the head and all of the hair must be clearly visible with headroom above, extending down to match Panel 1's framing. Do NOT show a headless silhouette or crop the head. The back of the head and hair are the identity anchor for this panel.

PANEL 3 (right third) — Tight face close-up:
Head-and-shoulders portrait of the same person, face filling the majority of the frame, looking straight at camera with a neutral expression. Every facial detail sharp and pin-sharp: eyes, eyebrows, nose, lips, jawline, skin texture, and hair framing the face. Same lighting and neutral backdrop.

CRITICAL RULES (do not violate):
- HEADS ARE ALWAYS VISIBLE. Never generate a headless body, a cropped-off head, a floating collar, or any panel where the head is missing or above the frame line. If you cannot fit the full body with the head visible, prioritize showing the head and shoulders — but NEVER omit the head.
- The EXACT same person must appear in all 3 panels: identical face, hair, skin tone, outfit, and proportions.
- Studio-quality soft even light across all 3 panels. Consistent backdrop tone across all three.
- Skin healthy, smooth, and youthful — plump unlined skin of someone in their early 20s. No age texture.
- Panels aligned horizontally; consistent floor/horizon line between the two standing panels.
- No text, no labels, no numbers, no watermarks, no on-image UI.`

const SHEET_PROMPT = (appearancePrompt: string) => `Create a photorealistic identity reference sheet for a social media influencer. Use the uploaded portrait as the source of truth for this person's exact face, hair, skin tone, and features. Reproduce them faithfully across every panel.

Character: ${appearancePrompt}

Layout: A clean 3x2 grid (3 columns, 2 rows) of 6 photo panels, each showing the SAME person in a different real-life candid moment. Thin neutral dividers between panels. No text, no labels, no watermarks, no UI elements anywhere.

Each panel is a hyper-realistic smartphone-style photo — natural light only, no studio flash, candid and authentic. The person looks like a real attractive social media creator in every panel.

Panel 1 (top-left): Close portrait — face filling most of the frame, looking directly at camera with a soft natural expression. Warm window light. Natural makeup, healthy glowing skin.

Panel 2 (top-center): Lifestyle shot — shoulders up, in a bright airy bedroom or kitchen, holding a coffee mug, relaxed candid pose, soft smile or neutral expression.

Panel 3 (top-right): Outdoor — walking or standing outside in soft daylight, three-quarter body shot, casual outfit, hair catching the light naturally.

Panel 4 (bottom-left): Close-up at 3/4 angle — face turned slightly to the side, eyes looking just off-camera, pensive or relaxed expression. Tight crop showing the face structure clearly.

Panel 5 (bottom-center): Full lifestyle — waist-up or full body, in a casual home setting, natural posture, showing their signature style and outfit.

Panel 6 (bottom-right): Candid close-up — laughing or mid-expression, eyes crinkled naturally, very close crop on the face. Feels like a real spontaneous moment.

Critical rules:
- The EXACT same person must appear in every panel: same face shape, cheekbones, eye shape, nose, lips, skin tone, hair color and texture. Identity must be unmistakable across all panels.
- Every panel must look like a real candid photo taken with a smartphone. Natural light only.
- Skin looks healthy, smooth, and youthful — the plump unlined skin of someone in their early 20s. No sun spots, no fine lines, no wrinkles, no age texture. Clean and radiant.
- No text, no labels, no numbers, no watermarks, no UI anywhere in the image.`

export async function generateCharacterSheet(input: {
  supabase: SupabaseClient
  userId: string
  influencerId: string
  appearancePrompt: string
  portraitUrl?: string
  model?: 'pro' | 'nb2'
  userReferenceImages?: Array<{ base64: string; mimeType: string }>
  resolution?: '2K' | '4K'
  style?: 'lifestyle' | 'turnaround'
}): Promise<string> {
  const refs: Array<{ base64: string; mimeType: string }> = []
  if (input.userReferenceImages?.length) {
    refs.push(...input.userReferenceImages.slice(0, 3))
  }
  if (input.portraitUrl) {
    try {
      const r = await fetch(input.portraitUrl)
      if (r.ok) {
        refs.push({
          base64: Buffer.from(await r.arrayBuffer()).toString('base64'),
          mimeType: r.headers.get('content-type') || 'image/png',
        })
      }
    } catch { /* sheet still works text-only */ }
  }

  const model = 'pro' as const
  const resolution = '4K' as const
  const prompt = input.style === 'lifestyle'
    ? SHEET_PROMPT(input.appearancePrompt)
    : TURNAROUND_PROMPT(input.appearancePrompt)
  const sheet = await generateNanoBananaImage(prompt, {
    style: 'realistic',
    ratio: '16:9',
    model,
    resolution,
    referenceImages: refs.length ? refs : undefined,
    referenceHint: refs.length
      ? (input.userReferenceImages?.length
          ? `The FIRST ${Math.min(input.userReferenceImages.length, 3)} attached reference photo(s) ARE this character — the user's original photos. Every panel of the sheet must show THIS exact person: same face, hair, skin tone, distinctive features. Any additional images after are just AI-rendered portraits for framing hints — always defer to the user's original photos for identity.`
          : 'The person in the attached reference photo IS this character — every panel of the sheet must show THIS exact person: same face, hair, skin tone, and features.')
      : undefined,
  })

  const filename = `influencers/${input.userId}-${Date.now()}-sheet.png`
  const { error: upErr } = await input.supabase.storage
    .from('ugc-assets')
    .upload(filename, Buffer.from(sheet.imageBase64, 'base64'), { contentType: sheet.mimeType, upsert: false })
  if (upErr) throw new Error(`Sheet upload failed: ${upErr.message}`)
  const url = input.supabase.storage.from('ugc-assets').getPublicUrl(filename).data.publicUrl

  await input.supabase
    .from('user_influencers')
    .update({ character_sheet_url: url })
    .eq('id', input.influencerId)
    .eq('user_id', input.userId)

  return url
}
