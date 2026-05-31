import { generateImage } from '@/lib/gemini-image'
import { submitVideoJob, submitImageToVideoJob, estimateDuration } from '@/lib/heygen'
import { generatePersonWithProduct } from '@/lib/dalle'
import { generateSpeech } from '@/lib/elevenlabs'
import { submitBrollJob } from '@/lib/kling'
import { CREDIT_COSTS } from '@/lib/credits'
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
): Promise<[string, string]> {
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `Write exactly 2 short video generation prompts for cinematic B-roll clips to accompany a UGC ad for "${productName}" (${productDescription}). Setting context: ${background}.

B-roll 1: A close-up product detail shot — the product alone, beautiful lighting, slight camera movement, no people.
B-roll 2: A lifestyle/context shot — the product being used or in its natural environment, cinematic feel, 9:16 vertical.

Rules:
- Each prompt on its own line
- Cinematic, photorealistic, vertical 9:16 format
- No text or watermarks in the scene
- Output ONLY the 2 prompts, nothing else`,
    }],
  })

  const lines = (msg.content[0] as { text: string }).text.trim().split('\n').filter(Boolean)
  return [lines[0] ?? `Cinematic close-up of ${productName}, beautiful studio lighting, slow zoom, 9:16 vertical`, lines[1] ?? `Lifestyle shot of ${productName} in a ${background}, natural light, cinematic, 9:16 vertical`]
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
    const { ugcType, productName, productDescription, benefits, callToAction, style = 'realistic', imageSize = '1024x1024', avatarId, voiceId, productImageBase64, productImageMimeType } = await request.json()

    if (!ugcType || !productName || !productDescription || !benefits) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Calculate credit cost
    let totalCost = 0
    if (ugcType === 'image-with-voiceover' || ugcType === 'all') totalCost += CREDIT_COSTS.image
    if (ugcType === 'video-with-voiceover' || ugcType === 'all') totalCost += CREDIT_COSTS.video

    const { data: userCredits } = await supabase.from('user_credits').select('balance').eq('user_id', userId).single()
    if (!userCredits || userCredits.balance < totalCost) {
      return NextResponse.json({ error: `Insufficient credits. Need ${totalCost}, have ${userCredits?.balance ?? 0}` }, { status: 400 })
    }

    // Generate Claude script first
    const script = await generateUGCScript(productName, productDescription, benefits, callToAction || 'Try it today', productImageBase64, productImageMimeType)

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

      if (process.env.OPENAI_API_KEY) {
        // Run image generation and ElevenLabs audio in parallel
        const [personResult, audioBuffer] = await Promise.all([
          generatePersonWithProduct(productName, productDescription, backgroundContext),
          process.env.ELEVENLABS_API_KEY
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

        const heygenRes = await submitImageToVideoJob(spokenScript, heygenImageUrl, audioUrl ? voiceId : heygenFallbackVoiceId, audioUrl)
        videoId = heygenRes.videoId

        // Save to DB immediately after HeyGen submits — never lose a video ID to a timeout
        components.video = { videoId, status: 'processing', estimatedDuration: estimateDuration(script) }
        const dbContentTypeEarly = 'video'
        await supabase.from('ugc_content').insert({
          user_id: userId,
          content_type: dbContentTypeEarly,
          external_id: `ugc-${Date.now()}`,
          storage_url: JSON.stringify(components),
          metadata: { ugcType, productName, productDescription, benefits, callToAction, script, generatedAt: new Date().toISOString() },
          credit_cost: totalCost,
          status: 'generating',
        })
        await supabase.from('user_credits').update({ balance: userCredits.balance - totalCost }).eq('user_id', userId)
        await supabase.from('credit_transactions').insert({
          user_id: userId, amount: totalCost, transaction_type: 'generation',
          content_type: 'ugc_package', description: `UGC package: ${productName}`,
        })

        // Submit Kling B-rolls after DB is saved — failures here won't lose the main video
        const brollPrompts = process.env.PIAPI_API_KEY
          ? await generateBrollPrompts(productName, productDescription, backgroundContext).catch(() => null)
          : null

        if (brollPrompts) {
          const [broll1, broll2] = await Promise.all([
            submitBrollJob(brollPrompts[0]).catch(() => null),
            submitBrollJob(brollPrompts[1]).catch(() => null),
          ])
          components.broll = [
            broll1 ? { taskId: broll1.taskId, status: 'processing', label: 'Product close-up' } : null,
            broll2 ? { taskId: broll2.taskId, status: 'processing', label: 'Lifestyle shot' } : null,
          ].filter(Boolean)
        }

        return NextResponse.json({
          success: true, ugcType, components, script,
          creditDeducted: totalCost, newBalance: userCredits.balance - totalCost,
        }, { status: 201 })
      } else {
        const effectiveAvatarId = avatarId || 'Daisy-inskirt-20220818'
        const res = await submitVideoJob(spokenScript, effectiveAvatarId, voiceId)
        videoId = res.videoId
      }

      components.video = {
        videoId,
        status: 'processing',
        estimatedDuration: estimateDuration(script),
      }
    }

    // Map to allowed content_type values ('image' | 'video' | 'voice')
    const dbContentType = (ugcType === 'image-with-voiceover') ? 'image' : 'video'
    const dbStatus = components.video ? 'generating' : 'completed'

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
