// Sound for motion ads: the soundtrack and one-shot effects. The audio
// files are handed to the sandbox as blobs and reach these components
// through context (see runtime.ts), so ad code only names them.

import { createContext, useContext } from 'react'
import { Sequence, interpolate, useVideoConfig } from 'remotion'
import { Audio } from '@remotion/media'
import type { SfxName } from '../music'

export type AudioAssets = {
  music: { src: string; offset: number } | null
  sfx: Partial<Record<SfxName, string>>
}

export const AudioAssetsContext = createContext<AudioAssets>({ music: null, sfx: {} })

const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

/** The ad's soundtrack, started at the track's offset and faded in and out. Use exactly one, inside the Stage. */
export function Music({ volume = 0.55, fadeIn = 6, fadeOut = 36 }: { volume?: number; fadeIn?: number; fadeOut?: number }) {
  const { music } = useContext(AudioAssetsContext)
  const { fps, durationInFrames } = useVideoConfig()
  if (!music) return null
  return (
    <Audio
      src={music.src}
      trimBefore={Math.round(music.offset * fps)}
      volume={f => volume
        * interpolate(f, [0, fadeIn], [0, 1], CLAMP)
        * interpolate(f, [durationInFrames - fadeOut, durationInFrames], [1, 0], CLAMP)}
    />
  )
}

// Per-sound gain so the effects sit under the music rather than on top of
// it; the ad's `volume` scales from here.
const GAIN: Record<SfxName, number> = {
  click: 0.6, pop: 0.7, switch: 0.45, whoosh: 0.5, tick: 0.5, type: 0.3,
  impact: 0.75, bonk: 0.8, success: 0.5, bong: 0.55, error: 0.45, glitch: 0.35,
}

/** A one-shot sound effect at frame `at` (relative to the enclosing Sequence). */
export function Sfx({ name, at, volume = 1 }: { name: SfxName; at: number; volume?: number }) {
  const { sfx } = useContext(AudioAssetsContext)
  const src = sfx[name]
  if (!src) return null
  return (
    <Sequence from={Math.round(at)} durationInFrames={60} layout="none">
      <Audio src={src} volume={GAIN[name] * volume} />
    </Sequence>
  )
}
