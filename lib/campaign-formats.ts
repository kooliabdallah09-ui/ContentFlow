// Campaign Format Registry — the source of truth for the Campaign Planner.
//
// Distinct from lib/formats.ts (which drives the standalone Reel/Format
// pages with overlay timelines + script scaffolds). This registry is
// lightweight — Sonnet references it when planning a campaign so every
// row in the shot table maps 1:1 to a real pipeline we can render.
//
// Adding a format = add an entry here + wire its pipeline in
// /api/campaigns/[id]/generate/route.ts if it's a new pipeline.

export type CampaignPipeline =
  | 'ugc-video'         // single-actor UGC → /api/ugc/hero-frames + /api/ugc/animate
  | 'ugc-interview'     // two-person interview → same pipeline, forced multi-actor
  | 'ugc-couple'        // two-actor lifestyle → same pipeline
  | 'product-photo'     // isolated product render → /api/products-studio/generate
  | 'lifestyle-photo'   // product in-scene photo → /api/generate/image
  | 'hero-editorial'    // magazine hero → /api/generate/image
  | 'motion-broll'      // motion-only, no dialogue → /api/ugc/animate from hero frame

export type CampaignAspect = '9:16' | '4:5' | '1:1' | '16:9'

export interface CampaignFormat {
  key: string
  label: string
  tagline: string
  category: 'solo' | 'two-person' | 'motion' | 'transformation' | 'photo' | 'other'
  pipeline: CampaignPipeline
  defaultAspect: CampaignAspect
  defaultDuration: number   // seconds; 0 = photo
  requiresActor: boolean
  requiresScene: boolean
  requiresProduct: boolean
  creditHint: number        // rough estimate, drives the running total
  // Prompt hint Sonnet uses when writing hook/setting/caption for this format.
  sonnetSpec: string
  // Visual-only formats — no spoken dialogue. Skips the script review step.
  noScript?: boolean
}

