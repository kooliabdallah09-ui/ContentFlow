import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function generateUGCScript(
  productName: string,
  productDescription: string,
  benefits: string,
  callToAction: string,
  productImageBase64?: string,
  productImageMimeType?: string,
  targetDurationSeconds: number = 10,
  forcedScene?: string,
  customInstructions?: string,
  language?: { name: string; code: string },
  productType?: 'physical' | 'software',
): Promise<string> {
  // 1.9 words/sec spoken pace with 1.5s padding so the last word lands before cutoff.
  const targetWords = Math.max(6, Math.round((targetDurationSeconds - 1.5) * 1.9))
  const hookEnd = Math.min(5, Math.round(targetDurationSeconds * 0.2))
  const bodyEnd = Math.round(targetDurationSeconds * 0.85)

  const backgroundLine = forcedScene
    ? `[BACKGROUND: ${forcedScene}]   ← USE THIS EXACT SCENE, do not change it`
    : `[BACKGROUND: one of: bedroom, bathroom, kitchen, living room, office, gym, outdoor, car interior, cafe]`

  const customBlock = customInstructions?.trim()
    ? `\nUSER INSTRUCTIONS (HIGH PRIORITY — follow these exactly, override your defaults to match):\n${customInstructions.trim()}\n`
    : ''

  const productTypeBlock = productType === 'software'
    ? `\nPRODUCT TYPE: This is a software/app/digital product — NOT a physical item.\n- Never say "grab yours", "pick it up", "apply", "use on your skin" or any physical product language\n- CTAs must be digital: "start free", "try it free", "download now", "sign up today", "get started"\n- Refer to it as "this app", "this tool", "this platform" not "this product" or "it"\n- Benefits should be outcomes: "saves me 3 hours", "I finally have X", "it just works"\n`
    : ''

  const languageBlock = language && language.code !== 'en'
    ? `\nLANGUAGE — All SPOKEN content (everything inside double quotes) MUST be written in ${language.name}. Stage directions in (parentheses) and section headers in [brackets] stay in English so the parser can read them. The CTA "${callToAction}" should also be translated to natural ${language.name}.\n`
    : ''

  const textPrompt = `Write a ${targetDurationSeconds}-SECOND UGC video script for a social media ad. The TOTAL spoken word count across HOOK + BODY + CTA must be ${targetWords} words or fewer — this is a hard limit because the video will be cut at ${targetDurationSeconds}s. Count carefully.

Product: ${productName}
Description: ${productDescription}
Benefits: ${benefits}
CTA: ${callToAction}
${languageBlock}${productTypeBlock}${customBlock}
Use this exact format:

${backgroundLine}

[HOOK — 0:00 to 0:0${hookEnd}]
(brief expression/tone note)
"spoken hook line — grabs attention immediately"

[BODY — 0:0${hookEnd} to 0:${bodyEnd < 10 ? '0' + bodyEnd : bodyEnd}]
(tone note)
"spoken body — authentic, conversational. Keep it tight — total script ≤ ${targetWords} words."

[CTA — 0:${bodyEnd < 10 ? '0' + bodyEnd : bodyEnd} to 0:${targetDurationSeconds}]
(tone note)
"spoken CTA — natural, confident, very short"

Rules:
- TOTAL spoken word count ≤ ${targetWords} — count every word in every quoted line. This is the most important rule.
- Spoken text always in double quotes
- Stage directions always in (parentheses)
- Section headers always in [brackets]
- ${forcedScene ? `[BACKGROUND: ${forcedScene}] must be the very first line, use it exactly` : '[BACKGROUND: ...] must be the very first line — choose what fits the product naturally'}
- No markdown, no title, no hashtags
- Authentic UGC tone — real person, not corporate${customInstructions?.trim() ? `\n- The USER INSTRUCTIONS block above overrides default tone/style choices wherever they conflict.` : ''}`

  const content: Anthropic.MessageParam['content'] = productImageBase64
    ? [
        { type: 'image', source: { type: 'base64', media_type: productImageMimeType as 'image/jpeg' | 'image/png' | 'image/webp', data: productImageBase64 } },
        { type: 'text', text: textPrompt },
      ]
    : textPrompt

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [{ role: 'user', content }],
  })

  return (msg.content[0] as { text: string }).text.trim()
}

// Replace the spoken line in the [HOOK ...] section with a user-picked hook.
export function replaceHook(script: string, newHook: string): string {
  const lines = script.split('\n')
  let inHook = false
  let replaced = false
  const out: string[] = []
  for (const line of lines) {
    const t = line.trim()
    if (/^\[HOOK\b/i.test(t)) {
      inHook = true
      out.push(line)
      continue
    }
    if (inHook && /^\[/.test(t)) {
      inHook = false
      out.push(line)
      continue
    }
    if (inHook && !replaced && t && !t.startsWith('(') && !t.startsWith('[')) {
      out.push(`"${newHook.replace(/^["""]|["""]$/g, '').trim()}"`)
      replaced = true
      continue
    }
    out.push(line)
  }
  if (!replaced) return `[HOOK — 0:00 to 0:05]\n"${newHook}"\n\n${script}`
  return out.join('\n')
}

// Extract only the spoken lines (between quotes) — this becomes Kling's audio source.
export function extractSpokenLines(script: string): string {
  const spoken: string[] = []
  for (const line of script.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('[') || t.startsWith('(')) continue
    const clean = t.replace(/^[""""]|[""""]$/g, '').trim()
    if (clean) spoken.push(clean)
  }
  return spoken.join(' ')
}
