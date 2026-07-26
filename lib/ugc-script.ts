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
  formatKey?: string,
  hasSecondCharacter?: boolean,
): Promise<string> {
  // Determine script mode from format. Two-person = interview/couple/roommate.
  // POV-stranger-only = interview-pov (solo pipeline but interview framing).
  // Also: if a co-star is explicitly present (hasSecondCharacter) we ALWAYS
  // write a two-person script regardless of the picked format.
  const { getCampaignFormat } = await import('./campaign-formats')
  const fmt = formatKey ? getCampaignFormat(formatKey) : undefined
  const isTwoPerson = hasSecondCharacter
    || fmt?.pipeline === 'ugc-interview'
    || fmt?.pipeline === 'ugc-couple'
  const isInterviewPOV = formatKey === 'interview-pov'
  const isInterviewLike = formatKey === 'interview-man-on-street' || isInterviewPOV
  const personA = isInterviewLike ? 'interviewer' : (formatKey === 'couple-sharing' ? 'partner' : 'friend')
  const personB = isInterviewLike ? 'stranger' : (formatKey === 'couple-sharing' ? 'partner' : 'roommate')
  // Kling v3 omni's native voice actually spits ~2.2 words/sec for casual UGC
  // delivery. With only 0.4s of tail padding the last word lands just before
  // the final frame — no silent-mouth drift like we had with the old (dur-1.5)×1.9
  // formula which underfilled the clip by 2-3s. If Kling starts overrunning
  // we can nudge WPS down to 2.1, but 2.2 lines up with the measured cadence.
  const targetWords = Math.max(6, Math.round((targetDurationSeconds - 0.4) * 2.2))
  const hookEnd = Math.min(5, Math.round(targetDurationSeconds * 0.2))
  const bodyEnd = Math.round(targetDurationSeconds * 0.85)

  // Format-implied scenes — the format itself dictates where this HAS to be shot.
  // Falls back to a generic picker only if no format is set and no forcedScene given.
  const formatScene = (() => {
    if (!formatKey) return null
    if (formatKey === 'interview-pov' || formatKey === 'interview-man-on-street')
      return 'busy city street or pedestrian walkway — real outdoor urban setting, cars/people in background'
    if (formatKey === 'couple-sharing') return 'living room or kitchen at home — warm, lived-in'
    if (formatKey === 'roommate-rec') return 'shared apartment living space — casual, cluttered-real'
    if (formatKey === 'get-ready-with-me') return 'bathroom mirror or bedroom vanity — morning-routine setting'
    if (formatKey === 'tv-spot') return 'considered cinematic setting appropriate to the product — not a generic room'
    if (formatKey === 'camera-pov' || formatKey === 'pov-vlog')
      return 'first-person environment where the product is being used'
    if (formatKey === 'unboxing') return 'clean desk, table, or countertop — package-opening setting'
    return null
  })()
  const finalScene = forcedScene || formatScene
  const backgroundLine = finalScene
    ? `[BACKGROUND: ${finalScene}]   ← USE THIS EXACT SCENE, do not change it (format requires it)`
    : `[BACKGROUND: one of: bedroom, bathroom, kitchen, living room, office, gym, outdoor, car interior, cafe]`

  const customBlock = customInstructions?.trim()
    ? `\nUSER INSTRUCTIONS (HIGH PRIORITY — follow these exactly, override your defaults to match):\n${customInstructions.trim()}\n`
    : ''

  const productTypeBlock = productType === 'software'
    ? `\nPRODUCT TYPE: This is a software/app/digital product — NOT a physical item.
- The character speaks directly to camera — they do NOT hold a phone, tablet, or laptop, and do NOT show or reference any screen/device physically
- The app UI will appear as a large background screen behind them — no need to describe it, just talk about the benefit
- Never say "grab yours", "pick it up", "apply", "use on your skin", "holding my phone", "showing you my screen" or ANY physical/device interaction language
- CTAs must be digital: "start free", "try it free", "download now", "sign up today", "get started", "get early access"
- Refer to it as "this app", "this tool", "this platform" — not "this product"
- Benefits should be outcome-first: "saves me 3 hours", "I finally have X", "it just works", "no more [old problem]"
- HOOK must be a provocative question or relatable problem — never a device action
\n`
    : ''

  const languageBlock = language && language.code !== 'en'
    ? `\nLANGUAGE — All SPOKEN content (everything inside double quotes) MUST be written in ${language.name}. Stage directions in (parentheses) and section headers in [brackets] stay in English so the parser can read them. The CTA "${callToAction}" should also be translated to natural ${language.name}.\n`
    : ''

  const twoPersonBlock = isTwoPerson
    ? `\nTWO-PERSON DIALOGUE FORMAT — this is a two-persona script. You MUST label every spoken line with either "PERSON A (${personA})" or "PERSON B (${personB})". They trade lines back-and-forth across HOOK, BODY, CTA. Include brief stage directions in (parentheses) after the label — e.g. PERSON A (${personA}, holding mic + product): "line". Both personas share the ${targetWords}-word budget. Example:
[HOOK — 0:00 to 0:03]
PERSON A (${personA}, holding mic + product): "Have you tried this?"
PERSON B (${personB}, curious): "What is it?"
[BODY — 0:03 to 0:10]
PERSON A: "Short pitch line."
PERSON B (taking a sip, impressed): "Oh wow. Really good."
[CTA — 0:10 to 0:15]
PERSON A: "Try it."
PERSON B (nodding): "Yeah, I'm buying this."
\n`
    : ''

  const povInterviewBlock = isInterviewPOV
    ? `\nPOV INTERVIEW FORMAT — the camera IS the interviewer. Only the STRANGER's spoken audio matters (only their voice will be in the final video). The interviewer's question is IMPLIED off-camera in brackets like [interviewer off-camera: "Have you tried this?"] for context, but is NOT counted in the spoken-word budget. Every quoted spoken line must belong to the stranger. Example:
[HOOK — 0:00 to 0:03]
[interviewer off-camera: "Have you tried this?"]
(stranger, curious) "Wait, what is it?"
[BODY — 0:03 to 0:10]
[interviewer off-camera: "Take a sip."]
(stranger, taking a sip, impressed) "Oh wow. That's actually really good."
[CTA — 0:10 to 0:15]
(stranger, nodding) "Yeah, I'm buying this."
\n`
    : ''

  const textPrompt = `Write a ${targetDurationSeconds}-SECOND UGC video script for a social media ad. The TOTAL spoken word count across HOOK + BODY + CTA must be ${targetWords} words or fewer — this is a hard limit because the video will be cut at ${targetDurationSeconds}s. Count carefully.

Product: ${productName}
Description: ${productDescription}
Benefits: ${benefits}
CTA: ${callToAction}
${languageBlock}${productTypeBlock}${twoPersonBlock}${povInterviewBlock}${customBlock}
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
- ${finalScene ? `[BACKGROUND: ${finalScene}] must be the very first line, use it exactly` : '[BACKGROUND: ...] must be the very first line — choose what fits the product naturally'}
- No markdown, no title, no hashtags

HOW A REAL PERSON TALKS ON CAMERA — this is the difference between good and cringe:

BANNED phrases (these are AI-ad tells — a real person NEVER says these together like this):
- "actually amazing", "genuinely good", "actually really", "actually really good", "actually does something"
- "finally, a [X] that…", "no more [X]", "the [X] that [Y]"
- "amazing", "incredible", "revolutionary", "game-changer", "next-level", "hits different", "life-changing", "obsessed"
- "you have to try", "trust me", "you won't believe", "you need this"
- multi-benefit stitching ("great taste AND healthy AND refreshing AND …") — pick ONE reaction
- three-adjective descriptions ("light, refreshing, and functional")
- CTAs like "grab one today", "get yours now", "don't miss out"

DO write like this:
- Reactions BEFORE opinions: "oh — wait", "hm", "okay", "no way", "hold on"
- Disfluencies and thinking sounds: "uh", "like", "hm", "wait…", trailing off with "…"
- False starts and self-correction: "this is — okay this is actually kind of…"
- Short direct sentences. One thought at a time. Not two claims stitched together.
- Specific concrete details over adjectives: not "refreshing", but "cold, kinda tart" or "tastes like basil"
- Genuine mild reactions, not enthusiasm dial: "yeah… I'd buy this" beats "you HAVE to try this"
- CTAs that sound like a real recommendation, not a pitch: "I'd get this", "worth trying", "gonna buy more"
- If the character just tasted/tried the product, they react first (surprise, curiosity), THEN describe. Never launch straight into a pitch.

EXAMPLES of good vs bad — study these:
BAD: "Wait, this is actually amazing. Lemon and basil? Sounds weird but tastes incredible. Plus it's good for digestion. Finally a drink that's actually refreshing and functional."
GOOD: "Wait — (sips) hm. Yeah, that's… weird in a good way. Basil? Kinda tart. I like it."

BAD: "You have to try this. It's revolutionary."
GOOD: "Honestly? I'd get this again."

BAD: "This app changed my life. It saves me hours every day."
GOOD: "Okay, I've been using this for like a week. It's — it just works. Weirdly."

Every quoted line must pass this test: "Would a real person tasting/testing this for the first time, filmed on a phone, ACTUALLY say this?" If it sounds like ad copy, rewrite it.${customInstructions?.trim() ? `\n- The USER INSTRUCTIONS block above overrides default tone/style choices wherever they conflict.` : ''}`

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
