// The only two Claude models the app uses. Spread a preset into
// anthropic.messages.create({ ...FAST, max_tokens, messages }).
//
// - FAST  (Haiku 5.5): short copy, captions, hooks, JSON fills, classification,
//   moderation, quick rewrites. Thinking off, so it stays fast and cheap.
// - SMART (Sonnet 5.5): planning, multi-step briefs, long structured output,
//   detailed image/video prompt writing, analysis. Thinking off so the small
//   max_tokens budgets go to the answer, like the old Sonnet 4.6 calls.
// - DEEP  (Sonnet 5.5 + adaptive thinking): the few hardest jobs (motion ad
//   code, Studio "Aether"). Give these a large max_tokens.
//
// Note: neither model accepts a custom temperature, assistant prefill, or
// forced tool_choice ('any' / 'tool').

import type Anthropic from '@anthropic-ai/sdk'

export const HAIKU = 'claude-haiku-5-5'
export const SONNET = 'claude-sonnet-5-5'

export const FAST = {
  model: HAIKU,
  thinking: { type: 'disabled' },
} as const satisfies Partial<Anthropic.MessageCreateParamsNonStreaming>

// Sonnet 5.5 rejects { type: 'disabled' }; 'between_tools' is its "no thinking"
// mode. SDK 0.91 doesn't type it yet, hence the cast.
export const SMART = {
  model: SONNET,
  thinking: { type: 'between_tools' } as unknown as Anthropic.ThinkingConfigParam,
} as const

export const DEEP = {
  model: SONNET,
  thinking: { type: 'adaptive' },
  output_config: { effort: 'high' },
} as const satisfies Partial<Anthropic.MessageCreateParamsNonStreaming>
