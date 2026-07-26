// Motion-broll pipeline prompt helpers.
//
// The 5 motion-broll formats (aesthetic-broll, unboxing-asmr, mystery-box,
// crush-test, product-showcase, hyper-motion) are all product-first, no
// dialogue. There is no character, no script. The first frame is a
// product-hero still; Seedance animates it forward with a per-format
// motion prompt.

export type MotionBrollFormatKey =
  | 'aesthetic-broll'
  | 'unboxing-asmr'
  | 'mystery-box'
  | 'crush-test'
  | 'product-showcase'
  | 'hyper-motion'

// Per-format first-frame image prompts. Fed to Nano Banana Pro with the
// product reference image. Every prompt insists on faithful product
// fidelity (label, colour, shape) — this is the whole point of motion-broll.
export function motionBrollFrameSpec(
  formatKey: string,
  opts: { hasPackagingRef?: boolean } = {},
): {
  framing: string
  scene: string
  lighting: string
  extra?: string
} {
  if (formatKey === 'unboxing-asmr') {
    const packagingLine = opts.hasPackagingRef
      ? 'The package MUST match the attached packaging reference photo — exact shape, colour, branding, materials, and proportions. The lid is CLEARLY LIFTED / partially open, tissue paper peeled back, and a CORNER OR TOP of the actual product (the reference product) is PARTIALLY VISIBLE emerging from inside. Two hands (forearms visible, no face) hold the lid mid-lift. Top-down or slight-angle overhead framing.'
      : 'The package MUST be a plausible branded cardboard shipping/retail box appropriate to the product category — minimalist clean cardboard or branded matte cardboard with the PRODUCT/BRAND NAME printed on the side in clear typography. Professional, NOT generic Amazon-style shipping. The lid is CLEARLY LIFTED / partially open, tissue paper peeled back, and a CORNER OR TOP of the actual product is PARTIALLY VISIBLE emerging from inside. Two hands (forearms visible, no face) hold the lid mid-lift. Top-down or slight-angle overhead framing.'
    return {
      framing: `Hands-only ASMR unbox at the MOMENT OF REVEAL. MANDATORY: a branded PACKAGE / BOX with lid PARTIALLY LIFTED, tissue peeled back, and the product PARTIALLY VISIBLE inside (not fully out, not fully hidden — mid-reveal). ${packagingLine}`,
      scene: 'Clean neutral surface — light wood, marble, or matte paper — with the package centred. Optional minimal props (a pair of scissors, a card).',
      lighting: 'Soft overhead daylight, even and shadow-free. Gentle sheen on the tissue paper and box edge.',
      extra: 'CRITICAL: the lid is LIFTED and the product is PARTIALLY VISIBLE inside — this is the mid-reveal beat, NOT a sealed closed box. A corner, top, cap, or edge of the actual product must be clearly showing. Hands look real, natural skin tone, clean nails, no jewelry conflict. Face is NEVER in frame.',
    }
  }
  if (formatKey === 'mystery-box') {
    const packagingLine = opts.hasPackagingRef
      ? 'The mystery package MUST match the attached packaging reference photo — exact shape, colour, branding, materials, and proportions. It is SEALED / CLOSED — lid firmly on, tape or ribbon intact, wrapping smooth.'
      : 'The mystery package is a beautiful matte-black or deep-charcoal branded cardboard box, tied with a single dark ribbon or sealed with a wax stamp / minimalist branded label. Premium editorial packaging — think luxury tech drop, art gallery mailer, black-tie invitation. Never generic Amazon shipping. Small subtle brand mark only.'
    return {
      framing: `Sealed mystery package as the SOLE subject, dead-centre or in a strong hero composition. The product inside is COMPLETELY HIDDEN — nothing peeks out, no reveal, no hint. Editorial hero-shot photography, cinematic and premium. ${packagingLine}`,
      scene: 'Dark, moody, tactile surface — black slate, dark walnut, deep-charcoal linen, or matte black paper. Curls of atmospheric fog or faint dust particles catching light are optional. No clutter, no props. The whole frame breathes suspense.',
      lighting: 'Low-key chiaroscuro — a single hard rim/edge light rakes across the package from one side, carving out the silhouette against deep shadow. A faint glow escapes from the seam between lid and base (as if something inside is emitting soft light) — just a whisper, never a full reveal. Deep blacks, high contrast, cinematic grade.',
      extra: 'MANDATORY: the box is COMPLETELY CLOSED. Do NOT lift the lid, do NOT show the product, do NOT let anything peek out. The whole point is suspense — the viewer must be curious. The only tease allowed is a faint light glow escaping the lid seam. No hands, no character, no text overlays.',
    }
  }
  switch (formatKey) {
    case 'aesthetic-broll':
      return {
        framing: 'Beauty-shot product photography. Product is the hero — dominant in frame at a slight 3/4 angle, centred with room for text overlay above or below. Mid-distance framing.',
        scene: 'Environmental context appropriate to the product (marble vanity for skincare, wood counter for kitchen, linen surface for apparel, minimalist desk for tech). Complementary props only — never competing.',
        lighting: 'Cinematic soft directional lighting. Single key source (window or overhead softbox), gentle fill, real shadow beneath the product. Rich colour, shallow depth-of-field on the background.',
        extra: 'No hands, no character. Composition leaves clear negative space for future text overlay.',
      }
    case 'unboxing-asmr':
      return {
        framing: 'Hands-only ASMR unbox. Product is STILL IN its sealed package (box, mailer, wrapping) resting on a clean surface. Two hands (forearms visible, no face, no shoulders) are entering frame from the bottom or side, fingers about to grasp or start opening. Top-down or slight-angle overhead framing.',
        scene: 'Clean neutral surface — light wood, marble, or matte paper — with the sealed package centred. Optional minimal props (a pair of scissors, a card).',
        lighting: 'Soft overhead daylight, even and shadow-free. Slight sheen on tape/plastic to show it is unopened.',
        extra: 'CRITICAL: the package is closed. The product inside is NOT yet visible. Hands look real, natural skin tone, clean nails, no jewelry conflict. Face is NEVER in frame.',
      }
    case 'mystery-box':
      return {
        framing: 'Closed wrapped mystery package as the sole subject. Product is NOT yet revealed — only the packaging/box/wrap is visible. Dramatic hero-shot composition, product-hero centred.',
        scene: 'Dark moody surface (black slate, dark wood, deep-toned linen). Suspenseful minimalism — no clutter, no props, just the mysterious package.',
        lighting: 'Low-key dramatic lighting — single hard rim light or spotlight from above/side, deep shadows, high contrast. Chiaroscuro mood.',
        extra: 'The box/wrap should look intriguing and untouched. Do not reveal the product inside. No hands, no character.',
      }
    case 'crush-test':
      return {
        framing: 'Product sitting on a hard industrial surface, framed slightly wide to leave room above for a descending heavy object (hydraulic press plate, steel block, boot heel implied above frame). Product is centred and about to be interacted with.',
        scene: 'Hard flat surface — concrete slab, steel plate, wood block. Industrial context. Nothing else on the surface competing.',
        lighting: 'Bright, even, high-contrast studio lighting — no romantic softness. Emphasises the impending impact. Slight tension in the shadows.',
        extra: 'Product is intact and upright. Heavy object (if visible) is at the top of the frame, still descending. No hands, no character.',
      }
    case 'product-showcase':
      return {
        framing: 'Studio-clean product showcase. Product centred on a subtle rotating-platform-style surface (matte turntable, seamless white pedestal, or reflective black disc). Front 3/4 angle, mid-distance, full product visible with slight room above and below.',
        scene: 'Seamless infinity backdrop (white, cream, or brand-neutral). Zero clutter. Reflective floor optional.',
        lighting: 'Balanced studio lighting — soft key + fill + subtle rim to define edges. Even, catalog-grade, no harsh shadows.',
        extra: 'No hands, no character. Product is pristine, label facing camera. Composition should read as premium e-commerce hero.',
      }
    case 'hyper-motion':
      return {
        framing: 'High-energy product-in-motion composition. Product mid-air, mid-splash, mid-drop, or mid-spin — captured at the peak of the action. Dynamic diagonal framing, motion-implied even in the still.',
        scene: 'Bold coloured seamless backdrop (electric blue, red, black) or a splash/liquid/powder cloud around the product. Zero incidental clutter.',
        lighting: 'Punchy high-contrast lighting, edge highlights, saturated colour. Slight motion-blur trails on the periphery to hint at velocity.',
        extra: 'Product is unmistakable and pixel-faithful even mid-motion. No hands, no character. Composition should feel like the moment before a hero drop lands.',
      }
    default:
      return {
        framing: 'Product hero shot at a slight 3/4 angle, centred, mid-distance.',
        scene: 'Clean neutral surface, minimal props.',
        lighting: 'Soft directional lighting with real shadow.',
      }
  }
}

