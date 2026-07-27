// Scroll-stop hooks — a curated library of 20 attention-grabbing openers
// that render as a short (1.5s target — Seedance floors at 3s) clip
// stitched BEFORE the main talking-head UGC video. Admin-gated in v1
// via lib/pov-access.ts.
//
// Each hook's `frame` is the first-frame prompt for Nano Banana Pro:
// it MUST bind to the chosen influencer identity refs (portrait +
// character sheet + recent photos) so the person in the hook IS the
// same person who talks in the main clip. Where the hook features the
// product (catch, sky-drop, hand-materialize, pull-from-nowhere,
// product-wall), the frame also binds to the product reference image.
//
// The `motion` prompt drives Seedance 2.0 for the ~1.5s clip. `sfx`
// is a short audio cue that gets folded into the Seedance prompt
// (Seedance 2.0 has native audio).

export type HookCategory = 'entry' | 'object' | 'environmental' | 'meta'

export interface ScrollStopHook {
  key: string
  label: string
  tagline: string
  category: HookCategory
  frame: string
  motion: string
  featuresProduct: boolean
  disabledForFormats?: string[]
  sfx: string
}

// POV / interview / vlog formats where the camera IS a character — a
// scroll-stop hook that shows the avatar arriving from off-frame would
// break the fourth wall in the wrong direction.
const POV_DISABLED = ['interview-pov', 'interview-man-on-street', 'pov-vlog', 'camera-pov']

