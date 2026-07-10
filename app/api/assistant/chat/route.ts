import { ASSISTANT_SYSTEM_PROMPT } from '@/lib/assistant-knowledge'
import { findAgent } from '@/lib/chat-agents'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { deductCredits } from '@/lib/deduct-credits'
import { generateNanoBananaImage } from '@/lib/nanobanana'
import { loadBrandContext, formatBrandPrompt } from '@/lib/brand-context'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const maxDuration = 120

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  results?: ChatResult[]
}

// Rich results the frontend renders inline in the chat (image tile, caption
// card, etc.). Kept as a discriminated union so the UI can switch on kind.
type ChatResult =
  | { kind: 'image'; url: string; prompt: string; credits: number }
  | { kind: 'social'; posts: Record<string, string>; topic: string; credits: number }
  | { kind: 'navigate'; path: string; prefillTopic?: string }
  | { kind: 'error'; message: string }

interface ChatRequest {
  message: string
  history?: ChatMessage[]
  currentPath?: string
  agentId?: string
}

interface ChatResponse {
  reply: string
  action?: { href: string; label: string }
  results?: ChatResult[]
}

function supa() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Tools Claude can call from the chat. Each agent gets only the tools that
// match its surface (image agent → generate_image, social → captions, etc.).
// General agent gets everything.
const TOOL_DEFS: Record<string, Anthropic.Tool> = {
  open_generator: {
    name: 'open_generator',
    description: "Route the user to a ContentFlow generator page. Use this AS SOON as you know which generator fits — do not ask clarifying questions first. The generator collects the details itself. Optionally include the user's original request as prefillTopic so the target page pre-fills the topic / prompt field.",
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          enum: [
            '/generate/ugc',
            '/generate/pov',
            '/generate/image',
            '/generate/video',
            '/generate/social',
            '/generate/voice',
            '/generate/screen-demo',
            '/generate/business-card',
          ],
          description: 'The generator route to open',
        },
        prefillTopic: {
          type: 'string',
          description: 'The user\'s original request in one clean sentence, used to prefill the target generator\'s topic / prompt field.',
        },
      },
      required: ['path'],
    },
  },
  generate_image: {
    name: 'generate_image',
    description: 'Generate an image with Nano Banana 2 and render it inline in the chat. Use this when the user asks to "generate", "make", "create" an image, photo, picture, or scene. Costs 5 credits.',
    input_schema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Detailed image prompt — subject, setting, lighting, mood.' },
        ratio: { type: 'string', enum: ['1:1', '4:5', '9:16', '16:9'], description: 'Aspect ratio. Default 1:1.' },
        style: { type: 'string', enum: ['realistic', 'artistic', 'professional', 'minimalist'], description: 'Style. Default realistic.' },
      },
      required: ['prompt'],
    },
  },
  generate_social_captions: {
    name: 'generate_social_captions',
    description: 'Generate platform-native social captions (Instagram, Facebook, X/Twitter) for a topic. Use when the user asks for captions, posts, or copy. Costs 5 credits.',
    input_schema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'What the post is about.' },
        platforms: {
          type: 'array',
          items: { type: 'string', enum: ['instagram', 'facebook', 'twitter'] },
          description: 'Which platforms. Default all three.',
        },
        tone: { type: 'string', enum: ['bold', 'conversational', 'professional', 'storytelling'] },
      },
      required: ['topic'],
    },
  },
}

const AGENT_TOOLS: Record<string, string[]> = {
  general: ['open_generator', 'generate_image', 'generate_social_captions'],
  image: ['generate_image'],
  social: ['generate_social_captions'],
  ugc: ['open_generator'],
  video: ['open_generator'],
  pov: ['open_generator'],
  voice: ['open_generator'],
}

