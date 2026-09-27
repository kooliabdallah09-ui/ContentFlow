// Server-side: has Claude write (and then fix) a motion-ad composition.
// The code it returns runs only inside the motion sandbox iframe.

import Anthropic from '@anthropic-ai/sdk'
import { MOTION_REVIEW_PROMPT, MOTION_SYSTEM_PROMPT } from './prompt'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Haiku can't reliably write several hundred lines of timed animation code,
// so this is the one generation path that uses a larger model.
export type MotionModel = 'claude-sonnet-5' | 'claude-opus-5-5'

// $ per million tokens: [input, output]. Cache writes bill at 1.25× input,
// cache reads at 0.1×. Thinking tokens bill as output.
const PRICE: Record<MotionModel, [number, number]> = {
  'claude-sonnet-5': [2, 10],
  'claude-opus-5-5': [4, 20],
}

export type MotionBrief = {
  brandName: string
  /** What the product is and does, in the user's words. */
  product: string
  audience?: string
  /** The angle or story idea, if the user has one. */
  idea?: string
  cta?: string
  website?: string
  hasProductImage: boolean
  hasLogo: boolean
}

export type MotionResult = {
  /** null when a review found nothing to change. */
  code: string | null
  model: MotionModel
  usage: Anthropic.Usage
  costUsd: number
  ms: number
}

function briefText(b: MotionBrief): string {
  return [
    `Brand: ${b.brandName}`,
    `Product: ${b.product}`,
    b.audience && `Audience: ${b.audience}`,
    b.idea && `Story idea from the client: ${b.idea}`,
    `Call to action: ${b.cta || 'Try it free'}`,
    b.website && `Website: ${b.website}`,
    `assets.productImage: ${b.hasProductImage ? 'provided (show it at the end)' : 'null'}`,
    `assets.logo: ${b.hasLogo ? 'provided' : 'null (use the brand name as a wordmark)'}`,
  ].filter(Boolean).join('\n')
}

function costOf(model: MotionModel, u: Anthropic.Usage): number {
  const [inp, out] = PRICE[model]
  return (
    u.input_tokens * inp +
    (u.cache_creation_input_tokens ?? 0) * inp * 1.25 +
    (u.cache_read_input_tokens ?? 0) * inp * 0.1 +
    u.output_tokens * out
  ) / 1e6
}

function extractCode(text: string): string | null {
  if (text.trim() === 'NO_CHANGES') return null
  const m = text.match(/```(?:tsx|typescript|ts|jsx)?\s*\n([\s\S]*?)```/)
  if (!m) throw new Error('The model did not return a code block')
  return m[1].trim() + '\n'
}

async function call(model: MotionModel, content: Anthropic.ContentBlockParam[]): Promise<MotionResult> {
  const t0 = Date.now()
  const stream = client.messages.stream({
    model,
    max_tokens: 64000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    system: [{ type: 'text', text: MOTION_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content }],
  })
  const msg = await stream.finalMessage()
  if (msg.stop_reason === 'refusal') throw new Error('The model declined this brief')
  if (msg.stop_reason === 'max_tokens') throw new Error('The ad ran past the output limit')
  const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('')
  return { code: extractCode(text), model, usage: msg.usage, costUsd: costOf(model, msg.usage), ms: Date.now() - t0 }
}

/** First draft of the ad. */
export function writeMotionAd(brief: MotionBrief, model: MotionModel): Promise<MotionResult> {
  return call(model, [{ type: 'text', text: `Write the ad for this brief.\n\n${briefText(brief)}` }])
}

/**
 * Fixes an ad. Either `error` (it failed to compile or crashed) or `stills`
 * (frames rendered from it, for a visual review) — or both.
 */
export function reviseMotionAd(opts: {
  brief: MotionBrief
  code: string
  model: MotionModel
  error?: string
  stills?: Array<{ frame: number; jpegBase64: string }>
}): Promise<MotionResult> {
  const content: Anthropic.ContentBlockParam[] = [
    { type: 'text', text: `Brief:\n${briefText(opts.brief)}` },
  ]
  for (const s of opts.stills ?? []) {
    content.push({ type: 'text', text: `Frame ${s.frame}:` })
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: s.jpegBase64 } })
  }
  content.push({ type: 'text', text: `The code:\n\`\`\`tsx\n${opts.code}\`\`\`` })
  content.push({
    type: 'text',
    text: opts.error
      ? `It fails with this error:\n${opts.error}\n\nReply with the complete corrected file in one \`\`\`tsx code block and nothing else.`
      : MOTION_REVIEW_PROMPT,
  })
  return call(opts.model, content)
}
