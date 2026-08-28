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

  // Pick an angle at random so the model stops defaulting to
  // "problem → recap → CTA" every single time. Rotating the frame is the
  // single biggest lever on perceived variety and freshness.
  const angles = [
    {
      name: 'MID-USE REACTION',
      brief: 'Open mid-experience. They\'re already using it when the camera catches them. No setup, no problem statement — a reaction to what just happened, then one specific detail about what surprised them, then a throwaway line about telling their friend / not going back.',
    },
    {
      name: 'CONFESSIONAL',
      brief: 'A weirdly personal admission that has nothing to do with the product for the first beat, then the product enters as the thing that fixed the embarrassing situation. Vulnerable, specific, uncomfortable-honest.',
    },
    {
      name: 'ARGUING WITH SOMEONE OFF-SCREEN',
      brief: 'They\'re defending the product to an unseen skeptic ("no listen —", "I\'m telling you —"). Feels like the middle of a real conversation. The CTA is basically them giving up trying to convince and shrugging.',
    },
    {
      name: 'RANT / GENUINE ANNOYANCE',
      brief: 'They\'re annoyed at the OLD way of doing things — competitor by name if relevant, or the workflow itself. Product is the relief valve. Delivered fast, dry, a little pissed off.',
    },
    {
      name: 'SLOW REVEAL',
      brief: 'Starts with a hyper-specific weird sentence that makes no sense until the last 2 seconds. Payoff is the product being what caused the weirdness. Confusion-then-oh moment.',
    },
    {
      name: 'STORYTIME COLD OPEN',
      brief: 'Starts mid-story like they\'re texting a friend — "okay so —", "you\'re not gonna believe —". Zero preamble. The story IS the ad.',
    },
    {
      name: 'DIRECT-CAMERA CHALLENGE',
      brief: 'Cocky, playful, borderline confrontational. Points at the lens. Dares the viewer to prove them wrong. High energy, short sentences.',
    },
  ]
  const pickedAngle = angles[Math.floor(Math.random() * angles.length)]

  const textPrompt = `Write a ${targetDurationSeconds}-SECOND UGC video script for a social media ad. TOTAL spoken word count ≤ ${targetWords} — hard limit. Count every word.

Product: ${productName}
Description: ${productDescription}
Benefits: ${benefits}
CTA the brand wants: ${callToAction}   ← inspiration, NOT a line to copy verbatim
${languageBlock}${productTypeBlock}${twoPersonBlock}${povInterviewBlock}${customBlock}
==============================================
CREATIVE ANGLE FOR THIS SCRIPT: ${pickedAngle.name}
${pickedAngle.brief}
Commit to this angle. Do NOT default to "problem statement → product recap → generic CTA" — that is the exact shape we're trying to escape.
==============================================

Format:

${backgroundLine}

[HOOK — 0:00 to 0:0${hookEnd}]
(brief expression/tone note — physical, not emotional. e.g. "half-laughing, mouth full" not "excited")
"spoken hook — first 3 seconds MUST make someone stop scrolling. Weird, specific, unfinished, mid-sentence, oddly personal. NOT a clean thesis."

[BODY — 0:0${hookEnd} to 0:${bodyEnd < 10 ? '0' + bodyEnd : bodyEnd}]
(tone note)
"body — ONE specific moment from THEIR life. Not a description of what the product does. Details that couldn't come from a marketer: a time, a smell, a coworker's name, a tab count, a specific dollar amount, a physical gesture, an interrupted thought."

[CTA — 0:${bodyEnd < 10 ? '0' + bodyEnd : bodyEnd} to 0:${targetDurationSeconds}]
(tone note)
"CTA — an aside, a shrug, a private recommendation. NEVER 'just try it' / 'you have to try it' / 'try it free' / 'link below' — those four are BANNED. Rewrite as something a friend would text you."

Format rules:
- Spoken text in double quotes. Stage directions in (parentheses). Section headers in [brackets].
- ${finalScene ? `[BACKGROUND: ${finalScene}] is the first line — use it exactly.` : '[BACKGROUND: ...] is the first line.'}
- No markdown, no title, no hashtags, no explanations outside the format.

——————————————————————————————————
THE ANTI-SLOP CHECKLIST — read every line you write against this. If any line fails, rewrite it.
——————————————————————————————————

FAIL if any spoken line does ANY of these:

☒ Names the product's features in a list. ("script, voiceover, captions" → FAIL)
☒ Describes the product as if reading a website. ("makes ads in two minutes" → FAIL)
☒ Uses ANY of: amazing / incredible / game-changer / life-changing / obsessed / hits different / next-level / genuinely / actually / literally the best / finally a X that / no more X
☒ CTA is: "just try it" / "try it free" / "you have to try it" / "I'm in" / "I'm sold" / "link below" / "get yours" / "the one"
☒ Opens with "So I've been using…" / "So I discovered…" / "Let me tell you about…" / "You need to know about…"
☒ Body summarizes the product instead of telling ONE moment.
☒ CTA has an exclamation mark, an imperative verb, or sounds like it belongs on a billboard.
☒ Any three consecutive quoted words could appear in the marketing copy on the product's landing page.

☒ CLARITY FAIL — the "specific detail" rule is producing weird inside-joke scripts. Details must be FLAVOR, not PLOT. FAIL if the ad requires the viewer to already know:
   - a name that never gets a role ("Priya had three ads waiting" — WHO is Priya? "my client" or "my coworker" tells us in 2 words)
   - a placeholder that never gets replaced ("I typed our product name" — the ad must NAME the product or it's not an ad)
   - an event the viewer wasn't shown ("she thought I outsourced it" — outsourced WHAT? the ads? the writing? the whole company?)
   - a meta reference to the story itself ("…she's still asking who I hired" — this closes a story instead of driving action; the viewer should understand what the product IS by the last word)

CLARITY TEST — read the ad to a stranger who has never seen the product. After 10 seconds they should be able to answer:
   1. What is this product? (a name, a category, or a clear demonstration — pick one)
   2. What just happened to the person on screen? (a moment, not a mystery)
   3. Why should I care? (an outcome, a feeling, or a payoff)
If they'd shrug on any of the three → rewrite.

The SLOW REVEAL angle in particular: the "oh, THAT's what happened" moment must LAND. A slow reveal that stays confusing is just confusion. Weird → curiosity → payoff. Not weird → weirder → nothing.

PROPER NOUNS RULE: if you use a name, either it's the product/brand OR it's paired with a 1-word role ("my client Priya", "my roommate Sam", "our PM Jordan"). No naked names dropped into a scene the viewer doesn't share.

PASS looks like:

Physical (drink):
[HOOK] "Wait — (sips, squints) …what is happening in my mouth."
[BODY] "Okay so it's basil. And lemon. Which sounds fake. But it's like… (looks at can) …clean? I don't know how to say it."
[CTA] "I bought six. That's the review."

Physical (skincare):
[HOOK] "(camera catches her mid-application) — oh, you're here. Hi."
[BODY] "It's been eleven days. My mom asked if I got a facial. I did not get a facial."
[CTA] "…the tub is $34. That's all I'm gonna say."

SaaS (video tool like ContentFlow):
[HOOK] "Guys I'm gonna get fired." (long pause) "…just kidding, I'm ten ads ahead of schedule."
[BODY] "I typed one sentence into this thing at 9:04. It's 9:11. There are three finished ads on my desktop. I don't understand what's happening but I love it."
[CTA] "(shrugs) I mean. Yeah."

SaaS (project mgmt):
[HOOK] "My PM tried to schedule a meeting to plan the meeting to plan the launch."
[BODY] "I opened this thing, dragged four tasks onto a board, and just — walked out. Nobody knows I'm doing the work. Everyone thinks I'm still in the meeting."
[CTA] "It's free until it's not. Do what you want."

Study what those examples have in common:
- The HOOK is NOT a thesis. It's a fragment, a fake-out, or a weirdly personal image.
- The BODY has details that couldn't be invented by a copywriter (specific times, a mom, a tab, a dollar amount, a coworker).
- The CTA doesn't ask for the sale — it lets the viewer close it in their own head.
- There's ALWAYS one moment of hesitation, disfluency, or physical action ("sips", "shrugs", "squints", "long pause").

Before you commit each line, ask: "Could a marketer have written this exact sentence for a landing page?" If yes → rewrite until the answer is no.${customInstructions?.trim() ? `\n\nThe USER INSTRUCTIONS block above overrides default tone/style choices wherever they conflict.` : ''}`

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
