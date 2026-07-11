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
  | 'ugc+compositor'  // UGC clip + background removal + PIP move + icon fields
                      // (needs the advanced compositor pass — not shipped yet)

// Timing supports absolute seconds or percentage of the clip so a template
// scales across 5s / 10s / 15s / 20s / 30s durations without rewriting.
export type FormatTiming = {
  start: number | { pct: number } | { fromEnd: number }
  duration: number | { pct: number }
}

// Character PIP moves (Arcads-style). The talking-head clip is composited on
// top of the background layer — this describes where + how big it sits and
// how it transitions between positions across the timeline.
export type CharacterPip = {
  from: { x: number; y: number; scale: number } // 0-1 space, 1.0 scale = fills canvas
  to: { x: number; y: number; scale: number }
  transitionAt: FormatTiming['start']  // when the PIP starts moving to the "to" pose
  transitionDuration: number           // seconds — how long the move takes
  keyOut: boolean                       // remove the character's background via
                                        // segmentation before compositing
}

// State-machine timeline (for multi-scene composites like App Demo where the
// layout swaps between an overlay state and a fullscreen state at scripted
// timestamps). Full spec written up in the Gemini blueprint.
export type CompositeState =
  | {
      // Avatar cutout at bottom, background video (b-roll or app UI) fills
      // the whole 9:16 canvas behind it.
      kind: 'overlay'
      background:
        | { type: 'b_roll'; hint: string }              // Nano Banana / stock hint
        | { type: 'app_ui'; slot: 'ui-screenshot' | 'ui-recording' }
      avatarSize: number       // 0-1, fraction of canvas height (default 0.45)
      avatarBottomInset: number // 0-1 fraction (default 0 = touching bottom)
      avatarKeyOut: true       // this state always removes the character bg
    }
  | {
      // The pattern-interrupt: character fills the frame with their native
      // background. No compositing, just the raw Kling clip.
      kind: 'fullscreen'
      avatarKeyOut: false
    }

export type StateMachineSegment = {
  id: number
  startSeconds: number
  endSeconds: number
  state: CompositeState
  // Spoken line for this segment. Used for word-timing extraction (Whisper)
  // and, if the user hasn't recorded audio yet, as the target script line.
  spokenText: string
  captionColor: string   // hex — Gemini spec alternates purple / green / white
}

// Word-level caption specification. The renderer looks up each word's start
// time from the Whisper transcript and pops it on screen for its window.
export type CaptionSpec = {
  perWord: true
  centerX: number        // 0-1 (default 0.5)
  centerY: number        // 0-1 (default 0.30 = 30% from top per spec)
  fontFamily: string     // 'Montserrat' | 'Impact' | 'Futura Bold' etc
  fontSize: number       // pixels at 1080x1920 (default 64)
  bounceScaleActive: number // 1.1 per spec
  strokeColor: string    // for readability against shifting backgrounds
  strokeWidth: number    // pixels
  maxWordsPerFrame: 1 | 2
}

