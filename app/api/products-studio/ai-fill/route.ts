// Product Studio — AI-fill the create questions from a quick description
// (+ the first uploaded photo when available). Free — a single Haiku call.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const header = request.headers.get('Authorization')
    if (!header?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: userData } = await supabase.auth.getUser(header.slice(7))
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const quick = typeof body?.quick === 'string' ? body.quick.trim().slice(0, 300) : ''
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 80) : ''
    const productType: 'physical' | 'app' = body?.productType === 'app' ? 'app' : 'physical'
    const websiteUrl = typeof body?.websiteUrl === 'string' ? body.websiteUrl.trim().slice(0, 300) : ''
    const photo = body?.photo && typeof body.photo.base64 === 'string' && typeof body.photo.mimeType === 'string'
      ? body.photo : null
    if (!quick && !photo && !name && !websiteUrl) {
      return NextResponse.json({ error: 'Type a quick description, product name, URL, or upload a photo first' }, { status: 400 })
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const content: Anthropic.ContentBlockParam[] = []
    if (photo) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: photo.mimeType, data: photo.base64 },
      })
    }
    const contextBits: string[] = []
    if (name) contextBits.push(`Product name the user already typed: "${name}" — TRUST THIS as the name and refine only if clearly wrong.`)
    if (quick) contextBits.push(`Quick description from the user: "${quick}"`)
    if (productType === 'app') {
      contextBits.push(`This is a WEBSITE / SaaS APP, NOT a physical product. The attached image (if any) is a landing-page screenshot — READ the visible text (hero copy, product name in the header, features) to describe what the software does. Do NOT invent a physical object. If the screenshot is blank or unreadable, rely on the URL + name.`)
      if (websiteUrl) contextBits.push(`Website URL: ${websiteUrl}`)
    } else {
      contextBits.push(`This is a PHYSICAL product. Read packaging/label text on the photo if present.`)
    }
    if (contextBits.length === 0) contextBits.push('No context — read the photo.')

    content.push({
      type: 'text',
      text: `${contextBits.join('\n\n')}\n\nReturn ONLY JSON: {"name": "short product/app name", "whatItIs": "one plain sentence: what the ${productType === 'app' ? 'app or website does and who it\'s for' : 'product is and what it\'s for'}"}. If a name was already provided, keep it verbatim unless clearly typo\'d.`,
    })
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content }],
    })
    const raw = (msg.content[0] as { type: 'text'; text: string }).text.trim()
      .replace(/^```json?\n?/i, '').replace(/\n?```$/, '')
    const parsed = JSON.parse(raw) as { name?: string; whatItIs?: string }
    return NextResponse.json({
      name: String(parsed.name ?? '').slice(0, 80),
      whatItIs: String(parsed.whatItIs ?? '').slice(0, 300),
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'AI fill failed' }, { status: 500 })
  }
}
