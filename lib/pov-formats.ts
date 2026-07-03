// POV / faceless UGC ad formats.
// Each format is a preset prompt scaffold for Seedance. The user supplies
// { productName, productDescription, benefit, extraDirection }, and we render
// a scene description tuned for realism + physics + the "phone-shot" aesthetic.

export type PovCategory = 'discovery' | 'unboxing' | 'in-use' | 'lifestyle' | 'demo'

export interface PovFormat {
  id: string
  name: string
  category: PovCategory
  emoji: string
  tagline: string
  needsProductImage: boolean
  needsUiScreenshot: boolean       // laptop/app UI reveal formats
  needsVoiceover: boolean          // ElevenLabs overlay on top
  durationSeconds: 5 | 10
  aspectRatio: '9:16' | '1:1' | '16:9'
  // Fallback prompt used only if Claude prompt-builder fails. Not the primary path —
  // buildPovSeedancePrompt (lib/pov-prompt.ts) composes a bespoke Arcads-style prompt
  // per generation using format, character, script, and product context.
  buildPrompt: (ctx: PovPromptContext) => string
}

export interface PovPromptContext {
  productName: string
  productDescription: string
  benefit: string
  extraDirection?: string
}

// Common POV realism scaffold — appended to every format so the model
// consistently produces phone-camera aesthetics, not cinematic AI output.
const REALISM_TAIL =
  'Shot on iPhone, vertical 9:16, handheld with slight micro-shake, natural available light, soft shallow depth of field, realistic skin and hand textures, no artificial cinematic color grading, no film grain, no letterboxing. Casual UGC aesthetic. Faceless — camera stays low or angled so no full face is visible.'

const NEG =
  'no cinematic camera moves, no smooth gimbal motion, no studio lighting, no perfect focus, no film grain, no overlaid text, no logos, no watermarks, no distorted hands, no extra fingers, no morphing faces'