// Emoji + SFX trigger — fires when a keyword lands in the caption stream.
// The renderer times the pop-in to the exact word timestamp from Whisper.
export type EmojiTrigger = {
  keyword: string        // word to match (case-insensitive, first occurrence)
  emoji: string          // the emoji to pop in
  sfx?: string           // asset path or Replicate/Freesound id
  scaleFrames: number    // ease-in frame count (default 15)
  yOffset: number        // offset in canvas fraction from the caption
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
  | {
      // Icon-pattern background layer (dollar signs, hearts, checkmarks, etc.).
      // Rendered as a tiled or scattered field of the icon behind the character.
      kind: 'icon-field'
      iconSlot: 'money' | 'heart' | 'check' | 'star' | 'flame' | 'brain' | 'arrow-up' | 'clock' | 'custom'
      density: 'sparse' | 'medium' | 'dense'
      color: string
      backgroundColor: string
      timing: FormatTiming
    }
  | {
      // Full-frame background swap. Useful for multi-scene composites where
      // the character stays but the world behind them changes.
      kind: 'background-swap'
      slot: 'chart-fullframe' | 'icon-field' | 'grid-dark' | 'grid-light' | 'gradient' | 'photo'
      color?: string
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

  // Optional: character PIP movement (Arcads-style composites). Requires the
  // compositor pipeline.
  pip?: CharacterPip

  // Optional: full multi-state timeline for complex composites (App Demo).
  // Overrides the simpler pip/overlays[] layout when present.
  stateMachine?: {
    totalSeconds: number
    segments: StateMachineSegment[]
    captions: CaptionSpec
    triggers: EmojiTrigger[]
    fps: number
    canvas: { width: number; height: number }
  }

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
  // ==========================================================================
  // ARCADS-STYLE COMPOSITE FAMILY (character PIP + dynamic backgrounds)
  // Needs the compositor pipeline (background removal + PIP animation).
  // ==========================================================================
  // ------------------------------------------------------------------ 41
  {
    id: 'pip-explainer',
    name: 'PIP Explainer',
    category: 'educational',
    tagline: 'Character shrinks from full-frame to bottom-right corner as visuals fill the rest.',
    whenToUse: 'For finance, tech-news, or data commentary. Character starts centered talking, then ducks into a corner while a chart, icon field, or infographic dominates.',
    pipeline: 'ugc+compositor',
    durations: [15, 20, 30],
    needsProduct: false,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'ai',
    audio: 'voiceover',
    captionStyle: 'highlight',
    vibe: 'clinical',
    scriptScaffold: {
      hook: 'You need to be watching {topic}.',
      body: 'First 3s: introduce the topic while centered on camera. Then walk through 2-3 key points while the visual layer takes over. End with a hook back to your product.',
      cta: '{cta}',
      toneHint: 'confident news-anchor cadence',
    },
    pip: {
      from: { x: 0.5, y: 0.5, scale: 1.0 },
      to:   { x: 0.75, y: 0.82, scale: 0.4 },
      transitionAt: 3,
      transitionDuration: 0.6,
      keyOut: true,
    },
    overlays: [
      { kind: 'text', template: '{hook}', position: { x: 0.35, y: 0.18 }, style: 'highlight', size: 'lg', animation: 'zoom', timing: t(0.4, 3) },
      { kind: 'image-slot', slot: 'chart-data-viz', position: { x: 0.4, y: 0.4 }, scale: 0.55, timing: t(3.5, { pct: 0.85 }) },
      { kind: 'text', template: '{key_point_1}', position: { x: 0.4, y: 0.15 }, style: 'bold-white', size: 'md', animation: 'slide-up', timing: t(pct(0.5), 4) },
    ],
    examples: ['Stock reaction', 'Tech news explainer', 'Metric deep-dive'],
  },
  // ------------------------------------------------------------------ 42
  {
    id: 'icon-rain',
    name: 'Icon Rain',
    category: 'trending',
    tagline: 'Repeating themed icons tile the background, character composited over.',
    whenToUse: 'Instantly telegraphs the topic via visual metaphor — dollar signs for money, hearts for love, brains for smart, flames for hot takes.',
    pipeline: 'ugc+compositor',
    durations: [10, 15, 20],
    needsProduct: false,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'ai',
    audio: 'voiceover',
    captionStyle: 'bold-white',
    vibe: 'bold',
    scriptScaffold: {
      hook: 'So what\'s driving {topic}?',
      body: 'Explain the trend or insight in 3 tight sentences. Reference {product} as the answer or the tool.',
      cta: '{cta}',
      toneHint: 'high-energy, gestures with hands',
    },
    pip: {
      from: { x: 0.5, y: 0.5, scale: 1.0 },
      to:   { x: 0.75, y: 0.85, scale: 0.42 },
      transitionAt: 2,
      transitionDuration: 0.5,
      keyOut: true,
    },
    overlays: [
      { kind: 'icon-field', iconSlot: 'money', density: 'medium', color: '#ffffff', backgroundColor: '#000000', timing: t(2, { pct: 0.9 }) },
      { kind: 'text', template: '{hook}', position: { x: 0.5, y: 0.35 }, style: 'bold-white', size: 'lg', animation: 'zoom', timing: t(2.5, 4) },
    ],
    examples: ['Money moves', 'Trending love/dating', 'Hot takes with 🔥 icons'],
  },
  // ------------------------------------------------------------------ 43
  {
    id: 'chart-reaction',
    name: 'Chart Reaction',
    category: 'educational',
    tagline: 'Big chart or number dominates screen; character reacts from the corner.',
    whenToUse: 'For data-driven claims — stock moves, growth metrics, poll results. The visual is the evidence, the character is the interpreter.',
    pipeline: 'ugc+compositor',
    durations: [15, 20, 30],
    needsProduct: false,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'user',
    audio: 'voiceover',
    captionStyle: 'caption',
    vibe: 'urgent',
    scriptScaffold: {
      hook: 'Look at what just happened.',
      body: 'Describe what the chart shows, what changed, and what it means. Keep the character\'s energy reactive — not just narrating.',
      cta: '{cta}',
      toneHint: 'reactive, incredulous, breathy',
    },
    pip: {
      from: { x: 0.5, y: 0.5, scale: 1.0 },
      to:   { x: 0.75, y: 0.85, scale: 0.38 },
      transitionAt: 2,
      transitionDuration: 0.5,
      keyOut: true,
    },
    overlays: [
      { kind: 'background-swap', slot: 'grid-dark', color: '#000000', timing: t(2, { pct: 0.9 }) },
      { kind: 'image-slot', slot: 'chart-data-viz', position: { x: 0.5, y: 0.35 }, scale: 0.75, timing: t(2.4, { pct: 0.85 }) },
      { kind: 'text', template: '{data_label}', position: { x: 0.5, y: 0.65 }, style: 'caption', size: 'md', animation: 'fade', timing: t(pct(0.5), 4) },
    ],
    examples: ['Stock chart reaction', 'Growth metric reveal', 'Poll / survey response'],
  },
  // ------------------------------------------------------------------ 44
  {
    id: 'multi-scene-composite',
    name: 'Multi-Scene Composite',
    category: 'educational',
    tagline: 'Same character composited through 3-4 different backdrops as the topic evolves.',
    whenToUse: 'The Arcads signature. Perfect for tech/finance/health explainers where you visit multiple sub-topics — plain room → chart → icon field → data screen.',
    pipeline: 'ugc+compositor',
    durations: [20, 30],
    needsProduct: false,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'user',
    audio: 'voiceover',
    captionStyle: 'highlight',
    vibe: 'clinical',
    scriptScaffold: {
      hook: 'You need to be watching {topic}.',
      body: 'Structure into 3 beats, each with a distinct backdrop: (1) plain — set up the topic, (2) chart / data — show the evidence, (3) icon field — reinforce the theme. Character transitions between the scenes with a small nod or gesture.',
      cta: '{cta}',
      toneHint: 'authoritative, journalist-explainer',
    },
    pip: {
      from: { x: 0.5, y: 0.5, scale: 1.0 },
      to:   { x: 0.72, y: 0.84, scale: 0.4 },
      transitionAt: 3,
      transitionDuration: 0.5,
      keyOut: true,
    },
    overlays: [
      { kind: 'text', template: '{hook}', position: { x: 0.4, y: 0.18 }, style: 'highlight', size: 'lg', animation: 'zoom', timing: t(0.5, 3) },
      { kind: 'background-swap', slot: 'grid-dark', timing: t(3, 6) },
      { kind: 'image-slot', slot: 'chart-data-viz', position: { x: 0.4, y: 0.4 }, scale: 0.6, timing: t(3.5, 5) },
      { kind: 'text', template: '{beat_2_label}', position: { x: 0.4, y: 0.7 }, style: 'caption', size: 'md', animation: 'fade', timing: t(pct(0.4), 3) },
      { kind: 'icon-field', iconSlot: 'money', density: 'medium', color: '#ffffff', backgroundColor: '#000000', timing: t(pct(0.6), { pct: 0.35 }) },
      { kind: 'text', template: '{beat_3_hook}', position: { x: 0.4, y: 0.35 }, style: 'bold-white', size: 'lg', animation: 'zoom', timing: t(pct(0.65), 4) },
    ],
    examples: ['Stock analyst clip', 'Health explainer', 'Tech breakdown'],
  },
  // ==========================================================================
  // APP DEMO COMPOSITE FAMILY — the specific Arcads pattern for mobile app ads
  // Character-as-PIP woven through rotating app UI screens with sticker overlays.
  // ==========================================================================
  // ------------------------------------------------------------------ NEW-A
  {
    id: 'app-demo-composite',
    name: 'App Demo Composite',
    category: 'talking-head',
    tagline: '3-state pattern-interrupt: hook overlay → fullscreen pivot → app-UI demo overlay.',
    whenToUse: 'The exact Arcads app-ad blueprint. State A (0-3s): B-roll behind avatar cutout. State B (3-5.5s): full-frame character break for peer-to-peer intimacy. State C (5.5-16s): app UI dominates while avatar narrates from the bottom. Word-by-word captions with alternating colors + emoji + SFX on keyword triggers.',
    pipeline: 'ugc+compositor',
    durations: [15, 20, 30],
    needsProduct: false,
    needsUI: true,
    needsUserFootage: false,
    needsScript: 'ai',
    audio: 'voiceover',
    captionStyle: 'bold-white',
    vibe: 'funny',
    scriptScaffold: {
      hook: 'Are you really still wasting your time playing video games?',
      body: 'Beat 1 (0-3s, State Overlay + B-roll of gameplay): call out the pain / lifestyle. Beat 2 (3-5.5s, Fullscreen pivot): break the fourth wall — "heh, so do I, but at least I earn cash doing that". Beat 3 (5.5-16s, State Overlay + app UI): reveal {product}, walk through 2-3 screens, land on the money shot.',
      cta: 'Link in bio — download {product} and start earning.',
      toneHint: 'sarcastic hook → conspiratorial pivot → excited demo. Real hand gestures, real reactions.',
    },
    pip: {
      from: { x: 0.5, y: 0.85, scale: 0.45 },  // State A: avatar cutout at bottom
      to:   { x: 0.5, y: 0.85, scale: 0.45 },  // State C: same cutout position
      transitionAt: 5.5,
      transitionDuration: 0.3,
      keyOut: true,
    },
    // The state machine takes over from the simpler overlays[] list when
    // present. The Format Library detail page renders both — engineers looking
    // at the JSON will see the exact Gemini spec.
    stateMachine: {
      totalSeconds: 16,
      fps: 30,
      canvas: { width: 1080, height: 1920 },
      segments: [
        {
          id: 1,
          startSeconds: 0,
          endSeconds: 3,
          state: {
            kind: 'overlay',
            background: { type: 'b_roll', hint: 'hands playing a mobile game on a phone, cafe or couch setting, close-up' },
            avatarSize: 0.45,
            avatarBottomInset: 0,
            avatarKeyOut: true,
          },
          spokenText: '{hook}',
          captionColor: '#A855F7',  // purple
        },
        {
          id: 2,
          startSeconds: 3,
          endSeconds: 5.5,
          state: {
            kind: 'fullscreen',
            avatarKeyOut: false,
          },
          spokenText: '{pivot_line}',
          captionColor: '#FFFFFF',  // white
        },
        {
          id: 3,
          startSeconds: 5.5,
          endSeconds: 16,
          state: {
            kind: 'overlay',
            background: { type: 'app_ui', slot: 'ui-recording' },
            avatarSize: 0.45,
            avatarBottomInset: 0,
            avatarKeyOut: true,
          },
          spokenText: '{demo_line}',
          captionColor: '#22C55E',  // bright green
        },
      ],
      captions: {
        perWord: true,
        centerX: 0.5,
        centerY: 0.30,
        fontFamily: 'Montserrat',
        fontSize: 64,
        bounceScaleActive: 1.1,
        strokeColor: '#000000',
        strokeWidth: 6,
        maxWordsPerFrame: 2,
      },
      triggers: [
        { keyword: 'cash',     emoji: '💰', sfx: 'cash_register', scaleFrames: 15, yOffset: -0.08 },
        { keyword: 'money',    emoji: '💵', sfx: 'cash_register', scaleFrames: 15, yOffset: -0.08 },
        { keyword: 'app',      emoji: '📱', sfx: 'pop',           scaleFrames: 15, yOffset: -0.08 },
        { keyword: 'game',     emoji: '🎮', sfx: 'pop',           scaleFrames: 15, yOffset: -0.08 },
        { keyword: 'games',    emoji: '🎮', sfx: 'pop',           scaleFrames: 15, yOffset: -0.08 },
        { keyword: 'download', emoji: '📥', sfx: 'swoosh',        scaleFrames: 15, yOffset: -0.08 },
        { keyword: 'earn',     emoji: '✨', sfx: 'sparkle',       scaleFrames: 15, yOffset: -0.08 },
        { keyword: 'free',     emoji: '🔥', sfx: 'whoosh',        scaleFrames: 15, yOffset: -0.08 },
        { keyword: 'gem',      emoji: '💎', sfx: 'sparkle',       scaleFrames: 15, yOffset: -0.08 },
        { keyword: 'real',     emoji: '💯', sfx: 'pop',           scaleFrames: 15, yOffset: -0.08 },
      ],
    },
    overlays: [
      // Kept for the legacy renderer that doesn't understand stateMachine yet.
      // Once the compositor is live these become no-ops.
      { kind: 'image-slot', slot: 'ui-screenshot', position: 'center', scale: 1.0, timing: t(5.5, 5) },
      { kind: 'image-slot', slot: 'ui-screenshot', position: 'center', scale: 1.0, timing: t(10.5, { pct: 0.35 }) },
    ],
    examples: ['Cashback app (Benjamin, ArgosEyes style)', 'Reward gaming apps', 'Fintech onboarding', 'Productivity SaaS'],
  },
  // ------------------------------------------------------------------ NEW-B
  {
    id: 'cutaway-to-user',
    name: 'Cutaway to User',
    category: 'trending',
    tagline: 'Talking head, then cutaway shot of someone else using the app.',
    whenToUse: 'Social-proof lift. Character reacts to seeing another person using the app in the wild — cafe, subway, on a couch. Builds "everyone\'s using this" energy without saying it.',
    pipeline: 'ugc+editor',
    durations: [10, 15, 20],
    needsProduct: false,
    needsUI: false,
    needsUserFootage: true,
    needsScript: 'ai',
    audio: 'voiceover',
    captionStyle: 'bubble',
    vibe: 'funny',
    scriptScaffold: {
      hook: 'Wait — that\'s the app I was telling you about.',
      body: 'React to seeing someone else use {product}. Frame it as spotting them in the wild. Explain what they\'re doing on screen, then tie it to why the user should download.',
      cta: '{cta}',
      toneHint: 'surprised, playful, "no way" energy',
    },
    overlays: [
      { kind: 'image-slot', slot: 'user-photo', position: { x: 0.5, y: 0.35 }, scale: 0.85, timing: t(0, 3.5) },
      { kind: 'text', template: 'HEH, SO DO I…', position: { x: 0.6, y: 0.2 }, style: 'bubble', size: 'lg', animation: 'zoom', timing: t(3.5, 2.5) },
    ],
    examples: ['Cafe cashback ad', 'Airport productivity app', 'Gym app spotting'],
  },
  // ------------------------------------------------------------------ NEW-C
  {
    id: 'sticker-callout',
    name: 'Sticker Callout',
    category: 'trending',
    tagline: 'Playful graffiti/sticker text overlays punctuate the talking head.',
    whenToUse: 'When you want energy without changing the setting. Sticker fonts (bright green, neon purple, marker-style) drop at key beats — feels TikTok-native, meme-friendly.',
    pipeline: 'ugc+editor',
    durations: [10, 15, 20],
    needsProduct: false,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'ai',
    audio: 'voiceover',
    captionStyle: 'bubble',
    vibe: 'funny',
    scriptScaffold: {
      hook: 'Okay so I need to tell you about {product}.',
      body: 'Deliver 2-3 sentences with energy. Each key phrase gets a sticker-style word stamped over it — REAL, YES, WAIT, MONEY, etc.',
      cta: '{cta}',
      toneHint: 'high energy, mid-conversation, expressive hands',
    },
    overlays: [
      { kind: 'text', template: 'REAL', position: { x: 0.5, y: 0.35 }, style: 'highlight', size: 'xl', animation: 'zoom', timing: t(pct(0.25), 2) },
      { kind: 'text', template: 'WAIT', position: { x: 0.7, y: 0.25 }, style: 'highlight', size: 'lg', animation: 'zoom', timing: t(pct(0.5), 2) },
      { kind: 'text', template: '{cta}', position: { x: 0.5, y: 0.75 }, style: 'highlight', size: 'xl', animation: 'zoom', timing: t(end(3), 3) },
    ],
    examples: ['App reveal', 'Meme-style testimonial', 'Fast-cut product hype'],
  },
  // ------------------------------------------------------------------ NEW-D
  {
    id: 'reward-reveal',
    name: 'Reward Reveal',
    category: 'product',
    tagline: 'Cashback / rewards apps — big money numbers dominate, character reacts.',
    whenToUse: 'For finance, cashback, gaming-rewards, sweepstakes apps. Money numbers do the selling — the ad exists to show "I actually got paid".',
    pipeline: 'ugc+compositor',
    durations: [10, 15, 20],
    needsProduct: false,
    needsUI: true,
    needsUserFootage: false,
    needsScript: 'ai',
    audio: 'voiceover',
    captionStyle: 'highlight',
    vibe: 'urgent',
    scriptScaffold: {
      hook: 'I just cashed out {amount}. Look.',
      body: 'Show the app UI with the reward number front and center. React with disbelief. Explain briefly how it works. Give one specific detail (how long, what task).',
      cta: 'Download link in bio — {cta}.',
      toneHint: 'excited, slightly disbelieving, real reaction',
    },
    pip: {
      from: { x: 0.5, y: 0.5, scale: 1.0 },
      to:   { x: 0.72, y: 0.82, scale: 0.4 },
      transitionAt: 2,
      transitionDuration: 0.4,
      keyOut: true,
    },
    overlays: [
      { kind: 'image-slot', slot: 'ui-screenshot', position: 'center', scale: 1.0, timing: t(2, { pct: 0.85 }) },
      { kind: 'text', template: '${amount}', position: { x: 0.5, y: 0.35 }, style: 'highlight', size: 'xl', animation: 'zoom', timing: t(3, 4) },
      { kind: 'text', template: '{claim_label}', position: { x: 0.5, y: 0.55 }, style: 'bold-white', size: 'md', animation: 'fade', timing: t(pct(0.5), 3) },
    ],
    examples: ['Cashback app ad', 'Gaming rewards app', 'Sweepstakes app'],
  },
  // ------------------------------------------------------------------ NEW-E
  {
    id: 'testimonial-with-ui',
    name: 'Testimonial + UI',
    category: 'narrative',
    tagline: '"This changed my life" story intercut with real app screens.',
    whenToUse: 'Long-form conversion ad. Character delivers an emotional testimonial while the UI walks through the actual experience in cutaways.',
    pipeline: 'ugc+compositor',
    durations: [20, 30],
    needsProduct: false,
    needsUI: true,
    needsUserFootage: false,
    needsScript: 'user',
    audio: 'voiceover',
    captionStyle: 'caption',
    vibe: 'warm',
    scriptScaffold: {
      hook: 'I\'ve been using {product} for {timeframe} and it\'s changed how I {activity}.',
      body: 'Beat 1: the frustration before (character-focused). Beat 2: how they found {product} (cutaway to UI). Beat 3: the specific change / result (UI + character). Beat 4: what it means for them now.',
      cta: '{cta}',
      toneHint: 'sincere, warm, one small vulnerable detail',
    },
    pip: {
      from: { x: 0.5, y: 0.5, scale: 1.0 },
      to:   { x: 0.75, y: 0.82, scale: 0.4 },
      transitionAt: 6,
      transitionDuration: 0.6,
      keyOut: true,
    },
    overlays: [
      { kind: 'image-slot', slot: 'ui-screenshot', position: 'center', scale: 1.0, timing: t(6, 5) },
      { kind: 'image-slot', slot: 'ui-screenshot', position: 'center', scale: 1.0, timing: t(12, 5) },
      { kind: 'text', template: '{result_metric}', position: { x: 0.5, y: 0.3 }, style: 'highlight', size: 'lg', animation: 'zoom', timing: t(pct(0.65), 4) },
    ],
    examples: ['Fitness app transformation', 'Finance app savings story', 'Productivity app win'],
  },
  // ------------------------------------------------------------------ 45
  {
    id: 'news-anchor',
    name: 'News Anchor',
    category: 'talking-head',
    tagline: 'Character locked in bottom-right; big headline + sub-labels fill the rest.',
    whenToUse: 'Fake-news-broadcast styling — perfect for market takes, product-launch commentary, milestone announcements.',
    pipeline: 'ugc+compositor',
    durations: [10, 15, 20],
    needsProduct: false,
    needsUI: false,
    needsUserFootage: false,
    needsScript: 'ai',
    audio: 'voiceover',
    captionStyle: 'bold-white',
    vibe: 'clinical',
    scriptScaffold: {
      hook: 'Breaking: {headline}.',
      body: 'Deliver the news in 2-3 sentences with anchor precision. Land on the takeaway.',
      cta: '{cta}',
      toneHint: 'measured, broadcast-clean, slight urgency',
    },
    pip: {
      from: { x: 0.75, y: 0.82, scale: 0.4 },
      to:   { x: 0.75, y: 0.82, scale: 0.4 },
      transitionAt: 0,
      transitionDuration: 0,
      keyOut: true,
    },
    overlays: [
      { kind: 'background-swap', slot: 'gradient', color: '#0a1f3d', timing: t(0, { pct: 1 }) },
      { kind: 'text', template: 'BREAKING', position: { x: 0.28, y: 0.15 }, style: 'highlight', size: 'md', animation: 'slide-up', timing: t(0, 3) },
      { kind: 'text', template: '{headline}', position: { x: 0.35, y: 0.35 }, style: 'bold-white', size: 'xl', animation: 'slide-up', timing: t(0.5, { pct: 0.85 }) },
      { kind: 'text', template: '{sub_label}', position: { x: 0.35, y: 0.6 }, style: 'minimal', size: 'md', animation: 'fade', timing: t(pct(0.4), 4) },
    ],
    examples: ['Stock news', 'Product launch announcement', 'Milestone report'],
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
