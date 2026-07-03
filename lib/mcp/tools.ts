import { createClient, SupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { deductCredits } from '@/lib/deduct-credits'
import { loadBrandContext, formatBrandPrompt } from '@/lib/brand-context'
import { generateNanoBananaImage } from '@/lib/nanobanana'

// MCP tool definitions. Each tool exposes a portion of ContentFlow's capabilities
// to any MCP client (Claude Desktop, Cursor, Claude Code, custom agents).
// Inputs are validated with JSON Schema, results returned as MCP content blocks.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = SupabaseClient<any, any, any>

function supa(): Supa {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export interface McpTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (userId: string, args: Record<string, any>) => Promise<{ content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> }>
}

// -------- get_credit_balance --------
const getCreditBalance: McpTool = {
  name: 'get_credit_balance',
  description: "Get the user's current ContentFlow credit balance and plan.",
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  handler: async (userId) => {
    const { data } = await supa()
      .from('user_credits')
      .select('balance, monthly_credits, pack_credits, plan')
      .eq('user_id', userId)
      .maybeSingle()
    const balance = data?.balance ?? 0
    const pack = data?.pack_credits ?? 0
    const monthly = data?.monthly_credits ?? 0
    const plan = data?.plan ?? 'free'
    return {
      content: [
        {
          type: 'text',
          text: `Plan: ${plan}\nBalance: ${balance} credits (${pack} from packs, ${monthly} monthly)`,
        },
      ],
    }
  },
}

// -------- list_library --------
const listLibrary: McpTool = {
  name: 'list_library',
  description: "List the user's recent generated content (videos, images, social posts, carousels).",
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Max items to return (default 20, max 100)' },
      contentType: { type: 'string', description: 'Filter by type: video | image | social | carousel | pov | ugc' },
    },
    additionalProperties: false,
  },
  handler: async (userId, args) => {
    const limit = Math.max(1, Math.min(100, Number(args.limit) || 20))
    let q = supa()
      .from('ugc_content')
      .select('id, content_type, status, credit_cost, created_at, metadata, storage_url')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (args.contentType && typeof args.contentType === 'string') {
      q = q.eq('content_type', args.contentType)
    }
    const { data } = await q
    const rows = data ?? []
    if (rows.length === 0) {
      return { content: [{ type: 'text', text: 'No items in library.' }] }
    }
    const lines = rows.map(r => `- [${r.content_type}] ${r.status} · ${r.credit_cost}cr · ${new Date(r.created_at).toISOString().slice(0, 10)} · id=${r.id}`)
    return { content: [{ type: 'text', text: lines.join('\n') }] }
  },
}