function toolsFor(agentId: string): Anthropic.Tool[] {
  const names = AGENT_TOOLS[agentId] ?? []
  return names.map(n => TOOL_DEFS[n]).filter(Boolean)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runTool(name: string, input: any, userId: string): Promise<ChatResult> {
  const supabase = supa()
  const { data: credits } = await supabase
    .from('user_credits')
    .select('balance, pack_credits')
    .eq('user_id', userId)
    .maybeSingle()
  const balance = credits?.balance ?? 0
  const packCredits = credits?.pack_credits ?? 0

  if (name === 'open_generator') {
    const path = String(input.path ?? '')
    if (!path.startsWith('/generate/')) {
      return { kind: 'error', message: `Invalid path: ${path}` }
    }
    const prefillTopic = typeof input.prefillTopic === 'string'
      ? input.prefillTopic.slice(0, 500)
      : undefined
    return { kind: 'navigate', path, prefillTopic }
  }

  if (name === 'generate_image') {
    const CREDIT_COST = 5
    if (balance < CREDIT_COST) return { kind: 'error', message: `Not enough credits (need ${CREDIT_COST}, have ${balance})` }

    const prompt = String(input.prompt ?? '').trim().slice(0, 2000)
    if (!prompt) return { kind: 'error', message: 'Missing prompt' }

    try {
      const result = await generateNanoBananaImage(prompt, {
        style: (input.style as 'realistic' | 'artistic' | 'professional' | 'minimalist') || 'realistic',
        ratio: (input.ratio as '1:1' | '4:5' | '9:16' | '16:9') || '1:1',
      })
      const filename = `chat-images/${userId}-${Date.now()}.png`
      const buf = Buffer.from(result.imageBase64, 'base64')
      await supabase.storage.from('ugc-assets').upload(filename, buf, { contentType: 'image/png', upsert: false })
      const { data: pub } = supabase.storage.from('ugc-assets').getPublicUrl(filename)

      await deductCredits(supabase, userId, CREDIT_COST, balance, packCredits)
      await supabase.from('ugc_content').insert({
        user_id: userId,
        content_type: 'image',
        storage_url: pub.publicUrl,
        metadata: { prompt, ratio: input.ratio, style: input.style, source: 'chat', generatedAt: new Date().toISOString() },
        credit_cost: CREDIT_COST,
        status: 'completed',
      })
      return { kind: 'image', url: pub.publicUrl, prompt, credits: CREDIT_COST }
    } catch (err) {
      return { kind: 'error', message: err instanceof Error ? err.message : 'Image generation failed' }
    }
  }

  if (name === 'generate_social_captions') {
    const CREDIT_COST = 5
    if (balance < CREDIT_COST) return { kind: 'error', message: `Not enough credits (need ${CREDIT_COST}, have ${balance})` }

    const topic = String(input.topic ?? '').trim().slice(0, 2000)
    if (!topic) return { kind: 'error', message: 'Missing topic' }

    const platforms: string[] = Array.isArray(input.platforms) && input.platforms.length
      ? input.platforms
      : ['instagram', 'facebook', 'twitter']
    const tone: string = typeof input.tone === 'string' ? input.tone : 'bold'

    const guides: Record<string, string> = {
      instagram: 'Instagram caption (max 2200 chars). Hook, short paragraphs, hashtags.',
      facebook: 'Facebook post (max 500 chars). Conversational, engagement-inviting.',
      twitter: 'X/Twitter post (max 280 chars). Quotable, minimal hashtags.',
    }

    const brand = await loadBrandContext(supabase, userId)
    const brandBlock = formatBrandPrompt(brand)

    try {
      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: `${brandBlock}
TOPIC: ${topic}
TONE: ${tone}

${platforms.map(p => `${p.toUpperCase()}: ${guides[p]}`).join('\n')}

Return ONLY valid JSON: { ${platforms.map(p => `"${p}": "post"`).join(', ')} }`,
        }],
      })
      const raw = (msg.content[0] as { type: 'text'; text: string }).text.trim()
      const cleaned = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
      const posts = JSON.parse(cleaned) as Record<string, string>

      await deductCredits(supabase, userId, CREDIT_COST, balance, packCredits)
      await supabase.from('ugc_content').insert({
        user_id: userId,
        content_type: 'social',
        metadata: { topic, tone, platforms, posts, source: 'chat', generatedAt: new Date().toISOString() },
        credit_cost: CREDIT_COST,
        status: 'completed',
      })
      return { kind: 'social', posts, topic, credits: CREDIT_COST }
    } catch (err) {
      return { kind: 'error', message: err instanceof Error ? err.message : 'Caption generation failed' }
    }
  }

  return { kind: 'error', message: `Unknown tool: ${name}` }
}

