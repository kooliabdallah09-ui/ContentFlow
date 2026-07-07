import { ASSISTANT_SYSTEM_PROMPT } from '@/lib/assistant-knowledge'
import { findAgent } from '@/lib/chat-agents'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const maxDuration = 30

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatRequest {
  message: string
  history?: ChatMessage[]
  currentPath?: string  // Where the user is now — so the assistant can use context
  agentId?: string       // Optional specialist persona (see lib/chat-agents.ts)
}

interface ChatResponse {
  reply: string
  action?: { href: string; label: string }
}

// Pulls a possibly-fenced JSON object out of Claude's text response. Claude usually
// returns clean JSON because we ask for it, but it occasionally wraps in ```json fences.
function extractJSON(text: string): ChatResponse | null {
  // Strip code fences if present.
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  try {
    const parsed = JSON.parse(cleaned)
    if (typeof parsed?.reply !== 'string') return null
    const result: ChatResponse = { reply: parsed.reply }
    if (
      parsed.action &&
      typeof parsed.action.href === 'string' &&
      typeof parsed.action.label === 'string' &&
      parsed.action.href.startsWith('/')  // refuse off-site redirects
    ) {
      result.action = { href: parsed.action.href, label: parsed.action.label }
    }
    return result
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatRequest
    const userMessage = typeof body.message === 'string' ? body.message.slice(0, 1500).trim() : ''
    if (!userMessage) {
      return NextResponse.json({ error: 'Empty message' }, { status: 400 })
    }

    const history = Array.isArray(body.history)
      ? body.history.slice(-8).filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      : []

    const currentPathLine = typeof body.currentPath === 'string' && body.currentPath.startsWith('/')
      ? `\n[User is currently on: ${body.currentPath}]`
      : ''

    // Anthropic message thread: last N exchanges + the new user message.
    // System prompt teaches Claude the app + JSON response shape.
    const messages: Anthropic.MessageParam[] = [
      ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: userMessage + currentPathLine },
    ]

    // If an agent id is provided, swap in that specialist's system prompt.
    // Fall back to the legacy generalist prompt when none matches.
    const systemPrompt = body.agentId
      ? findAgent(body.agentId).systemPrompt
      : ASSISTANT_SYSTEM_PROMPT

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: systemPrompt,
      messages,
    })

    const text = (msg.content[0] as { text: string }).text
    const parsed = extractJSON(text)

    // Graceful fallback if Claude broke format — return the raw text as the reply.
    if (!parsed) {
      return NextResponse.json({ reply: text.trim().slice(0, 1000) })
    }

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[assistant/chat] error:', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Assistant unavailable' },
      { status: 500 },
    )
  }
}
