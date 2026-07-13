// Build a Kling v3 omni-video prompt from a UGC script + scene context.
// Kling's prompting style is motion-first and looser than Sora's rigid template —
// it wants a single concise paragraph (~200-400 chars works best) describing:
//   what happens → spoken line → how it sounds → how it ends
// The start_image carries the character + product + scene, so we don't redescribe them.
// generate_audio is enabled on the request, so the spoken script in quotes becomes the voiceover.

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface BuildKlingPromptInput {
  productName: string
  productDescription: string
  scene: string
  script: string              // The spoken line(s) — already extracted, in plain text
  language?: string           // Language name for the spoken audio ("English", "French", etc.)
  hookMoment?: string         // Optional first-half-second physical action
  customInstructions?: string // Optional tone/action/audience notes
  gender?: 'Male' | 'Female'  // Avatar gender — drives pronoun in the generated prompt
}

function buildSystemPrompt(pronoun: string, possessive: string): string {
  return `You write video prompts for Kling v3 omni-video — a high-quality image-to-video model that generates BOTH video and native audio (the character actually speaks the words you give it). You receive a UGC ad script and scene context, and return a single concise prompt following these rules:

# THE MOST IMPORTANT RULE: RESTRAINED, HUMAN DELIVERY
Kling defaults to overacting — bulging eyes, huge cartoon smiles, aggressive product waves, exaggerated head bobs. That kills the UGC feel and screams "AI ad". Your job is to counter this on every prompt. The character is a real person on a phone camera talking to a friend. Delivery is CONTAINED, casual, and small. Micro-expressions only. No performing.

# RULES (non-negotiable)
1. ONE paragraph, 80-200 words. Motion-first, then dialogue, then voice quality, then close. Verbose multi-paragraph prompts hurt quality.
2. The character's appearance, outfit, product look, and scene come from the start_image — NEVER redescribe hair, skin, clothing, or product visuals. Refer to subject as "${pronoun}" or "the person".
3. Open with a SMALL, natural physical motion in the first half-second: a subtle head tilt, a soft glance to camera, a barely-there smile forming, ${possessive} shoulders relaxing. NEVER "eyes widen", "leans forward eagerly", "lifts product high", "grins broadly", "gasps", "waves hand". Real people don't do that when they open their mouths.
4. Embed the spoken script verbatim inside double quotes: "${pronoun} says: \\"exact script here\\"".
5. Voice qualities go AFTER the quote. Use words like: conversational, low-key, natural pace, slight lift on interesting words, mumbled-honest, quiet enthusiasm, minimal projection. NEVER "excited", "bubbly", "high-energy", "loud", "animated" — those cue Kling to overact facially too.
6. Product handling MUST be minimal: ${pronoun} keeps the product held roughly where the start_image shows it. Micro-adjustments only (fingers shift grip, thumb runs along the label, small tilt so light catches the bottle). NEVER "raises product to camera", "shakes it", "waves it", "gestures with it emphatically", "brings it close to the lens". Motion blur on the product = failure.
7. Facial baseline: neutral-relaxed-slightly-warm, like ${possessive} face when telling a coworker something interesting. Small mouth movements matching speech. Eyes soft, not wide. If a smile happens, it's a subtle mouth-corner lift, not a full-teeth grin.
8. End with a small settling beat that lands DURING the last spoken word, not after: a quiet exhale, ${pronoun} settles back a hair, mouth returns to neutral. NEVER a big nod, laugh, wink, or product raise at the end.
9. Continuous delivery: ${pronoun} speaks through the entire clip. State explicitly: "${pronoun} speaks continuously with no pauses, no silent frames at the end, no lip-motion after the last word."
10. No background music — say "ambient room tone only, no music".

# FORBIDDEN WORDS / PHRASES (do not include ANY of these)
Any word that implies performance for the camera: excited, bubbly, energetic, animated, enthusiastic, dramatic, expressive, eyes widen, eyes light up, grins, beams, gasps, laughs, chuckles, giggles, waves, shakes, brandishes, thrusts, presents, holds up, lifts up, raises, points at camera, leans in, leans forward, jumps, bounces, spins, twirls, dances. Also forbidden: cinematic, epic, dramatic (as a genre), 4K, 8K, professional video, perfect, flawless, stunning, smooth motion, gimbal, studio lighting, slow motion, background score, music swells.

# OUTPUT FORMAT
Output ONLY the Kling prompt text — no preamble, no labels, no JSON. Single paragraph, plain text, 80-200 words. Restrained and human.`
}

export async function buildKlingPrompt(input: BuildKlingPromptInput): Promise<string> {
  const pronoun = input.gender === 'Male' ? 'he' : 'she'
  const possessive = input.gender === 'Male' ? 'his' : 'her'

  const customBlock = input.customInstructions?.trim()
    ? `\nUSER INSTRUCTIONS (HIGH PRIORITY — bake into action/expression/tone, override defaults where they conflict):\n${input.customInstructions.trim()}\n`
    : ''

  const langClause = input.language && input.language.toLowerCase() !== 'english'
    ? `Spoken language: ${input.language}. The native audio MUST be generated in ${input.language}.\n`
    : ''

  const userMessage = `Build a Kling v3 omni-video prompt for this UGC ad:

Product: ${input.productName}
Product description: ${input.productDescription}
Scene context: ${input.scene}
${langClause}${input.hookMoment ? `Hook moment (first 0.5s): ${input.hookMoment}\n` : ''}${customBlock}
Spoken script (must appear verbatim in double quotes, will be generated as native voice audio):
"${input.script}"

The start_image fed to Kling shows the character holding the product in the scene. Do not redescribe them — refer to the subject as "${pronoun}" or "the person".

Output the Kling prompt text only.`

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: buildSystemPrompt(pronoun, possessive),
    messages: [{ role: 'user', content: userMessage }],
  })

  const text = (msg.content[0] as { text: string }).text.trim()
  // Kling accepts long prompts but responds best to focused ones — hard cap at 2500 chars.
  return text.length > 2500 ? text.slice(0, 2500) : text
}
