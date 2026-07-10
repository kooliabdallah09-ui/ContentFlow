// ContentFlow Format Templates
//
// A curated library of short-video formats. Each template configures:
//   1. Which underlying generator to use (UGC talking-head, POV, editor-only).
//   2. Whether the user must supply a product photo or UI screenshot.
//   3. A script scaffold Claude fills in from the user's inputs.
//   4. A timeline of text + image overlays the editor auto-places once the
//      base clip is rendered.
//
// The goal: reduce a first-time user's decision fatigue. Instead of a blank
// UGC form, they pick "Hot Take" → we know the script structure, the pacing,
// the caption style, and where the product image should pop in.
//
// Access is admin-gated (see lib/pov-access.ts → canAccessReelAnalyzer for the
// same allowlist) until the pipeline settles.

export type FormatCategory =
  | 'talking-head'
  | 'pov'
  | 'product'
  | 'narrative'
  | 'trending'
  | 'educational'

// Which underlying pipeline renders the base clip. The editor pass is always
// available on top and handles overlays.
export type FormatPipeline =
  | 'ugc'             // Kling v3 omni talking-head from a hero frame
  | 'pov'             // Vista faceless POV
  | 'editor-only'     // No AI video — user supplies footage, we compose overlays
  | 'ugc+editor'      // UGC clip + heavy overlay work in the editor

// Timing supports absolute seconds or percentage of the clip so a template
// scales across 5s / 10s / 15s / 20s / 30s durations without rewriting.
export type FormatTiming = {
  start: number | { pct: number } | { fromEnd: number }
  duration: number | { pct: number }
}

export type FormatOverlay =
  | {
      kind: 'text'
      // {product}, {benefit}, {hook}, {cta}, {audience}, {problem}, {solution}
      // are interpolated from the user's inputs at generation time.
      template: string
      position: 'top' | 'center' | 'bottom' | { x: number; y: number }
      style: 'caption' | 'bold-white' | 'tiktok' | 'outline' | 'highlight' | 'bubble' | 'minimal'
      size?: 'sm' | 'md' | 'lg' | 'xl'
      animation?: 'none' | 'fade' | 'slide-up' | 'zoom' | 'typewriter'
      timing: FormatTiming
    }
  | {
      kind: 'image-slot'
      // What kind of image should sit here — the generator can auto-fetch
      // (Nano Banana renders one), or the user can drop their own.
      slot:
        | 'product-photo'
        | 'ui-screenshot'
        | 'comment-screenshot'
        | 'chart-data-viz'
        | 'before'
        | 'after'
        | 'meme'
        | 'user-photo'
      position: 'top' | 'center' | 'bottom' | { x: number; y: number }
      scale?: number   // 0-1, relative to canvas width
      opacity?: number
      timing: FormatTiming
    }

export interface ScriptScaffold {
  hook: string           // 3-second opener template
  body: string           // main content template — longest section
  cta: string            // closing call to action template
  toneHint: string       // e.g. "confident + fast", "warm + calm"
}

export interface FormatTemplate {
  id: string
  name: string
  category: FormatCategory
  tagline: string                  // one-line pitch
  whenToUse: string                // 1-2 sentence use case
  pipeline: FormatPipeline

  // Suggested duration range. First entry is the default.
  durations: Array<5 | 10 | 15 | 20 | 30>

  // What the user must supply.
  needsProduct: boolean            // isolated product photo
  needsUI: boolean                 // app screenshot or website screen
  needsUserFootage: boolean        // for editor-only formats
  needsScript: 'user' | 'ai' | 'either'

  // Audio track.
  audio: 'voiceover' | 'ambient' | 'music-driven' | 'silent'

  // Default caption bar style, applies to auto-transcribed subtitles.
  captionStyle: 'caption' | 'bold-white' | 'tiktok' | 'outline' | 'highlight' | 'bubble' | 'minimal'

  // Vibe tag — helps the user scan formats visually.
  vibe: 'bold' | 'calm' | 'urgent' | 'aesthetic' | 'funny' | 'warm' | 'clinical' | 'raw'

  // Script generation scaffold.
  scriptScaffold: ScriptScaffold

  // Overlay timeline auto-placed in the editor after the base clip renders.
  overlays: FormatOverlay[]

  // Example prompts the format is good for — helps first-time users see the fit.
  examples: string[]
}

// ---------- shorthand helpers to keep the array readable ----------
const pct = (p: number) => ({ pct: p })
const end = (fromEnd: number) => ({ fromEnd })
const t = (start: FormatTiming['start'], duration: FormatTiming['duration']): FormatTiming =>
  ({ start, duration })

// ==========================================================================
// THE 32 TEMPLATES
// ==========================================================================

