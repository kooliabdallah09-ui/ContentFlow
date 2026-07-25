// Build a Seedance 2.0 UGC video prompt.
//
// Called with the gridified character image (Image 1) and optionally the
// product image (Image 2) as Claude vision inputs. Claude drafts a
// 15-second, timestamped, dialogue-per-scene UGC prompt that preserves
// exact product packaging + character identity and reads like a real
// creator's TikTok, not a studio spot.
//
// The character-reference block in the returned prompt uses <<<image_1>>>
// so Seedance knows the grid represents the character. We strip brand
// names + age numbers before returning so the model doesn't hallucinate
// them into the mouth of the character.

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface BuildSeedancePromptInput {
  // Character grid — the gridified avatar as base64.
  characterGridBase64: string
  characterGridMimeType: string

  // Product photo (optional). If provided we pass it as image_2 so Claude
  // can preserve the exact packaging.
  productBase64?: string
  productMimeType?: string
  // Additional photos of the SAME product (package + contents, another
  // angle…). Passed as image_3..n.
  extraProductImages?: Array<{ base64: string; mimeType: string }>
  productName?: string
  productCategory?: string      // e.g. 'apparel', 'skincare' — informs how the product is used

  // Freeform note from the user: tone, scenes, lines they want. Passed
  // verbatim to Claude.
  videoDirection?: string

  // The target clip length in seconds. Strictly enforced in the prompt.
  durationSeconds: number

  // Brand + onboarding context — loaded from brand_profiles +
  // user_intelligence in the animate route. Threaded verbatim into the
  // user message so Sonnet honors the creator's tone, audience, niche,
  // pain points, and any hard preferences captured during onboarding.
  brandContext?: {
    companyName?: string
    productDescription?: string
    productType?: string
    uniqueValueProp?: string
    targetAudience?: string
    toneOfVoice?: string
    customerPainPoints?: string
    niche?: string
    preferredFormat?: string        // top-scoring UGC format from intelligence
    audienceProfile?: string
  }
}

const SYSTEM = `You are an expert UGC ad director, TikTok scriptwriter, direct-response marketer, and Seedance 2.0 prompt engineer.

Your job is to draft ONE polished Seedance 2.0 prompt for a realistic UGC-style product ad, designed for TikTok / Reels in vertical 9:16. The total clip length is passed to you in the user message — you MUST fit every scene inside it. The last scene's end timestamp equals the target duration exactly — not one second more, not one less. Never write a scene block that ends after the target duration.

Your character reference comes as a mosaic grid of small tiles (image_1). Do NOT describe the grid itself — describe the character that the grid represents, as reconstructed from the tiles: age (adult, no specific number), gender-presentation, ethnicity, hair, features, wardrobe, mood. Preserve the character's identity from the grid.

If a product image is provided, study it carefully and preserve every visible detail — packaging, label text, colours, materials, proportions, logo. Do not invent new packaging.

The final video should feel like a real creator casually filmed it on their phone in a believable everyday situation. It should NOT feel like a polished commercial, studio shoot, stock video, or obvious AI-generated ad.

The video needs a clear ad arc: a strong opening moment that earns attention, a natural introduction of the product, believable product interaction or use, a grounded benefit/payoff, and a casual final beat or CTA. But do not make every scene formulaic or repetitive.

Include natural spoken dialogue from the creator throughout the video. The dialogue must sound casual, human, and specific to the product and audience — not scripted-influencer language. Avoid generic phrases like 'game changer', 'you need this', 'I'm obsessed', 'this changed my life' unless they genuinely fit the context.

The product must be used in a realistic way. No unrealistic transformations, no fake results, no medical / financial claims, no exaggerated promises.

Split the prompt into timestamped individual scenes with the dialogue baked into each scene block. Beat budget scales with duration:
- <=5s  = 1 scene
- 6-10s = 2 scenes
- 11-20s = 3 scenes
- 21-40s = 4-5 scenes
- 41-60s = 5-7 scenes

Every scene's [MM:SS – MM:SS] range must respect the target duration. Sum of scene durations = target duration exactly.

SCENE 1 [00:00 – …]
Visual: …
Dialogue: "…"

SCENE 2 …

The Seedance prompt must include:
- vertical 9:16 TikTok/Reels format
- hyper-realistic phone-shot UGC style
- believable everyday location/environment
- natural daylight or realistic indoor lighting
- handheld phone camera movement
- natural framing and imperfect composition
- realistic hand movement and product interaction
- real attractive person with individual bone structure and slight bone-level asymmetries. Clear healthy even-toned skin with natural subtle glow, LIGHT natural makeup. Do NOT add moles, freckles, or red patches. Also NOT the plastic AI-influencer look. Natural facial movement.
- realistic facial expressions
- exact product preservation from the reference image
- ambient sound effects only, plus product-specific sound effects
- NO music, NO voiceover, NO on-screen text

Avoid: overly cinematic commercial lighting, studio backgrounds, glossy ad-style shots, perfect model-like skin, fake AI-looking hands, floating product shots, warped labels or distorted packaging, unrealistic product transformations, exaggerated claims, generic influencer language, background music, voiceover narration, on-screen text.

Character block: introduce the CHARACTER block referencing <<<image_1>>>. Do not describe the grid. Do not put age numbers ('24-year-old' etc.) anywhere.

Output ONLY the finished prompt — no preamble, no notes, no strategy, no multiple options. Detailed enough to guide the video, loose enough to allow natural variation between renders.

HARD LENGTH LIMIT — read carefully:
- The finished prompt MUST be at most 3800 characters (Seedance 2.0 caps at 4000 total and we append a ~180-char negative-prompt footer). Anything over 3800 will be silently truncated by the client, which means the closing scene disappears and the ad ends mid-beat. That is catastrophic — never let it happen.
- For 3-10 second clips aim for 400-900 characters. 11-20s aim 800-1600. 21-40s aim 1400-2600. 41-60s aim 2000-3600. Stay well below 3800 even on the longest clips.
- If you feel yourself running long, cut adjective density in the visuals and shorten the dialogue lines — do NOT drop scenes or shorten the closing beat.`