// -------- generate_social_captions --------
const generateSocialCaptions: McpTool = {
  name: 'generate_social_captions',
  description: 'Generate platform-native social media captions (Instagram, Facebook, X/Twitter) for a given topic.',
  inputSchema: {
    type: 'object',
    properties: {
      topic: { type: 'string', description: 'What the post is about' },
      platforms: {
        type: 'array',
        items: { type: 'string', enum: ['instagram', 'facebook', 'twitter'] },
        description: 'Which platforms to write for (default: all three)',
      },
      tone: { type: 'string', enum: ['bold', 'conversational', 'professional', 'storytelling'], description: 'Voice / tone' },
    },
    required: ['topic'],
    additionalProperties: false,
  },
  handler: async (userId, args) => {
    const CREDIT_COST = 5
    const supabase = supa()
    const { data: credits } = await supabase
      .from('user_credits')
      .select('balance, pack_credits')
      .eq('user_id', userId)
      .maybeSingle()
    const balance = credits?.balance ?? 0
    if (balance < CREDIT_COST) throw new Error(`Insufficient credits (need ${CREDIT_COST}, have ${balance})`)

    const platforms: string[] = Array.isArray(args.platforms) && args.platforms.length
      ? args.platforms
      : ['instagram', 'facebook', 'twitter']
    const tone: string = typeof args.tone === 'string' ? args.tone : 'bold'
    const topic = String(args.topic).trim()

    const guides: Record<string, string> = {
      instagram: 'Instagram caption (max 2200 chars). Hook in line 1, short paragraphs, 5-10 hashtags on a new line.',
      facebook: 'Facebook post (max 500 chars). Conversational, invite engagement, 1-3 hashtags inline.',
      twitter: 'X/Twitter post (max 280 chars). One quotable sentence, minimal hashtags.',
    }
    const brand = await loadBrandContext(supabase, userId)
    const brandBlock = formatBrandPrompt(brand)

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Write platform-native social posts for the topic.
${brandBlock}
TOPIC: ${topic}
TONE: ${tone}

${platforms.map(p => `${p.toUpperCase()}: ${guides[p]}`).join('\n')}

Return ONLY valid JSON (no markdown):
{ ${platforms.map(p => `"${p}": "post content"`).join(', ')} }`,
      }],
    })

    const raw = (msg.content[0] as { type: 'text'; text: string }).text.trim()
    const cleaned = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    let posts: Record<string, string>
    try { posts = JSON.parse(cleaned) } catch { throw new Error('AI response parse failed') }

    await deductCredits(supabase, userId, CREDIT_COST, balance, credits?.pack_credits ?? 0)

    await supabase.from('ugc_content').insert({
      user_id: userId,
      content_type: 'social',
      metadata: { topic, tone, platforms, posts, source: 'mcp', generatedAt: new Date().toISOString() },
      credit_cost: CREDIT_COST,
      status: 'completed',
    })

    const formatted = Object.entries(posts).map(([p, text]) => `--- ${p.toUpperCase()} ---\n${text}`).join('\n\n')
    return { content: [{ type: 'text', text: `${formatted}\n\n(${CREDIT_COST} credits deducted)` }] }
  },
}

// -------- generate_image --------
const generateImage: McpTool = {
  name: 'generate_image',
  description: 'Generate a marketing image with Nano Banana 2. Returns a URL you can use anywhere.',
  inputSchema: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: 'Detailed description of the image' },
      ratio: { type: 'string', enum: ['1:1', '4:5', '9:16', '16:9'], description: 'Aspect ratio (default 1:1)' },
      style: { type: 'string', enum: ['realistic', 'artistic', 'professional', 'minimalist'], description: 'Style hint' },
    },
    required: ['prompt'],
    additionalProperties: false,
  },
  handler: async (userId, args) => {
    const CREDIT_COST = 3
    const supabase = supa()
    const { data: credits } = await supabase
      .from('user_credits')
      .select('balance, pack_credits')
      .eq('user_id', userId)
      .maybeSingle()
    const balance = credits?.balance ?? 0
    if (balance < CREDIT_COST) throw new Error(`Insufficient credits (need ${CREDIT_COST}, have ${balance})`)

    const result = await generateNanoBananaImage(String(args.prompt), {
      style: (args.style as 'realistic' | 'artistic' | 'professional' | 'minimalist') || 'realistic',
      ratio: (args.ratio as '1:1' | '4:5' | '9:16' | '16:9') || '1:1',
    })

    const filename = `mcp-images/${userId}-${Date.now()}.png`
    const buf = Buffer.from(result.imageBase64, 'base64')
    await supabase.storage.from('ugc-assets').upload(filename, buf, { contentType: 'image/png', upsert: false })
    const { data: pub } = supabase.storage.from('ugc-assets').getPublicUrl(filename)

    await deductCredits(supabase, userId, CREDIT_COST, balance, credits?.pack_credits ?? 0)

    await supabase.from('ugc_content').insert({
      user_id: userId,
      content_type: 'image',
      storage_url: pub.publicUrl,
      metadata: { prompt: args.prompt, ratio: args.ratio, style: args.style, source: 'mcp', generatedAt: new Date().toISOString() },
      credit_cost: CREDIT_COST,
      status: 'completed',
    })

    return {
      content: [
        { type: 'text', text: `Image ready: ${pub.publicUrl}\n(${CREDIT_COST} credits deducted)` },
      ],
    }
  },
}

export const MCP_TOOLS: McpTool[] = [
  getCreditBalance,
  listLibrary,
  generateSocialCaptions,
  generateImage,
]

export function findTool(name: string): McpTool | undefined {
  return MCP_TOOLS.find(t => t.name === name)
}
