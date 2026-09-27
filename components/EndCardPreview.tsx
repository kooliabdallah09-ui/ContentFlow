'use client'

// Live preview of the end card in the editor panel. Loaded with
// next/dynamic (ssr: false) — the Player and the font loader are browser-only.

import { Player } from '@remotion/player'
import { EndCard } from '@/components/remotion/EndCard'
import { END_CARD_FPS, END_CARD_FRAMES, END_CARD_SIZE, type EndCardAspect, type EndCardProps } from '@/lib/end-card'

export default function EndCardPreview({ props, aspect }: { props: EndCardProps; aspect: EndCardAspect }) {
  const [w, h] = END_CARD_SIZE[aspect]
  return (
    <Player
      component={EndCard}
      inputProps={props}
      durationInFrames={END_CARD_FRAMES}
      fps={END_CARD_FPS}
      compositionWidth={w}
      compositionHeight={h}
      acknowledgeRemotionLicense
      // Frame 0 is an empty background (everything animates in), so a
      // preview that can't autoplay would look broken. Start on the
      // finished card instead.
      initialFrame={END_CARD_FRAMES - 30}
      autoPlay
      loop
      controls
      clickToPlay
      style={{
        // Capped by height, not width, so a 9:16 card doesn't run 500px tall
        // in the side panel.
        width: '100%',
        maxWidth: Math.round((420 * w) / h),
        aspectRatio: `${w} / ${h}`,
        margin: '0 auto',
        borderRadius: 10,
        overflow: 'hidden',
        border: '1px solid var(--border)',
        background: '#000',
      }}
    />
  )
}