export const FORMAT_TEMPLATES: FormatTemplate[] = [
  // ------------------------------------------------------------------ 1
  {
    id: 'hot-take',
    name: 'Hot Take',
    category: 'talking-head',
    tagline: 'One bold, contrarian opinion said with conviction.',
    whenToUse: 'When you want to grab attention with a spicy claim about your industry that most people disagree with. Great for founders willing to be polarizing.',
    pipeline: 'ugc+editor',
    durations: [10, 15, 20],
    needsProduct: false,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'ai',
    audio: 'voiceover',
    captionStyle: 'bold-white',
    vibe: 'bold',
    scriptScaffold: {
      hook: 'Everyone is wrong about {topic}. Here\'s what actually works.',
      body: 'Explain your counter-position in 2–3 tight sentences using {product} or your own experience as evidence. Don\'t hedge. Speak like you\'re annoyed nobody\'s said this.',
      cta: '{cta}',
      toneHint: 'confident, slightly annoyed, fast delivery',
    },
    overlays: [
      { kind: 'text', template: 'HOT TAKE', position: 'top', style: 'tiktok', size: 'lg', animation: 'zoom', timing: t(0, 2) },
      { kind: 'text', template: '{hook}', position: 'center', style: 'bold-white', size: 'xl', animation: 'slide-up', timing: t(0.5, 3) },
    ],
    examples: ['SaaS pricing rants', '"Marketing is broken" takes', 'Industry myths'],
  },
  // ------------------------------------------------------------------ 2
  {
    id: 'debunk',
    name: 'Debunk',
    category: 'talking-head',
    tagline: '"You\'ve been lied to about X" — myth vs. reality.',
    whenToUse: 'When there\'s a common misconception in your niche you can correct. Educational + confrontational combo that drives shares.',
    pipeline: 'ugc+editor',
    durations: [15, 20, 30],
    needsProduct: false,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'ai',
    audio: 'voiceover',
    captionStyle: 'outline',
    vibe: 'bold',
    scriptScaffold: {
      hook: 'You\'ve been lied to about {topic}. Here\'s the truth.',
      body: 'State the widely-believed myth in one sentence, then reveal why it\'s wrong and back it up with one specific fact or number. Reference {product} if it\'s the solution.',
      cta: '{cta}',
      toneHint: 'authoritative, slower cadence, punchy',
    },
    overlays: [
      { kind: 'text', template: 'MYTH', position: { x: 0.5, y: 0.35 }, style: 'bubble', size: 'md', animation: 'fade', timing: t(2, 3) },
      { kind: 'text', template: 'TRUTH ↓', position: { x: 0.5, y: 0.35 }, style: 'highlight', size: 'md', animation: 'slide-up', timing: t(pct(0.55), 2) },
    ],
    examples: ['"Cold email is dead"', '"You need followers to sell"', '"AI content flops"'],
  },
  // ------------------------------------------------------------------ 3
  {
    id: 'founder-story',
    name: 'Founder Story',
    category: 'narrative',
    tagline: 'Personal origin narrative in one sustained take.',
    whenToUse: 'When you want to humanize the brand. Works for product launches, milestone posts, About-us content. Emotional, low-fi.',
    pipeline: 'ugc',
    durations: [20, 30],
    needsProduct: false,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'user',
    audio: 'voiceover',
    captionStyle: 'caption',
    vibe: 'warm',
    scriptScaffold: {
      hook: 'A year ago I was {starting_point}. Today {current_state}.',
      body: 'Walk through the turning point in 2–3 short beats. Be specific: numbers, dates, one detail nobody else would know.',
      cta: 'If you\'re where I was, check out {product}.',
      toneHint: 'reflective, warm, unhurried',
    },
    overlays: [],
    examples: ['Product launch backstory', 'Career pivot', 'Bootstrapping win'],
  },
  // ------------------------------------------------------------------ 4
  {
    id: 'answer-the-comment',
    name: 'Answer the Comment',
    category: 'trending',
    tagline: 'Screenshot of a comment → direct response to camera.',
    whenToUse: 'When you have a common objection or FAQ. Feels reactive and human, huge engagement.',
    pipeline: 'ugc+editor',
    durations: [10, 15],
    needsProduct: false,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'ai',
    audio: 'voiceover',
    captionStyle: 'caption',
    vibe: 'funny',
    scriptScaffold: {
      hook: '"{fake_comment}" — okay let me actually answer this.',
      body: 'Address the objection directly in 2–3 sentences. Use {product} as proof if relevant.',
      cta: '{cta}',
      toneHint: 'casual, slightly amused',
    },
    overlays: [
      { kind: 'image-slot', slot: 'comment-screenshot', position: { x: 0.5, y: 0.25 }, scale: 0.72, opacity: 1, timing: t(0, 3) },
    ],
    examples: ['"Isn\'t AI content bad?"', '"How is this different from X?"', '"Does this really work?"'],
  },
  // ------------------------------------------------------------------ 5
  {
    id: 'three-reason-list',
    name: '3-Reason List',
    category: 'talking-head',
    tagline: 'Talking head + big numbers popping in with each reason.',
    whenToUse: 'When you can compress a benefit list into three tight beats. Classic algorithm-friendly format — high completion rate.',
    pipeline: 'ugc+editor',
    durations: [15, 20, 30],
    needsProduct: false,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'ai',
    audio: 'voiceover',
    captionStyle: 'bold-white',
    vibe: 'urgent',
    scriptScaffold: {
      hook: '3 reasons {audience} switched to {product}.',
      body: 'Deliver each reason in one sentence, no filler. Reason 1 is the biggest pain, 2 is the surprising benefit, 3 is the emotional hook.',
      cta: '{cta}',
      toneHint: 'fast, punchy, momentum-building',
    },
    overlays: [
      { kind: 'text', template: '1', position: { x: 0.1, y: 0.1 }, style: 'tiktok', size: 'xl', animation: 'zoom', timing: t(pct(0.15), 3) },
      { kind: 'text', template: '2', position: { x: 0.1, y: 0.1 }, style: 'tiktok', size: 'xl', animation: 'zoom', timing: t(pct(0.4), 3) },
      { kind: 'text', template: '3', position: { x: 0.1, y: 0.1 }, style: 'tiktok', size: 'xl', animation: 'zoom', timing: t(pct(0.65), 3) },
    ],
    examples: ['3 reasons this saves time', '3 reasons agencies switched', '3 reasons SaaS founders love X'],
  },
  // ------------------------------------------------------------------ 6
  {
    id: 'whisper-confession',
    name: 'Whisper Confession',
    category: 'talking-head',
    tagline: 'Quiet close-up, secret-sharing tone, big reveal at the end.',
    whenToUse: 'When the message is intimate or slightly transgressive. Contrast to the loud TikTok norm — cuts through by being quiet.',
    pipeline: 'ugc+editor',
    durations: [10, 15, 20],
    needsProduct: false,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'ai',
    audio: 'voiceover',
    captionStyle: 'minimal',
    vibe: 'calm',
    scriptScaffold: {
      hook: 'Nobody talks about this but…',
      body: 'Share the "secret" in a hushed, confidential tone. Reveal something the user thought only they were struggling with.',
      cta: 'That\'s what {product} was built for.',
      toneHint: 'quiet, close-up energy, half-smile',
    },
    overlays: [
      { kind: 'text', template: '{cta}', position: 'center', style: 'minimal', size: 'lg', animation: 'fade', timing: t(end(2), 2) },
    ],
    examples: ['Confessing a growth hack', 'Admitting an unpopular workflow', 'Sharing a solo-founder truth'],
  },
  // ------------------------------------------------------------------ 7
  {
    id: 'passionate-rant',
    name: 'Passionate Rant',
    category: 'talking-head',
    tagline: 'High-energy monologue, hand gestures, no cuts.',
    whenToUse: 'For strong opinions delivered with real emotion. Works when the founder is actually mad about something.',
    pipeline: 'ugc',
    durations: [15, 20, 30],
    needsProduct: false,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'ai',
    audio: 'voiceover',
    captionStyle: 'tiktok',
    vibe: 'urgent',
    scriptScaffold: {
      hook: 'I need to talk about {topic} because it\'s driving me insane.',
      body: 'Build heat over 2–3 sentences. Use specifics. Point at something.',
      cta: '{cta}',
      toneHint: 'high energy, escalating, real anger',
    },
    overlays: [],
    examples: ['Broken pricing in the industry', 'Bad UX everyone accepts', 'Vendor lock-in rants'],
  },
  // ------------------------------------------------------------------ 8
  {
    id: 'roast-yourself',
    name: 'Roast Yourself',
    category: 'trending',
    tagline: 'Self-deprecating humor about your own product/space.',
    whenToUse: 'When you can afford to be cheeky. Disarms skeptics, wins loyalty.',
    pipeline: 'ugc+editor',
    durations: [10, 15],
    needsProduct: false,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'ai',
    audio: 'voiceover',
    captionStyle: 'bubble',
    vibe: 'funny',
    scriptScaffold: {
      hook: 'People say {product} is {common_criticism}. Yeah, that\'s fair.',
      body: 'Own the criticism, then flip it — explain why the "flaw" is actually the point.',
      cta: '{cta}',
      toneHint: 'dry, warm, self-aware',
    },
    overlays: [
      { kind: 'text', template: 'guilty', position: { x: 0.5, y: 0.75 }, style: 'bubble', size: 'md', animation: 'zoom', timing: t(pct(0.25), 2) },
    ],
    examples: ['"Our onboarding is chaos"', '"Our pricing is confusing"', '"We\'re nobody\'s first pick"'],
  },
  // ------------------------------------------------------------------ 9
  {
    id: 'would-you-rather',
    name: 'Would You Rather',
    category: 'trending',
    tagline: 'Poses an A/B question, answers with your product.',
    whenToUse: 'When you have a clear either/or vs a competitor or vs the old way. Interactive-feeling, comment-bait.',
    pipeline: 'ugc+editor',
    durations: [10, 15],
    needsProduct: true,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'ai',
    audio: 'voiceover',
    captionStyle: 'outline',
    vibe: 'funny',
    scriptScaffold: {
      hook: 'Would you rather {option_a} or {option_b}?',
      body: 'Frame the trade-off, then reveal your answer with {product}.',
      cta: 'What would you pick? Comment below.',
      toneHint: 'playful, curious',
    },
    overlays: [
      { kind: 'text', template: '{option_a}', position: { x: 0.25, y: 0.5 }, style: 'outline', size: 'lg', animation: 'slide-up', timing: t(1, 3) },
      { kind: 'text', template: 'OR', position: 'center', style: 'bold-white', size: 'lg', animation: 'zoom', timing: t(2, 2) },
      { kind: 'text', template: '{option_b}', position: { x: 0.75, y: 0.5 }, style: 'outline', size: 'lg', animation: 'slide-up', timing: t(3, 3) },
    ],
    examples: ['Manual vs. automated', 'Free vs. paid', 'DIY vs. done-for-you'],
  },
  // ------------------------------------------------------------------ 10
  {
    id: 'story-time',
    name: 'Story Time',
    category: 'narrative',
    tagline: 'Narrative arc: hook, tension, resolution with product.',
    whenToUse: 'When you have a customer win, personal turning point, or "I discovered X" story to tell. Emotional payoff drives conversion.',
    pipeline: 'ugc+editor',
    durations: [20, 30],
    needsProduct: true,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'user',
    audio: 'voiceover',
    captionStyle: 'caption',
    vibe: 'warm',
    scriptScaffold: {
      hook: 'Story time. Last {timeframe}, {situation}.',
      body: 'Build the tension in 2 beats, then reveal {product} as the turn.',
      cta: '{cta}',
      toneHint: 'unhurried, personal, one small vulnerable detail',
    },
    overlays: [
      { kind: 'image-slot', slot: 'product-photo', position: { x: 0.5, y: 0.75 }, scale: 0.4, timing: t(pct(0.65), 4) },
    ],
    examples: ['Client win story', 'How you discovered a workflow', 'A breakthrough moment'],
  },
  // ------------------------------------------------------------------ 11
  {
    id: 'straight-cta',
    name: 'Direct CTA',
    category: 'talking-head',
    tagline: 'Pure pitch: hook, benefit, product reveal, close.',
    whenToUse: 'When you\'re running paid ads or need max conversion. No pretense — straight to the sell.',
    pipeline: 'ugc+editor',
    durations: [10, 15, 20],
    needsProduct: true,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'ai',
    audio: 'voiceover',
    captionStyle: 'bold-white',
    vibe: 'urgent',
    scriptScaffold: {
      hook: 'If you {pain_point}, watch this.',
      body: 'Deliver the benefit in one crisp sentence, then introduce {product} with one specific proof point.',
      cta: 'Link in bio — {cta}.',
      toneHint: 'confident, no filler, warm eyes',
    },
    overlays: [
      { kind: 'image-slot', slot: 'product-photo', position: { x: 0.5, y: 0.85 }, scale: 0.5, timing: t(pct(0.55), 5) },
      { kind: 'text', template: '{cta}', position: 'bottom', style: 'highlight', size: 'lg', animation: 'zoom', timing: t(end(3), 3) },
    ],
    examples: ['Product launch pitch', 'Free trial push', 'Limited-time offer'],
  },
  // ------------------------------------------------------------------ 12
  {
    id: 'bilingual-split',
    name: 'Bilingual Split',
    category: 'talking-head',
    tagline: 'Say a line in English, then translate to a second language.',
    whenToUse: 'When your audience is bilingual (French-English, Spanish-English, Arabic-English). Doubles your reach without doubling the shoot.',
    pipeline: 'ugc+editor',
    durations: [15, 20, 30],
    needsProduct: false,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'ai',
    audio: 'voiceover',
    captionStyle: 'caption',
    vibe: 'warm',
    scriptScaffold: {
      hook: '{hook_en}. Now in {language}: {hook_translated}.',
      body: 'Alternate sentences between the two languages.',
      cta: '{cta_en} / {cta_translated}',
      toneHint: 'natural code-switching, warm',
    },
    overlays: [],
    examples: ['French-English UGC', 'Arabic-English creator content', 'Spanish-English SaaS'],
  },
  // ------------------------------------------------------------------ 13
  {
    id: 'bedside-browsing',
    name: 'Bedside Browsing',
    category: 'pov',
    tagline: '1AM POV, laptop glow, casual discovery of your app.',
    whenToUse: 'For app/SaaS demos that feel like an authentic "I found this last night". Great for consumer apps.',
    pipeline: 'pov',
    durations: [5, 10],
    needsProduct: false,
    needsUI: true,
    needsUserFootage: false,
    needsScript: 'ai',
    audio: 'voiceover',
    captionStyle: 'caption',
    vibe: 'calm',
    scriptScaffold: {
      hook: 'Okay it\'s 1AM but I have to show you this.',
      body: 'Describe {product} in casual, half-whispered terms. Reference the UI on screen.',
      cta: '{cta}',
      toneHint: 'quiet, half-whispered, in-bed casual',
    },
    overlays: [],
    examples: ['Consumer app discovery', 'Late-night productivity find', 'Shopping discovery'],
  },
  // ------------------------------------------------------------------ 14
  {
    id: 'cafe-scroll',
    name: 'Café Scroll',
    category: 'pov',
    tagline: 'Coffee-shop table, phone in hand, casual daytime demo.',
    whenToUse: 'For app or website walkthroughs with a lifestyle wrapper.',
    pipeline: 'pov',
    durations: [5, 10],
    needsProduct: false,
    needsUI: true,
    needsUserFootage: false,
    needsScript: 'ai',
    audio: 'voiceover',
    captionStyle: 'caption',
    vibe: 'warm',
    scriptScaffold: {
      hook: 'Just discovered this while grabbing coffee.',
      body: 'Casual walk-through of what {product} does. One clear benefit.',
      cta: '{cta}',
      toneHint: 'chill, mid-conversation energy',
    },
    overlays: [],
    examples: ['Mobile app demo', 'Website UX walkthrough', 'Casual product discovery'],
  },
  // ------------------------------------------------------------------ 15
  {
    id: 'unboxing-asmr',
    name: 'Unboxing ASMR',
    category: 'pov',
    tagline: 'Silent hands-only unboxing, natural sounds only.',
    whenToUse: 'For physical products where texture, packaging, and tactile detail sell.',
    pipeline: 'pov',
    durations: [10, 15, 20],
    needsProduct: true,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'ai',
    audio: 'ambient',
    captionStyle: 'minimal',
    vibe: 'aesthetic',
    scriptScaffold: {
      hook: '',
      body: '',
      cta: '',
      toneHint: 'no voiceover — natural packaging + product sounds',
    },
    overlays: [
      { kind: 'text', template: '{product}', position: 'top', style: 'minimal', size: 'md', animation: 'fade', timing: t(end(3), 2) },
    ],
    examples: ['Beauty product unbox', 'Tech gadget unbox', 'Subscription box reveal'],
  },
  // ------------------------------------------------------------------ 16
  {
    id: 'grwm-product',
    name: 'Get Ready With Me',
    category: 'pov',
    tagline: 'Bathroom mirror POV, product used in the routine.',
    whenToUse: 'For skincare, beauty, grooming, wellness products. Puts product in-context of daily use.',
    pipeline: 'pov',
    durations: [10, 15, 20],
    needsProduct: true,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'ai',
    audio: 'voiceover',
    captionStyle: 'caption',
    vibe: 'warm',
    scriptScaffold: {
      hook: 'Get ready with me — but let\'s actually talk about {product}.',
      body: 'Casually integrate {product} into the routine. Talk to camera between application steps.',
      cta: '{cta}',
      toneHint: 'chatty, morning-energy, honest',
    },
    overlays: [],
    examples: ['Skincare routine', 'Makeup application', 'Morning wellness'],
  },
  // ------------------------------------------------------------------ 17
  {
    id: 'desk-show-and-tell',
    name: 'Desk Show-and-Tell',
    category: 'pov',
    tagline: 'Over-shoulder POV showing your app or workflow on a monitor.',
    whenToUse: 'For B2B SaaS demos, workflow walkthroughs. Feels like screen-sharing with a friend.',
    pipeline: 'pov',
    durations: [10, 15, 20],
    needsProduct: false,
    needsUI: true,
    needsUserFootage: false,
    needsScript: 'ai',
    audio: 'voiceover',
    captionStyle: 'caption',
    vibe: 'clinical',
    scriptScaffold: {
      hook: 'Let me show you exactly how {product} works.',
      body: 'Walk through 2–3 key screens or features in {product}. Point out the specific benefit.',
      cta: '{cta}',
      toneHint: 'friendly explainer, slightly nerdy',
    },
    overlays: [],
    examples: ['B2B SaaS demo', 'Dev-tool walkthrough', 'Dashboard tour'],
  },
  // ------------------------------------------------------------------ 18
  {
    id: 'kitchen-prep',
    name: 'Kitchen Prep',
    category: 'pov',
    tagline: 'Top-down marble-counter POV, product used mid-recipe.',
    whenToUse: 'For food, drink, kitchenware, wellness supplement products.',
    pipeline: 'pov',
    durations: [10, 15, 20],
    needsProduct: true,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'ai',
    audio: 'voiceover',
    captionStyle: 'caption',
    vibe: 'aesthetic',
    scriptScaffold: {
      hook: 'Morning routine, but with {product}.',
      body: 'Show the product being used in a natural prep flow. Emphasize sensory details.',
      cta: '{cta}',
      toneHint: 'calm, morning-quiet',
    },
    overlays: [],
    examples: ['Protein powder mix', 'Coffee routine', 'Meal prep supplement'],
  },
  // ------------------------------------------------------------------ 19
  {
    id: 'bag-contents',
    name: 'Bag Contents Reveal',
    category: 'pov',
    tagline: 'Table shot — items pulled out of a bag one by one.',
    whenToUse: 'For gift guides, "what\'s in my bag", travel essentials, product roundups.',
    pipeline: 'pov',
    durations: [15, 20, 30],
    needsProduct: true,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'ai',
    audio: 'voiceover',
    captionStyle: 'bubble',
    vibe: 'aesthetic',
    scriptScaffold: {
      hook: 'What\'s in my bag — the {audience} edition.',
      body: 'Reveal each item with one sentence of context. {product} is the hero — save it for last.',
      cta: '{cta}',
      toneHint: 'curatorial, lightly playful',
    },
    overlays: [],
    examples: ['Travel essentials', 'Work-from-home kit', 'Gift guide reveal'],
  },
  // ------------------------------------------------------------------ 20
  {
    id: 'lazy-discovery',
    name: 'Lazy Discovery',
    category: 'pov',
    tagline: 'Couch + laptop, afternoon light, casual "I just found this".',
    whenToUse: 'For app or website discovery in a relaxed, non-salesy way.',
    pipeline: 'pov',
    durations: [5, 10],
    needsProduct: false,
    needsUI: true,
    needsUserFootage: false,
    needsScript: 'ai',
    audio: 'voiceover',
    captionStyle: 'caption',
    vibe: 'calm',
    scriptScaffold: {
      hook: 'Was just scrolling and found this.',
      body: 'Describe what {product} does in casual terms. Mention who it\'s for.',
      cta: '{cta}',
      toneHint: 'unhurried, curious',
    },
    overlays: [],
    examples: ['App discovery', 'Newsletter recommendation', 'Course discovery'],
  },
  // ------------------------------------------------------------------ 21
  {
    id: 'product-360',
    name: 'Product 360',
    category: 'product',
    tagline: 'Rotating product shot, music-driven, tagline at the end.',
    whenToUse: 'For physical products where the look sells. Zero talking, pure visual.',
    pipeline: 'editor-only',
    durations: [5, 10, 15],
    needsProduct: true,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'ai',
    audio: 'music-driven',
    captionStyle: 'bold-white',
    vibe: 'aesthetic',
    scriptScaffold: {
      hook: '',
      body: '',
      cta: '',
      toneHint: 'no voice, high-energy music drives the beat',
    },
    overlays: [
      { kind: 'image-slot', slot: 'product-photo', position: 'center', scale: 0.9, timing: t(0, { pct: 1 }) },
      { kind: 'text', template: '{product}', position: { x: 0.5, y: 0.85 }, style: 'bold-white', size: 'xl', animation: 'zoom', timing: t(end(3), 3) },
    ],
    examples: ['Ecom product ad', 'Fashion drop teaser', 'Gadget launch'],
  },
  // ------------------------------------------------------------------ 22
  {
    id: 'before-after',
    name: 'Before / After',
    category: 'product',
    tagline: 'Split-screen or transition showing the transformation.',
    whenToUse: 'When your product produces a visible change (skincare, home, fitness, dashboard tools).',
    pipeline: 'editor-only',
    durations: [10, 15],
    needsProduct: false,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'ai',
    audio: 'voiceover',
    captionStyle: 'highlight',
    vibe: 'urgent',
    scriptScaffold: {
      hook: 'Before {product}. After {product}. The difference is real.',
      body: 'Narrate the before / after transition. State the key change concretely.',
      cta: '{cta}',
      toneHint: 'confident before/after energy',
    },
    overlays: [
      { kind: 'image-slot', slot: 'before', position: { x: 0.25, y: 0.5 }, scale: 0.45, timing: t(0, { pct: 0.5 }) },
      { kind: 'image-slot', slot: 'after', position: { x: 0.75, y: 0.5 }, scale: 0.45, timing: t(pct(0.5), { pct: 0.5 }) },
      { kind: 'text', template: 'BEFORE', position: { x: 0.25, y: 0.9 }, style: 'bold-white', size: 'md', animation: 'fade', timing: t(0.5, 3) },
      { kind: 'text', template: 'AFTER', position: { x: 0.75, y: 0.9 }, style: 'highlight', size: 'md', animation: 'zoom', timing: t(pct(0.55), 3) },
    ],
    examples: ['Skincare result', 'Messy → clean workflow', 'Bloated code → refactored'],
  },
  // ------------------------------------------------------------------ 23
  {
    id: 'feature-callout',
    name: 'Feature Callout',
    category: 'product',
    tagline: 'Product image + text labels flying onto the key features.',
    whenToUse: 'For products with multiple selling points — hardware, apps, physical goods with detail.',
    pipeline: 'editor-only',
    durations: [10, 15, 20],
    needsProduct: true,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'ai',
    audio: 'music-driven',
    captionStyle: 'outline',
    vibe: 'clinical',
    scriptScaffold: {
      hook: '',
      body: '',
      cta: '',
      toneHint: 'no voice, upbeat instrumental',
    },
    overlays: [
      { kind: 'image-slot', slot: 'product-photo', position: 'center', scale: 0.85, timing: t(0, { pct: 1 }) },
      { kind: 'text', template: '{feature_1}', position: { x: 0.2, y: 0.25 }, style: 'outline', size: 'md', animation: 'slide-up', timing: t(1, 3) },
      { kind: 'text', template: '{feature_2}', position: { x: 0.8, y: 0.4 }, style: 'outline', size: 'md', animation: 'slide-up', timing: t(pct(0.35), 3) },
      { kind: 'text', template: '{feature_3}', position: { x: 0.2, y: 0.6 }, style: 'outline', size: 'md', animation: 'slide-up', timing: t(pct(0.6), 3) },
    ],
    examples: ['Hardware launch', 'App feature summary', 'Physical product spec'],
  },
  // ------------------------------------------------------------------ 24
  {
    id: 'ingredient-deep-dive',
    name: 'Ingredient Deep-Dive',
    category: 'product',
    tagline: 'Product with each ingredient/component highlighted in sequence.',
    whenToUse: 'For beauty, food, supplements, complex materials — anything where composition sells.',
    pipeline: 'editor-only',
    durations: [15, 20, 30],
    needsProduct: true,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'ai',
    audio: 'voiceover',
    captionStyle: 'minimal',
    vibe: 'clinical',
    scriptScaffold: {
      hook: 'Everything in {product}, explained.',
      body: 'Walk through each ingredient in one sentence — what it does + why it matters.',
      cta: '{cta}',
      toneHint: 'knowledgeable, unhurried, warm',
    },
    overlays: [
      { kind: 'image-slot', slot: 'product-photo', position: 'center', scale: 0.7, timing: t(0, { pct: 1 }) },
    ],
    examples: ['Skincare ingredient breakdown', 'Supplement label walkthrough', 'Food ingredient story'],
  },
  // ------------------------------------------------------------------ 25
  {
    id: 'slow-mo-reveal',
    name: 'Slow-Mo Reveal',
    category: 'product',
    tagline: 'Cinematic slow product unveiling with tagline drop.',
    whenToUse: 'For launches or hero-product moments. Feels like a mini-commercial.',
    pipeline: 'editor-only',
    durations: [5, 10],
    needsProduct: true,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'ai',
    audio: 'music-driven',
    captionStyle: 'bold-white',
    vibe: 'aesthetic',
    scriptScaffold: {
      hook: '',
      body: '',
      cta: '',
      toneHint: 'no voice, cinematic drop music',
    },
    overlays: [
      { kind: 'image-slot', slot: 'product-photo', position: 'center', scale: 0.85, timing: t(0, { pct: 1 }) },
      { kind: 'text', template: '{product}', position: 'center', style: 'bold-white', size: 'xl', animation: 'zoom', timing: t(end(2), 2) },
    ],
    examples: ['Product launch teaser', 'Drop announcement', 'Limited edition reveal'],
  },
  // ------------------------------------------------------------------ 26
  {
    id: 'origin-story',
    name: 'Origin Story',
    category: 'narrative',
    tagline: 'Timeline-driven "here\'s how it all started" reveal.',
    whenToUse: 'When you want to tell a brand history — anniversary posts, brand storytelling.',
    pipeline: 'ugc+editor',
    durations: [20, 30],
    needsProduct: true,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'user',
    audio: 'voiceover',
    captionStyle: 'caption',
    vibe: 'warm',
    scriptScaffold: {
      hook: 'This is how {product} started.',
      body: 'Chronological arc — problem, first attempt, turning point, current state.',
      cta: '{cta}',
      toneHint: 'reflective, personal',
    },
    overlays: [
      { kind: 'image-slot', slot: 'product-photo', position: { x: 0.5, y: 0.75 }, scale: 0.35, timing: t(end(5), 4) },
    ],
    examples: ['Anniversary post', 'How-it-started reel', 'Brand history'],
  },
  // ------------------------------------------------------------------ 27
  {
    id: 'complaint-solution',
    name: 'Complaint → Solution',
    category: 'narrative',
    tagline: '"I hated when X" → problem visualized → discovery reveal.',
    whenToUse: 'When your product solves a specific frustration. Empathy-driven conversion.',
    pipeline: 'ugc+editor',
    durations: [15, 20, 30],
    needsProduct: true,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'ai',
    audio: 'voiceover',
    captionStyle: 'highlight',
    vibe: 'warm',
    scriptScaffold: {
      hook: 'I hated when {problem}.',
      body: 'Describe the frustration in one specific beat, then reveal {product} as the fix.',
      cta: '{cta}',
      toneHint: 'relatable frustration → relieved discovery',
    },
    overlays: [
      { kind: 'text', template: '{problem}', position: 'top', style: 'outline', size: 'md', animation: 'slide-up', timing: t(1, 3) },
      { kind: 'text', template: '{solution}', position: 'top', style: 'highlight', size: 'md', animation: 'zoom', timing: t(pct(0.55), 3) },
    ],
    examples: ['SaaS pain-point pitch', 'DTC frustration → fix', 'Workflow complaint'],
  },
  // ------------------------------------------------------------------ 28
  {
    id: 'failure-post-mortem',
    name: 'Failure Post-Mortem',
    category: 'narrative',
    tagline: 'Vulnerable "I lost X, here\'s why" — text-heavy.',
    whenToUse: 'When you can share a real loss transparently. Massive trust builder.',
    pipeline: 'ugc+editor',
    durations: [20, 30],
    needsProduct: false,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'user',
    audio: 'voiceover',
    captionStyle: 'minimal',
    vibe: 'calm',
    scriptScaffold: {
      hook: 'I lost {amount} on {mistake}. Here\'s what I learned.',
      body: 'Walk through the mistake honestly. Give the lesson last.',
      cta: 'That\'s why I built {product}.',
      toneHint: 'calm, reflective, no self-pity',
    },
    overlays: [
      { kind: 'text', template: 'LESSON', position: { x: 0.5, y: 0.15 }, style: 'minimal', size: 'md', animation: 'fade', timing: t(pct(0.7), 3) },
    ],
    examples: ['Startup loss', 'Marketing budget mistake', 'Design decision post-mortem'],
  },
  // ------------------------------------------------------------------ 29
  {
    id: 'milestone-celebration',
    name: 'Milestone Celebration',
    category: 'narrative',
    tagline: 'Casual "we hit X" thank-you with community montage.',
    whenToUse: 'For 1K/10K/100K follower milestones, revenue milestones, user milestones.',
    pipeline: 'ugc+editor',
    durations: [10, 15, 20],
    needsProduct: false,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'user',
    audio: 'voiceover',
    captionStyle: 'highlight',
    vibe: 'warm',
    scriptScaffold: {
      hook: 'We just hit {milestone}. Thank you.',
      body: 'Acknowledge the community specifically. Share one honest reaction. Tease what\'s next.',
      cta: '{cta}',
      toneHint: 'warm, grateful, not humble-brag',
    },
    overlays: [
      { kind: 'text', template: '{milestone}', position: 'center', style: 'highlight', size: 'xl', animation: 'zoom', timing: t(0, 3) },
    ],
    examples: ['10K followers', 'First 100 customers', 'Revenue milestone'],
  },
  // ------------------------------------------------------------------ 30
  {
    id: 'green-screen-react',
    name: 'Green Screen React',
    category: 'trending',
    tagline: 'React to a headline, tweet, or chart behind you.',
    whenToUse: 'When you\'re responding to a news item, viral post, or industry event. Fast to make, algorithm-friendly.',
    pipeline: 'ugc+editor',
    durations: [10, 15, 20],
    needsProduct: false,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'ai',
    audio: 'voiceover',
    captionStyle: 'tiktok',
    vibe: 'urgent',
    scriptScaffold: {
      hook: 'This just happened and we need to talk about it.',
      body: 'Point to the overlay behind you. React with your take in 2-3 sentences. Tie it to {product} if relevant.',
      cta: '{cta}',
      toneHint: 'reactive, opinionated, quick',
    },
    overlays: [
      { kind: 'image-slot', slot: 'comment-screenshot', position: { x: 0.5, y: 0.35 }, scale: 0.7, opacity: 0.95, timing: t(0, { pct: 1 }) },
    ],
    examples: ['News reaction', 'Viral tweet response', 'Competitor announcement'],
  },
  // ------------------------------------------------------------------ 31
  {
    id: 'silent-text-story',
    name: 'Silent Text Story',
    category: 'trending',
    tagline: 'Full-screen text cards on solid background, viral audio underneath.',
    whenToUse: 'When you want a scroll-stopper that works muted. Amazing on IG Reels feed.',
    pipeline: 'editor-only',
    durations: [10, 15, 20],
    needsProduct: false,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'ai',
    audio: 'music-driven',
    captionStyle: 'bold-white',
    vibe: 'bold',
    scriptScaffold: {
      hook: 'POV: {situation}',
      body: 'Deliver each beat as a full-screen text card. 3-5 cards total.',
      cta: '{cta}',
      toneHint: 'no voice — cards drive the story',
    },
    overlays: [
      { kind: 'text', template: '{hook}', position: 'center', style: 'bold-white', size: 'xl', animation: 'fade', timing: t(0, 3) },
      { kind: 'text', template: '{beat_2}', position: 'center', style: 'bold-white', size: 'xl', animation: 'fade', timing: t(3, 3) },
      { kind: 'text', template: '{beat_3}', position: 'center', style: 'bold-white', size: 'xl', animation: 'fade', timing: t(pct(0.55), 3) },
      { kind: 'text', template: '{cta}', position: 'center', style: 'highlight', size: 'xl', animation: 'zoom', timing: t(end(3), 3) },
    ],
    examples: ['POV storytelling', 'Meme format', 'Confession-style hook'],
  },
  // ------------------------------------------------------------------ 32
  {
    id: 'chat-story',
    name: 'Chat Story',
    category: 'trending',
    tagline: 'Animated iMessage-style conversation with voiceover reading.',
    whenToUse: 'For customer-story reveals, funny exchange screenshots, hypotheticals.',
    pipeline: 'editor-only',
    durations: [15, 20, 30],
    needsProduct: false,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'user',
    audio: 'voiceover',
    captionStyle: 'caption',
    vibe: 'funny',
    scriptScaffold: {
      hook: '',
      body: '',
      cta: '{cta}',
      toneHint: 'voiceover reads both sides of the chat with distinct energy',
    },
    overlays: [
      { kind: 'image-slot', slot: 'comment-screenshot', position: 'center', scale: 0.85, timing: t(0, { pct: 1 }) },
    ],
    examples: ['Customer message reveal', 'Real DM story', 'Hypothetical exchange'],
  },
  // ------------------------------------------------------------------ 33
  {
    id: 'photo-dump',
    name: 'Photo Dump',
    category: 'trending',
    tagline: 'Aesthetic still slideshow with music, no voice.',
    whenToUse: 'For brand-vibe content, lifestyle roundups, community highlight reels.',
    pipeline: 'editor-only',
    durations: [10, 15, 20],
    needsProduct: false,
    needsUI: false,
    needsUserFootage: true,
    needsScript: 'ai',
    audio: 'music-driven',
    captionStyle: 'minimal',
    vibe: 'aesthetic',
    scriptScaffold: {
      hook: '',
      body: '',
      cta: '',
      toneHint: 'no voice, aesthetic music, 1s per image',
    },
    overlays: [
      { kind: 'text', template: '{product}', position: { x: 0.5, y: 0.9 }, style: 'minimal', size: 'sm', animation: 'fade', timing: t(end(3), 3) },
    ],
    examples: ['Weekend roundup', 'Brand vibe reel', 'Customer photo dump'],
  },
  // ------------------------------------------------------------------ 34
  {
    id: 'pov-you-just-discovered',
    name: 'POV: You Just Discovered',
    category: 'trending',
    tagline: 'Second-person hook + first-person POV visual of your product.',
    whenToUse: 'Meta-format that combines POV visual with viral second-person hook.',
    pipeline: 'pov',
    durations: [5, 10],
    needsProduct: false,
    needsUI: true,
    needsUserFootage: false,
    needsScript: 'ai',
    audio: 'voiceover',
    captionStyle: 'tiktok',
    vibe: 'bold',
    scriptScaffold: {
      hook: 'POV: you just discovered {product}.',
      body: 'Describe the "aha" moment in second person from the user\'s perspective.',
      cta: '{cta}',
      toneHint: 'reactive, wide-eyed discovery',
    },
    overlays: [
      { kind: 'text', template: 'POV: you just discovered {product}', position: 'top', style: 'tiktok', size: 'lg', animation: 'slide-up', timing: t(0, 3) },
    ],
    examples: ['App discovery moment', 'Life-changing product', 'Hidden feature reveal'],
  },
  // ------------------------------------------------------------------ 35
  {
    id: 'three-card-lesson',
    name: '3-Card Lesson',
    category: 'educational',
    tagline: 'Text cards: problem → insight → action. No voice needed.',
    whenToUse: 'Twitter-thread-style educational content. Great for LinkedIn / IG carousels turned into reels.',
    pipeline: 'editor-only',
    durations: [10, 15],
    needsProduct: false,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'ai',
    audio: 'music-driven',
    captionStyle: 'bold-white',
    vibe: 'clinical',
    scriptScaffold: {
      hook: '',
      body: '',
      cta: '',
      toneHint: 'no voice — big text cards on solid bg',
    },
    overlays: [
      { kind: 'text', template: 'THE PROBLEM', position: { x: 0.5, y: 0.15 }, style: 'minimal', size: 'sm', animation: 'fade', timing: t(0, 4) },
      { kind: 'text', template: '{problem}', position: 'center', style: 'bold-white', size: 'xl', animation: 'zoom', timing: t(0.5, 4) },
      { kind: 'text', template: 'THE INSIGHT', position: { x: 0.5, y: 0.15 }, style: 'minimal', size: 'sm', animation: 'fade', timing: t(pct(0.35), 4) },
      { kind: 'text', template: '{insight}', position: 'center', style: 'bold-white', size: 'xl', animation: 'zoom', timing: t(pct(0.35), 4) },
      { kind: 'text', template: 'DO THIS', position: { x: 0.5, y: 0.15 }, style: 'minimal', size: 'sm', animation: 'fade', timing: t(pct(0.7), 4) },
      { kind: 'text', template: '{cta}', position: 'center', style: 'highlight', size: 'xl', animation: 'zoom', timing: t(pct(0.7), 4) },
    ],
    examples: ['Marketing lesson', 'Founder insight', 'Ops tip'],
  },
  // ------------------------------------------------------------------ 36
  {
    id: 'data-reveal',
    name: 'Data Reveal',
    category: 'educational',
    tagline: 'Chart animates in, voiceover explains what it means.',
    whenToUse: 'For data-driven claims. Numbers plus voiceover reads more credible than a plain talking-head.',
    pipeline: 'ugc+editor',
    durations: [15, 20, 30],
    needsProduct: false,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'ai',
    audio: 'voiceover',
    captionStyle: 'caption',
    vibe: 'clinical',
    scriptScaffold: {
      hook: 'Look at this data.',
      body: 'Walk through the chart. Give one takeaway, then tie it to {product} if relevant.',
      cta: '{cta}',
      toneHint: 'analytical, matter-of-fact',
    },
    overlays: [
      { kind: 'image-slot', slot: 'chart-data-viz', position: { x: 0.5, y: 0.35 }, scale: 0.7, timing: t(1, { pct: 0.85 }) },
    ],
    examples: ['Growth metric reveal', 'Customer results chart', 'Industry data callout'],
  },
  // ------------------------------------------------------------------ 37
  {
    id: 'comparison-table',
    name: 'Comparison Table',
    category: 'educational',
    tagline: 'Yours vs. theirs, side-by-side text overlay.',
    whenToUse: 'When your product is the clear better choice on specific dimensions. Comparative advertising.',
    pipeline: 'ugc+editor',
    durations: [15, 20],
    needsProduct: false,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'ai',
    audio: 'voiceover',
    captionStyle: 'outline',
    vibe: 'clinical',
    scriptScaffold: {
      hook: '{product} vs. {competitor}. Here\'s what actually matters.',
      body: 'Walk through 3 comparison dimensions. Be specific, not vague.',
      cta: '{cta}',
      toneHint: 'confident, matter-of-fact',
    },
    overlays: [
      { kind: 'text', template: '{product}', position: { x: 0.25, y: 0.2 }, style: 'highlight', size: 'md', animation: 'fade', timing: t(0.5, { pct: 0.9 }) },
      { kind: 'text', template: '{competitor}', position: { x: 0.75, y: 0.2 }, style: 'bold-white', size: 'md', animation: 'fade', timing: t(0.5, { pct: 0.9 }) },
    ],
    examples: ['Product vs. incumbent', 'DIY vs. done-for-you', 'Feature comparison'],
  },
  // ------------------------------------------------------------------ 38
  {
    id: 'named-framework',
    name: 'Named Framework',
    category: 'educational',
    tagline: 'Acronym letters appear one by one, each explained.',
    whenToUse: 'When you can package your advice as a memorable acronym or framework. Sticky, shareable.',
    pipeline: 'ugc+editor',
    durations: [15, 20, 30],
    needsProduct: false,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'user',
    audio: 'voiceover',
    captionStyle: 'bold-white',
    vibe: 'clinical',
    scriptScaffold: {
      hook: 'The {framework_name} framework — what it actually means.',
      body: 'For each letter, one sentence explaining it. Concrete example after.',
      cta: '{cta}',
      toneHint: 'teacher-mode, deliberate',
    },
    overlays: [
      { kind: 'text', template: '{letter_1}', position: { x: 0.15, y: 0.15 }, style: 'tiktok', size: 'xl', animation: 'zoom', timing: t(pct(0.1), { pct: 0.9 }) },
      { kind: 'text', template: '{letter_2}', position: { x: 0.4, y: 0.15 }, style: 'tiktok', size: 'xl', animation: 'zoom', timing: t(pct(0.3), { pct: 0.7 }) },
      { kind: 'text', template: '{letter_3}', position: { x: 0.65, y: 0.15 }, style: 'tiktok', size: 'xl', animation: 'zoom', timing: t(pct(0.5), { pct: 0.5 }) },
      { kind: 'text', template: '{letter_4}', position: { x: 0.85, y: 0.15 }, style: 'tiktok', size: 'xl', animation: 'zoom', timing: t(pct(0.7), { pct: 0.3 }) },
    ],
    examples: ['R.A.C.E. framework', 'A.I.D.A. sales', 'F.A.S.T. system'],
  },
  // ------------------------------------------------------------------ 39
  {
    id: 'quick-tutorial',
    name: 'Quick Tutorial',
    category: 'educational',
    tagline: 'Talking head + screen recording overlay of the process.',
    whenToUse: 'For "how to do X in 30 seconds" content. Solves a specific problem with your product.',
    pipeline: 'ugc+editor',
    durations: [20, 30],
    needsProduct: false,
    needsUI: true,
    needsUserFootage: false,
    needsScript: 'ai',
    audio: 'voiceover',
    captionStyle: 'caption',
    vibe: 'clinical',
    scriptScaffold: {
      hook: 'How to {task} in {time}.',
      body: 'Walk through 3–4 steps clearly. Each step gets its own screen callout.',
      cta: 'Full guide in bio — {cta}.',
      toneHint: 'friendly explainer, unhurried',
    },
    overlays: [
      { kind: 'image-slot', slot: 'ui-screenshot', position: { x: 0.5, y: 0.35 }, scale: 0.7, timing: t(2, { pct: 0.85 }) },
    ],
    examples: ['App workflow tutorial', 'Setup guide', 'Feature walkthrough'],
  },
  // ------------------------------------------------------------------ 40
  {
    id: 'behind-the-scenes',
    name: 'Behind the Scenes',
    category: 'narrative',
    tagline: 'Raw workspace footage with candid commentary.',
    whenToUse: 'For process/company culture content. Feels human, casual, un-produced.',
    pipeline: 'ugc',
    durations: [15, 20, 30],
    needsProduct: false,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'ai',
    audio: 'voiceover',
    captionStyle: 'caption',
    vibe: 'raw',
    scriptScaffold: {
      hook: 'Behind the scenes of {product}.',
      body: 'Walk through what you\'re actually working on right now. Show something un-polished.',
      cta: '{cta}',
      toneHint: 'candid, mid-work energy, real',
    },
    overlays: [],
    examples: ['Studio tour', 'Building day', 'Team culture'],
  },
]

