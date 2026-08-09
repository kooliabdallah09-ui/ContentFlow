import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { loadBrandContext, formatBrandPrompt } from '@/lib/brand-context'
import { generateNanoBananaImage } from '@/lib/nanobanana'
import { generateVoice } from '@/lib/elevenlabs'
import { deductCredits } from '@/lib/deduct-credits'

export const maxDuration = 120

const ADMIN_EMAILS = new Set<string>([
  'abdallah.kooli@icloud.com',
  'abdallah@icloud.com',
  'kooliabdallah09@gmail.com',
])

export type CanvasItem =
  | { kind: 'image'; id: string; url: string; prompt: string; ratio: string; credits: number }
  | { kind: 'social'; id: string; posts: Record<string, string>; topic: string; credits: number }
  | { kind: 'voice'; id: string; audioUrl: string; text: string; duration?: number; credits: number }
  | { kind: 'brief'; id: string; title: string; hook: string; scenes: string[]; cta: string; platform: string }
  | { kind: 'error'; id: string; message: string }

const VOICE_IDS: Record<string, string> = {
  warm: 'EXAVITQu4vr4xnSDxMaL',
  professional: '21m00Tcm4TlvDq8ikWAM',
  energetic: 'AZnzlk1XvdvUeBnXmlld',
  calm: 'IKne3meq5aSn9XLyUdCD',
}

