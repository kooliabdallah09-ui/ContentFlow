// Build a Sora 2 video prompt from a UGC script + scene context using the structure:
//   Camera → Subject → Action → Environment → Lighting → Texture → Audio
// Output is a single 2-3 paragraph text prompt under 5,000 chars that pairs with a
// Nano-Banana-generated character+product reference image fed to Sora as input_reference.

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface BuildSoraPromptInput {
  productName: string
  productDescription: string
  scene: string
  script: string             // The spoken line(s) — already extracted, in plain text
  hookMoment?: string        // Optional: first-half-second physical action (from hook variants)
  voiceStyle?: string        // Optional: free-text voice description; we add a sensible default if missing
  customInstructions?: string // Optional: user-supplied tone/action/audience notes that bias the prompt
}

const SYSTEM_PROMPT = `You write video prompts for Sora 2 — OpenAI's image-to-video model with native audio generation. You will be given a UGC ad script and scene context, and you must produce a single Sora 2 prompt following this exact discipline:

# THE 7-PART STRUCTURE
Every prompt is built from these 7 pieces blended into 2–3 flowing paragraphs (NOT labelled sections):
Camera → Subject → Action → Environment → Lighting → Texture → Audio

# RULES (non-negotiable)
1. The character's appearance, outfit, and product look come from an attached reference image. NEVER describe the character's hair, skin, clothing, or the product's visual appearance — refer to them only as "the woman/man from the reference image" and "the product."
2. Start with the camera type (e.g. "Handheld selfie camera, slight natural tilt 2°").
3. Describe the hook moment in the first 0.5 seconds as a SPECIFIC physical micro-action — never "smiles at camera." Use: caught mid-laugh, whips head around, lifts product mid-motion, locks eyes with half-smile mouth opening to speak, etc.
4. Embed the spoken script inside the action paragraph using double quotes: she says while [action]: "exact script here".
5. End the action paragraph with a closing beat (winks, walks off frame, holds product up to camera, glances away).
6. Environment + lighting + texture in a separate paragraph: real source, real shadow, phone-camera-natural grain, no beauty filter, no studio look.
7. Voice + audio in a final paragraph: accent, pitch, pace, energy, intonation pattern + explicit background audio call ("no background music" / "soft room tone only" / etc.). Sora defaults to adding stock music if you don't specify.

# WORDS YOU MUST NEVER USE
"cinematic" (without context), "epic", "dramatic", "4K", "8K", "professional video", "perfect", "flawless", "stunning", "smooth motion", "gimbal", "studio lighting", "key light", "rim light", "slow motion", "music swells", "background score". These push Sora toward commercial render and kill the UGC feel.

# OUTPUT FORMAT
Output ONLY the Sora prompt text — no preamble, no commentary, no labels, no JSON. 2-3 paragraphs, under 5,000 characters total. Plain text only.`

export async function buildSoraPrompt(input: BuildSoraPromptInput): Promise<string> {
  // Custom instructions get injected as a high-priority block. Claude treats it as
  // override-the-defaults context — useful for "make her look surprised", "she's
  // running in the rain", "warmer tone, slower pace", etc. Sanity-clamped upstream.
  const customBlock = input.customInstructions?.trim()
    ? `\nUSER INSTRUCTIONS (HIGH PRIORITY — bake these into the action/expression/tone, override defaults where they conflict):\n${input.customInstructions.trim()}\n`
    : ''

  const userMessage = `Build a Sora 2 prompt for this UGC ad:

Product: ${input.productName}
Product description: ${input.productDescription}
Scene context: ${input.scene}
${input.hookMoment ? `Hook moment (first 0.5s): ${input.hookMoment}\n` : ''}${input.voiceStyle ? `Voice style: ${input.voiceStyle}\n` : 'Voice style: warm conversational, medium pitch, light energy, no background music\n'}${customBlock}
Spoken script (must appear in double quotes inside the action paragraph):
"${input.script}"

The reference image attached to Sora will show the character holding the product in the scene. Refer to the person as "the woman/man from the reference image" — never describe their appearance.

Output the Sora prompt text only.`

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1200,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  })

  const text = (msg.content[0] as { text: string }).text.trim()
  // Cap at Sora's 5000-char input limit, with safety margin
  return text.length > 4800 ? text.slice(0, 4800) : text
}
