// Multi-shot UGC planner.
//
// The UGC pipeline can render one anchor talking-head clip (Kling v3 omni
// with native voice) and cut to N short silent b-roll cutaways (Seedance
// 2.0 image-to-video, 720p, ~2s each) on top of a continuous audio track.
// This module owns the "how many cuts and where" logic, plus the per-slot
// Nano Banana + Seedance prompts.
//
// Cadence chosen for real UGC feel:
//   <10s anchor  → 0 cutaways (too short for a cut to feel intentional)
//   10-14s       → 2 cutaways
//   15-24s       → 3 cutaways
//   25s+         → 4 cutaways
// Each cutaway is 2 seconds and is centred in an evenly-spaced slot within
// the anchor's middle (leaves 1s intro + 1s outro of the anchor visible).

export type CutawaySlot = 'apply' | 'hero' | 'reaction' | 'usage'

export interface CutawayPlan {
  count: number
  cutawayDuration: number      // seconds
  positions: number[]          // start offset within the anchor (seconds)
  slots: CutawaySlot[]
}

const CUTAWAY_DURATION = 2

export function planCutaways(anchorDurationSeconds: number): CutawayPlan {
  let count = 0
  if (anchorDurationSeconds >= 25) count = 4
  else if (anchorDurationSeconds >= 15) count = 3
  else if (anchorDurationSeconds >= 10) count = 2

  if (count === 0) {
    return { count: 0, cutawayDuration: CUTAWAY_DURATION, positions: [], slots: [] }
  }

  // Progression tells a mini-story: they show the product, apply it,
  // react to the result, then a wider usage beat.
  const order: CutawaySlot[] = ['hero', 'apply', 'reaction', 'usage']
  const slots = order.slice(0, count)

  // Evenly space cutaways in the middle (anchor visible 1s at start + 1s at
  // end, plus the gaps between cutaways).
  const usable = Math.max(CUTAWAY_DURATION * count, anchorDurationSeconds - 2)
  const spacing = usable / count
  const positions: number[] = []
  for (let i = 0; i < count; i++) {
    const centre = 1 + spacing * (i + 0.5)
    positions.push(Math.max(1, Math.min(anchorDurationSeconds - CUTAWAY_DURATION - 1, centre - CUTAWAY_DURATION / 2)))
  }
  return { count, cutawayDuration: CUTAWAY_DURATION, positions, slots }
}

// Nano Banana hero-frame prompt for each cutaway slot. Fed the refined
// hero frame (character + product) as the identity anchor so the cutaways
// stay visually consistent with the anchor clip.
export function cutawayFramePrompt(slot: CutawaySlot, productName: string, scene: string): string {
  const base = `Two reference images are attached. Image 1 is the character + product anchor — preserve the person's face, skin tone, hair, wardrobe, and the product's exact packaging/label. Image 2 is a clean product shot for label fidelity. Render a hyper-realistic phone-camera photograph.`
  const shared = `\n\nUse ${scene} as the environment (soft natural light, real skin texture, no beauty filter, no captions, no watermark).`
  switch (slot) {
    case 'hero':
      return `${base}\n\nSHOT: extreme close-up product hero. ${productName} placed on a matching surface (bathroom counter / kitchen counter / desk depending on scene), macro lens, shallow depth of field, label sharp and readable, character NOT in frame. Soft key light from the side, subtle reflection on the packaging. Shot to make the product look premium.${shared}`
    case 'apply':
      return `${base}\n\nSHOT: hands-only medium close-up of the character applying / using ${productName}. Show fingertips picking up product, or the product being pressed / poured / dabbed onto skin or hair or the target surface. Focus on the tactile moment. Product label partly visible. Character's face NOT in frame — this is a hand-and-product beat.${shared}`
    case 'reaction':
      return `${base}\n\nSHOT: medium close-up of the character's face reacting positively (subtle smile, small nod, slightly widened eyes, natural not exaggerated). ${productName} may be held near the face but out of the way — the reaction is the subject. Same wardrobe, same lighting as the anchor image.${shared}`
    case 'usage':
      return `${base}\n\nSHOT: medium shot of the character using ${productName} in-context — wearing it, holding it up, mid-application, or showing the result. Waist-up framing. Handheld camera feel. Product clearly visible in the character's hand or on their skin.${shared}`
  }
}

// Seedance 2.0 motion prompt per slot. Silent, 2 seconds.
export function cutawayMotionPrompt(slot: CutawaySlot, productName: string): string {
  switch (slot) {
    case 'hero':
      return `Macro-lens push-in on ${productName} sitting on the surface. Product rotates ~15° so the label catches the light. Subtle rack focus from foreground to product label. Two-second cinematic product beat. No people, no captions.`
    case 'apply':
      return `Hands-only medium close-up. The character's fingers pick up / dispense / apply ${productName}. Subtle shake as skin contacts product. Handheld phone-camera feel. Two seconds. No captions.`
    case 'reaction':
      return `Character's face — small breath in, subtle satisfied smile forms, eyes soften. Slight head tilt. Handheld phone-camera framing. Two seconds. No speech, no captions.`
    case 'usage':
      return `Medium shot of the character using ${productName}. Small camera push-in over two seconds, character continues the action naturally. Handheld phone-camera feel. No speech, no captions.`
  }
}