function nanoid() {
  return Math.random().toString(36).slice(2, 10)
}

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const { data: userData, error: userErr } = await supabase.auth.getUser(authHeader.slice(7))
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = userData.user
  const email = user.email?.toLowerCase() ?? ''
  if (!ADMIN_EMAILS.has(email)) {
    return NextResponse.json({ error: 'Studio access is admin-only during alpha' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const message: string = body.message ?? ''
  const history: Array<{ role: 'user' | 'assistant'; content: string }> = body.history ?? []

  if (!message.trim()) {
    return NextResponse.json({ error: 'Message required' }, { status: 400 })
  }

  // Load brand context
  const brandCtx = await loadBrandContext(supabase, user.id)
  const brandPrompt = formatBrandPrompt(brandCtx)

  // Load credit balance
  const { data: creditsRow } = await supabase
    .from('user_credits')
    .select('balance, pack_credits')
    .eq('user_id', user.id)
    .maybeSingle()
  let balance = creditsRow?.balance ?? 0
  let packCredits = creditsRow?.pack_credits ?? 0

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const systemPrompt = `You are the ContentFlow Studio AI — a creative director that helps users produce content.
You have access to tools to generate images, write social captions, create voiceovers, and plan UGC video briefs.

RULES:
- Use tools immediately when the intent is clear — don't ask "shall I generate that?"
- After using a tool, briefly describe what you made and suggest a logical next step
- For images: default ratio 1:1 unless user mentions Instagram/Stories (4:5/9:16) or YouTube (16:9)
- For social: always write all 4 platforms (instagram, facebook, twitter, linkedin) unless asked for specific ones
- Keep replies concise (2-4 sentences) — the canvas shows the output, don't re-describe it in detail
- When you don't know something, ask ONE targeted question, not several
- You know the user's brand context — incorporate it into every generation without being asked
${brandPrompt}`

  const tools: Anthropic.Tool[] = [
    {
      name: 'generate_image',
      description: 'Generate an image using AI. Calls the image generation API and returns a public URL.',
      input_schema: {
        type: 'object' as const,
        properties: {
          prompt: { type: 'string', description: 'Detailed image prompt' },
          ratio: { type: 'string', enum: ['1:1', '4:5', '9:16', '16:9'], description: 'Aspect ratio' },
          style: { type: 'string', enum: ['realistic', 'artistic', 'professional', 'minimalist'], description: 'Visual style' },
        },
        required: ['prompt', 'ratio', 'style'],
      },
    },
    {
      name: 'generate_social_captions',
      description: 'Write social media captions for multiple platforms.',
      input_schema: {
        type: 'object' as const,
        properties: {
          topic: { type: 'string', description: 'What the captions are about' },
          platforms: {
            type: 'array',
            items: { type: 'string', enum: ['instagram', 'facebook', 'twitter', 'linkedin'] },
            description: 'Which platforms to write for',
          },
          tone: { type: 'string', enum: ['bold', 'conversational', 'professional', 'storytelling'], description: 'Caption tone' },
        },
        required: ['topic', 'platforms', 'tone'],
      },
    },
    {
      name: 'generate_voiceover',
      description: 'Generate a voiceover audio file from a script.',
      input_schema: {
        type: 'object' as const,
        properties: {
          script: { type: 'string', description: 'The voiceover script text' },
          voice_style: { type: 'string', enum: ['warm', 'professional', 'energetic', 'calm'], description: 'Voice style/tone' },
        },
        required: ['script', 'voice_style'],
      },
    },
    {
      name: 'create_ugc_brief',
      description: 'Create a structured UGC video brief with hook, scenes, and CTA.',
      input_schema: {
        type: 'object' as const,
        properties: {
          product: { type: 'string', description: 'Product name or description' },
          goal: { type: 'string', description: 'Campaign goal (awareness, conversion, engagement)' },
          duration: { type: 'string', enum: ['4s', '8s', '12s'], description: 'Video duration' },
          tone: { type: 'string', description: 'Tone and vibe of the video' },
          platform: { type: 'string', description: 'Target platform (TikTok, Instagram, YouTube Shorts)' },
        },
        required: ['product', 'goal', 'duration', 'tone', 'platform'],
      },
    },
  ]

  const conversationMessages: Anthropic.MessageParam[] = [
    ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: message },
  ]

  // First Claude call — may return tool_use
  const firstResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: systemPrompt,
    tools,
    messages: conversationMessages,
  })

  const canvasItems: CanvasItem[] = []
  const toolResults: Anthropic.ToolResultBlockParam[] = []

  if (firstResponse.stop_reason === 'tool_use') {
    const toolUseBlocks = firstResponse.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    )

    for (const toolUse of toolUseBlocks) {
      const input = toolUse.input as Record<string, unknown>

      try {
        if (toolUse.name === 'generate_image') {
          if (balance < 5) {
            const item: CanvasItem = { kind: 'error', id: nanoid(), message: 'Not enough credits to generate an image (5 credits required).' }
            canvasItems.push(item)
            toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: 'Error: insufficient credits', is_error: true })
            continue
          }

          const prompt = input.prompt as string
          const ratio = (input.ratio as string) || '1:1'
          const style = (input.style as 'realistic' | 'artistic' | 'professional' | 'minimalist') || 'realistic'

          const result = await generateNanoBananaImage(prompt, { style, ratio: ratio as '1:1' | '4:5' | '9:16' | '16:9' })

          // Upload to Supabase storage
          const fileName = `studio/${user.id}-${Date.now()}.png`
          const imageBuffer = Buffer.from(result.imageBase64, 'base64')
          const { error: uploadError } = await supabase.storage
            .from('ugc-assets')
            .upload(fileName, imageBuffer, { contentType: result.mimeType, upsert: false })

          if (uploadError) {
            throw new Error(`Upload failed: ${uploadError.message}`)
          }

          const { data: urlData } = supabase.storage.from('ugc-assets').getPublicUrl(fileName)
          const publicUrl = urlData.publicUrl

          // Deduct credits
          const deducted = await deductCredits(supabase, user.id, 5, balance, packCredits)
          balance = deducted.newBalance
          packCredits = deducted.newPackCredits

          const item: CanvasItem = { kind: 'image', id: nanoid(), url: publicUrl, prompt, ratio, credits: 5 }
          canvasItems.push(item)
          toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: `Image generated and available at: ${publicUrl}` })
        } else if (toolUse.name === 'generate_social_captions') {
          if (balance < 5) {
            const item: CanvasItem = { kind: 'error', id: nanoid(), message: 'Not enough credits to generate social captions (5 credits required).' }
            canvasItems.push(item)
            toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: 'Error: insufficient credits', is_error: true })
            continue
          }

          const topic = input.topic as string
          const platforms = (input.platforms as string[]) || ['instagram', 'facebook', 'twitter', 'linkedin']
          const tone = input.tone as string

          // Use claude-haiku to write captions (separate instance to avoid recursion)
          const haikuClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
          const captionRes = await haikuClient.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1200,
            messages: [{
              role: 'user',
              content: `Write social media captions for the following platforms: ${platforms.join(', ')}.

Topic: ${topic}
Tone: ${tone}
${brandPrompt ? `Brand context:\n${brandPrompt}` : ''}

Return a JSON object with platform names as keys and caption text as values. Example:
{"instagram": "caption here...", "facebook": "caption here...", "twitter": "tweet here...", "linkedin": "post here..."}

Only include the platforms listed. Return ONLY valid JSON, no markdown.`,
            }],
          })

          const rawText = captionRes.content[0].type === 'text' ? captionRes.content[0].text.trim() : '{}'
          const jsonStart = rawText.indexOf('{')
          const jsonEnd = rawText.lastIndexOf('}')
          const posts: Record<string, string> = jsonStart >= 0 && jsonEnd > jsonStart
            ? JSON.parse(rawText.slice(jsonStart, jsonEnd + 1))
            : {}

          const deducted = await deductCredits(supabase, user.id, 5, balance, packCredits)
          balance = deducted.newBalance
          packCredits = deducted.newPackCredits

          const item: CanvasItem = { kind: 'social', id: nanoid(), posts, topic, credits: 5 }
          canvasItems.push(item)
          toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: `Social captions generated for: ${platforms.join(', ')}` })
        } else if (toolUse.name === 'generate_voiceover') {
          if (balance < 5) {
            const item: CanvasItem = { kind: 'error', id: nanoid(), message: 'Not enough credits to generate a voiceover (5 credits required).' }
            canvasItems.push(item)
            toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: 'Error: insufficient credits', is_error: true })
            continue
          }

          const script = input.script as string
          const voiceStyle = (input.voice_style as string) || 'professional'
          const voiceId = VOICE_IDS[voiceStyle] ?? VOICE_IDS.professional

          const voiceResult = await generateVoice(script, voiceId, 0.5, 0.75)

          const deducted = await deductCredits(supabase, user.id, 5, balance, packCredits)
          balance = deducted.newBalance
          packCredits = deducted.newPackCredits

          const item: CanvasItem = {
            kind: 'voice',
            id: nanoid(),
            audioUrl: voiceResult.audioUrl,
            text: script,
            duration: voiceResult.duration,
            credits: 5,
          }
          canvasItems.push(item)
          toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: `Voiceover generated. Duration: ~${voiceResult.duration}s, ${voiceResult.characterCount} characters.` })
        } else if (toolUse.name === 'create_ugc_brief') {
          const product = input.product as string
          const goal = input.goal as string
          const duration = input.duration as string
          const tone = input.tone as string
          const platform = input.platform as string

          // Use Claude haiku to compose the brief JSON
          const briefClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
          const briefRes = await briefClient.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1000,
            messages: [{
              role: 'user',
              content: `Create a structured UGC video brief.

Product: ${product}
Goal: ${goal}
Duration: ${duration}
Tone: ${tone}
Platform: ${platform}
${brandPrompt ? `Brand context:\n${brandPrompt}` : ''}

Return a JSON object with this exact shape:
{
  "title": "Brief title",
  "hook": "The opening hook line (first 2 seconds)",
  "scenes": [
    "Scene 1: visual description | VO: voiceover text",
    "Scene 2: visual description | VO: voiceover text",
    "Scene 3: visual description | VO: voiceover text"
  ],
  "cta": "Call to action text"
}

Return ONLY valid JSON, no markdown.`,
            }],
          })

          const rawBriefText = briefRes.content[0].type === 'text' ? briefRes.content[0].text.trim() : '{}'
          const briefJsonStart = rawBriefText.indexOf('{')
          const briefJsonEnd = rawBriefText.lastIndexOf('}')
          const briefData = briefJsonStart >= 0 && briefJsonEnd > briefJsonStart
            ? JSON.parse(rawBriefText.slice(briefJsonStart, briefJsonEnd + 1))
            : { title: 'UGC Brief', hook: '', scenes: [], cta: '' }

          const item: CanvasItem = {
            kind: 'brief',
            id: nanoid(),
            title: briefData.title ?? 'UGC Brief',
            hook: briefData.hook ?? '',
            scenes: Array.isArray(briefData.scenes) ? briefData.scenes : [],
            cta: briefData.cta ?? '',
            platform,
          }
          canvasItems.push(item)
          toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: `UGC brief created for ${platform}: "${briefData.title}"` })
        } else {
          toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: 'Unknown tool', is_error: true })
        }
      } catch (toolErr) {
        console.error(`[studio] tool ${toolUse.name} error:`, toolErr)
        const errMsg = toolErr instanceof Error ? toolErr.message : 'Tool execution failed'
        canvasItems.push({ kind: 'error', id: nanoid(), message: `${toolUse.name}: ${errMsg}` })
        toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: `Error: ${errMsg}`, is_error: true })
      }
    }

    // Second Claude call with tool results to get final reply
    const secondResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: systemPrompt,
      tools,
      messages: [
        ...conversationMessages,
        { role: 'assistant', content: firstResponse.content },
        { role: 'user', content: toolResults },
      ],
    })

    const replyText = secondResponse.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim()

    return NextResponse.json({ reply: replyText, canvasItems })
  }

  // No tool use — direct text reply
  const replyText = firstResponse.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('\n')
    .trim()

  return NextResponse.json({ reply: replyText, canvasItems: [] })
}
