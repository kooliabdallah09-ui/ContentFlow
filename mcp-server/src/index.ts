#!/usr/bin/env node
import 'dotenv/config'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import Anthropic from '@anthropic-ai/sdk'
import { createSign, randomUUID } from 'node:crypto'

// ─── Vertex AI / NanoBanana image engine ─────────────────────────────────────

interface VertexSA {
  client_email: string
  private_key: string
  project_id: string
}

interface ImageResult {
  imageBase64: string
  mimeType: string
}

const GOOGLE_PRO_MODEL = process.env.GOOGLE_NANO_BANANA_PRO_MODEL ?? 'gemini-3-pro-image'
const GOOGLE_NB2_MODEL = process.env.GOOGLE_NANO_BANANA_MODEL ?? 'gemini-2.5-flash-image'
const VERTEX_REGION_PRO = process.env.GOOGLE_VERTEX_REGION_PRO ?? 'global'
const VERTEX_REGION_NB2 = process.env.GOOGLE_VERTEX_REGION ?? 'us-central1'

let _sa: VertexSA | null = null
let _tokenCache: { token: string; expiresAt: number } | null = null

function getSA(): VertexSA {
  if (_sa) return _sa
  const raw = process.env.GOOGLE_VERTEX_SA_JSON
  if (!raw) throw new Error('GOOGLE_VERTEX_SA_JSON is not set')
  _sa = JSON.parse(raw) as VertexSA
  return _sa
}

function b64url(input: Buffer | string) {
  return (typeof input === 'string' ? Buffer.from(input) : input)
    .toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

async function getVertexToken(): Promise<string> {
  const sa = getSA()
  const now = Math.floor(Date.now() / 1000)
  if (_tokenCache && _tokenCache.expiresAt > now + 60) return _tokenCache.token

  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  }))
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${claims}`)
  const jwt = `${header}.${claims}.${b64url(signer.sign(sa.private_key))}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  })
  if (!res.ok) throw new Error(`Vertex token error ${res.status}: ${await res.text()}`)
  const data = await res.json() as { access_token: string; expires_in: number }
  _tokenCache = { token: data.access_token, expiresAt: now + data.expires_in }
  return data.access_token
}

async function generateImage(
  prompt: string,
  options: {
    ratio?: '1:1' | '4:5' | '9:16' | '16:9'
    model?: 'pro' | 'nb2'
    referenceImages?: Array<{ base64: string; mimeType: string }>
  } = {}
): Promise<ImageResult> {
  const sa = getSA()
  const model = options.model ?? 'pro'
  const modelId = model === 'nb2' ? GOOGLE_NB2_MODEL : GOOGLE_PRO_MODEL
  const region = model === 'pro' ? VERTEX_REGION_PRO : VERTEX_REGION_NB2
  const host = region === 'global' ? 'aiplatform.googleapis.com' : `${region}-aiplatform.googleapis.com`

  const nbRatio: '1:1' | '4:3' | '3:4' | '16:9' | '9:16' | undefined =
    options.ratio === '4:5' ? '3:4' : options.ratio

  const parts: Array<Record<string, unknown>> = [{ text: prompt }]
  for (const ref of options.referenceImages ?? []) {
    parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.base64 } })
  }

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      ...(nbRatio ? { imageConfig: { aspectRatio: nbRatio } } : {}),
    },
  }

  const token = await getVertexToken()
  const url = `https://${host}/v1/projects/${sa.project_id}/locations/${region}/publishers/google/models/${modelId}:generateContent`

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 1200 * attempt))
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    })
    if (res.status === 429) { console.error(`[vertex] 429, retry ${attempt + 1}/3`); continue }
    if (!res.ok) throw new Error(`Vertex error ${res.status}: ${(await res.text()).slice(0, 400)}`)
    const data = await res.json()
    const parts2 = data?.candidates?.[0]?.content?.parts as Array<{ inlineData?: { data: string; mimeType: string } }> | undefined
    const img = parts2?.find(p => p.inlineData?.data)
    if (!img?.inlineData) throw new Error('Vertex returned no image')
    return { imageBase64: img.inlineData.data, mimeType: img.inlineData.mimeType ?? 'image/png' }
  }
  throw new Error('Vertex: too many 429 retries')
}

