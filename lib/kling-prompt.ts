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

# RULES (non-negotiable)
1. ONE paragraph, 80-200 words max. Kling responds best to focused, motion-first prompts. Verbose Sora-style multi-paragraph prompts hurt quality.
2. The character's appearance, outfit, product look, and scene come from the start_image — NEVER redescribe hair, skin, clothing, or product visuals. Refer to subject as "${pronoun}" or "the person".
3. Open with the physical motion in the first second (caught mid-laugh, lifts product up, leans toward camera with eyes widening, etc.) — never "smiles at camera".
4. Embed the spoken script verbatim inside double quotes. Tag it explicitly: "${pronoun} says: \\"exact script here\\"" so Kling knows to generate that voice line.
5. Specify the voice qualities AFTER the quote: warm/bright/low/young/confident, natural conversational pace, slight smile in the voice. This biases the native audio generator.
6. End with a closing micro-beat (small nod, holds product up, glances away with grin, ${pronoun === 'he' ? 'runs hand through hair' : 'hair flip'}) that lands DURING the last spoken word — not after. The mouth stops moving the instant the final word ends.
7. No background music — say "ambient room tone only, no music".
8. Continuous delivery: ${pronoun} speaks through the entire clip. State this explicitly: "${pronoun} speaks continuously with no pauses, no silent frames at the end, no lip-motion after the last word." Kling drifts audio/mouth-sync at the tail if this isn't enforced.

# FORBIDDEN WORDS
"cinematic" (without context), "epic", "dramatic", "4K", "8K", "professional video", "perfect", "flawless", "stunning", "smooth motion", "gimbal", "studio lighting", "slow motion", "background score", "music swells". These push the model toward commercial render and kill the UGC feel.

# OUTPUT FORMAT
Output ONLY the Kling prompt text — no preamble, no labels, no JSON. Single paragraph, plain text, 80-200 words.`
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