// Build the Nano Banana Pro image prompt for a motion-broll first frame.
// The product reference image is passed separately as a reference; the
// prompt just describes framing + scene + lighting.
// Exported so routes can inject the format's shot direction as a hard
// imperative override at the tail of the Nano Banana prompt (bypasses any
// dilution that may occur through upstream rewrites).
export function motionBrollShotDirectionFor(
  formatKey: string,
  opts: { hasPackagingRef?: boolean } = {},
): string {
  const s = motionBrollFrameSpec(formatKey, opts)
  return [
    `FRAMING: ${s.framing}`,
    `SCENE: ${s.scene}`,
    `LIGHTING: ${s.lighting}`,
    s.extra ? `ADDITIONAL: ${s.extra}` : '',
  ].filter(Boolean).join('\n')
}

export function buildMotionBrollFramePrompt(input: {
  formatKey: string
  productName: string
  productDescription?: string
  videoDirection?: string
  aspectRatio: '9:16' | '16:9' | '1:1' | '3:4'
  hasProductRef: boolean
  hasPackagingRef?: boolean
}): string {
  const spec = motionBrollFrameSpec(input.formatKey, { hasPackagingRef: input.hasPackagingRef })
  const productLine = input.hasProductRef
    ? `Using the attached reference image as the EXACT product — preserve packaging, label text, every logo/font/colour, shape and proportions PIXEL-FAITHFULLY. Do NOT redesign, restyle, or substitute a generic product.`
    : `Render the product described below as a hero object.`

  const directionBlock = input.videoDirection?.trim()
    ? `\n\nDIRECTOR NOTE (apply where it doesn't conflict with the framing above):\n${input.videoDirection.trim().slice(0, 500)}`
    : ''

  return `${productLine}

Generate a hyper-realistic product-first first-frame still for a motion-broll video. This frame will be animated forward — compose it as the START of a shot, not the middle.

PRODUCT: ${input.productName}${input.productDescription ? ` — ${input.productDescription.slice(0, 300)}` : ''}

FRAMING: ${spec.framing}

SCENE: ${spec.scene}

LIGHTING: ${spec.lighting}
${spec.extra ? `\nADDITIONAL: ${spec.extra}` : ''}

REALISM ANCHORS:
- Product label + all text must be readable and unstyled — no invented text
- Subtle surface texture where relevant (grain, weave, marble veins)
- Real, physically-plausible shadow anchoring the product to the surface
- No motion blur on the product itself (it is at rest in the first frame unless the format explicitly calls for mid-motion)
- No AI-gloss, no over-sharpening, no commercial-render polish

Render in ${input.aspectRatio} aspect ratio.${directionBlock}`
}

