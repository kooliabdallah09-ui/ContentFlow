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
  productName?: string

  // Freeform note from the user: tone, scenes, lines they want. Passed
  // verbatim to Claude.
  videoDirection?: string
}

const SYSTEM = `You are an expert UGC ad director, TikTok scriptwriter, direct-response marketer, and Seedance 2.0 prompt engineer.

Your job is to draft ONE polished 15-second Seedance 2.0 prompt for a realistic UGC-style product ad, designed for TikTok / Reels in vertical 9:16.

Your character reference comes as a mosaic grid of small tiles (image_1). Do NOT describe the grid itself — describe the character that the grid represents, as reconstructed from the tiles: age (adult, no specific number), gender-presentation, ethnicity, hair, features, wardrobe, mood. Preserve the character's identity from the grid.

If a product image is provided, study it carefully and preserve every visible detail — packaging, label text, colours, materials, proportions, logo. Do not invent new packaging.

The final video should feel like a real creator casually filmed it on their phone in a believable everyday situation. It should NOT feel like a polished commercial, studio shoot, stock video, or obvious AI-generated ad.

The video needs a clear ad arc: a strong opening moment that earns attention, a natural introduction of the product, believable product interaction or use, a grounded benefit/payoff, and a casual final beat or CTA. But do not make every scene formulaic or repetitive.

Include natural spoken dialogue from the creator throughout the video. The dialogue must sound casual, human, and specific to the product and audience — not scripted-influencer language. Avoid generic phrases like 'game changer', 'you need this', 'I'm obsessed', 'this changed my life' unless they genuinely fit the context.

The product must be used in a realistic way. No unrealistic transformations, no fake results, no medical / financial claims, no exaggerated promises.

Split the prompt into timestamped individual scenes with the dialogue baked into each scene block:

SCENE 1 [00:00 – 00:03]
Visual: …
Dialogue: "…"

SCENE 2 [00:03 – 00:07]
…

The Seedance prompt must include:
- vertical 9:16 TikTok/Reels format
- hyper-realistic phone-shot UGC style
- believable everyday location/environment
- natural daylight or realistic indoor lighting
- handheld phone camera movement
- natural framing and imperfect composition
- realistic hand movement and product interaction
- natural skin texture, pores, facial movement, small imperfections
- realistic facial expressions
- exact product preservation from the reference image
- ambient sound effects only, plus product-specific sound effects
- NO music, NO voiceover, NO on-screen text

Avoid: overly cinematic commercial lighting, studio backgrounds, glossy ad-style shots, perfect model-like skin, fake AI-looking hands, floating product shots, warped labels or distorted packaging, unrealistic product transformations, exaggerated claims, generic influencer language, background music, voiceover narration, on-screen text.

Character block: introduce the CHARACTER block referencing <<<image_1>>>. Do not describe the grid. Do not put age numbers ('24-year-old' etc.) anywhere.

Output ONLY the finished prompt — no preamble, no notes, no strategy, no multiple options. Detailed enough to guide the video, loose enough to allow natural variation between renders.`

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

  const directionBlock = input.videoDirection?.trim()
    ? `\n\nAdditional direction from the user for this specific video:\n${input.videoDirection.trim()}`
    : ''

  const productBlock = input.productName?.trim()
    ? `The product name is "${input.productName.trim()}". The product image ${input.productBase64 ? '(image_2)' : ''} is the source of truth for its exact appearance.`
    : (input.productBase64 ? 'The product image (image_2) is the source of truth for its exact appearance.' : 'No product image was provided — build the ad around the character in a believable everyday moment.')

  parts.push({
    type: 'text',
    text: `Attached: the character grid (image_1)${input.productBase64 ? ' and the product photo (image_2)' : ''}.
${productBlock}${directionBlock}

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
  if (out.length + negativeLen > HARD_CAP) {
    out = out.slice(0, HARD_CAP - negativeLen).trim()
  }
  return `${out}\n\n${NEGATIVE}`
}
