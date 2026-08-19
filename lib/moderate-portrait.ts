// First-line moderation for user-uploaded portraits and product images.
// Uses Anthropic vision to detect obvious red flags:
//   - Real recognisable public figure / celebrity
//   - Person who appears to be a minor
//   - NSFW / explicit content
//   - Non-human subject where a person was expected
//
// Not perfect (no image model is), but stops the easy 90% of abuse.
// Failure to call the API returns { allow: true } — we fail-open so a moderation
// outage never blocks legit creators. Log and monitor.

import Anthropic from '@anthropic-ai/sdk'

export interface ModerationResult {
  allow: boolean
  reason?: 'celebrity' | 'minor' | 'nsfw' | 'not-human'
  details?: string
}

const SYSTEM = `You are a content-moderation classifier for an AI content-generation platform. Given an image the user uploaded as a reference portrait, decide whether it is safe to accept.

Reply with a single JSON object, no prose, matching this exact shape:
{"allow": true} — if the image is a normal-looking adult person (18+), not a recognisable public figure, not explicit, and clearly a human face.
{"allow": false, "reason": "celebrity" | "minor" | "nsfw" | "not-human", "details": "<one short sentence>"} — otherwise.

Guidance:
- "celebrity": the person is clearly a famous public figure (actor, musician, politician, athlete, well-known influencer). If uncertain, err on the side of allow.
- "minor": the person appears under 18. Be conservative — if you cannot confidently say adult, reject.
- "nsfw": nudity, sexual content, or explicit imagery.
- "not-human": the subject is a pet, cartoon, illustration, product shot, or the image contains no clear human subject.`

export async function moderatePortrait(input: { base64: string; mimeType: string }): Promise<ModerationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.warn('[moderate-portrait] ANTHROPIC_API_KEY missing — fail-open')
    return { allow: true }
  }

  try {
    const client = new Anthropic({ apiKey })
    const res = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: input.mimeType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif', data: input.base64 },
          },
          { type: 'text', text: 'Moderate this portrait upload. JSON only.' },
        ],
      }],
    })

    const raw = res.content.map(c => (c.type === 'text' ? c.text : '')).join('').trim()
    const jsonStart = raw.indexOf('{')
    const jsonEnd = raw.lastIndexOf('}')
    if (jsonStart === -1 || jsonEnd === -1) return { allow: true }
    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as ModerationResult
    return parsed
  } catch (err) {
    console.warn('[moderate-portrait] failed, allowing:', err instanceof Error ? err.message : err)
    return { allow: true }
  }
}