// Crush-Test multi-shot method pool. Used when total duration >8s to
// split the crush-test video into N distinct crushing-method shots that
// are then stitched into one final video. Each entry describes:
//   frame:  the first-frame image prompt (fed to Nano Banana Pro)
//   motion: the Seedance camera + motion prompt for the shot
//   audio:  native-audio direction appended to the motion prompt
export const CRUSH_METHODS: Array<{ key: string; frame: string; motion: string; audio: string }> = [
  { key: 'hydraulic-press',   frame: 'Product sits centered on a heavy steel plate. Above it, a chrome hydraulic-press ram descends from the top of the frame, seconds from contact. Industrial workshop lighting.', motion: 'Hydraulic press ram descends smoothly and crushes the product flat. Slow deliberate mechanical motion.', audio: 'Deep pneumatic hiss, metal-on-metal groan, satisfying crunch on impact.' },
  { key: 'sledgehammer',      frame: 'Product placed on a wooden workbench. Gloved hands grip a large sledgehammer raised overhead, mid-swing about to descend.', motion: 'Sledgehammer swings down in a powerful arc, direct impact on the product, debris flies outward.', audio: 'Whoosh of the swing, sharp cracking impact, pieces scattering.' },
  { key: 'tire-roll',         frame: 'Product lies on asphalt. A large truck tire looms above it, about to roll forward.', motion: 'Heavy truck tire rolls forward over the product, flattening it under its weight, tire tread visible.', audio: 'Deep tire rumble, low crunch, rubber squelch.' },
  { key: 'boulder-drop',      frame: 'Product sits on the ground. A large rough boulder hangs suspended above, ready to drop.', motion: 'Boulder drops straight down, decisive impact, dust plume rising around the product.', audio: 'Whoosh, heavy thud, gritty crush, dust dispersal.' },
  { key: 'car-crusher',       frame: 'Product placed in an industrial car-crusher chamber. Two massive metal walls flank it, poised to close.', motion: 'Steel walls squeeze inward compressing the product between them, hydraulics working. Slow menacing pressure.', audio: 'Steel groaning, hydraulic whine, crunching compression.' },
  { key: 'anvil-drop',        frame: 'Product on a concrete floor. A cast-iron anvil hangs by a chain overhead, about to be released.', motion: 'Anvil plunges down, cartoon-style vertical drop, direct crushing impact.', audio: 'Chain clank release, whistling drop, massive metal-on-concrete clang.' },
  { key: 'vice-grip',         frame: 'Product clamped in a large industrial bench vice, handle just starting to turn.', motion: 'Vice jaws slowly tighten, compressing and warping the product between them.', audio: 'Metal screech of the vice turning, plastic/metal groan, sharp snap.' },
  { key: 'boot-stomp',        frame: 'Product on rough gravel. A heavy work boot poised directly above, sole visible.', motion: 'Heavy boot stomps down decisively onto the product, ground vibrating.', audio: 'Boot slam, gravel scatter, crunching debris.' },
]

