import { generateImage } from '@/lib/gemini-image'
import { estimateDuration } from '@/lib/heygen'
import { generateActionFrame, generateCharacterWithProduct, generateProductOnlyFrame } from '@/lib/nanobanana'
import { submitSoraJob } from '@/lib/sora'
import { buildSoraPrompt } from '@/lib/sora-prompt'
import { generateSpeech } from '@/lib/tts'
import { submitBrollJob } from '@/lib/kling'
import { CREDIT_COSTS } from '@/lib/credits'
import {
  TIERS,
  DEFAULT_TIER,
  DEFAULT_DURATION,
  DURATION_OPTIONS,
  DURATION_CONFIGS,
  calculateVideoCredits,
  brollCountForDuration,
  type UGCTier,
  type UGCDuration,
} from '@/lib/tiers'
import { buildCharacterPrompt, type CharacterProfile } from '@/lib/character'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import sharp from 'sharp'

// Sora 2 requires the reference image dimensions to EXACTLY match the requested size
// (the model treats it as an inpaint base). Nano Banana outputs vary — usually 1024×1024 —
// so we always resize + center-crop before submitting.
const SORA_SIZE = '720x1280' // 9:16 portrait, Sora 2's supported vertical size
const [SORA_W, SORA_H] = SORA_SIZE.split('x').map(Number)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function generateUGCScript(
  productName: string,
  productDescription: string,
  benefits: string,
  callToAction: string,
  productImageBase64?: string,
  productImageMimeType?: string,
  // NEW: total target duration in seconds. Sora caps clips at 12s — without this,
  // Claude wrote 30s scripts that got cut off mid-sentence on Hero (12s) and Premium (8s).
  targetDurationSeconds: number = 30,
  // NEW: when the user picks a scene in the character questionnaire, force it here
  // so [BACKGROUND:] matches what Sora renders. Otherwise Claude invents one and the
  // questionnaire choice is ignored downstream.
  forcedScene?: string,
  // NEW: free-text user instructions injected into the prompt. Used for tone overrides
  // ("make it funny", "target Gen-Z"), constraints ("mention 30% off"), or for users
  // who paste their own full script and want Claude to format it into our template.
  customInstructions?: string,
  // NEW: language for the SPOKEN content. Section headers + stage directions stay in
  // English so our parser downstream can find [HOOK], [BODY], [CTA], [BACKGROUND].
  // The quoted spoken lines are written in this language.
  language?: { name: string; code: string },
): Promise<string> {
  // Spoken pace for AI voice (Sora native / OpenAI TTS / ElevenLabs) sits
  // around 120 wpm = 2.0 words/sec — slower than typical human reading speed
  // since AI voices add pause/emphasis. We were using 2.5 wps which caused
  // scripts to overrun and Sora cut off mid-sentence. Drop to 1.9 words/sec
  // and reserve 1.5s padding so the last word always lands before the clip ends.
  const targetWords = Math.max(6, Math.round((targetDurationSeconds - 1.5) * 1.9))
  const hookEnd = Math.min(5, Math.round(targetDurationSeconds * 0.2))
  const bodyEnd = Math.round(targetDurationSeconds * 0.85)

  const backgroundLine = forcedScene
    ? `[BACKGROUND: ${forcedScene}]   ← USE THIS EXACT SCENE, do not change it`
    : `[BACKGROUND: one of: bedroom, bathroom, kitchen, living room, office, gym, outdoor, car interior, cafe]`

  // Custom instructions block — added at the top of the prompt so Claude treats it
  // as priority context. If the user pasted a full script, Claude reformats into the
  // template; if it's a tone/constraint note, Claude obeys it while still writing.
  const customBlock = customInstructions?.trim()
    ? `\nUSER INSTRUCTIONS (HIGH PRIORITY — follow these exactly, override your defaults to match):\n${customInstructions.trim()}\n`
    : ''

  // Language block — applies to spoken content only. Stage directions and section
  // headers stay in English so the rest of the pipeline keeps parsing them.
  const languageBlock = language && language.code !== 'en'
    ? `\nLANGUAGE — All SPOKEN content (everything inside double quotes) MUST be written in ${language.name}. Stage directions in (parentheses) and section headers in [brackets] stay in English so the parser can read them. The CTA "${callToAction}" should also be translated to natural ${language.name}.\n`
    : ''

  const textPrompt = `Write a ${targetDurationSeconds}-SECOND UGC video script for a social media ad. The TOTAL spoken word count across HOOK + BODY + CTA must be ${targetWords} words or fewer — this is a hard limit because the video will be cut at ${targetDurationSeconds}s. Count carefully.

Product: ${productName}
Description: ${productDescription}
Benefits: ${benefits}
CTA: ${callToAction}
${languageBlock}${customBlock}
Use this exact format:

${backgroundLine}

[HOOK — 0:00 to 0:0${hookEnd}]
(brief expression/tone note)
"spoken hook line — grabs attention immediately"

[BODY — 0:0${hookEnd} to 0:${bodyEnd < 10 ? '0' + bodyEnd : bodyEnd}]
(tone note)
"spoken body — authentic, conversational. Keep it tight — total script ≤ ${targetWords} words."

[CTA — 0:${bodyEnd < 10 ? '0' + bodyEnd : bodyEnd} to 0:${targetDurationSeconds}]
(tone note)
"spoken CTA — natural, confident, very short"

Rules:
- TOTAL spoken word count ≤ ${targetWords} — count every word in every quoted line. This is the most important rule.
- Spoken text always in double quotes
- Stage directions always in (parentheses)
- Section headers always in [brackets]
- ${forcedScene ? `[BACKGROUND: ${forcedScene}] must be the very first line, use it exactly` : '[BACKGROUND: ...] must be the very first line — choose what fits the product naturally'}
- No markdown, no title, no hashtags
- Authentic UGC tone — real person, not corporate${customInstructions?.trim() ? `\n- The USER INSTRUCTIONS block above overrides default tone/style choices wherever they conflict.` : ''}`

  const content: Anthropic.MessageParam['content'] = productImageBase64
    ? [
        { type: 'image', source: { type: 'base64', media_type: productImageMimeType as 'image/jpeg' | 'image/png' | 'image/webp', data: productImageBase64 } },
        { type: 'text', text: textPrompt },
      ]
    : textPrompt

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [{ role: 'user', content }],
  })

  return (msg.content[0] as { text: string }).text.trim()
}

