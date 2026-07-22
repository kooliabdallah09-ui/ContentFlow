// Character turnaround sheet — a single 16:9 image containing a multi-angle
// grid of the same person (full-body front / three-quarter / profile / back
// on the top row, head close-ups at matching angles on the bottom row) on a
// neutral studio background. Downstream Nano Banana calls use this sheet as
// the identity reference, which anchors the face + body far better than a
// single head-and-shoulders portrait.

import { generateNanoBananaImage } from '@/lib/nanobanana'
import { SupabaseClient } from '@supabase/supabase-js'

const SHEET_PROMPT = (appearancePrompt: string) => `Character reference turnaround sheet of ONE single person, laid out as a clean 2-row grid on a seamless light-grey studio background with soft even lighting:

TOP ROW (6 panels): FULL BODY from the very top of the head to the FEET — the entire person is visible in each panel: head, torso, waist, hips, legs, and shoes all inside the frame, standing relaxed with arms at sides, camera pulled back far enough that there is visible floor beneath their shoes. Angles: front view, three-quarter front view, left profile, right profile, three-quarter back view, back view.
BOTTOM ROW (6 panels): head-and-shoulders close-ups at the same angles: front, three-quarter front, left profile, right profile, three-quarter back, back of head.

THE PERSON: ${appearancePrompt}
They wear the same complete casual outfit in every panel INCLUDING visible pants/skirt and shoes — describe-appropriate bottoms and footwear must be rendered, never cropped out.

CRITICAL RULES:
- TOP ROW IS STRICTLY HEAD-TO-TOE. A panel that cuts off at the waist, hips, or knees is WRONG — the feet and shoes must be fully visible with floor space below them, like a fashion e-commerce model turnaround.
- It is the SAME person in every panel — identical face, hair, skin tone, build, and the exact same outfit in all 12 panels.
- Neutral relaxed expression, natural posture, photorealistic — real skin texture, natural face, no plastic face, no AI-smooth skin, no beauty filter, no illustration or 3D-render look.
- Panels separated by thin white gutters, equal sizes.
- No text, no labels, no watermarks, no camera interface, no logos.`

export async function generateCharacterSheet(input: {
  supabase: SupabaseClient
  userId: string
  influencerId: string
  appearancePrompt: string
  portraitUrl?: string          // just-rendered NB portrait — added as an anchor when no user refs exist
  model?: 'pro' | 'nb2'
  // Original user-uploaded reference photos. When present these become the
  // PRIMARY identity anchor for the sheet — the user's real photos, not the
  // AI's interpretation of them. Prevents cumulative drift across future
  // photoshoots.
  userReferenceImages?: Array<{ base64: string; mimeType: string }>
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

  const sheet = await generateNanoBananaImage(SHEET_PROMPT(input.appearancePrompt), {
    style: 'realistic',
    ratio: '16:9',
    model: input.model ?? 'pro',
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
