// Character turnaround sheet — a single 16:9 image containing a multi-angle
// grid of the same person (full-body front / three-quarter / profile / back
// on the top row, head close-ups at matching angles on the bottom row) on a
// neutral studio background. Downstream Nano Banana calls use this sheet as
// the identity reference, which anchors the face + body far better than a
// single head-and-shoulders portrait.

import { generateNanoBananaImage } from '@/lib/nanobanana'
import { SupabaseClient } from '@supabase/supabase-js'

const SHEET_PROMPT = (appearancePrompt: string) => `Create a professional photorealistic character turnaround sheet using the uploaded character image as the main identity reference. The uploaded image is the source of truth for the character's face, body proportions, hairstyle, hair colour, skin tone, outfit, materials, accessories, silhouette, personality, and overall visual style. Preserve the character exactly apart from any changes made in the character description area. Do not change the costume, colours, hairstyle, age, build, or facial structure unless specifically instructed.

Character description: ${appearancePrompt}

Background: Neutral plain studio background. Clean lighting. No environment, no props unless part of the character design. The character must be easy to read clearly from every angle.

Canvas layout: Create one clean character sheet arranged in six vertical columns with thin, clean borders between each column. Each column must contain two stacked images of the same character:
Top section: full-body view
Bottom section: matching close-up portrait

The close-up portrait in each column must match the exact same rotation and facing direction as the full-body view directly above it. The portrait inherits the full-body rotation. The portrait must not use an independent camera angle, independent pose, or different facing direction.

Use even spacing, consistent scale, clean silhouettes, and a professional model-sheet layout. No text. No labels. No numbers. No logos. No captions.

Column order from LEFT to RIGHT:

Column 1 — FRONT VIEW, 0° rotation
Full body facing directly toward the camera. Portrait facing directly toward the camera. No rotation on the vertical axis. Both eyes visible. Chest, hips, knees, and feet facing forward.

Column 2 — 45° LEFT TURN
Character rotated exactly 45° toward screen-left. Rotation happens only on the vertical axis. Nose angled 45° toward screen-left. Both eyes visible. Torso, hips, knees, and feet rotated 45° toward screen-left. Portrait must match the exact same 45° left rotation. Portrait must face screen-left. Portrait must not rotate toward screen-right.

Column 3 — 90° LEFT PROFILE
Character facing fully toward screen-left in a strict side profile. Exact 90° rotation. Only one eye visible. Chest, hips, knees, and feet aligned toward screen-left. Portrait must be the exact same 90° left profile. Portrait must face screen-left only.

Column 4 — 90° RIGHT PROFILE
Character facing fully toward screen-right in a strict side profile. Exact 90° rotation. Only one eye visible. Chest, hips, knees, and feet aligned toward screen-right. Portrait must be the exact same 90° right profile. Portrait must face screen-right only.

Column 5 — 45° RIGHT TURN
Character rotated exactly 45° toward screen-right. Rotation happens only on the vertical axis. Nose angled 45° toward screen-right. Both eyes visible. Torso, hips, knees, and feet rotated 45° toward screen-right. Portrait must match the exact same 45° right rotation. Portrait must face screen-right. Portrait must not rotate toward screen-left.

Column 6 — BACK VIEW, 180° rotation
Character facing completely away from the camera. Full body shows the back of the outfit, back of the hair, back silhouette, and rear-facing posture. Portrait shows the back of the head only. No face visible in this column.

Critical consistency rules:
- The same character must appear in every column.
- The same outfit must appear in every column.
- The same hairstyle must appear in every column.
- The same body proportions must appear in every column.
- The same facial identity must appear in every visible portrait.
- The portrait rotation must exactly match the full-body rotation in the same column.
- Left-facing angles must never appear in right-facing columns.
- Right-facing angles must never appear in left-facing columns.
- Do not mirror the portraits incorrectly.
- Do not flip angles.
- Do not create mismatched rotations between full body and portrait.
- Do not change the costume between columns.
- Do not change the face between columns.
- Do not change the hairstyle between columns.
- Do not change the character's age, gender presentation, body type, or ethnicity.
- Do not add text, labels, numbers, watermarks, or UI elements.

Camera and style: Strict orthographic turnaround. No dramatic perspective distortion. No wide-angle lens distortion. Consistent camera height across all full-body views. Consistent portrait crop across all close-ups. Photorealistic DSLR studio lighting. Sharp detail. Clean professional character reference sheet. Cinematic realism with realistic fabric, skin, hair, and material detail.

Exact rotational progression across the sheet: 0° front → 45° left → 90° left profile → 90° right profile → 45° right → 180° back.`

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
  // '2K' (default, cheap) or '4K' (sharper close-ups — better identity
  // anchor for downstream shoots, but roughly 1.7× the NB Pro cost).
  resolution?: '2K' | '4K'
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

  // Character sheets are ALWAYS NB Pro at 4K — the sheet is the identity
  // anchor for every downstream shoot, and the 2K / NB2 variants shipped
  // visibly cheap-looking renders. Model + resolution inputs are ignored.
  const model = 'pro' as const
  const resolution = '4K' as const
  const sheet = await generateNanoBananaImage(SHEET_PROMPT(input.appearancePrompt), {
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
