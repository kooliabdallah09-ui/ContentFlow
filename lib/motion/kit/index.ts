// The motion kit: everything an AI-written ad composition may import from
// '@motion-kit'. Keep lib/motion/kit-docs.ts in step with these exports —
// it's the model's only reference for them.

export { FONT, INK, PAPER, COLORS, color, tint, useUnit, type KitColor } from './theme'
export { pop, glide, ease, Pop, Float, Shake, Camera } from './anim'
export { Character, type CharacterShape, type Expression, type Mark } from './Character'
export {
  Stage, AppWindow, ChatInput, SpeechBubble, RankBadge, RaceBar, raceBarTip,
  Slider, sliderKnobX, Rope, Pill, Ground, Podium, podiumSpots,
} from './ui'
export { Confetti, Burst, Banner, Caption, ProductShot, SiteShot, CtaButton, Logo, Counter, Checklist, PhoneFrame } from './fx'
export { Music, Sfx } from './audio'
