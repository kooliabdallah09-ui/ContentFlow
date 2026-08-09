import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { loadBrandContext, formatBrandPrompt } from '@/lib/brand-context'
import { generateNanoBananaImage } from '@/lib/nanobanana'
import { generateVoice } from '@/lib/elevenlabs'
import { deductCredits } from '@/lib/deduct-credits'

export const maxDuration = 300

// ─── Tavily web search ────────────────────────────────────────────────────────

async function tavilySearch(query: string, includeImages: boolean): Promise<{ text: string; imageUrls: string[] }> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) return { text: 'Web search unavailable — TAVILY_API_KEY not configured.', imageUrls: [] }
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: 5,
        search_depth: 'basic',
        include_answer: true,
        include_images: includeImages,
        include_raw_content: false,
      }),
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return { text: `Search failed (${res.status})`, imageUrls: [] }
    const data = await res.json()
    const answer = data.answer ? `Summary: ${data.answer}\n\n` : ''
    const results = (data.results ?? [])
      .map((r: { title: string; content: string; url: string }) =>
        `${r.title}\n${(r.content ?? '').slice(0, 500)}\nSource: ${r.url}`)
      .join('\n\n')
    const imageUrls: string[] = includeImages ? (data.images ?? []).slice(0, 5) : []
    return { text: `${answer}${results}`.trim(), imageUrls }
  } catch (e) {
    return { text: `Search error: ${e instanceof Error ? e.message : 'unknown'}`, imageUrls: [] }
  }
}

async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'ContentFlow/1.0' },
    })
    if (!res.ok) return null
    const ct = (res.headers.get('content-type') ?? 'image/jpeg').split(';')[0].trim()
    if (!ct.startsWith('image/')) return null
    const buf = await res.arrayBuffer()
    return { base64: Buffer.from(buf).toString('base64'), mimeType: ct }
  } catch {
    return null
  }
}

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

export type StepEvent = {
  type: 'step'
  label: string
  icon: 'think' | 'image' | 'social' | 'voice' | 'brief' | 'check'
  status: 'active' | 'done'
}
export type ResultEvent = { type: 'result'; reply: string; canvasItems: CanvasItem[] }
export type ErrorEvent  = { type: 'error'; message: string }
export type QuestionEvent = { type: 'question'; prompt: string; options: string[] }
type SSEEvent = StepEvent | ResultEvent | ErrorEvent | QuestionEvent

const VOICE_IDS: Record<string, string> = {
  warm: 'EXAVITQu4vr4xnSDxMaL',
  professional: '21m00Tcm4TlvDq8ikWAM',
  energetic: 'AZnzlk1XvdvUeBnXmlld',
  calm: 'IKne3meq5aSn9XLyUdCD',
}

function nanoid() { return Math.random().toString(36).slice(2, 10) }

const MODEL_CREDITS: Record<string, number> = {
  lumen:  1,
  animus: 3,
  aether: 10,
}

