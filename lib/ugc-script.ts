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

  // TV Spot: cinematic multi-shot structure — NOT a talking-head UGC.
  if (formatKey === 'tv-spot') {
    const shotCount = targetDurationSeconds <= 10 ? 2 : targetDurationSeconds <= 20 ? 3 : 4
    const tvSpotPrompt = `Write a ${targetDurationSeconds}-SECOND TV SPOT script for a premium brand ad. This is NOT a UGC talking-head — it is a cinematic commercial with multiple shots and a confident voiceover or minimal spoken lines. Total spoken word count ≤ ${targetWords} words.

Product: ${productName}
Description: ${productDescription}
Benefits: ${benefits}
CTA: ${callToAction}
${languageBlock}${customBlock}
Use this EXACT format (${shotCount} shots + a super card):

[LOCATION: {one cinematic setting — describe lighting, surfaces, mood. This is the main scene.}]

${Array.from({ length: shotCount }, (_, i) => {
  const start = Math.round((i / shotCount) * targetDurationSeconds)
  const end = Math.round(((i + 1) / shotCount) * targetDurationSeconds)
  return `[SHOT ${i + 1} — 0:${String(start).padStart(2, '0')} to 0:${String(end).padStart(2, '0')}]
(camera angle + action — e.g. "tight on product, hand lifts it into light" or "wide — character walks into frame from left, sets product on counter")
"spoken V.O. or on-camera line — OR write [VISUAL ONLY] if this shot has no dialogue"
`
}).join('\n')}
[SUPER — final 2s]
${productName}
${callToAction}

Rules:
- TOTAL spoken word count ≤ ${targetWords} — the hardest constraint
- Each [SHOT N] camera direction describes a CINEMATIC moment: product hero, lifestyle action, or character gesture. Not a selfie. Not talking straight to camera unless it's the final beat.
- Spoken lines are V.O. or quiet/deliberate on-camera — confident, spare, NOT conversational rambling
- [VISUAL ONLY] is valid when the image and motion say enough
- [LOCATION] is one continuous setting — all shots happen here
- [SUPER] = text overlay on final frame, not spoken
- No markdown, no hashtags, no explanations outside the format

TV AD TONE — the difference between a TV spot and a social UGC:
- BANNED: filler reactions ("wait—", "hm", "uh"), disfluencies, self-corrections, casual chat
- USE: short declarative sentences, poetic compression, one strong image per line
- GOOD V.O.: "Cold. Herbal. Nothing like it." / "The drink you didn't know you needed." / "Some things are just different."
- GOOD ON-CAMERA: a character picks up the product, looks at it, says one clean line — then cuts
- CTA is shown as text in [SUPER], not spoken unless the format demands it
- Think: Apple, Nike, Liquid Death TV ads — not TikTok reviews`

    const tvContent: Anthropic.MessageParam['content'] = productImageBase64
      ? [
          { type: 'image', source: { type: 'base64', media_type: productImageMimeType as 'image/jpeg' | 'image/png' | 'image/webp', data: productImageBase64 } },
          { type: 'text', text: tvSpotPrompt },
        ]
      : tvSpotPrompt

    const tvMsg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 700,
      messages: [{ role: 'user', content: tvContent }],
    })
    return (tvMsg.content[0] as { text: string }).text.trim()
  }

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

HOW A REAL PERSON TALKS ON CAMERA — this is the difference between good and cringe.

BANNED PATTERNS (structural — not just words. The model breaks these constantly. DO NOT.):

1. **Feature listing.** NEVER stitch features together with commas or "AND". A real person naming 4 things in a row is instant AI-tell.
   BAD: "It does script, voiceover, captions, and B-roll."
   BAD: "You get analytics, scheduling, editing, and posting."
   GOOD: Pick ONE feature, describe the specific moment you used it. "I typed in what I wanted and it just... made the whole video."

2. **The Recap Body.** BODY is not "here is what the product does." BODY is "here is one specific moment I had with it, in my life, this week."
   BAD: "Contentflow makes ads in two minutes with one brand profile."
   GOOD: "I made this ad on my lunch break. Like, actual lunch break — 15 minutes."