// Strip any leaked JSON block or code fence that Claude occasionally emits when
// tools have run. We prefer the plain-English wrapping over the raw json.
function cleanReply(text: string): { reply: string; action?: { href: string; label: string } } {
  const trimmed = text.trim()

  // If it's a pure JSON payload (agents were told to return JSON), parse.
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (typeof parsed?.reply === 'string') {
        const result: { reply: string; action?: { href: string; label: string } } = { reply: parsed.reply }
        if (parsed.action?.href && typeof parsed.action.href === 'string' && parsed.action.href.startsWith('/')) {
          result.action = { href: parsed.action.href, label: parsed.action.label }
        }
        return result
      }
    } catch { /* fall through */ }
  }

  // Strip fenced ```json ... ``` blocks anywhere in the text.
  const withoutFences = trimmed.replace(/```(?:json)?\s*[\s\S]*?```/g, '').trim()
  // Also strip any leftover raw JSON object that Claude may have leaked outside
  // fences (starts with `{ "reply"` or similar).
  const withoutRawJson = withoutFences.replace(/\{\s*"reply"[\s\S]*?\}\s*$/g, '').trim()

  return { reply: (withoutRawJson || trimmed).slice(0, 1500) }
}

async function getUserId(request: NextRequest): Promise<string | null> {
  // Chat is public today (see /ask page). If a Bearer token is present, use it
  // to identify the user for tool billing. If not, tool calls will error with
  // "not signed in" (soft-fail — the reply still returns).
  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const { data } = await supa().auth.getUser(auth.slice(7))
  return data.user?.id ?? null
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatRequest
    const userMessage = typeof body.message === 'string' ? body.message.slice(0, 1500).trim() : ''
    if (!userMessage) return NextResponse.json({ error: 'Empty message' }, { status: 400 })

    const history = Array.isArray(body.history)
      ? body.history.slice(-8).filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      : []

    const currentPathLine = typeof body.currentPath === 'string' && body.currentPath.startsWith('/')
      ? `\n[User is currently on: ${body.currentPath}]`
      : ''

    const agentId = body.agentId ?? ''
    const systemPrompt = agentId
      ? findAgent(agentId).systemPrompt
      : ASSISTANT_SYSTEM_PROMPT
    const tools = toolsFor(agentId)

    const userId = await getUserId(request)

    // Conversation state — Claude may call tools mid-turn, so we loop until it
    // returns a final text block. Bounded to 3 rounds so a runaway loop can't
    // burn tokens.
    const anthMessages: Anthropic.MessageParam[] = [
      ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: userMessage + currentPathLine },
    ]

    const results: ChatResult[] = []
    let finalText = ''

    for (let round = 0; round < 3; round++) {
      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        system: systemPrompt + (tools.length ? '\n\nYou have tools available. When the user asks you to generate an image or captions, CALL THE TOOL immediately with a strong prompt derived from what they said — do NOT ask clarifying questions unless the prompt is truly unusable. After a tool has run, reply with ONE short natural-language sentence confirming what happened. Never wrap that confirmation in JSON, never use markdown code fences, never repeat the tool output.' : ''),
        tools: tools.length ? tools : undefined,
        messages: anthMessages,
      })

      const toolUses = msg.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[]
      const textBlocks = msg.content.filter(b => b.type === 'text') as Anthropic.TextBlock[]

      if (toolUses.length === 0) {
        finalText = textBlocks.map(t => t.text).join('\n\n')
        break
      }

      // Persist the assistant turn (needed so Claude sees its own tool_use in the
      // next round). Then execute each tool call in parallel-ish.
      anthMessages.push({ role: 'assistant', content: msg.content })

      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const tu of toolUses) {
        if (!userId) {
          const err: ChatResult = { kind: 'error', message: 'Sign in to generate content in chat.' }
          results.push(err)
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: 'User is not signed in — cannot bill the generation.',
            is_error: true,
          })
          continue
        }
        const result = await runTool(tu.name, tu.input, userId)
        results.push(result)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: result.kind === 'error'
            ? `Error: ${result.message}`
            : `Success. Rendered inline in the chat. Do not describe the output at length — one sentence confirmation.`,
          is_error: result.kind === 'error',
        })
      }

      anthMessages.push({ role: 'user', content: toolResults })
    }

    // If we still have no final text after 3 rounds, degrade gracefully.
    if (!finalText) finalText = results.length ? 'Done.' : 'Sorry, could not complete that.'

    const parsed = cleanReply(finalText)
    const response: ChatResponse = { reply: parsed.reply }
    if (parsed.action) response.action = parsed.action
    if (results.length) response.results = results

    return NextResponse.json(response)
  } catch (err) {
    console.error('[assistant/chat] error:', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Assistant unavailable' },
      { status: 500 },
    )
  }
}