// Strip any markdown/URL artifacts from Claude's reply so the chat stays clean
function cleanReply(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')       // strip ![image](url)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')       // [link](url) → link text
    .replace(/https?:\/\/\S+/g, '')                // strip raw URLs
    .replace(/\n{3,}/g, '\n\n')                    // collapse excess newlines
    .trim()
}

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) return Response.json({ error: 'Server not configured' }, { status: 500 })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createClient(supabaseUrl, supabaseKey)
  const { data: userData, error: userErr } = await supabase.auth.getUser(authHeader.slice(7))
  if (userErr || !userData?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const user = userData.user
  if (!ADMIN_EMAILS.has(user.email?.toLowerCase() ?? '')) {
    return Response.json({ error: 'Studio access is admin-only during alpha' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const message: string = body.message ?? ''
  const history: Array<{ role: 'user' | 'assistant'; content: string }> = body.history ?? []
  const referenceImageBase64: string | undefined = body.referenceImageBase64
  const referenceImageMimeType: string = body.referenceImageMimeType ?? 'image/jpeg'
  const selectedItemContext = body.selectedItemContext as { kind: string; imageUrl?: string; prompt?: string; text?: string } | undefined
  const modelKey: string = body.model ?? 'studio'
  const MODEL_MAP: Record<string, string> = {
    lumen:  'claude-haiku-4-5-20251001',
    animus: 'claude-sonnet-4-6',
    aether: 'claude-opus-4-7',
  }
  const claudeModel = MODEL_MAP[modelKey] ?? 'claude-sonnet-4-6'
  if (!message.trim()) return Response.json({ error: 'Message required' }, { status: 400 })

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SSEEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      try {
        const brandCtx = await loadBrandContext(supabase, user.id)
        const brandPrompt = formatBrandPrompt(brandCtx)

        const { data: creditsRow } = await supabase
          .from('user_credits').select('balance, pack_credits').eq('user_id', user.id).maybeSingle()
        let balance = creditsRow?.balance ?? 0
        let packCredits = creditsRow?.pack_credits ?? 0

        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

        const refImageNote = referenceImageBase64
          ? `\nREFERENCE IMAGE PROVIDED: The user has attached a reference image. You can see it above. When calling generate_image, your prompt MUST mirror the reference image's exact visual style — extract and include: the specific color palette, lighting quality, background textures, composition/framing, mood, and any identifiable objects or UI elements. The generated image should look like it was shot in the same style as the reference. Do not write a generic prompt — describe what you actually see in the reference image.`
          : ''

        const systemPrompt = `You are the ContentFlow Studio AI — a creative director that helps brands produce content.
You have tools to generate images, write social captions, create voiceovers, and plan UGC video briefs.

CAPABILITIES: You generate images using ContentFlow's built-in image engine. You do NOT have access to external models or third-party tools — never mention model names like "NanoBanana", "DALL-E", "Midjourney", "Stable Diffusion", or any other. Just say "I'll generate that" and use your generate_image tool.

STRICT RULES:
- NEVER narrate. NEVER say "I'll generate", "I'm creating", "Now generating", "Got everything I need", "Working on it", or any variation. Saying these words is FORBIDDEN because nothing will happen unless you call a tool. If you need to generate — CALL THE TOOL. Text without a tool call = nothing appears on canvas = you failed.
- Use tools immediately when intent is clear — never ask "shall I generate that?"
- Write replies in plain, clean prose only. NO markdown. NO asterisks. NO URLs. NO image links.
- All generated content (images, audio, captions) appears on the canvas — never reference URLs in your reply.
- Keep replies to 1-2 sentences max: say what you made, then suggest one natural next step.
- Be direct and confident — like a creative director, not an assistant.
- Incorporate the user's brand context automatically without mentioning it.
${brandPrompt}${refImageNote}
WEB SEARCH RULE: Use search_web proactively whenever accuracy matters — competitor comparisons, real brand UI, current pricing/features, trending content, or any fact you're unsure about. For image tasks involving real-world UI or brands, always call search_web with include_images=true first, then pass the returned URLs as web_reference_urls to generate_image so NanoBanana can use them as visual references.

CAROUSEL RULE: When generating a carousel, you MUST call generate_image ONCE PER SLIDE in the SAME response — do not call it once and stop. A 6-slide carousel = 6 separate generate_image calls in one response. Each call must include the slide number and total in the prompt (e.g. "Slide 1 of 6: cover — ..."). Maintain a consistent visual style, ratio (1:1 for feed carousels), and color palette across all slides. Slide 1 = bold cover/title. Middle slides = content/comparison/features. Last slide = CTA or ranking/conclusion.

CLARIFICATION RULE: You MUST call ask_clarification before generating images whenever ANY of the following is true:
1. COUNT is not an explicit number (words like "some", "a few", "photos", "images" without a digit → ALWAYS ask "How many?")
2. FORMAT/RATIO is not specified and cannot be inferred from a platform name
3. STYLE is vague or unspecified

Ask ONE question that covers the most important unknown. Use ONLY these approved options — never expose internal model names:
- Count: "How many images?" → options: "1 image", "2 images", "3 images", "4 images"
- Format: "Which format?" → options: "Square 1:1", "Portrait 4:5 (Instagram)", "Story 9:16", "Landscape 16:9"
- Style: "What visual style?" → options: "Realistic photo", "Clean & minimal", "Artistic lifestyle", "Studio product"
- Platforms (captions): "Which platforms?" → options: "Instagram", "Instagram + Facebook", "Instagram + X + LinkedIn", "All platforms"
- Voice style: "What voice tone?" → options: "Warm & friendly", "Professional", "Energetic", "Calm & reassuring"

When multiple things are ambiguous, ask about COUNT first (it determines cost), then format on the next turn if still unclear.
Skip clarification ONLY when the user has given an explicit number AND a clear format/platform AND a clear style.`

        const tools: Anthropic.Tool[] = [
          {
            name: 'ask_clarification',
            description: 'Ask the user ONE focused clarifying question before generating. Use when count, ratio, style, platform, or tone is ambiguous. Do NOT use when intent is fully clear (e.g. user said "one 4:5 Instagram photo"). Keep the question short and direct. Provide 3–6 concise options.',
            input_schema: {
              type: 'object' as const,
              properties: {
                question: { type: 'string', description: 'Short direct question, max 12 words.' },
                options: { type: 'array', items: { type: 'string' }, description: '3–6 short options (1–5 words each).' },
              },
              required: ['question', 'options'],
            },
          },
          {
            name: 'search_web',
            description: 'Search the web for current information before generating content. Use this proactively when you need: competitor UI screenshots, real brand visuals, current trends, product details, or any accurate up-to-date facts. Set include_images=true when you need real web images to use as visual references for generate_image (e.g. to generate a carousel about competitors, search for their screenshots first).',
            input_schema: {
              type: 'object' as const,
              properties: {
                query: { type: 'string', description: 'Specific search query.' },
                include_images: { type: 'boolean', description: 'Set true to fetch real web images to use as visual references in generate_image via web_reference_urls.' },
              },
              required: ['query'],
            },
          },
          {
            name: 'generate_image',
            description: `Generate an image with AI. The result appears on the canvas — do not include the URL in your reply.${referenceImageBase64 ? ' A reference image was provided — analyze it carefully and mirror its exact visual style, color palette, lighting, background, and composition in your prompt.' : ''} If you called search_web with include_images=true, pass the returned image URLs as web_reference_urls so NanoBanana can use them as visual references.`,
            input_schema: {
              type: 'object' as const,
              properties: {
                prompt: { type: 'string', description: 'Detailed image prompt' },
                ratio: { type: 'string', enum: ['1:1', '4:5', '9:16', '16:9'], description: 'Aspect ratio — 4:5 for Instagram, 9:16 for Stories/Reels, 1:1 default' },
                style: { type: 'string', enum: ['realistic', 'artistic', 'professional', 'minimalist'] },
                web_reference_urls: { type: 'array', items: { type: 'string' }, description: 'URLs of real images found via search_web to use as visual references for generation. Max 3.' },
              },
              required: ['prompt', 'ratio', 'style'],
            },
          },
          {
            name: 'generate_social_captions',
            description: 'Write platform-native captions. Results appear on the canvas.',
            input_schema: {
              type: 'object' as const,
              properties: {
                topic: { type: 'string' },
                platforms: { type: 'array', items: { type: 'string', enum: ['instagram', 'facebook', 'twitter', 'linkedin'] } },
                tone: { type: 'string', enum: ['bold', 'conversational', 'professional', 'storytelling'] },
              },
              required: ['topic', 'platforms', 'tone'],
            },
          },
          {
            name: 'generate_voiceover',
            description: 'Generate a voiceover audio file. Results appear on the canvas.',
            input_schema: {
              type: 'object' as const,
              properties: {
                script: { type: 'string' },
                voice_style: { type: 'string', enum: ['warm', 'professional', 'energetic', 'calm'] },
              },
              required: ['script', 'voice_style'],
            },
          },
          {
            name: 'create_ugc_brief',
            description: 'Create a structured UGC video brief. Results appear on the canvas.',
            input_schema: {
              type: 'object' as const,
              properties: {
                product: { type: 'string' },
                goal: { type: 'string' },
                duration: { type: 'string', enum: ['4s', '8s', '12s'] },
                tone: { type: 'string' },
                platform: { type: 'string' },
              },
              required: ['product', 'goal', 'duration', 'tone', 'platform'],
            },
          },
        ]

        // Build the last user message — include a vision block if a reference image was attached
        const lastUserContent: Anthropic.ContentBlockParam[] = []
        if (referenceImageBase64) {
          lastUserContent.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: referenceImageMimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: referenceImageBase64,
            },
          })
        }

        // If user selected a canvas image, include it as a vision block
        if (selectedItemContext?.imageUrl) {
          lastUserContent.push({
            type: 'image',
            source: { type: 'url', url: selectedItemContext.imageUrl },
          } as Anthropic.ImageBlockParam)
        }

        // Build text with context prefix
        let textWithContext = message
        if (selectedItemContext) {
          const ctxNote = selectedItemContext.kind === 'image'
            ? `[User is asking about the selected canvas image: "${selectedItemContext.prompt ?? ''}". The image is shown above.]`
            : selectedItemContext.kind === 'social'
            ? `[User is asking about the selected canvas caption: "${(selectedItemContext.text ?? '').slice(0, 200)}"]`
            : `[User is asking about a selected canvas item (${selectedItemContext.kind})]`
          textWithContext = `${ctxNote}\n${message}`
        }

        if (referenceImageBase64) {
          lastUserContent.push({ type: 'text', text: `[Reference image attached above]\n${textWithContext}` })
        } else {
          lastUserContent.push({ type: 'text', text: textWithContext })
        }

        const conversationMessages: Anthropic.MessageParam[] = [
          ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
          { role: 'user', content: lastUserContent },
        ]

        // ── Agentic loop: Claude → tools → Claude → tools → … → text reply ──
        send({ type: 'step', label: 'Reading your request…', icon: 'think', status: 'active' })

        const canvasItems: CanvasItem[] = []
        let askedQuestion = false

        // agentMessages grows as we accumulate tool calls + results across iterations
        const agentMessages: Anthropic.MessageParam[] = [...conversationMessages]

        // Execute a single tool block and return the tool_result
        async function runTool(toolUse: Anthropic.ToolUseBlock): Promise<Anthropic.ToolResultBlockParam> {
          const input = toolUse.input as Record<string, unknown>
          try {
            // ── search_web ────────────────────────────────────────────────
            if (toolUse.name === 'search_web') {
              const query = String(input.query ?? '')
              const includeImages = Boolean(input.include_images)
              const searchLabel = `Searching the web…`
              send({ type: 'step', label: searchLabel, icon: 'think', status: 'active' })
              const { text, imageUrls } = await tavilySearch(query, includeImages)
              let content = text
              if (imageUrls.length > 0) {
                content += `\n\nWEB IMAGES AVAILABLE AS REFERENCES (pass as web_reference_urls in generate_image):\n${imageUrls.map((u, i) => `${i + 1}. ${u}`).join('\n')}`
              }
              send({ type: 'step', label: searchLabel, icon: 'think', status: 'done' })
              return { type: 'tool_result', tool_use_id: toolUse.id, content }

            // ── generate_image ────────────────────────────────────────────
            } else if (toolUse.name === 'generate_image') {
              const imgNum = canvasItems.filter(i => i.kind === 'image').length + 1
              const label = `Rendering image ${imgNum}…`
              send({ type: 'step', label, icon: 'image', status: 'active' })
              // Note: done event MUST use the same label so the frontend updates instead of adding a new row

              if (balance < 5) {
                canvasItems.push({ kind: 'error', id: nanoid(), message: 'Insufficient credits — need 5 to generate an image.' })
                send({ type: 'step', label, icon: 'image', status: 'done' })
                return { type: 'tool_result', tool_use_id: toolUse.id, content: 'Error: insufficient credits', is_error: true }
              }

              const prompt = String(input.prompt ?? '')
              const ratio = String(input.ratio ?? '1:1')
              const style = (input.style ?? 'realistic') as 'realistic' | 'artistic' | 'professional' | 'minimalist'
              const webRefUrls = Array.isArray(input.web_reference_urls)
                ? (input.web_reference_urls as string[]).slice(0, 3) : []

              const userRef = referenceImageBase64
                ? [{ base64: referenceImageBase64, mimeType: referenceImageMimeType }] : []
              let webRefs: Array<{ base64: string; mimeType: string }> = []
              if (webRefUrls.length > 0) {
                send({ type: 'step', label: 'Fetching web references…', icon: 'think', status: 'active' })
                const fetched = await Promise.all(webRefUrls.map(fetchImageAsBase64))
                webRefs = fetched.filter(Boolean) as Array<{ base64: string; mimeType: string }>
                send({ type: 'step', label: 'Fetching web references…', icon: 'think', status: 'done' })
              }
              const allRefs = [...userRef, ...webRefs]
              const hasWebRefs = webRefs.length > 0

              const result = await generateNanoBananaImage(prompt, {
                style,
                ratio: ratio as '1:1' | '4:5' | '9:16' | '16:9',
                referenceImages: allRefs.length > 0 ? allRefs : undefined,
                referenceHint: allRefs.length > 0
                  ? hasWebRefs
                    ? 'Use the attached web reference images as the visual foundation — replicate their color palette, UI layout, design language, and composition as closely as possible in the generated image.'
                    : 'Use the attached reference image as the primary visual style guide — mirror its color palette, lighting quality, background textures, composition, and mood.'
                  : undefined,
              })
              const fileName = `studio/${user.id}-${Date.now()}-${nanoid()}.png`
              await supabase.storage.from('ugc-assets').upload(fileName, Buffer.from(result.imageBase64, 'base64'), { contentType: result.mimeType, upsert: false })
              const { data: urlData } = supabase.storage.from('ugc-assets').getPublicUrl(fileName)

              const d1 = await deductCredits(supabase, user.id, 5, balance, packCredits)
              balance = d1.newBalance; packCredits = d1.newPackCredits

              canvasItems.push({ kind: 'image', id: nanoid(), url: urlData.publicUrl, prompt, ratio, credits: 5 })
              send({ type: 'step', label, icon: 'image', status: 'done' })
              return { type: 'tool_result', tool_use_id: toolUse.id, content: 'Image generated and added to canvas.' }

            // ── generate_social_captions ──────────────────────────────────
            } else if (toolUse.name === 'generate_social_captions') {
              send({ type: 'step', label: 'Writing captions…', icon: 'social', status: 'active' })

              if (balance < 5) {
                canvasItems.push({ kind: 'error', id: nanoid(), message: 'Insufficient credits — need 5 to generate captions.' })
                send({ type: 'step', label: 'Writing captions…', icon: 'social', status: 'done' })
                return { type: 'tool_result', tool_use_id: toolUse.id, content: 'Error: insufficient credits', is_error: true }
              }

              const topic = String(input.topic ?? '')
              const platforms = Array.isArray(input.platforms) ? input.platforms.map(String) : ['instagram', 'facebook', 'twitter', 'linkedin']
              const tone = String(input.tone ?? 'bold')

              const haikuClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
              const captionRes = await haikuClient.messages.create({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 1200,
                messages: [{
                  role: 'user',
                  content: `Write social media captions for: ${platforms.join(', ')}.\nTopic: ${topic}\nTone: ${tone}\n${brandPrompt ? `Brand:\n${brandPrompt}` : ''}\nReturn ONLY a JSON object with platform keys.`,
                }],
              })

              const raw = captionRes.content[0].type === 'text' ? captionRes.content[0].text.trim() : '{}'
              const posts: Record<string, string> = (() => { try { return JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) } catch { return {} } })()

              const d2 = await deductCredits(supabase, user.id, 5, balance, packCredits)
              balance = d2.newBalance; packCredits = d2.newPackCredits

              canvasItems.push({ kind: 'social', id: nanoid(), posts, topic, credits: 5 })
              send({ type: 'step', label: 'Captions ready', icon: 'social', status: 'done' })
              return { type: 'tool_result', tool_use_id: toolUse.id, content: 'Captions written and added to canvas.' }

            // ── generate_voiceover ────────────────────────────────────────
            } else if (toolUse.name === 'generate_voiceover') {
              send({ type: 'step', label: 'Recording voiceover…', icon: 'voice', status: 'active' })

              if (balance < 5) {
                canvasItems.push({ kind: 'error', id: nanoid(), message: 'Insufficient credits — need 5 to generate a voiceover.' })
                send({ type: 'step', label: 'Recording voiceover…', icon: 'voice', status: 'done' })
                return { type: 'tool_result', tool_use_id: toolUse.id, content: 'Error: insufficient credits', is_error: true }
              }

              const script = String(input.script ?? '')
              const voiceId = VOICE_IDS[String(input.voice_style ?? 'professional')] ?? VOICE_IDS.professional
              const voiceResult = await generateVoice(script, voiceId, 0.5, 0.75)

              const d3 = await deductCredits(supabase, user.id, 5, balance, packCredits)
              balance = d3.newBalance; packCredits = d3.newPackCredits

              canvasItems.push({ kind: 'voice', id: nanoid(), audioUrl: voiceResult.audioUrl, text: script, duration: voiceResult.duration, credits: 5 })
              send({ type: 'step', label: 'Voiceover ready', icon: 'voice', status: 'done' })
              return { type: 'tool_result', tool_use_id: toolUse.id, content: 'Voiceover recorded and added to canvas.' }

            // ── create_ugc_brief ──────────────────────────────────────────
            } else if (toolUse.name === 'create_ugc_brief') {
              send({ type: 'step', label: 'Planning UGC brief…', icon: 'brief', status: 'active' })

              const briefClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
              const briefRes = await briefClient.messages.create({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 1000,
                messages: [{
                  role: 'user',
                  content: `UGC video brief.\nProduct: ${input.product}\nGoal: ${input.goal}\nDuration: ${input.duration}\nTone: ${input.tone}\nPlatform: ${input.platform}\n${brandPrompt ? `Brand:\n${brandPrompt}` : ''}\nReturn ONLY JSON: {"title":"...","hook":"...","scenes":["...","...","..."],"cta":"..."}`,
                }],
              })

              const rawB = briefRes.content[0].type === 'text' ? briefRes.content[0].text.trim() : '{}'
              const briefData = (() => { try { return JSON.parse(rawB.slice(rawB.indexOf('{'), rawB.lastIndexOf('}') + 1)) } catch { return { title: 'UGC Brief', hook: '', scenes: [], cta: '' } } })()

              canvasItems.push({ kind: 'brief', id: nanoid(), title: briefData.title ?? 'UGC Brief', hook: briefData.hook ?? '', scenes: Array.isArray(briefData.scenes) ? briefData.scenes : [], cta: briefData.cta ?? '', platform: String(input.platform ?? '') })
              send({ type: 'step', label: 'Brief ready', icon: 'brief', status: 'done' })
              return { type: 'tool_result', tool_use_id: toolUse.id, content: 'Brief created and added to canvas.' }

            // ── ask_clarification ─────────────────────────────────────────
            } else if (toolUse.name === 'ask_clarification') {
              const q = String(input.question ?? '')
              const opts = Array.isArray(input.options) ? input.options.map(String) : []
              send({ type: 'question', prompt: q, options: opts })
              askedQuestion = true
              return { type: 'tool_result', tool_use_id: toolUse.id, content: 'Question shown to user.' }

            } else {
              return { type: 'tool_result', tool_use_id: toolUse.id, content: 'Unknown tool', is_error: true }
            }
          } catch (toolErr) {
            const errMsg = toolErr instanceof Error ? toolErr.message : 'Tool execution failed'
            canvasItems.push({ kind: 'error', id: nanoid(), message: errMsg })
            return { type: 'tool_result', tool_use_id: toolUse.id, content: `Error: ${errMsg}`, is_error: true }
          }
        }

        // Agentic loop — keep calling Claude with tools until it stops calling tools
        let loopResponse = await anthropic.messages.create({
          model: claudeModel,
          max_tokens: 4096,
          system: systemPrompt,
          tools,
          messages: agentMessages,
        })
        send({ type: 'step', label: 'Reading your request…', icon: 'think', status: 'done' })

        const MAX_ITERATIONS = 8
        let iterations = 0

        while (loopResponse.stop_reason === 'tool_use' && iterations < MAX_ITERATIONS) {
          iterations++
          const toolUseBlocks = loopResponse.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
          )

          // Run all tools in this turn (sequentially to preserve order)
          const toolResults: Anthropic.ToolResultBlockParam[] = []
          for (const toolUse of toolUseBlocks) {
            const result = await runTool(toolUse)
            toolResults.push(result)
          }

          if (askedQuestion) break

          // Append this turn's assistant message + tool results to the message chain
          agentMessages.push({ role: 'assistant', content: loopResponse.content })
          agentMessages.push({ role: 'user', content: toolResults })

          // Show a spinner while Claude decides what to do next (prevents "frozen" appearance)
          send({ type: 'step', label: 'Thinking…', icon: 'think', status: 'active' })

          // Call Claude again — WITH tools so it can continue (e.g. search then generate)
          loopResponse = await anthropic.messages.create({
            model: claudeModel,
            max_tokens: 4096,
            system: systemPrompt,
            tools,
            messages: agentMessages,
          })

          send({ type: 'step', label: 'Thinking…', icon: 'think', status: 'done' })
        }

        // Final text reply
        if (!askedQuestion) {
          send({ type: 'step', label: 'Composing reply…', icon: 'think', status: 'active' })

          let replyText = cleanReply(
            loopResponse.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map(b => b.text).join('\n')
          )

          // If Claude still narrated without generating (no canvas items and no reply), force a real reply
          if (!replyText && canvasItems.length === 0) {
            const fallback = await anthropic.messages.create({
              model: claudeModel,
              max_tokens: 256,
              system: systemPrompt,
              messages: [...agentMessages, { role: 'assistant', content: loopResponse.content }, { role: 'user', content: [{ type: 'text', text: 'Please respond to my request now.' }] }],
            })
            replyText = cleanReply(
              fallback.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map(b => b.text).join('\n')
            )
          }

          send({ type: 'step', label: 'Composing reply…', icon: 'think', status: 'done' })
          const convCost = MODEL_CREDITS[modelKey] ?? 3
          await deductCredits(supabase, user.id, convCost, balance, packCredits)
          send({ type: 'result', reply: replyText, canvasItems })
        } else {
          const convCost = MODEL_CREDITS[modelKey] ?? 3
          await deductCredits(supabase, user.id, convCost, balance, packCredits)
          send({ type: 'result', reply: '', canvasItems })
        }

      } catch (err) {
        console.error('[studio/chat]', err)
        send({ type: 'error', message: err instanceof Error ? err.message : 'Something went wrong' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
