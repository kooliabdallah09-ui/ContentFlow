// Server-side: has Claude plan, write and then fix a motion-ad composition.
// The code it returns runs only inside the motion sandbox iframe.

import Anthropic from '@anthropic-ai/sdk'
import { MOTION_TONES, motionTrack, type MotionTone } from './music'
import { MOTION_PLAN_PROMPT, MOTION_REVIEW_PROMPT, MOTION_SYSTEM_PROMPT } from './prompt'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Haiku can't reliably write several hundred lines of timed animation code,
// so this is the one generation path that uses a larger model. Measured on
// the same brief: Opus 5.5 $0.40-0.49 per ad (write + review) and clearly
// better; Sonnet 5 $0.20-0.25.
export type MotionModel = 'claude-sonnet-5' | 'claude-opus-5-5'
export const MOTION_MODEL: MotionModel = 'claude-opus-5-5'

// $ per million tokens: [input, output]. Cache writes bill at 1.25× input,
// cache reads at 0.1×. Thinking tokens bill as output.
const PRICE: Record<MotionModel, [number, number]> = {
  'claude-sonnet-5': [2, 10],
  'claude-opus-5-5': [4, 20],
}

export type MotionStoryboard = {
  angle: string
  hook: string
  scenes: Array<{ seconds: number; title: string; action: string; text: string }>
  punchline: string
  shareCopy: string
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
  tone: MotionTone
  /** A key from MOTION_TRACKS, or null for no music. */
  trackKey: string | null
  hasProductImage: boolean
  hasLogo: boolean
  /** The brand's own colours as #rrggbb, main one first. */
  brandColors?: string[]
  /** The storyboard the user approved, when writing the code. */
  storyboard?: MotionStoryboard | null
}

export type MotionUsage = { model: MotionModel; usage: Anthropic.Usage; costUsd: number; ms: number }
export type MotionResult = MotionUsage & {
  /** null when a review found nothing to change. */
  code: string | null
}

function briefText(b: MotionBrief): string {
  const tone = MOTION_TONES[b.tone] ?? MOTION_TONES.playful
  const track = motionTrack(b.trackKey)
  const lines = [
    `Brand: ${b.brandName}`,
    `Product: ${b.product}`,
    b.audience && `Audience: ${b.audience}`,
    b.idea && `Story idea from the client: ${b.idea}`,
    `Call to action: ${b.cta || 'Try it free'}`,
    b.website && `Website: ${b.website}`,
    `Tone: ${tone.label}. ${tone.direction}`,
    track
      ? `Music: "${track.title}", ${track.bpm} BPM. Beat frames: ${track.beats.join(', ')}. Accent frames (strongest hits): ${track.accents.join(', ') || 'none'}.`
      : 'Music: none (no <Music />).',
    `assets.productImage: ${b.hasProductImage ? 'provided (show it at the end)' : 'null'}`,
    `assets.logo: ${b.hasLogo ? 'provided' : 'null (use the brand name as a wordmark)'}`,
    b.brandColors?.length &&
      `Brand colors: ${b.brandColors.join(', ')}. Use the first as the main accent (call-to-action button, highlighted words, the lead character) and the others as secondary accents; keep paper and ink as the base.`,
  ]
  if (b.storyboard) {
    const s = b.storyboard
    lines.push(
      '',
      'Approved storyboard (follow its scenes, actions and exact texts; adjust timings by up to half a second to land on the music):',
      `Hook: ${s.hook}`,
      ...s.scenes.map((sc, i) => `${i + 1}. ${sc.title} (${sc.seconds}s): ${sc.action} Text: ${sc.text}`),
      `Punchline: ${s.punchline}`,
    )
  }
  return lines.filter((l): l is string => typeof l === 'string').join('\n')
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

async function call(
  model: MotionModel,
  content: Anthropic.ContentBlockParam[],
  opts: { effort?: 'medium' | 'high'; format?: Anthropic.JSONOutputFormat } = {},
): Promise<{ text: string } & MotionUsage> {
  const t0 = Date.now()
  const stream = client.messages.stream({
    model,
    max_tokens: 64000,
    thinking: { type: 'adaptive' },
    output_config: { effort: opts.effort ?? 'high', ...(opts.format ? { format: opts.format } : {}) },
    system: [{ type: 'text', text: MOTION_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content }],
  })
  const msg = await stream.finalMessage()
  if (msg.stop_reason === 'refusal') throw new Error('The model declined this brief')
  if (msg.stop_reason === 'max_tokens') throw new Error('The ad ran past the output limit')
  const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('')
  return { text, model, usage: msg.usage, costUsd: costOf(model, msg.usage), ms: Date.now() - t0 }
}

const STORYBOARD_SCHEMA: Anthropic.JSONOutputFormat = {
  type: 'json_schema',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['angle', 'hook', 'scenes', 'punchline', 'shareCopy'],
    properties: {
      angle: { type: 'string' },
      hook: { type: 'string' },
      scenes: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['seconds', 'title', 'action', 'text'],
          properties: {
            seconds: { type: 'number' },
            title: { type: 'string' },
            action: { type: 'string' },
            text: { type: 'string' },
          },
        },
      },
      punchline: { type: 'string' },
      shareCopy: { type: 'string' },
    },
  },
}

/** The storyboard, for the user to approve or edit before any code is written. */
export async function planMotionAd(brief: MotionBrief, model: MotionModel = MOTION_MODEL): Promise<MotionUsage & { storyboard: MotionStoryboard }> {
  const r = await call(model, [{ type: 'text', text: `Brief:\n${briefText({ ...brief, storyboard: null })}\n\n${MOTION_PLAN_PROMPT}` }], { effort: 'medium', format: STORYBOARD_SCHEMA })
  const storyboard = JSON.parse(r.text) as MotionStoryboard
  if (!Array.isArray(storyboard.scenes) || storyboard.scenes.length === 0) throw new Error('The storyboard came back empty')
  return { ...r, storyboard }
}

/** First draft of the ad's code. */
export async function writeMotionAd(brief: MotionBrief, model: MotionModel = MOTION_MODEL): Promise<MotionResult> {
  const r = await call(model, [{ type: 'text', text: `Write the ad for this brief.\n\n${briefText(brief)}` }])
  return { ...r, code: extractCode(r.text) }
}

/**
 * Fixes an ad. Either `error` (it failed to compile or crashed) or `stills`
 * (frames rendered from it, for a visual review) — or both.
 */
export async function reviseMotionAd(opts: {
  brief: MotionBrief
  code: string
  model?: MotionModel
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
  const r = await call(opts.model ?? MOTION_MODEL, content)
  return { ...r, code: extractCode(r.text) }
}