export const POV_FORMATS: PovFormat[] = [
  {
    id: 'lazy-discovery',
    name: 'Lazy Discovery',
    category: 'discovery',
    emoji: '🛏️',
    tagline: 'Bed + laptop, casual "I just found this" energy',
    needsProductImage: false,
    needsUiScreenshot: true,
    needsVoiceover: true,
    durationSeconds: 5,
    aspectRatio: '9:16',
    buildPrompt: (ctx) =>
      `POV shot from a phone held at chest height, first-person perspective, filmed by someone lying on a white unmade bed at golden hour. In the foreground: a MacBook resting on the person's lap, screen visible, tilted slightly toward the camera. The screen clearly shows the ${ctx.productName} interface (${ctx.productDescription}). Warm afternoon sunlight through a window, cozy bedroom in soft focus, plants and a coffee mug on the nightstand. The hand not holding the phone occasionally reaches to scroll on the trackpad. Very slight handheld micro-shake, casual home vibe. Focus on the laptop screen: it stays crisp so the UI is legible. ${ctx.extraDirection ?? ''} ${REALISM_TAIL}`,
  },
  {
    id: 'cafe-scroll',
    name: 'Café Scroll',
    category: 'discovery',
    emoji: '☕',
    tagline: 'Coffee-shop table, phone in one hand, UI in view',
    needsProductImage: false,
    needsUiScreenshot: true,
    needsVoiceover: true,
    durationSeconds: 5,
    aspectRatio: '9:16',
    buildPrompt: (ctx) =>
      `POV shot from a person's face-height, looking down at their own hand holding a phone. Camera captures both the phone (screen crisp and legible, showing the ${ctx.productName} app: ${ctx.productDescription}) and a rustic café table below — a matcha latte, a croissant on a plate, warm wood texture. Ambient café background heavily blurred, soft afternoon light through a window. The thumb scrolls slowly on the phone screen. Very natural, unstyled. ${ctx.extraDirection ?? ''} ${REALISM_TAIL}`,
  },
  {
    id: 'late-night-scroll',
    name: 'Late-Night Scroll',
    category: 'discovery',
    emoji: '🌙',
    tagline: 'Dim room, blue screen glow, night-mode browsing',
    needsProductImage: false,
    needsUiScreenshot: true,
    needsVoiceover: true,
    durationSeconds: 5,
    aspectRatio: '9:16',
    buildPrompt: (ctx) =>
      `POV shot in a dark bedroom late at night. Only the blue-purple glow from a phone illuminates the person's hands and duvet cover. The phone screen dominates the frame, sharp and legible, showing the ${ctx.productName} interface (${ctx.productDescription}). Warm yellow lamp barely visible in the far background. Thumb slowly scrolls, tapping through the app. Intimate, quiet late-night mood. ${ctx.extraDirection ?? ''} ${REALISM_TAIL}`,
  },
  {
    id: 'unboxing',
    name: 'POV Unboxing',
    category: 'unboxing',
    emoji: '📦',
    tagline: 'Hands-only unboxing, ASMR-adjacent',
    needsProductImage: true,
    needsUiScreenshot: false,
    needsVoiceover: true,
    durationSeconds: 10,
    aspectRatio: '9:16',
    buildPrompt: (ctx) =>
      `Top-down POV, phone camera looking straight down at a light wooden desk. Two hands enter frame holding a delivery package. Hands pull the tape off, open the box, lift out the ${ctx.productName} (${ctx.productDescription}). Realistic tactile motion, focus on textures — cardboard, tissue paper, the product itself. Natural window light from the side. Slight ASMR feel. The product is visible clearly by the end of the clip. ${ctx.extraDirection ?? ''} ${REALISM_TAIL}`,
  },
  {
    id: 'delivery-reveal',
    name: 'Delivery Reveal',
    category: 'unboxing',
    emoji: '🚪',
    tagline: 'Hands open door → box on floor → unbox',
    needsProductImage: true,
    needsUiScreenshot: false,
    needsVoiceover: true,
    durationSeconds: 10,
    aspectRatio: '9:16',
    buildPrompt: (ctx) =>
      `POV: first person opens an apartment door, sees a delivery box sitting on the doormat. Camera looks down at the box, hands pick it up. Cut to them sitting on a couch, ripping the tape off, lifting out ${ctx.productName} (${ctx.productDescription}). Modern apartment interior in soft focus. Realistic hands, natural indoor lighting. Feels like a candid moment shared to a friend. ${ctx.extraDirection ?? ''} ${REALISM_TAIL}`,
  },
  {
    id: 'product-broll',
    name: 'Product B-Roll',
    category: 'in-use',
    emoji: '✋',
    tagline: 'Hands using the product — no talking, just visuals',
    needsProductImage: true,
    needsUiScreenshot: false,
    needsVoiceover: true,
    durationSeconds: 5,
    aspectRatio: '9:16',
    buildPrompt: (ctx) =>
      `POV close-up shots of hands actively using ${ctx.productName} (${ctx.productDescription}). Realistic textures, natural motion. Multiple micro-angles cut together: wide, close, top-down. Emphasize the tactile feel and the moment of ${ctx.benefit}. Real hands with slight imperfections (natural nails, small marks). No face visible. Home or studio environment, warm ambient light. ${ctx.extraDirection ?? ''} ${REALISM_TAIL}`,
  },
  {
    id: 'kitchen-prep',
    name: 'Kitchen Prep',
    category: 'in-use',
    emoji: '🍳',
    tagline: 'POV hands using product in kitchen',
    needsProductImage: true,
    needsUiScreenshot: false,
    needsVoiceover: true,
    durationSeconds: 10,
    aspectRatio: '9:16',
    buildPrompt: (ctx) =>
      `POV from a person's chest-height looking down at a marble kitchen counter. Hands prepare something using ${ctx.productName} (${ctx.productDescription}). Natural morning light through a window. Coffee steam in background. Cutting board, herbs, and ingredients around. Realistic cooking motion focused on ${ctx.benefit}. Hands only, no face. ${ctx.extraDirection ?? ''} ${REALISM_TAIL}`,
  },
  {
    id: 'grwm',
    name: 'Get Ready With Me',
    category: 'lifestyle',
    emoji: '💄',
    tagline: 'Bathroom mirror POV, applying / using product',
    needsProductImage: true,
    needsUiScreenshot: false,
    needsVoiceover: true,
    durationSeconds: 10,
    aspectRatio: '9:16',
    buildPrompt: (ctx) =>
      `POV filmed via a phone held at chest level in a bathroom, aimed at a mirror. Person's reflection is visible from the neck down or with face partially cropped — never fully seeing the face. They pick up ${ctx.productName} (${ctx.productDescription}) from the sink counter and use it. Realistic bathroom: white subway tile, warm vanity lights, plants. Natural morning light mixed with warm bulbs. Focus on the product and the routine motion around ${ctx.benefit}. ${ctx.extraDirection ?? ''} ${REALISM_TAIL}`,
  },
  {
    id: 'desk-showcase',
    name: 'Desk Show-and-Tell',
    category: 'demo',
    emoji: '💻',
    tagline: 'Over-shoulder desk POV, showing product / app',
    needsProductImage: false,
    needsUiScreenshot: true,
    needsVoiceover: true,
    durationSeconds: 5,
    aspectRatio: '9:16',
    buildPrompt: (ctx) =>
      `POV over-shoulder shot of a clean modern desk setup. A hand gestures toward a large monitor showing the ${ctx.productName} interface (${ctx.productDescription}). Screen content is sharp and legible. Warm desk lamp, a plant, a coffee mug, mechanical keyboard. The hand points, moves the mouse, highlights something specific about ${ctx.benefit}. Camera stays behind the person — no face, only back of head partially visible if at all. ${ctx.extraDirection ?? ''} ${REALISM_TAIL}`,
  },
  {
    id: 'problem-solution',
    name: 'Problem → Solution',
    category: 'demo',
    emoji: '🔄',
    tagline: 'POV of the frustration → product appears → solved',
    needsProductImage: true,
    needsUiScreenshot: false,
    needsVoiceover: true,
    durationSeconds: 10,
    aspectRatio: '9:16',
    buildPrompt: (ctx) =>
      `POV first-person shot showing a frustrating everyday problem (relevant to ${ctx.productDescription}). Halfway through the clip, a hand enters frame holding ${ctx.productName}. The person uses it, and the scene resolves — ${ctx.benefit} is now visible. Two-part narrative in one continuous POV. Realistic home environment, natural light, no face. ${ctx.extraDirection ?? ''} ${REALISM_TAIL}`,
  },
]

export function getPovFormat(id: string): PovFormat | undefined {
  return POV_FORMATS.find(f => f.id === id)
}

export function seedanceNegativePrompt(): string {
  return NEG
}
