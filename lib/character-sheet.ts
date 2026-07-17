// Character turnaround sheet — a single 16:9 image containing a multi-angle
// grid of the same person (full-body front / three-quarter / profile / back
// on the top row, head close-ups at matching angles on the bottom row) on a
// neutral studio background. Downstream Nano Banana calls use this sheet as
// the identity reference, which anchors the face + body far better than a
// single head-and-shoulders portrait.

import { generateNanoBananaImage } from '@/lib/nanobanana'
import { SupabaseClient } from '@supabase/supabase-js'

const SHEET_PROMPT = (appearancePrompt: string) => `Character reference turnaround sheet of ONE single person, laid out as a clean 2-row grid on a seamless light-grey studio background with soft even lighting:

TOP ROW (6 panels, full body head-to-toe, standing relaxed, arms at sides): front view, three-quarter front view, left profile, right profile, three-quarter back view, back view.
BOTTOM ROW (6 panels, head-and-shoulders close-ups at the same angles): front, three-quarter front, left profile, right profile, three-quarter back, back of head.

THE PERSON: ${appearancePrompt}

CRITICAL RULES:
- It is the SAME person in every panel — identical face, hair, skin tone, build, and the exact same casual outfit in all 12 panels.
- Neutral relaxed expression, natural posture, photorealistic — real skin texture, no beauty filter, no illustration or 3D-render look.
- Panels separated by thin white gutters, equal sizes, nothing cropped.
- No text, no labels, no watermarks, no camera interface, no logos.`

export async function generateCharacterSheet(input: {
  supabase: SupabaseClient
  userId: string
  influencerId: string
  appearancePrompt: string
  portraitUrl?: string          // identity anchor for the sheet itself
}): Promise<string> {
  let refs: Array<{ base64: string; mimeType: string }> | undefined
  if (input.portraitUrl) {
    try {
      const r = await fetch(input.portraitUrl)
      if (r.ok) {
        refs = [{
          base64: Buffer.from(await r.arrayBuffer()).toString('base64'),
          mimeType: r.headers.get('content-type') || 'image/png',
        }]
      }
    } catch { /* sheet still works text-only */ }
  }

  const sheet = await generateNanoBananaImage(SHEET_PROMPT(input.appearancePrompt), {
    style: 'realistic',
    ratio: '16:9',
    referenceImages: refs,
    referenceHint: refs
      ? 'The person in the attached reference photo IS this character — every panel of the sheet must show THIS exact person: same face, hair, skin tone, and features.'
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
