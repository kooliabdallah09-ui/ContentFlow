// Identity reference sheet — a 16:9 mood-board collage of the same influencer
// in 6 different real-life candid situations. Used as the identity anchor for
// downstream photo shoots. Looks like a social media mood board, not a clinical
// 3D character turnaround — multiple angles/expressions help lock the face.

import { generateNanoBananaImage } from '@/lib/nanobanana'
import { SupabaseClient } from '@supabase/supabase-js'

const TURNAROUND_PROMPT = (appearancePrompt: string) => `Create a photorealistic character reference sheet for a social media influencer. Use the uploaded portrait as the strict source of truth for this person's exact face, hair, skin tone, and features.

Character: ${appearancePrompt}

Layout: A clean 3x2 grid (3 columns, 2 rows) of 6 panels showing the SAME person from different angles and distances. Thin neutral dividers between panels. No text, no labels, no watermarks, no UI elements.

Each panel is a hyper-realistic portrait photo — neutral studio or soft natural light, clean background. The person looks like a real attractive social media creator.

Panel 1 (top-left): Dead-center front view — face and shoulders, looking straight at camera. Neutral expression. Clean light.

Panel 2 (top-center): 45° left angle — face turned slightly left, still seeing both eyes, three-quarter view.

Panel 3 (top-right): Full 90° left profile — pure side view, showing the exact ear, nose bridge, and jaw silhouette.

Panel 4 (bottom-left): 45° right angle — face turned slightly right, mirror of panel 2.

Panel 5 (bottom-center): Full 90° right profile — pure side view from the right side.

Panel 6 (bottom-right): Slight downward angle from above — chin slightly down, showing the face from slightly elevated perspective.

Critical rules:
- The EXACT same person must appear in every panel: same face shape, cheekbones, eye shape, nose, lips, skin tone, hair color and texture.
- Consistent neutral background across all panels (soft white, grey, or studio tone).
- Skin looks healthy, smooth, and youthful — the plump unlined skin of someone in their early 20s.
- No text, no labels, no numbers, no watermarks anywhere.`

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
  const prompt = input.style === 'turnaround'
    ? TURNAROUND_PROMPT(input.appearancePrompt)
    : SHEET_PROMPT(input.appearancePrompt)
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