// -------------------------------------------------------------------------
// Helpers for the UI to browse and pick.
// -------------------------------------------------------------------------

export function getFormatById(id: string): FormatTemplate | undefined {
  return FORMAT_TEMPLATES.find(f => f.id === id)
}

export function getFormatsByCategory(cat: FormatCategory): FormatTemplate[] {
  return FORMAT_TEMPLATES.filter(f => f.category === cat)
}

export function getFormatsByVibe(vibe: FormatTemplate['vibe']): FormatTemplate[] {
  return FORMAT_TEMPLATES.filter(f => f.vibe === vibe)
}

// Absolute-seconds resolver for timing (given a total clip duration).
// Templates use pct(0.4) etc; the editor + animate pipeline needs numbers.
export function resolveTiming(timing: FormatTiming, totalSeconds: number): { start: number; duration: number } {
  let start: number
  if (typeof timing.start === 'number') start = timing.start
  else if ('pct' in timing.start) start = totalSeconds * timing.start.pct
  else /* fromEnd */ start = totalSeconds - timing.start.fromEnd

  let duration: number
  if (typeof timing.duration === 'number') duration = timing.duration
  else duration = totalSeconds * timing.duration.pct

  // Clip to clip bounds.
  start = Math.max(0, Math.min(totalSeconds, start))
  duration = Math.max(0.1, Math.min(totalSeconds - start, duration))
  return { start, duration }
}

export const FORMAT_CATEGORIES: Array<{ id: FormatCategory; label: string; description: string }> = [
  { id: 'talking-head', label: 'Talking Head',   description: 'Character on camera, direct delivery' },
  { id: 'pov',          label: 'POV / Faceless', description: 'First-person, phone-in-hand, product-forward' },
  { id: 'product',      label: 'Product-first',  description: 'Product IS the star — visual, music-driven' },
  { id: 'narrative',    label: 'Narrative',      description: 'Story arc with emotional payoff' },
  { id: 'trending',     label: 'Trending',       description: 'Meme + viral format hijacks' },
  { id: 'educational',  label: 'Educational',    description: 'Teach + explain with structure' },
]