export type CrushMethod = typeof CRUSH_METHODS[number]

// Pick n distinct crush methods at random (Fisher-Yates → take first n).
export function pickCrushMethods(n: number): CrushMethod[] {
  const pool = [...CRUSH_METHODS]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, Math.max(1, Math.min(n, pool.length)))
}

// Per-format Seedance motion prompt for the animate step. NO character
// direction, NO dialogue — just camera + product motion + optional
// native-audio cue.
export function buildMotionBrollSeedancePrompt(input: {
  formatKey: string
  productName: string
  durationSeconds: number
  videoDirection?: string
}): string {
  const dur = Math.max(3, Math.min(60, Math.round(input.durationSeconds)))
  const base = `Motion-broll video, ${dur} seconds, no dialogue, no on-screen text, no watermark. Product stays pixel-faithful to the first frame throughout — same packaging, same label, same colours. `

  const perFormat = (() => {
    switch (input.formatKey) {
      case 'aesthetic-broll':
        return `Cinematic slow push-in on the product, or gentle parallax drift. Camera moves smoothly and confidently, product remains the visual anchor. Subtle light shift over the duration adds life. Ambient music-friendly — no spoken audio, no ASMR sound cues, keep native audio minimal.`
      case 'unboxing-asmr':
        return `Overhead / slight-angle. Hands (already visible in the first frame) slowly and satisfyingly open the sealed package — peeling tape, lifting a flap, unwrapping paper, revealing the product inside at the mid-to-late beat. Fingers move naturally, real skin. Native audio ON: crisp ASMR — paper crinkle, tape peel, cardboard flex, gentle handling. No music, no voice.`
      case 'mystery-box':
        return `Slow suspenseful orbit around the sealed package. The box stays CLOSED for almost the entire clip — the whole video is a tease, not a reveal. The glow at the lid seam pulses/breathes gently. In the FINAL beat (last ~0.5-1s), the lid ONLY BEGINS to lift — a sliver of light escapes, a hint of colour, but the product itself never fully appears. Cut to black or hold on the crack of light. This is a cliffhanger. Native audio: low ambient hum, subtle atmospheric drone, a soft creak at the very end when the lid starts to lift. No voice, no music.`
      case 'crush-test':
        return `A heavy object (hydraulic press plate, steel weight) descends slowly from above onto the product. Impact lands mid-clip with satisfying compression and deformation — packaging crumples, contents may burst or crack. Camera holds steady on the product. Native audio ON: mechanical whir of the press, deep crunch and compression at impact. No voice, no music.`
      case 'product-showcase':
        return `Smooth continuous 360° orbit (or 180° arc if duration is short) around the product on the pedestal. Constant angular velocity, seamless motion, product perfectly centred throughout, label passes cleanly through the frame. Ambient/musical audio-friendly — native audio minimal, no voice.`
      case 'hyper-motion':
        return `Fast dynamic camera work matching the product's motion — spins, splashes, drops, powder bursts. Multiple micro-beats of energy across the ${dur} seconds. Motion-blur trails, punchy cuts of movement. Product remains readable at every peak. Native audio ON: whooshes, impact sounds, dynamic sound design. No voice.`
      default:
        return `Smooth cinematic camera motion on the product. Product remains hero throughout.`
    }
  })()

  const direction = input.videoDirection?.trim()
    ? `\n\nDIRECTOR NOTE (fold in where it doesn't conflict): ${input.videoDirection.trim().slice(0, 400)}`
    : ''

  return `${base}${perFormat}${direction}`
}