// Generate 2 ACTION DESCRIPTIONS for B-rolls — these describe what physically happens at
// the action peak (mid-spray, mid-apply, mid-bite). They feed Nano Banana to produce a
// frozen-mid-action frame, which Kling then animates forward via image-to-video.
// Action 1 = application (the moment of use). Action 2 = result/sensory (reaction, after-effect).
// One B-roll shot. Claude picks which kind fits each slot.
//   'character'  — the person using/holding/reacting to the product (hands/body in frame)
//   'product'    — product alone, hero-shot styled, no character
//   'lifestyle'  — the product in its native context (on a vanity, in a bag, on a desk)
export type BrollKind = 'character' | 'product' | 'lifestyle'
export interface BrollShot {
  kind: BrollKind
  label: string         // 2-3 word UI label, e.g. "Application moment"
  description: string   // full Kling prompt
}

async function generateBrollActions(
  productName: string,
  productDescription: string,
  background: string,
  count: number,
  imageBase64?: string,
  imageMimeType?: string,
  customInstructions?: string,
): Promise<BrollShot[]> {
  if (count <= 0) return []

  const customBlock = customInstructions?.trim()
    ? `\nUSER INSTRUCTIONS (HIGH PRIORITY — pick shots that match these, override defaults where they conflict):\n${customInstructions.trim()}\n`
    : ''

  // Tell Claude to MIX shot types. Common winning combos depending on product:
  //   - perfume/skincare: 1 character (application) + 1 product hero
  //   - food/drink: 1 character (sip/bite) + 1 product hero
  //   - tech/app: 1 character (using device) + 1 product hero or 1 lifestyle context
  // Claude picks. Output is N lines, each: KIND | LABEL | description
  const textPrompt = `Write ${count} B-roll shot${count > 1 ? 's' : ''} for a UGC ad about "${productName}" (${productDescription}). Setting: ${background}.
${imageBase64 ? 'The image above is the ACTUAL product — use what it looks like to decide the shots.\n' : ''}${customBlock}
Each shot must be ONE of these three kinds:

CHARACTER — the person using/holding/reacting to the product, body visible.
  Examples: hand mid-spray of perfume wrist with mist droplets; fingers mid-application of serum on cheek with product trail; mid-chew expression with food; thumb mid-tap on the phone screen; head tilted with hand running through just-conditioned hair.

PRODUCT — the product ALONE, no character, hero-shot styled.
  Examples: perfume bottle on marble surface with sunlight glint and shadow; serum bottle on bathroom vanity backlit by morning light; tech device on a wooden desk at a slight angle, screen on; food plated beautifully top-down; pill bottle and water glass side by side on linen.

LIFESTYLE — the product in its NATURAL context (no character or hands actively using it).
  Examples: perfume bottle on a dresser next to jewelry and a silk scarf; serum tucked into a tote bag with sunglasses; supplement bottle on a kitchen counter next to a smoothie; phone showing the app screen propped against a coffee cup.

${count >= 2 ? `STRATEGY for ${count} shots — pick a mix that fits this product type. Winning combinations:
- Character (application/use moment) + Product (clean hero shot)
- Character (reaction/satisfaction) + Lifestyle (product in environment)
- Character (application) + Character (reaction) — only if the product really shines through action
Don't pick all the same kind — variety is what makes UGC feel real.\n` : ''}
Output format — exactly ${count} line${count > 1 ? 's' : ''}, no headers, no numbering, no markdown. Each line:
KIND | LABEL | description

KIND must be exactly: CHARACTER, PRODUCT, or LIFESTYLE.
LABEL is 2-3 words for the UI ("Application moment", "Product hero", "Reaction shot", "On the vanity").
Description is a single concrete sentence with mid-action / mid-moment language. Body parts only when character is shown (hands, wrist, lips, side profile — never full face).

Output ONLY the ${count} line${count > 1 ? 's' : ''}, nothing else.`

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: imageBase64
        ? [
            { type: 'image' as const, source: { type: 'base64' as const, media_type: (imageMimeType ?? 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp', data: imageBase64 } },
            { type: 'text' as const, text: textPrompt },
          ]
        : textPrompt,
    }],
  })

  const raw = (msg.content[0] as { text: string }).text.trim()
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean).slice(0, count)

  const parsed: BrollShot[] = lines.map((line, i): BrollShot => {
    // Try the labeled "KIND | LABEL | description" format first.
    const parts = line.split('|').map(p => p.trim())
    if (parts.length >= 3) {
      const kindRaw = parts[0].toUpperCase()
      const kind: BrollKind = kindRaw === 'PRODUCT' ? 'product' : kindRaw === 'LIFESTYLE' ? 'lifestyle' : 'character'
      return { kind, label: parts[1] || `Shot ${i + 1}`, description: parts[2] }
    }
    // Unstructured fallback — assume character and use a generic label.
    return { kind: 'character', label: i === 0 ? 'Application moment' : 'Reaction moment', description: line }
  })

  // Sensible defaults if Claude returned fewer lines than requested.
  while (parsed.length < count) {
    parsed.push(
      parsed.length === 0
        ? { kind: 'character', label: 'Application moment', description: `Hand mid-lift bringing ${productName} toward the camera, fingers wrapped around it, label angled toward camera` }
        : { kind: 'product', label: 'Product hero', description: `${productName} on a clean surface with soft natural lighting, slight angle, sunlight glint on the label` },
    )
  }
  return parsed
}

// Replace the spoken line in the [HOOK ...] section with a user-picked hook.
// Preserves the section header, the (tone note) line, and everything else in the script.
function replaceHook(script: string, newHook: string): string {
  const lines = script.split('\n')
  let inHook = false
  let replaced = false
  const out: string[] = []
  for (const line of lines) {
    const t = line.trim()
    if (/^\[HOOK\b/i.test(t)) {
      inHook = true
      out.push(line)
      continue
    }
    if (inHook && /^\[/.test(t)) {
      inHook = false
      out.push(line)
      continue
    }
    if (inHook && !replaced && t && !t.startsWith('(') && !t.startsWith('[')) {
      out.push(`"${newHook.replace(/^["“”]|["“”]$/g, '').trim()}"`)
      replaced = true
      continue
    }
    out.push(line)
  }
  // If no [HOOK] section was found, prepend a synthetic one so TTS picks it up
  if (!replaced) return `[HOOK — 0:00 to 0:05]\n"${newHook}"\n\n${script}`
  return out.join('\n')
}

// Extract only the spoken lines (in "quotes") for sending to HeyGen TTS
function extractSpokenLines(script: string): string {
  const spoken: string[] = []
  for (const line of script.split('\n')) {
    const t = line.trim()
    // Skip section headers [HOOK...], stage directions (...), empty lines
    if (!t || t.startsWith('[') || t.startsWith('(')) continue
    // Collect lines that are quoted or plain text (strip surrounding quotes)
    const clean = t.replace(/^[""“”]|[""“”]$/g, '').trim()
    if (clean) spoken.push(clean)
  }
  return spoken.join(' ')
}

export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.slice(7))
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = userData.user.id
    const body = await request.json()
    const { ugcType, productName, productDescription, benefits, callToAction, style = 'realistic', imageSize = '1024x1024', avatarId, voiceId, productImageBase64, productImageMimeType, selectedHook, avatarGender, character: characterFromForm, customInstructions, language: languageRaw } = body
    // Resolve language; default to English. We accept whatever code the client sends
    // and pass the human-readable name into prompts so Claude doesn't have to remember ISO codes.
    const { getLanguage } = await import('@/lib/languages')
    const language = getLanguage(typeof languageRaw === 'string' ? languageRaw : undefined)
    // Sanity-cap custom instructions to prevent prompt-injection abuse via giant payloads.
    let safeCustomInstructions = typeof customInstructions === 'string'
      ? customInstructions.slice(0, 1500).trim() || undefined
      : undefined

    // Pull the user's brand profile so audience + tone get baked into the script.
    // Product name / description / benefits / CTA come from the form payload directly
    // (the UGC builder pre-fills them when "Use my brand profile" is on). This block
    // adds the bonus brand context that the form doesn't ask for.
    try {
      const { data: brand } = await supabase
        .from('brand_profiles')
        .select('target_audience, tone_of_voice')
        .eq('user_id', userId)
        .maybeSingle()
      const audience = brand?.target_audience?.trim()
      const tone = brand?.tone_of_voice?.trim()
      if (audience || tone) {
        const brandLines = [
          audience ? `Target audience: ${audience}` : '',
          tone ? `Tone of voice: ${tone}` : '',
        ].filter(Boolean).join('\n')
        // Prepend brand context to customInstructions so Claude treats it as priority
        // but the user's explicit instructions (if any) still override on conflict.
        safeCustomInstructions = safeCustomInstructions
          ? `${brandLines}\n\n${safeCustomInstructions}`
          : brandLines
        // Re-cap to 1500 chars after merging.
        if (safeCustomInstructions.length > 1500) {
          safeCustomInstructions = safeCustomInstructions.slice(0, 1500)
        }
      }
    } catch {
      // Brand profile load failures are non-fatal — generation still proceeds.
    }

    const character: CharacterProfile | undefined = characterFromForm
    const rawTier = (body.tier as UGCTier | undefined) ?? DEFAULT_TIER
    const tier: UGCTier = TIERS[rawTier]?.available ? rawTier : DEFAULT_TIER
    const tierCfg = TIERS[tier]

    // Duration: user-chosen total video length. Validates against the allowed set
    // AND against the per-duration `available` flag — extended/chained durations
    // are reserved for Push 2 and fall back to DEFAULT_DURATION here.
    const rawDuration = Number(body.duration ?? DEFAULT_DURATION)
    const allowedDurations: readonly number[] = DURATION_OPTIONS
    const dCfg = allowedDurations.includes(rawDuration) ? DURATION_CONFIGS[rawDuration] : null
    const duration: UGCDuration = dCfg?.available
      ? (rawDuration as UGCDuration)
      : DEFAULT_DURATION

    if (!ugcType || !productName || !productDescription || !benefits) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Calculate credit cost (video cost is tier-dependent)
    let totalCost = 0
    if (ugcType === 'image-with-voiceover' || ugcType === 'all') totalCost += CREDIT_COSTS.image
    if (ugcType === 'video-with-voiceover' || ugcType === 'all') totalCost += calculateVideoCredits(tier, duration)

    const { data: userCredits } = await supabase.from('user_credits').select('balance').eq('user_id', userId).single()
    if (!userCredits || userCredits.balance < totalCost) {
      return NextResponse.json({ error: `Insufficient credits. Need ${totalCost}, have ${userCredits?.balance ?? 0}` }, { status: 400 })
    }

    // Generate Claude script first.
    // - Target duration: Sora tiers must fit inside the clip cap (12s Hero, 8s Premium).
    //   Lean uses HeyGen with no hard cap so 30s is fine.
    // - Forced scene: when the user picked one in the character questionnaire, lock it in
    //   so [BACKGROUND:] downstream uses the same scene Sora will render.
    const scriptTargetDuration = duration  // both tiers are Sora-only now; script must fit
    const forcedScene = character?.scene?.trim() ? character.scene.toLowerCase() : undefined
    const baseScript = await generateUGCScript(
      productName,
      productDescription,
      benefits,
      callToAction || 'Try it today',
      productImageBase64,
      productImageMimeType,
      scriptTargetDuration,
      forcedScene,
      safeCustomInstructions,
      { name: language.name, code: language.code },
    )
    const script = selectedHook && typeof selectedHook === 'string' && selectedHook.trim()
      ? replaceHook(baseScript, selectedHook.trim())
      : baseScript

    const components: Record<string, any> = { script, language: language.code }

    // Generate image if needed
    if (ugcType === 'image-with-voiceover' || ugcType === 'all') {
      const imageResult = await generateImage(
        `Professional product showcase photo of ${productName}. ${productDescription}. Style: ${style}. Clean background, studio lighting, commercial quality.`,
        productImageBase64,
        productImageMimeType,
      )
      components.image = { url: imageResult.imageUrl, id: `gemini-${Date.now()}` }
    }

    // Submit HeyGen video job
    if (ugcType === 'video-with-voiceover' || ugcType === 'all') {
      const spokenScript = extractSpokenLines(script)

      // Extract background hint from script (e.g. "[BACKGROUND: bathroom]")
      const bgMatch = script.match(/\[BACKGROUND:\s*([^\]]+)\]/i)
      const backgroundContext = bgMatch?.[1]?.trim() ?? 'casual indoor setting'

      // All tiers now use Sora 2 for the A-roll. The tier just controls voice:
      //   Standard → Sora native audio (no extra TTS step)
      //   Hero     → muted Sora + ElevenLabs/OpenAI voice overlay during stitch
      let videoId: string
      const aRollProvider: 'sora-2' = 'sora-2'

      {
        if (!process.env.OPENAI_API_KEY) {
          return NextResponse.json({ error: 'Sora A-roll is not configured (OPENAI_API_KEY missing)' }, { status: 500 })
        }
        if (!productImageBase64 || !productImageMimeType) {
          return NextResponse.json({ error: 'Premium / Hero tier requires a product photo (used to anchor the AI character and product)' }, { status: 400 })
        }
        if (!process.env.REPLICATE_API_TOKEN) {
          return NextResponse.json({ error: 'Sora A-roll requires Nano Banana via Replicate (REPLICATE_API_TOKEN missing)' }, { status: 500 })
        }

        // 1. Nano Banana — character holding the real product, hyper-realistic phone-camera frame.
        // Build the character prompt from the user's CharacterBuilder answers when present (Premium/Hero).
        // Falls back to a generic prompt when the form character is missing or incomplete.
        const characterPrompt = character && character.gender
          ? buildCharacterPrompt(character)
          : avatarGender === 'Male'
            ? 'late 20s man, candid expression, real skin texture with pores and slight imperfections, natural hair with flyaways, casual outfit appropriate to the scene'
            : 'late 20s woman, candid expression, real skin texture with pores and slight imperfections, natural hair with flyaways, casual outfit appropriate to the scene'

        // User's chosen scene from the questionnaire overrides Claude's auto-extracted [BACKGROUND]
        const heroScene = character?.scene?.trim() ? character.scene.toLowerCase() : backgroundContext

        const heroFrame = await generateCharacterWithProduct(
          productImageBase64,
          productImageMimeType,
          productName,
          characterPrompt,
          heroScene,
          safeCustomInstructions,
        )

        // 2. Resize to Sora's exact dimensions (cover + center-crop, no distortion)
        const resizedHero = await sharp(Buffer.from(heroFrame.imageBase64, 'base64'))
          .resize(SORA_W, SORA_H, { fit: 'cover', position: 'center' })
          .png()
          .toBuffer()

        const heroFilename = `sora-source/${userId}-${Date.now()}.png`
        const { error: heroErr } = await supabase.storage
          .from('ugc-assets')
          .upload(heroFilename, resizedHero, { contentType: 'image/png', upsert: false })
        if (heroErr) throw new Error(`Failed to upload Sora source frame: ${heroErr.message}`)
        const { data: { publicUrl: heroUrl } } = supabase.storage.from('ugc-assets').getPublicUrl(heroFilename)

        // 3. Hero tier only: generate voice audio to overlay on the muted Sora video later.
        // lib/tts dispatches to OpenAI TTS for 'openai:*' voice IDs or ElevenLabs otherwise,
        // with an automatic fallback to OpenAI 'nova' if ElevenLabs rejects the request
        // (e.g. free-plan library-voice block). So if TTS throws here, both providers are
        // broken — fail BEFORE charging credits.
        // Premium uses Sora's native audio (no extra cost, no voice control).
        let elevenLabsAudioUrl: string | undefined
        if (tierCfg.useElevenLabs) {
          try {
            const audioBuf = await generateSpeech(spokenScript, voiceId)
            const audioFilename = `audio-gen/${userId}-${Date.now()}.mp3`
            const { error: audioErr } = await supabase.storage
              .from('ugc-assets')
              .upload(audioFilename, audioBuf, { contentType: 'audio/mpeg', upsert: false })
            if (audioErr) {
              return NextResponse.json({ error: `Hero tier voice upload failed: ${audioErr.message}` }, { status: 500 })
            }
            const { data: { publicUrl } } = supabase.storage.from('ugc-assets').getPublicUrl(audioFilename)
            elevenLabsAudioUrl = publicUrl
          } catch (err) {
            return NextResponse.json({
              error: `Hero tier voice generation failed (both ElevenLabs and OpenAI TTS): ${err instanceof Error ? err.message : 'unknown'}. No credits charged.`,
            }, { status: 502 })
          }
        }

        // 4. Claude builds the Sora 2 prompt (Camera→Subject→Action→...→Audio)
        const soraPrompt = await buildSoraPrompt({
          productName,
          productDescription,
          scene: backgroundContext,
          script: spokenScript,
          customInstructions: safeCustomInstructions,
        })

        // 5. Submit Sora 2 — returns immediately with a video id, client polls for completion.
        // Sora caps each generation at 12s, so we use the per-clip duration from the config.
        // (For extended/chained durations, this just means the first Sora clip — Push 2
        // adds the additional clips + extended B-roll fill.)
        const soraSeconds = DURATION_CONFIGS[duration].soraSeconds
        const sora = await submitSoraJob({
          prompt: soraPrompt,
          referenceImageUrl: heroUrl,
          durationSeconds: soraSeconds,
          size: SORA_SIZE,
        })
        videoId = sora.videoId
        if (elevenLabsAudioUrl) components.audioOverlayUrl = elevenLabsAudioUrl
      }

      // ---- shared post-submit: save early, submit B-rolls, return ----
      // duration: the EXACT length the final A-roll will be. Sora returns clips at the
      // requested length (4/8/12s native), so we know precisely. This drives the stitch
      // timeline + caption chunking — never use estimateDuration() here, the word-count
      // estimate was 7-12s off and caused frozen-frame tails on short videos.
      components.video = {
        videoId,
        status: 'processing',
        provider: aRollProvider,
        duration,
        estimatedDuration: duration,
      }

      // Save to DB immediately after HeyGen submits — never lose a video ID to a timeout
      const { data: ugcRow } = await supabase.from('ugc_content').insert({
        user_id: userId,
        content_type: 'video',
        external_id: `ugc-${Date.now()}`,
        storage_url: JSON.stringify(components),
        metadata: { ugcType, productName, productDescription, benefits, callToAction, script, tier, generatedAt: new Date().toISOString() },
        credit_cost: totalCost,
        status: 'generating',
      }).select('id').single()
      await supabase.from('user_credits').update({ balance: userCredits.balance - totalCost }).eq('user_id', userId)
      await supabase.from('credit_transactions').insert({
        user_id: userId, amount: totalCost, transaction_type: 'generation',
        content_type: 'ugc_package', description: `UGC package: ${productName} (${tier})`,
      })

      // Submit B-rolls after DB is saved. New action-driven pipeline:
      //   Claude → 2 action descriptions (application moment + reaction moment, product-specific)
      //   Nano Banana → 2 frozen-mid-action frames anchored on the real product image
      //   Kling image-to-video → animates each action frame forward into a 5s clip
      // Falls back gracefully: if Nano Banana fails for a frame, that slot uses Kling text-to-video
      // with the action description as the prompt. If everything is missing (no product image, no
      // Gemini key), both B-rolls use Kling text-to-video as before.
      //
      // B-roll count is duration-dependent: 4s = 0, 8s = 1, 12s+ = 2. A 4s video has no room
      // for a B-roll cut, so we skip the call entirely.
      const effectiveBrollCount = brollCountForDuration(duration, tierCfg.maxBrolls)
      const brollProviderReady = !!(process.env.REPLICATE_API_TOKEN || process.env.FAL_KEY || process.env.PIAPI_API_KEY)
      const brollShots = brollProviderReady && effectiveBrollCount > 0
        ? await generateBrollActions(productName, productDescription, backgroundContext, effectiveBrollCount, productImageBase64, productImageMimeType, safeCustomInstructions).catch(() => null)
        : null

      if (brollShots && brollShots.length) {
        const canUseNanoBanana = !!(productImageBase64 && productImageMimeType && process.env.REPLICATE_API_TOKEN)

        // For each shot: route by kind.
        //   character — Nano Banana action frame (character holding product) → Kling i2v
        //   product / lifestyle — Nano Banana product-only frame → Kling i2v (subtle camera motion)
        // Both kinds anchor on the real product image so the label/shape/color survives.
        // Without this, product/lifestyle shots used to go to Kling text-to-video with just a
        // word description — Kling hallucinated a generic bottle and the brand was lost.
        const KLING_I2V_CHARACTER_MOTION = 'Continue the action naturally from the starting frame — smooth realistic motion of the hands/body/product, 5 seconds, phone-camera handheld feel, soft natural lighting preserved, 9:16 vertical, no scene cuts, no new objects appearing'
        const KLING_I2V_PRODUCT_MOTION = 'Subtle cinematic motion from the starting frame — slow camera push-in toward the product, gentle light shift across the label, very slight rotation, 5 seconds, phone-camera handheld feel, soft natural lighting preserved, 9:16 vertical, no scene cuts, no new objects appearing, the product stays exactly as shown in the starting frame'

        const submissions = await Promise.all(brollShots.map(async (shot, i) => {
          if (canUseNanoBanana) {
            try {
              const isCharacter = shot.kind === 'character'
              const frame = isCharacter
                ? await generateActionFrame(productImageBase64!, productImageMimeType!, productName, shot.description, backgroundContext, safeCustomInstructions)
                : await generateProductOnlyFrame(productImageBase64!, productImageMimeType!, productName, shot.description, backgroundContext, shot.kind as 'product' | 'lifestyle', safeCustomInstructions)

              // Force 9:16 (720x1280) so Kling i2v inherits portrait aspect from the start frame.
              const resized = await sharp(Buffer.from(frame.imageBase64, 'base64'))
                .resize(720, 1280, { fit: 'cover', position: 'center' })
                .png()
                .toBuffer()
              const filename = `nano-banana/${userId}-${Date.now()}-${i}.png`
              const { error: upErr } = await supabase.storage
                .from('ugc-assets')
                .upload(filename, resized, { contentType: 'image/png', upsert: false })
              if (!upErr) {
                const { data: { publicUrl } } = supabase.storage.from('ugc-assets').getPublicUrl(filename)
                const motion = isCharacter ? KLING_I2V_CHARACTER_MOTION : KLING_I2V_PRODUCT_MOTION
                return await submitBrollJob(motion, publicUrl).catch(() => null)
              }
            } catch (err) {
              console.warn(`Nano Banana frame ${i} (${shot.kind}) failed, falling back to Kling text-to-video:`, err instanceof Error ? err.message : err)
            }
          }
          // Fallback: Kling text-to-video with the raw shot description (only if Nano Banana
          // path is unavailable — no OpenAI key or no product image uploaded).
          return await submitBrollJob(shot.description).catch(() => null)
        }))

        components.broll = submissions
          .map((sub, i) => sub ? {
            taskId: sub.taskId,
            status: 'processing',
            label: brollShots[i]?.label ?? `B-roll ${i + 1}`,
            kind: brollShots[i]?.kind,
          } : null)
          .filter(Boolean)

        if (ugcRow?.id) {
          await supabase.from('ugc_content')
            .update({ storage_url: JSON.stringify(components) })
            .eq('id', ugcRow.id)
        }
      }

      return NextResponse.json({
        success: true, ugcType, components, script,
        creditDeducted: totalCost, newBalance: userCredits.balance - totalCost,
      }, { status: 201 })
    }

    // image-only path falls through to single DB save
    const dbContentType = 'image'
    const dbStatus = 'completed'

    const { error: insertError } = await supabase.from('ugc_content').insert({
      user_id: userId,
      content_type: dbContentType,
      external_id: `ugc-${Date.now()}`,
      storage_url: JSON.stringify(components),
      metadata: { ugcType, productName, productDescription, benefits, callToAction, script, generatedAt: new Date().toISOString() },
      credit_cost: totalCost,
      status: dbStatus,
    })

    if (insertError) {
      console.error('DB insert error:', insertError)
      return NextResponse.json({ error: 'Failed to save UGC package' }, { status: 500 })
    }

    await supabase.from('user_credits').update({ balance: userCredits.balance - totalCost }).eq('user_id', userId)
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      amount: totalCost,
      transaction_type: 'generation',
      content_type: 'ugc_package',
      description: `UGC package: ${productName}`,
    })

    return NextResponse.json({
      success: true,
      ugcType,
      components,
      script,
      creditDeducted: totalCost,
      newBalance: userCredits.balance - totalCost,
    }, { status: 201 })

  } catch (error) {
    console.error('UGC orchestration error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Generation failed' }, { status: 500 })
  }
}