3. **Ad-copy CTAs.** CTAs sound like a friend's aside, not a marketer's close.
   BAD: "Yeah, I'm in." / "I'm sold." / "You have to try it." / "This is the one."
   GOOD: "I mean — I'm not going back to Canva after this." / "I'll link it below, look, I don't care what you do." / "Honestly, just try the free version, you'll see."

4. **The "so I discovered" opening.** Nobody starts a real conversation with a soft product reveal.
   BAD: "So I've been using this tool called Contentflow…"
   GOOD: A specific problem in progress. "It's midnight and I still haven't posted today's ad, this is fine."

5. **Adjective triples & AI-word soup.** "amazing", "incredible", "revolutionary", "game-changer", "next-level", "hits different", "life-changing", "obsessed", "actually amazing", "genuinely good", "finally, a [X] that…", "no more [X]", "the [X] that [Y]".

6. **The polite realization.** BAD: "(realization, matter-of-fact) 'Contentflow does it all…'" That fake-composed reveal is peak AI. Real reactions are messier — laugh, sigh, side-eye, exhale, "…what."

DO write like this:
- **Start with a specific moment, not a claim.** A time, a place, a small frustration, a small win. "3 AM edit," "the client just changed the brief," "I have 12 tabs open."
- **One idea per line.** Not two claims stitched.
- **Concrete over abstract.** Not "saves me time" — "I did this in 4 minutes." Not "professional-looking" — "my client thought I hired a filmer."
- **Disfluencies and self-correction.** "hm," "uh," "wait—," "okay so—," "…yeah," trailing "…"
- **Reactions BEFORE opinions.** They just experienced something → they react → THEN they describe.
- **CTAs that sound like a real recommendation, not a pitch.** "I mean, try it." "It's free to start, so." "I'd just get it."

EXAMPLES — study the PATTERN, not just the words.

Physical product (drink):
BAD: "Wait, this is actually amazing. Lemon and basil? Sounds weird but tastes incredible. Plus it's good for digestion."
GOOD: "Wait — (sips) hm. Yeah, that's… weird in a good way. Basil? Kinda tart. I like it."

SaaS / software (a tool like Contentflow):
BAD: "So we're using like five different tools just to make one ad?" / "Contentflow does it all in one place. Script, voiceover, captions, B-roll. Two minutes. One brand profile." / "Yeah, I'm in."
GOOD: "So I'm supposed to post an ad today and I have — (counts on fingers) — a Canva tab, a CapCut tab, ElevenLabs, ChatGPT, and I still haven't started." / "(later, holding phone showing finished video) …okay. I typed one sentence. This came out." / "I don't know, man. Just try it, it's free to start."

SaaS (video editor):
BAD: "This tool is a game-changer for creators."
GOOD: "I edited three reels in the time it took my coffee to get cold. That's — that's the whole review."

Beauty product:
BAD: "I've never used anything as amazing as this serum. My skin is glowing."
GOOD: "Okay it's been like a week. (turns face in light) I don't know if you can see. I can see."

TEST every quoted line before writing it: "Would a real person, holding a phone, mid-thought, actually say this out loud?" If it reads like a product page, rewrite it. If it lists features, rewrite it. If the CTA sounds like a pitch, rewrite it.${customInstructions?.trim() ? `\n- The USER INSTRUCTIONS block above overrides default tone/style choices wherever they conflict.` : ''}`

  const content: Anthropic.MessageParam['content'] = productImageBase64
    ? [
        { type: 'image', source: { type: 'base64', media_type: productImageMimeType as 'image/jpeg' | 'image/png' | 'image/webp', data: productImageBase64 } },
        { type: 'text', text: textPrompt },
      ]
    : textPrompt

  // Sonnet, not Haiku. UGC scripts are a taste task — Haiku produces
  // technically-correct but formulaic output (feature lists in BODY,
  // ad-copy CTAs). Sonnet catches the pattern-level "don'ts" that
  // Haiku ignores. ~$0.03 more per script; huge quality lift.
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 700,
    temperature: 1,
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