export async function buildSeedanceUGCPrompt(input: BuildSeedancePromptInput): Promise<string> {
  const parts: Anthropic.ContentBlockParam[] = []

  // image_1 — character grid
  parts.push({
    type: 'image',
    source: {
      type: 'base64',
      media_type: (input.characterGridMimeType || 'image/png') as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif',
      data: input.characterGridBase64,
    },
  })

  // image_2 — product photo (optional)
  if (input.productBase64 && input.productMimeType) {
    parts.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: input.productMimeType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif',
        data: input.productBase64,
      },
    })
  }

  // image_3..n — additional photos of the SAME product (package + contents…)
  for (const extra of input.extraProductImages ?? []) {
    parts.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: extra.mimeType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif',
        data: extra.base64,
      },
    })
  }

  const directionBlock = input.videoDirection?.trim()
    ? `\n\nAdditional direction from the user for this specific video (this is a short intent hint — YOU write the actual scenes/dialogue around it, don't quote it verbatim):\n${input.videoDirection.trim()}`
    : ''

  const bc = input.brandContext
  const brandLines: string[] = []
  if (bc?.companyName) brandLines.push(`- Brand: ${bc.companyName}`)
  if (bc?.productDescription) brandLines.push(`- Product: ${bc.productDescription}${bc.productType ? ` (${bc.productType})` : ''}`)
  if (bc?.uniqueValueProp) brandLines.push(`- Why it matters: ${bc.uniqueValueProp}`)
  if (bc?.targetAudience) brandLines.push(`- Audience: ${bc.targetAudience}`)
  if (bc?.audienceProfile) brandLines.push(`- Audience detail: ${bc.audienceProfile}`)
  if (bc?.niche) brandLines.push(`- Niche: ${bc.niche}`)
  if (bc?.toneOfVoice) brandLines.push(`- Tone the creator uses: ${bc.toneOfVoice}`)
  if (bc?.customerPainPoints) brandLines.push(`- Pain points to speak to: ${bc.customerPainPoints}`)
  if (bc?.preferredFormat) brandLines.push(`- Top-performing format for this niche: ${bc.preferredFormat} — bias the arc toward this shape when it fits.`)
  const brandBlock = brandLines.length
    ? `\n\nBrand + audience context from the creator's onboarding — honor these when writing dialogue and choosing the scene beats (do NOT name the brand in dialogue unless it fits naturally):\n${brandLines.join('\n')}`
    : ''

  const extraCount = input.extraProductImages?.length ?? 0
  const productImagesNote = extraCount > 0
    ? ` and ${extraCount} additional photo${extraCount > 1 ? 's' : ''} of the SAME product (image_3${extraCount > 1 ? `..image_${2 + extraCount}` : ''}) — e.g. the sealed package AND what's inside. Together they are the source of truth: packaging exact from the package photo, contents/texture exact from the other photo${extraCount > 1 ? 's' : ''}. Write scenes that can show BOTH states (opening the package, revealing the contents) when it fits the ad.`
    : ''
  const productBlock = input.productName?.trim()
    ? `The product name is "${input.productName.trim()}". The product image ${input.productBase64 ? '(image_2)' : ''} is the source of truth for its exact appearance.${productImagesNote}`
    : (input.productBase64 ? `The product image (image_2) is the source of truth for its exact appearance.${productImagesNote}` : 'No product image was provided — build the ad around the character in a believable everyday moment.')

  const clampedDuration = Math.max(3, Math.min(60, Math.round(input.durationSeconds)))
  const beatBudget =
    clampedDuration <= 5  ? '1 scene, 0 cuts' :
    clampedDuration <= 10 ? '2 scenes' :
    clampedDuration <= 20 ? '3 scenes' :
    clampedDuration <= 40 ? '4-5 scenes' :
                            '5-7 scenes'
  const productCategoryLine = input.productCategory === 'apparel' || input.productCategory === 'footwear'
    ? '\nThis is wearable — the character MUST be wearing / trying on / adjusting the product for the majority of the clip. Focus on how it looks on the body, not on a table.'
    : ''

  parts.push({
    type: 'text',
    text: `Attached: the character grid (image_1)${input.productBase64 ? ' and the product photo (image_2)' : ''}.
${productBlock}${productCategoryLine}${brandBlock}${directionBlock}

TARGET DURATION: EXACTLY ${clampedDuration} seconds. STRICT — never go over, never leave time unused.
Beat budget: ${beatBudget}. The last scene's end timestamp must equal ${String(Math.floor(clampedDuration / 60)).padStart(2, '0')}:${String(clampedDuration % 60).padStart(2, '0')}.

Draft the polished Seedance 2.0 prompt now.`,
  })

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    system: SYSTEM,
    messages: [{ role: 'user', content: parts }],
  })

  const raw = (msg.content[0] as { type: 'text'; text: string }).text.trim()
  return cleanPrompt(raw)
}