export const SCROLL_STOP_HOOKS: ScrollStopHook[] = [
  // ── Entry (character arrives) ──────────────────────────────────────
  {
    key: 'ceiling-drop',
    label: 'Ceiling Drop',
    tagline: 'Character falls into frame from above, hair whipping upward.',
    category: 'entry',
    frame:
      'The exact person from the reference images, caught mid-fall entering the top of the frame from above. Hair and loose clothing whipping UPWARD from the downward motion. Wide-eyed alert expression. Feet just entering top edge, head roughly centre-frame. Motion blur streaks on hair tips. Same scene as the main clip so the environment matches.',
    motion:
      'Character drops straight down through frame from the top. Body decelerates as feet plant on the ground in the last third. Camera holds steady. Hair and clothes settle. Fast, sharp landing energy.',
    featuresProduct: false,
    disabledForFormats: POV_DISABLED,
    sfx: 'quick whoosh followed by a soft ground-thud on landing',
  },
  {
    key: 'warp-zoom',
    label: 'Warp Zoom',
    tagline: 'Camera streaks in from far away and snaps to the face.',
    category: 'entry',
    frame:
      'The exact person from the reference images, small in the distance at the vanishing point of a long corridor / street / hallway, looking straight into the lens. Radial motion streaks around the edges of the frame implying the camera is rocketing toward them.',
    motion:
      'Extreme dolly-in / warp-speed zoom from far away straight to the character\'s face. Motion streaks blur past the edges. The last 20% of the clip snaps to a steady tight close-up on the face.',
    featuresProduct: false,
    disabledForFormats: POV_DISABLED,
    sfx: 'rising whoosh building to a sharp impact click as the zoom lands',
  },
  {
    key: 'portal-step',
    label: 'Portal Step',
    tagline: 'A glowing rectangular portal in the scene; character steps through.',
    category: 'entry',
    frame:
      'The exact person from the reference images, mid-stride stepping THROUGH a glowing rectangular portal that hangs vertically in the middle of the scene. One leg and shoulder already through on the near side, the rest still on the far side of the portal. Cool cyan/white rim light around the portal edge spilling onto the character\'s face and body.',
    motion:
      'Character completes the step through the portal into the scene. Portal edge glow flares briefly then the portal shrinks and pops out of existence behind them. Character finishes standing upright, facing camera.',
    featuresProduct: false,
    disabledForFormats: POV_DISABLED,
    sfx: 'shimmering electric hum with a soft pop as the portal closes',
  },
  {
    key: 'slide-in',
    label: 'Slide In',
    tagline: 'Character rockets in from the side with motion blur behind.',
    category: 'entry',
    frame:
      'The exact person from the reference images, mid-motion sliding into frame from the right edge, body angled forward into the slide, motion blur streaking off the trailing side. Feet not fully planted, weight shifting.',
    motion:
      'Character slides in horizontally from off-frame right, decelerating to a planted stance centre-frame. Motion blur dissolves as they stop. Small hair bounce settle on the stop.',
    featuresProduct: false,
    disabledForFormats: POV_DISABLED,
    sfx: 'quick horizontal whoosh with a scuff-stop at the end',
  },
  {
    key: 'rise-up',
    label: 'Rise Up',
    tagline: 'Head and shoulders rise into frame from behind a surface.',
    category: 'entry',
    frame:
      'The exact person from the reference images, only the top of the head just cresting into the bottom of the frame from behind a counter / desk / low wall. Eyes not yet visible. The surface they\'re rising behind is clearly part of the main-clip scene.',
    motion:
      'Character rises steadily from behind the surface until their head and upper chest are fully in frame. On the way up, their eyes lock to camera and they hold. Slight tilt-up as they settle.',
    featuresProduct: false,
    disabledForFormats: POV_DISABLED,
    sfx: 'a soft rising synth swell that resolves as their eyes meet the lens',
  },
  {
    key: 'materialize',
    label: 'Materialize',
    tagline: 'Glitch/smoke poof; the character forms out of the effect.',
    category: 'entry',
    frame:
      'The exact person from the reference images, partially formed inside a swirl of pixelated glitch fragments and soft smoke. Half the body clearly rendered, the other half still resolving into scattered particles. Standing centre-frame in the main scene.',
    motion:
      'Particles and glitch fragments swirl inward and coalesce into the fully-formed character. The last 30% of the clip is the character fully resolved and steady, taking a small breath.',
    featuresProduct: false,
    disabledForFormats: POV_DISABLED,
    sfx: 'a granular digital shimmer resolving to a clean silent breath',
  },
  {
    key: 'backwards-walk',
    label: 'Backwards Walk',
    tagline: 'Character mid-stride, facing away; camera watches their back.',
    category: 'entry',
    frame:
      'The exact person from the reference images, seen from behind, mid-stride walking away from camera into the scene. One foot lifted, arms in a natural walking swing. Same outfit and hair as the identity reference.',
    motion:
      'Character keeps walking away for the first half, then stops and turns their head over one shoulder toward the camera in the last third. Eyes lock to camera on the turn.',
    featuresProduct: false,
    disabledForFormats: POV_DISABLED,
    sfx: 'soft footsteps ending on a single beat as they turn',
  },

  // ── Object (something arrives) ─────────────────────────────────────
  {
    key: 'catch',
    label: 'The Catch',
    tagline: 'Product mid-air, about to land in the character\'s hand.',
    category: 'object',
    frame:
      'The exact person from the reference images, arm raised, palm open toward the sky, eyes tracking upward. The product (from the product reference image, preserved exactly — same shape, colours, label, proportions) is suspended mid-air just above the open hand, about to be caught. Slight motion blur on the falling product.',
    motion:
      'The product completes its fall and lands cleanly in the character\'s palm. Fingers close around it. Character brings the product down to chest height, eyes now on the product then flicking to camera.',
    featuresProduct: true,
    disabledForFormats: POV_DISABLED,
    sfx: 'a soft whistle drop followed by a satisfying palm-catch slap',
  },
  {
    key: 'sky-drop',
    label: 'Sky Drop',
    tagline: 'Product plummets straight down; character\'s palm ready.',
    category: 'object',
    frame:
      'The exact person from the reference images, looking straight up, mouth slightly open, one palm held flat and steady at chest height. The product (from the product reference image, preserved exactly) is higher in the frame directly above the palm, falling toward it, still some distance to travel.',
    motion:
      'The product falls the remaining distance and lands squarely in the palm. Character\'s eyes drop from the sky to the product on impact. Small settling bounce.',
    featuresProduct: true,
    disabledForFormats: POV_DISABLED,
    sfx: 'a rushing falling-object whoosh with a firm palm impact',
  },
  {
    key: 'hand-materialize',
    label: 'Hand Materialize',
    tagline: 'Smoke/light burst in a fist; the product emerges.',
    category: 'object',
    frame:
      'The exact person from the reference images, one fist held forward toward the camera at chest height, a burst of soft white light and thin smoke enveloping the fist. The product (from the product reference image, preserved exactly) is half-emerged from the smoke, held in the hand.',
    motion:
      'The smoke and light dissipate outward and clear away, revealing the product held clean and steady in the character\'s hand. Character\'s eyes flick from the product to the camera.',
    featuresProduct: true,
    disabledForFormats: POV_DISABLED,
    sfx: 'a soft magical shimmer resolving to a clean silence',
  },
  {
    key: 'pull-from-nowhere',
    label: 'Pull From Nowhere',
    tagline: 'Arm reaches off-frame; product is yanked halfway into view.',
    category: 'object',
    frame:
      'The exact person from the reference images, one arm reaching off-frame to the side (past the edge), body turned slightly toward the reach. The product (from the product reference image, preserved exactly) is half-visible being pulled INTO frame at the edge where the arm exits, as if pulled out of thin air.',
    motion:
      'Character finishes yanking the product fully into frame, swinging it around to chest-height presentation toward camera. Head follows the motion, ending on eyes-to-lens.',
    featuresProduct: true,
    disabledForFormats: POV_DISABLED,
    sfx: 'a snappy pull-swoosh with a small snap on presentation',
  },
  {
    key: 'confetti-burst',
    label: 'Confetti Burst',
    tagline: 'Confetti explodes; character partially revealed inside.',
    category: 'object',
    frame:
      'The exact person from the reference images, partially obscured inside a fresh mid-air confetti and powder explosion. Colourful paper flakes and fine powder frozen in the moment of maximum spread. Half the character\'s face and upper body clearly visible through the debris.',
    motion:
      'Confetti and powder fall and clear from around the character, revealing them fully in the last third. Character breaks into a subtle smile or smirk as the debris settles.',
    featuresProduct: false,
    disabledForFormats: POV_DISABLED,
    sfx: 'a sharp party-popper burst followed by paper flutter',
  },
  {
    key: 'product-wall',
    label: 'Product Wall',
    tagline: 'Stack of branded boxes crashes down around the character.',
    category: 'object',
    frame:
      'The exact person from the reference images, standing centre-frame, arms slightly raised in mild surprise, a stack of branded boxes / units of the product (from the product reference image, preserving label + colours + packaging exactly) mid-tumble around them — some still stacked behind, some frozen in the air, some already on the ground at their feet.',
    motion:
      'The remaining airborne boxes complete their fall and land around the character. Dust puff on the last impact. Character straightens up, looks at the pile, then flicks eyes to camera with a raised eyebrow.',
    featuresProduct: true,
    disabledForFormats: POV_DISABLED,
    sfx: 'a cascade of cardboard thuds ending on a single settling drop',
  },

  // ── Environmental ──────────────────────────────────────────────────
  {
    key: 'lights-snap',
    label: 'Lights Snap',
    tagline: 'Dark scene; a single key light snaps onto the face.',
    category: 'environmental',
    frame:
      'The exact person from the reference images, standing in a nearly black scene, only the very faint outline of their silhouette visible from ambient light. A single hard key light is JUST beginning to hit the side of their face — bright rim on one cheekbone and eye, the rest still in shadow.',
    motion:
      'The key light snaps fully on across the character\'s face, revealing them completely. Slight pupil constriction and a small confident chin-tilt into the light. Background stays dark.',
    featuresProduct: false,
    disabledForFormats: POV_DISABLED,
    sfx: 'a soft electric click-thunk as the light hits',
  },
  {
    key: 'paint-splash',
    label: 'Paint Splash',
    tagline: 'Paint mid-splatter; character emerges from behind it.',
    category: 'environmental',
    frame:
      'The exact person from the reference images, partially behind a mid-air splatter of thick colourful paint / liquid frozen in motion across the frame. Droplets and ribbons of paint suspended mid-splash. The character\'s face is visible in the gaps between splatter arcs.',
    motion:
      'The paint completes its splatter arc, ribbons falling out of frame and droplets landing on unseen ground. Character steps forward one small step, now fully visible, and locks eyes with camera.',
    featuresProduct: false,
    disabledForFormats: POV_DISABLED,
    sfx: 'a wet splash-slap tapering into liquid drips',
  },
  {
    key: 'fisheye-whip',
    label: 'Fisheye Whip',
    tagline: 'Fisheye lens whip-pan mid-motion; character in the arc.',
    category: 'environmental',
    frame:
      'The exact person from the reference images, captured in a fisheye lens perspective with strong barrel distortion, environment curved around them. Frame is caught mid-whip-pan — one side of the frame streaked with motion blur, the character just entering the sharp-focus centre of the arc.',
    motion:
      'The whip-pan completes and settles on the character in the centre of the fisheye frame, in sharp focus, holding a confident look at camera. Motion blur clears.',
    featuresProduct: false,
    disabledForFormats: POV_DISABLED,
    sfx: 'a fast whip-pan whoosh landing on a beat',
  },
  {
    key: 'world-rotate',
    label: 'World Rotate',
    tagline: 'Background rotates diagonally; character stays still.',
    category: 'environmental',
    frame:
      'The exact person from the reference images, standing perfectly upright and static in centre-frame. The background scene is tilted about 25 degrees off-axis, mid-rotation, as if the whole world is spinning around the character. Character\'s clothing and hair are unaffected by the rotation.',
    motion:
      'The background completes its rotation back to a level horizon over the course of the clip. Character stays perfectly still and steady, eyes on camera. World settles on the level.',
    featuresProduct: false,
    disabledForFormats: POV_DISABLED,
    sfx: 'a low whooshing wind that fades as the world levels',
  },
  {
    key: 'freeze-zoom',
    label: 'Freeze Zoom',
    tagline: 'Extreme close-up on a wide-eyed frozen expression.',
    category: 'environmental',
    frame:
      'The exact person from the reference images, extreme close-up on their face filling the frame, eyes wide, brows lifted in a caught-in-the-moment shocked expression, mouth slightly open. Sharp focus on the eyes. Very shallow depth of field.',
    motion:
      'A subtle push-in on the face for the first half. Character\'s expression softens from shock into a knowing half-smirk as they exhale. Camera holds tight on the face.',
    featuresProduct: false,
    disabledForFormats: POV_DISABLED,
    sfx: 'a sharp cinematic hit followed by a low sustained tone',
  },

  // ── Meta ───────────────────────────────────────────────────────────
  {
    key: 'caught-filming',
    label: 'Caught Filming',
    tagline: 'Character looks off then registers the camera is rolling.',
    category: 'meta',
    frame:
      'The exact person from the reference images, in the main-clip scene, looking off to the side (not at the lens), mid-natural moment — maybe adjusting hair or looking at something off-frame. Body language is unposed, unguarded.',
    motion:
      'Character\'s eyes snap to the lens as they register the camera is on, expression flickering from unaware to a quick amused smirk. Slight shoulder square-up toward camera at the end.',
    featuresProduct: false,
    disabledForFormats: POV_DISABLED,
    sfx: 'ambient room tone with a subtle beat on the eye-flick',
  },
  {
    key: 'mid-conversation',
    label: 'Mid-Conversation',
    tagline: 'Character mid-gesture, mouth open — as if you tuned in late.',
    category: 'meta',
    frame:
      'The exact person from the reference images, caught mid-gesture with one hand raised in a talking motion, mouth open mid-word, eyes engaged and animated as if in the middle of an important point. Feels like a screenshot pulled from the middle of an ongoing conversation.',
    motion:
      'Character finishes the sentence and gesture — hand lands, mouth closes on a beat, then a small nod as if landing the point. Eyes stay on the lens throughout.',
    featuresProduct: false,
    disabledForFormats: POV_DISABLED,
    sfx: 'natural conversational room tone with a subtle emphatic breath',
  },
]

export function getScrollStopHook(key: string): ScrollStopHook | undefined {
  return SCROLL_STOP_HOOKS.find(h => h.key === key)
}

// Convenience: is this hook allowed for the given format key?
export function isHookAllowedForFormat(hook: ScrollStopHook, formatKey: string | null | undefined): boolean {
  if (!formatKey) return true
  return !(hook.disabledForFormats?.includes(formatKey))
}