export const CAMPAIGN_FORMATS: CampaignFormat[] = [
  // ── Solo talking-head ────────────────────────────────────────────────
  {
    key: 'direct-to-camera',
    label: 'Direct to Camera',
    tagline: 'Creator speaks straight to camera, no gimmick.',
    category: 'solo', pipeline: 'ugc-video',
    defaultAspect: '9:16', defaultDuration: 15,
    requiresActor: true, requiresScene: false, requiresProduct: true, creditHint: 260,
    sonnetSpec: 'A confident 1-shot testimonial. Hook = one sharp claim about the product benefit. Body = one specific proof point. CTA optional.',
  },
  {
    key: 'selfie-testimonial',
    label: 'Selfie Testimonial',
    tagline: 'Arm\'s-length, "I\'ve been using this for a week" energy.',
    category: 'solo', pipeline: 'ugc-video',
    defaultAspect: '9:16', defaultDuration: 12,
    requiresActor: true, requiresScene: false, requiresProduct: true, creditHint: 240,
    sonnetSpec: 'Casual selfie framing. Personal story hook. Feels unscripted.',
  },
  {
    key: 'hot-take',
    label: 'Hot Take',
    tagline: '"Nobody\'s talking about this…" controversial hook.',
    category: 'solo', pipeline: 'ugc-video',
    defaultAspect: '9:16', defaultDuration: 12,
    requiresActor: true, requiresScene: false, requiresProduct: false, creditHint: 240,
    sonnetSpec: 'Bold contrarian statement, slightly annoyed tone. Product cameo late, not lead.',
  },
  {
    key: 'secret-hack-reveal',
    label: 'Secret Hack Reveal',
    tagline: 'Reveal one clever way to use the product.',
    category: 'solo', pipeline: 'ugc-video',
    defaultAspect: '9:16', defaultDuration: 15,
    requiresActor: true, requiresScene: false, requiresProduct: true, creditHint: 260,
    sonnetSpec: 'Hook = "You\'ve been using {product} wrong." Body demonstrates the hack. Reveal-driven pacing.',
  },
  {
    key: 'things-i-wish-i-knew',
    label: 'Things I Wish I Knew',
    tagline: 'Listicle with text overlays, 3 tight points.',
    category: 'solo', pipeline: 'ugc-video',
    defaultAspect: '9:16', defaultDuration: 15,
    requiresActor: true, requiresScene: false, requiresProduct: true, creditHint: 260,
    sonnetSpec: 'Three-point listicle. Each point gets one line. Product ties to point 3.',
  },
  {
    key: 'addiction',
    label: 'Addiction / Obsession',
    tagline: '"I literally cannot stop using this."',
    category: 'solo', pipeline: 'ugc-video',
    defaultAspect: '9:16', defaultDuration: 10,
    requiresActor: true, requiresScene: false, requiresProduct: true, creditHint: 220,
    sonnetSpec: 'Fast obsessive tone. Repetition. Product held prominently.',
  },
  {
    key: 'gadget-saved-me',
    label: 'Gadget Saved Me',
    tagline: 'Story: "This product fixed [problem] in my life."',
    category: 'solo', pipeline: 'ugc-video',
    defaultAspect: '9:16', defaultDuration: 15,
    requiresActor: true, requiresScene: false, requiresProduct: true, creditHint: 260,
    sonnetSpec: 'Problem-first hook. Turn into solution mid-way. Warm tone.',
  },
  {
    key: 'product-review',
    label: 'Product Review',
    tagline: 'Structured pros/cons, honest tone.',
    category: 'solo', pipeline: 'ugc-video',
    defaultAspect: '9:16', defaultDuration: 20,
    requiresActor: true, requiresScene: false, requiresProduct: true, creditHint: 320,
    sonnetSpec: 'Balanced 3-pros + 1-honest-con format. Ends with recommendation verdict.',
  },
  {
    key: 'tv-spot',
    label: 'TV Spot',
    tagline: 'Amplified authentic story, ad-polish energy.',
    category: 'solo', pipeline: 'ugc-video',
    defaultAspect: '16:9', defaultDuration: 15,
    requiresActor: true, requiresScene: true, requiresProduct: true, creditHint: 320,
    sonnetSpec: 'Cinematic 1-shot. Confident voiceover-like delivery. Setting matters.',
  },

  // ── Two-person / social ─────────────────────────────────────────────
  {
    key: 'interview-man-on-street',
    label: 'Man-on-Street Interview',
    tagline: '"Rate this out of 10" / jingle / guess the price.',
    category: 'two-person', pipeline: 'ugc-interview',
    defaultAspect: '9:16', defaultDuration: 15,
    requiresActor: true, requiresScene: true, requiresProduct: true, creditHint: 320,
    sonnetSpec: 'Interviewer holds product, stops a stranger on the street. Stranger reacts. Punchy edit.',
  },
  {
    key: 'couple-sharing',
    label: 'Couple Sharing',
    tagline: 'Two people at home, natural product use.',
    category: 'two-person', pipeline: 'ugc-couple',
    defaultAspect: '9:16', defaultDuration: 12,
    requiresActor: true, requiresScene: true, requiresProduct: true, creditHint: 300,
    sonnetSpec: 'Living-room / kitchen scene. One offers product to the other. Cozy tone.',
  },
  {
    key: 'interview-pov',
    label: 'Street Interview (POV)',
    tagline: 'POV interviewer holds mic, only the stranger is on camera.',
    category: 'solo', pipeline: 'ugc-video',
    defaultAspect: '9:16', defaultDuration: 15,
    requiresActor: true, requiresScene: true, requiresProduct: true, creditHint: 300,
    sonnetSpec: `POV: interviewer's outstretched arm holding a mic (and/or product) into frame from bottom edge. Camera on the stranger's face — real, spontaneous reaction. Stranger delivers the line; interviewer voice implied off-camera in brackets.`,
  },
  {
    key: 'roommate-rec',
    label: 'Roommate Rec',
    tagline: 'Friend banter, spontaneous recommendation.',
    category: 'two-person', pipeline: 'ugc-couple',
    defaultAspect: '9:16', defaultDuration: 10,
    requiresActor: true, requiresScene: true, requiresProduct: true, creditHint: 280,
    sonnetSpec: 'Two friends, one recommends product mid-conversation. Casual banter.',
  },

  // ── POV / camera-driven ─────────────────────────────────────────────
  {
    key: 'camera-pov',
    label: 'Camera POV',
    tagline: 'First-person, product enters frame.',
    category: 'solo', pipeline: 'ugc-video',
    defaultAspect: '9:16', defaultDuration: 8,
    requiresActor: false, requiresScene: true, requiresProduct: true, creditHint: 200,
    sonnetSpec: 'Hands-only POV. Setting drives the scene. No talking-head.',
  },
  {
    key: 'pov-vlog',
    label: 'POV Vlog',
    tagline: '"POV: you just found the drink of the summer."',
    category: 'solo', pipeline: 'ugc-video',
    defaultAspect: '9:16', defaultDuration: 8,
    requiresActor: true, requiresScene: true, requiresProduct: true, creditHint: 220,
    sonnetSpec: 'POV caption is the hook. Actor casually engages with product.',
  },
  {
    key: 'get-ready-with-me',
    label: 'Get Ready With Me',
    tagline: 'Routine, product enters mid-way.',
    category: 'solo', pipeline: 'ugc-video',
    defaultAspect: '9:16', defaultDuration: 20,
    requiresActor: true, requiresScene: true, requiresProduct: true, creditHint: 320,
    sonnetSpec: 'Morning / getting-ready routine. Product placed naturally in the sequence.',
  },

  // ── Product-first (no dialogue) ─────────────────────────────────────
  {
    key: 'aesthetic-broll',
    label: 'Aesthetic B-roll',
    tagline: 'Beauty shots + captions, ASMR pour.',
    category: 'motion', pipeline: 'motion-broll',
    defaultAspect: '9:16', defaultDuration: 10,
    requiresActor: false, requiresScene: true, requiresProduct: true, creditHint: 180,
    sonnetSpec: 'No dialogue. Product-first cinematography. Text overlay carries the message.',
  },
  {
    key: 'unboxing-asmr',
    label: 'Unboxing ASMR',
    tagline: 'Hands-only, satisfying sound.',
    category: 'motion', pipeline: 'motion-broll',
    defaultAspect: '9:16', defaultDuration: 12,
    requiresActor: false, requiresScene: false, requiresProduct: true, creditHint: 200,
    sonnetSpec: 'Hands only. Package → unwrap → reveal. Sound-driven, no VO.',
  },
  {
    key: 'unboxing',
    label: 'Unboxing',
    tagline: 'Standard package → open → first-use.',
    category: 'solo', pipeline: 'ugc-video',
    defaultAspect: '9:16', defaultDuration: 15,
    requiresActor: true, requiresScene: false, requiresProduct: true, creditHint: 260,
    sonnetSpec: 'Actor unboxes on camera. Enthusiastic reaction. First-use reveal.',
  },
  {
    key: 'mystery-box',
    label: 'Mystery Box',
    tagline: 'Suspenseful reveal, "what\'s inside?"',
    category: 'motion', pipeline: 'motion-broll',
    defaultAspect: '9:16', defaultDuration: 12,
    requiresActor: false, requiresScene: false, requiresProduct: true, creditHint: 200,
    sonnetSpec: 'Suspense build. Slow reveal. Product is the payoff.',
  },
  {
    key: 'crush-test',
    label: 'Crush Test',
    tagline: 'Satisfying durability test.',
    category: 'motion', pipeline: 'motion-broll',
    defaultAspect: '9:16', defaultDuration: 8,
    requiresActor: false, requiresScene: false, requiresProduct: true, creditHint: 180,
    sonnetSpec: 'Product survives (or breaks in) a durability test. Satisfying resolution.',
  },
  {
    key: 'product-showcase',
    label: 'Product Showcase',
    tagline: '360° / motion-around highlight.',
    category: 'motion', pipeline: 'motion-broll',
    defaultAspect: '1:1', defaultDuration: 8,
    requiresActor: false, requiresScene: false, requiresProduct: true, creditHint: 180,
    sonnetSpec: 'Slow camera orbit around product. Studio-clean.',
  },
  {
    key: 'hyper-motion',
    label: 'Hyper Motion',
    tagline: 'High-energy bursts, drops + spins.',
    category: 'motion', pipeline: 'motion-broll',
    defaultAspect: '9:16', defaultDuration: 6,
    requiresActor: false, requiresScene: false, requiresProduct: true, creditHint: 160,
    sonnetSpec: 'Fast cuts. Product drops, splashes, spins. Energy-first.',
  },

  // ── Transformation ──────────────────────────────────────────────────
  {
    key: 'before-after',
    label: 'Before & After',
    tagline: '"Wait for it" cut reveal.',
    category: 'transformation', pipeline: 'ugc-video',
    defaultAspect: '9:16', defaultDuration: 8,
    requiresActor: true, requiresScene: false, requiresProduct: true, creditHint: 200,
    sonnetSpec: 'Before shot → beat → after shot. Product is the cause.',
    noScript: true,
  },
  {
    key: 'mess-to-fresh',
    label: 'Mess to Fresh',
    tagline: 'Dirty sneaker → hands clean it → fresh result. Cleaning products only.',
    category: 'transformation', pipeline: 'motion-broll',
    defaultAspect: '9:16', defaultDuration: 10,
    requiresActor: false, requiresScene: false, requiresProduct: true, creditHint: 220,
    sonnetSpec: 'Hands-only close-up. Dirty sneaker/shoe on a flat surface, cleaning product beside it. Hands scrub with product → shoe becomes clean. Satisfying progressive reveal.',
    noScript: true,
  },
  {
    key: 'tutorial',
    label: 'Tutorial',
    tagline: 'Numbered steps, how-to.',
    category: 'solo', pipeline: 'ugc-video',
    defaultAspect: '9:16', defaultDuration: 20,
    requiresActor: true, requiresScene: false, requiresProduct: true, creditHint: 320,
    sonnetSpec: 'Numbered 3-step tutorial. Text overlay per step. Ends with result.',
  },

  // ── Photo ───────────────────────────────────────────────────────────
  {
    key: 'hero-editorial',
    label: 'Hero Editorial',
    tagline: 'Magazine-style product still.',
    category: 'photo', pipeline: 'hero-editorial',
    defaultAspect: '1:1', defaultDuration: 0,
    requiresActor: false, requiresScene: false, requiresProduct: true, creditHint: 40,
    sonnetSpec: 'Magazine cover polish. Dramatic lighting. Product is the hero.',
  },
  {
    key: 'lifestyle-in-scene',
    label: 'Lifestyle In-Scene',
    tagline: 'Product in a real environment.',
    category: 'photo', pipeline: 'lifestyle-photo',
    defaultAspect: '4:5', defaultDuration: 0,
    requiresActor: false, requiresScene: true, requiresProduct: true, creditHint: 40,
    sonnetSpec: 'Product naturally placed in a specific everyday scene.',
  },
  {
    key: 'studio-still',
    label: 'Studio Still',
    tagline: 'Clean-plate marketing hero.',
    category: 'photo', pipeline: 'product-photo',
    defaultAspect: '1:1', defaultDuration: 0,
    requiresActor: false, requiresScene: false, requiresProduct: true, creditHint: 40,
    sonnetSpec: 'Clean white or brand-color background. Product-only. Marketing-site hero quality.',
  },
]

export function getCampaignFormat(key: string): CampaignFormat | undefined {
  return CAMPAIGN_FORMATS.find(f => f.key === key)
}

export const CAMPAIGN_FORMAT_KEYS = CAMPAIGN_FORMATS.map(f => f.key)