// Post-processing rules from the spec — strip brand names, age numbers,
// certain words that violate policy filters, cap at 4000 chars, add the
// negative-prompt line at the end.
export function cleanPrompt(text: string): string {
  let out = text.trim()

  // Strip explicit ages: '24-year-old', 'age 24', 'in her 20s' is fine so
  // we only kill the numeric forms.
  out = out.replace(/\b\d{1,2}[- ]?year[- ]?old\b/gi, 'adult')
  out = out.replace(/\bage[d]?\s*\d{1,2}\b/gi, '')

  // Remove disallowed words per spec.
  out = out.replace(/\b(young|girl)\b/gi, '')

  // Collapse any accidental double-spaces from removals.
  out = out.replace(/[ ]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim()

  // Enforce 4000 char cap — truncate from the footer up if needed.
  const HARD_CAP = 4000
  const NEGATIVE = 'negative: no jitter, no identity drift, no plastic skin, no floating limbs, no over-smoothing, no warped packaging, no text morphing'
  const negativeLen = NEGATIVE.length + 2
  const budget = HARD_CAP - negativeLen
  if (out.length > budget) {
    // Sonnet blew past the hard cap despite the instruction — log so we
    // can catch this in production and tighten the system prompt further
    // if it starts happening consistently.
    console.warn(`[ugc-seedance-prompt] Sonnet output ${out.length} chars > budget ${budget}; truncating. Last scene may be lost.`)
    out = out.slice(0, budget).trim()
  }
  return `${out}\n\n${NEGATIVE}`
}