// ─── Supabase image upload (direct REST — no client, no WebSocket) ────────────

async function uploadImage(base64: string, mimeType: string): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error('[upload] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return null
  }
  const ext = mimeType.includes('jpeg') ? 'jpg' : 'png'
  const path = `mcp/${randomUUID()}.${ext}`
  const buf = Buffer.from(base64, 'base64')
  try {
    const res = await fetch(`${supabaseUrl}/storage/v1/object/ugc-assets/${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': mimeType },
      body: buf,
    })
    const body = await res.text()
    if (!res.ok) { console.error('[upload] HTTP', res.status, body); return null }
    return `${supabaseUrl}/storage/v1/object/public/ugc-assets/${path}`
  } catch (e) {
    console.error('[upload] fetch error:', e)
    return null
  }
}

// ─── Tavily web search ────────────────────────────────────────────────────────

async function searchWeb(query: string, includeImages = false): Promise<{ text: string; imageUrls: string[] }> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) return { text: 'Web search unavailable — TAVILY_API_KEY not set', imageUrls: [] }

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, query, max_results: 5, search_depth: 'basic', include_answer: true, include_images: includeImages }),
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) return { text: `Search failed (${res.status})`, imageUrls: [] }
  const data = await res.json()
  const answer = data.answer ? `Summary: ${data.answer}\n\n` : ''
  const results = (data.results ?? [])
    .map((r: { title: string; content: string; url: string }) => `${r.title}\n${(r.content ?? '').slice(0, 500)}\nSource: ${r.url}`)
    .join('\n\n')
  return { text: `${answer}${results}`.trim(), imageUrls: includeImages ? (data.images ?? []).slice(0, 5) : [] }
}

// ─── Claude client (carousel planning + captions) ─────────────────────────────

function getAnthropic() {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set')
  return new Anthropic({ apiKey: key })
}

// ─── MCP server ───────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'contentflow', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'generate_image',
      description: 'Generate a high-quality AI image using ContentFlow\'s NanoBanana Pro image engine (same engine as the Studio). Returns the image directly so you can see it.',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Detailed image description. Be specific about subject, style, lighting, composition.' },
          ratio: { type: 'string', enum: ['1:1', '4:5', '9:16', '16:9'], description: 'Aspect ratio. Default: 1:1 for logos, 4:5 for Instagram posts, 9:16 for Stories/Reels, 16:9 for banners.' },
          style: { type: 'string', enum: ['realistic', 'professional', 'artistic', 'minimalist'], description: 'Visual style preset.' },
        },
        required: ['prompt'],
      },
    },
    {
      name: 'generate_carousel',
      description: 'Generate a premium multi-slide Instagram/LinkedIn carousel. Each slide gets a headline, body copy, CTA, and a matching AI image. Use this for educational carousels, listicles, comparison posts, or storytelling.',
      inputSchema: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'What the carousel is about.' },
          slideCount: { type: 'number', description: 'Number of slides (2–7). Default: 5.' },
          platform: { type: 'string', enum: ['instagram', 'linkedin', 'tiktok'], description: 'Target platform.' },
          brandName: { type: 'string', description: 'Optional brand name to weave into slides.' },
          searchContext: { type: 'string', description: 'Optional web research context to ground the slides in real data.' },
        },
        required: ['topic'],
      },
    },
    {
      name: 'generate_social_captions',
      description: 'Write platform-native social media captions for a product, service, or topic. Returns one caption per requested platform.',
      inputSchema: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'What to write captions about.' },
          platforms: {
            type: 'array',
            items: { type: 'string', enum: ['instagram', 'twitter', 'linkedin', 'tiktok', 'facebook'] },
            description: 'Which platforms to generate captions for.',
          },
          tone: { type: 'string', enum: ['professional', 'casual', 'witty', 'inspirational'], description: 'Tone of voice. Default: casual.' },
          brandName: { type: 'string', description: 'Optional brand name.' },
        },
        required: ['topic'],
      },
    },
    {
      name: 'search_web',
      description: 'Search the web for current information — competitor data, brand visuals, pricing, trends, or any facts you need before generating content.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query.' },
          include_images: { type: 'boolean', description: 'Set true to also return image URLs from search results (useful as visual references).' },
        },
        required: ['query'],
      },
    },
    {
      name: 'generate_ugc_brief',
      description: 'Write a detailed UGC (user-generated content) video brief for a product or service. Includes hook, scene-by-scene breakdown, and CTA.',
      inputSchema: {
        type: 'object',
        properties: {
          product: { type: 'string', description: 'Product or service name and description.' },
          platform: { type: 'string', enum: ['tiktok', 'instagram', 'youtube'], description: 'Target platform.' },
          duration: { type: 'number', description: 'Video length in seconds. Default: 30.' },
          tone: { type: 'string', description: 'Tone/vibe (e.g. "energetic", "educational", "emotional").' },
        },
        required: ['product'],
      },
    },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    // ── generate_image ────────────────────────────────────────────────────────
    if (name === 'generate_image') {
      const { prompt, ratio, style } = args as {
        prompt: string
        ratio?: '1:1' | '4:5' | '9:16' | '16:9'
        style?: 'realistic' | 'professional' | 'artistic' | 'minimalist'
      }

      const styleHint =
        style === 'professional' ? 'Studio product photograph — clean seamless background, controlled directional lighting, sharp focus.' :
        style === 'artistic'     ? 'Lifestyle shot — natural, candid, soft daylight, hand-held feel.' :
        style === 'minimalist'   ? 'Flat-lay overhead — neutral surface, centered subject, soft even lighting.' :
                                   'Hyper-realistic photograph — soft natural lighting, real texture, subtle depth-of-field.'

      const ratioHint =
        ratio === '4:5'  ? 'Portrait 4:5 framing.' :
        ratio === '9:16' ? 'Vertical 9:16 framing.' :
        ratio === '16:9' ? 'Wide 16:9 framing.' :
                           'Square 1:1 framing.'

      const fullPrompt = `${prompt}\n\n${styleHint} ${ratioHint}`
      const result = await generateImage(fullPrompt, { ratio })
      const url = await uploadImage(result.imageBase64, result.mimeType)

      if (!url) throw new Error('Image generated but Supabase upload failed — check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Claude Desktop MCP config.')
      return {
        content: [{ type: 'text', text: `Image generated (${ratio ?? '1:1'}, ${style ?? 'realistic'} style):\n\n${url}` }],
      }
    }

    // ── generate_carousel ─────────────────────────────────────────────────────
    if (name === 'generate_carousel') {
      const { topic, slideCount = 5, platform = 'instagram', brandName, searchContext } = args as {
        topic: string
        slideCount?: number
        platform?: string
        brandName?: string
        searchContext?: string
      }

      const anthropic = getAnthropic()
      const count = Math.max(2, Math.min(7, slideCount))
      const ratio: '1:1' | '4:5' = platform === 'linkedin' ? '1:1' : '4:5'

      // Step 1: Claude Haiku plans the slides
      const planPrompt = `You are a social media content strategist. Plan a ${count}-slide ${platform} carousel about: "${topic}".
${brandName ? `Brand: ${brandName}` : ''}
${searchContext ? `Research context:\n${searchContext}` : ''}

Return ONLY a JSON array of ${count} slide objects. No markdown fences, no extra text.
Each object: { "headline": "...", "body": "...", "cta": "...", "imagePrompt": "..." }
- headline: bold hook (max 8 words)
- body: 1–2 punchy sentences
- cta: action phrase (max 5 words, empty string for middle slides)
- imagePrompt: detailed NanoBanana image prompt (cinematic, specific scene, no text/logos)`

      const planResponse = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 1500,
        messages: [{ role: 'user', content: planPrompt }],
      })

      const planText = planResponse.content.find(b => b.type === 'text')?.text ?? ''
      let slides: Array<{ headline: string; body: string; cta: string; imagePrompt: string }>

      try {
        const jsonMatch = planText.match(/\[[\s\S]*\]/)
        slides = JSON.parse(jsonMatch?.[0] ?? planText)
      } catch {
        throw new Error(`Failed to parse slide plan: ${planText.slice(0, 200)}`)
      }

      // Step 2: Generate images in batches of 2
      const imageResults: string[] = []
      for (let i = 0; i < slides.length; i += 2) {
        if (i > 0) await new Promise(r => setTimeout(r, 800))
        const batch = slides.slice(i, i + 2)
        const batchResults = await Promise.all(
          batch.map(slide => generateImage(
            `${slide.imagePrompt}\n\nCinematic editorial quality, ${ratio === '4:5' ? 'portrait 4:5' : 'square 1:1'} framing, premium brand aesthetic, no text overlays.`,
            { ratio }
          ).catch(() => null))
        )
        for (const r of batchResults) {
          imageResults.push(r ? r.imageBase64 : '')
        }
      }

      // Upload images and return URLs
      const uploadedUrls = await Promise.all(
        imageResults.map(b64 => b64 ? uploadImage(b64, 'image/png') : Promise.resolve(null))
      )

      const content: Array<{ type: string; text?: string }> = []
      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i]
        const imgLine = uploadedUrls[i] ? `\n🖼 ${uploadedUrls[i]}` : ''
        content.push({
          type: 'text',
          text: `**Slide ${i + 1}/${slides.length}**\n**${slide.headline}**\n${slide.body}${slide.cta ? `\n→ ${slide.cta}` : ''}${imgLine}`,
        })
      }
      content.push({ type: 'text', text: `\n---\nCarousel complete — ${slides.length} slides for ${platform}${brandName ? ` (${brandName})` : ''}.` })

      return { content }
    }

    // ── generate_social_captions ──────────────────────────────────────────────
    if (name === 'generate_social_captions') {
      const { topic, platforms = ['instagram', 'twitter', 'linkedin'], tone = 'casual', brandName } = args as {
        topic: string
        platforms?: string[]
        tone?: string
        brandName?: string
      }

      const anthropic = getAnthropic()
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 1200,
        messages: [{
          role: 'user',
          content: `Write platform-native social media captions for: "${topic}"
${brandName ? `Brand: ${brandName}` : ''}
Tone: ${tone}
Platforms: ${platforms.join(', ')}

For each platform, write one caption optimised for that platform's culture, character limits, and hashtag norms.
Format each as:

**[PLATFORM]**
[caption text]
[hashtags if applicable]

---`
        }],
      })

      const text = response.content.find(b => b.type === 'text')?.text ?? ''
      return { content: [{ type: 'text', text }] }
    }

    // ── search_web ────────────────────────────────────────────────────────────
    if (name === 'search_web') {
      const { query, include_images = false } = args as { query: string; include_images?: boolean }
      const { text, imageUrls } = await searchWeb(query, include_images)

      const content: Array<{ type: string; text?: string }> = [{ type: 'text', text }]
      if (imageUrls.length > 0) {
        content.push({ type: 'text', text: `\n\nImage URLs found:\n${imageUrls.map((u, i) => `${i + 1}. ${u}`).join('\n')}` })
      }
      return { content }
    }

    // ── generate_ugc_brief ────────────────────────────────────────────────────
    if (name === 'generate_ugc_brief') {
      const { product, platform = 'tiktok', duration = 30, tone = 'energetic' } = args as {
        product: string
        platform?: string
        duration?: number
        tone?: string
      }

      const anthropic = getAnthropic()
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Write a detailed UGC video brief for:

Product/Service: ${product}
Platform: ${platform}
Duration: ${duration} seconds
Tone: ${tone}

Include:
1. **Hook** (first 3 seconds — must stop the scroll)
2. **Scene breakdown** (3–5 scenes with timing, action, and voiceover)
3. **CTA** (last 3 seconds)
4. **Creator notes** (wardrobe, setting, lighting suggestions)

Keep it actionable and specific — a creator should be able to film this immediately.`,
        }],
      })

      const text = response.content.find(b => b.type === 'text')?.text ?? ''
      return { content: [{ type: 'text', text }] }
    }

    throw new Error(`Unknown tool: ${name}`)

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    }
  }
})

// ─── Start ────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport()
await server.connect(transport)
console.error('ContentFlow MCP server running on stdio')
