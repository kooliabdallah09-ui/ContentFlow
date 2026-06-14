import { generateImage } from '@/lib/gemini-image'
import { submitVideoJob, submitImageToVideoJob, submitAvatarVideoJob, createPhotoAvatar, estimateDuration } from '@/lib/heygen'
import { generatePersonWithProduct } from '@/lib/dalle'
import { generateSpeech } from '@/lib/elevenlabs'
import { submitBrollJob } from '@/lib/kling'
import { CREDIT_COSTS } from '@/lib/credits'
import { TIERS, DEFAULT_TIER, type UGCTier } from '@/lib/tiers'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function generateUGCScript(
  productName: string,
  productDescription: string,
  benefits: string,
  callToAction: string,
  productImageBase64?: string,
  productImageMimeType?: string,
): Promise<string> {
  const textPrompt = `Write a 30-second UGC video script for a social media ad. Format it exactly as shown below — no title, no intro text, just the script.

Product: ${productName}
Description: ${productDescription}
Benefits: ${benefits}
CTA: ${callToAction}

Use this exact format:

[BACKGROUND: one of: bedroom, bathroom, kitchen, living room, office, gym, outdoor]

[HOOK — 0:00 to 0:05]
(brief expression/tone note)
"spoken hook line — grabs attention immediately"

[BODY — 0:05 to 0:25]
(tone note)
"spoken body — authentic, conversational, like talking to a friend. 2-4 sentences."

[CTA — 0:25 to 0:35]
(tone note)
"spoken CTA — natural, confident"

Rules:
- Spoken text always in double quotes
- Stage directions always in (parentheses)
- Section headers always in [brackets]
- [BACKGROUND: ...] must be the very first line — choose what fits the product naturally
- No markdown, no title, no hashtags
- Authentic UGC tone — real person, not corporate`

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

async function generateBrollPrompts(
  productName: string,
  productDescription: string,
  background: string,
  imageBase64?: string,
  imageMimeType?: string,
): Promise<[string, string]> {
  const textPrompt = `Write exactly 2 short video generation prompts for cinematic B-roll clips to accompany a UGC ad for "${productName}" (${productDescription}). Setting context: ${background}.
${imageBase64 ? 'The image above shows the actual product — reference its exact appearance, colors, and packaging in the prompts.\n' : ''}
B-roll 1: A close-up product detail shot — the product alone on a surface or held in a hand, beautiful lighting, slight slow zoom or tilt, no people, cinematic 9:16 vertical.
B-roll 2: A usage action shot — determine the natural way to use this product (sunscreen → hands rubbing it into skin; perfume → spraying on wrist; food/drink → taking a bite or sip; tech → hands interacting with it; etc.) and show that specific action close-up, no face, hands only or body only, authentic and cinematic, 9:16 vertical.

Rules:
- Each prompt on its own line
- Cinematic, photorealistic, vertical 9:16 format
- No text, no watermarks, no full face shots
- Output ONLY the 2 prompts, nothing else`

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
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

  const lines = (msg.content[0] as { text: string }).text.trim().split('\n').filter(Boolean)
  return [lines[0] ?? `Cinematic close-up of ${productName}, beautiful studio lighting, slow zoom, 9:16 vertical`, lines[1] ?? `Lifestyle shot of ${productName} in a ${background}, natural light, cinematic, 9:16 vertical`]
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
    const { ugcType, productName, productDescription, benefits, callToAction, style = 'realistic', imageSize = '1024x1024', avatarId, voiceId, productImageBase64, productImageMimeType, selectedHook } = body
    const rawTier = (body.tier as UGCTier | undefined) ?? DEFAULT_TIER
    const tier: UGCTier = TIERS[rawTier]?.available ? rawTier : DEFAULT_TIER
    const tierCfg = TIERS[tier]

    if (!ugcType || !productName || !productDescription || !benefits) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Calculate credit cost (video cost is tier-dependent)
    let totalCost = 0
    if (ugcType === 'image-with-voiceover' || ugcType === 'all') totalCost += CREDIT_COSTS.image
    if (ugcType === 'video-with-voiceover' || ugcType === 'all') totalCost += tierCfg.videoCredits

    const { data: userCredits } = await supabase.from('user_credits').select('balance').eq('user_id', userId).single()
    if (!userCredits || userCredits.balance < totalCost) {
      return NextResponse.json({ error: `Insufficient credits. Need ${totalCost}, have ${userCredits?.balance ?? 0}` }, { status: 400 })
    }

    // Generate Claude script first
    const baseScript = await generateUGCScript(productName, productDescription, benefits, callToAction || 'Try it today', productImageBase64, productImageMimeType)
    const script = selectedHook && typeof selectedHook === 'string' && selectedHook.trim()
      ? replaceHook(baseScript, selectedHook.trim())
      : baseScript

    const components: Record<string, any> = { script }

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

      let videoId: string

      // Avatar IV path requires OpenAI (for person+product image gen) AND tier.useAvatarIV
      const useAvatarIVPath = tierCfg.useAvatarIV && !!process.env.OPENAI_API_KEY

      if (useAvatarIVPath) {
        // Run image generation and ElevenLabs audio in parallel (audio only on tiers that want it)
        const [personResult, audioBuffer] = await Promise.all([
          generatePersonWithProduct(productName, productDescription, backgroundContext, productImageBase64, productImageMimeType),
          tierCfg.useElevenLabs && process.env.ELEVENLABS_API_KEY
            ? generateSpeech(spokenScript, voiceId).catch(() => null)
            : Promise.resolve(null),
        ])

        // Upload person image to Supabase
        let heygenImageUrl = personResult.imageUrl
        if (heygenImageUrl.startsWith('data:')) {
          const mimeMatch = heygenImageUrl.match(/data:(image\/\w+);base64,/)
          const mime = mimeMatch?.[1] ?? 'image/png'
          const ext = mime.split('/')[1]
          const b64 = heygenImageUrl.split(',')[1]
          const imgBuf = Buffer.from(b64, 'base64')
          const filename = `avatar-gen/${userId}-${Date.now()}.${ext}`
          const { error: upErr } = await supabase.storage
            .from('ugc-assets')
            .upload(filename, imgBuf, { contentType: mime, upsert: false })
          if (!upErr) {
            const { data: { publicUrl } } = supabase.storage.from('ugc-assets').getPublicUrl(filename)
            heygenImageUrl = publicUrl
          }
        }

        // Upload ElevenLabs audio to Supabase if generated
        let audioUrl: string | undefined
        if (audioBuffer) {
          const audioFilename = `audio-gen/${userId}-${Date.now()}.mp3`
          const { error: audioErr } = await supabase.storage
            .from('ugc-assets')
            .upload(audioFilename, audioBuffer, { contentType: 'audio/mpeg', upsert: false })
          if (!audioErr) {
            const { data: { publicUrl } } = supabase.storage.from('ugc-assets').getPublicUrl(audioFilename)
            audioUrl = publicUrl
          }
        }

        // If ElevenLabs audio failed, fall back to a valid HeyGen voice ID
        const heygenFallbackVoiceId = '1bd001e7e50f421d891986aad5158bc8' // Sofia — known-good HeyGen voice
        const effectiveVoiceId = audioUrl ? voiceId : heygenFallbackVoiceId

        // Try Avatar IV path first (Photo Avatar + motion_prompt + expressiveness) for natural body motion
        // Fall back to plain image-to-video if photo-avatar creation fails
        const motionPrompt = `natural confident gestures, slight head movements, expressive hands holding the product up to camera, authentic UGC creator energy`
        try {
          const { avatarId: photoAvatarId } = await createPhotoAvatar(heygenImageUrl, `ugc-${userId}-${Date.now()}`)
          const heygenRes = await submitAvatarVideoJob(spokenScript, photoAvatarId, effectiveVoiceId, audioUrl, motionPrompt)
          videoId = heygenRes.videoId
        } catch (avatarErr) {
          console.warn('Avatar IV path failed, falling back to image-to-video:', avatarErr instanceof Error ? avatarErr.message : avatarErr)
          const heygenRes = await submitImageToVideoJob(spokenScript, heygenImageUrl, effectiveVoiceId, audioUrl)
          videoId = heygenRes.videoId
        }
      } else {
        // Lean path: stock HeyGen avatar, HeyGen TTS, no person-image generation
        const effectiveAvatarId = avatarId || 'Daisy-inskirt-20220818'
        const heygenVoiceId = '1bd001e7e50f421d891986aad5158bc8'
        const res = await submitVideoJob(spokenScript, effectiveAvatarId, heygenVoiceId)
        videoId = res.videoId
      }

      // ---- shared post-submit: save early, submit B-rolls, return ----
      components.video = { videoId, status: 'processing', estimatedDuration: estimateDuration(script) }

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

      // Submit Kling B-rolls after DB is saved — tier controls how many (lean=1, premium/hero=2)
      const brollProviderReady = !!(process.env.FAL_KEY || process.env.PIAPI_API_KEY)
      const brollPrompts = brollProviderReady && tierCfg.brollCount > 0
        ? await generateBrollPrompts(productName, productDescription, backgroundContext, productImageBase64, productImageMimeType).catch(() => null)
        : null

      if (brollPrompts) {
        const promptsToRender = brollPrompts.slice(0, tierCfg.brollCount)
        const submissions = await Promise.all(
          promptsToRender.map(p => submitBrollJob(p).catch(() => null))
        )
        const labels = ['Product close-up', 'Lifestyle shot']
        components.broll = submissions
          .map((sub, i) => sub ? { taskId: sub.taskId, status: 'processing', label: labels[i] ?? `B-roll ${i + 1}` } : null)
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
