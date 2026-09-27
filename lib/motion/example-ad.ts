// A complete ad written with the motion kit. It goes into the writer's
// system prompt as the reference for style, pacing and API use (the story
// itself is not to be copied), and doubles as the kit's smoke test: it must
// always compile and render in the sandbox.
//
// Written as plain strings (no template literals) so it can live inside one.

export const EXAMPLE_AD = `import { Sequence, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import {
  Stage, AppWindow, ChatInput, SpeechBubble, Character, RaceBar, raceBarTip,
  Burst, Ground, Podium, podiumSpots, Confetti, Caption, ProductShot, CtaButton, Logo, Shake, ease,
} from '@motion-kit'

export const durationInFrames = 360

type Assets = { productImage?: string | null; logo?: string | null }
const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

// 0-90: the problem, acted out inside a notes app.
function Lost() {
  const frame = useCurrentFrame()
  const { width: W, height: H } = useVideoConfig()
  const winW = W * 0.88
  const winH = 1300
  return (
    <AppWindow x={W / 2} y={H * 0.44} width={winW} height={winH} title="notes (847)" at={0}>
      <SpeechBubble x={winW * 0.56} y={220} text="where's my idea??" at={20} tail="down-left" size={60} />
      <SpeechBubble x={winW * 0.6} y={440} text="it was RIGHT here" at={50} tail="down-left" size={48} />
      <Character
        shape="triangle" color="coral" size={300} x={240} y={winH - 480} seed={1}
        expression={frame < 42 ? 'neutral' : 'shocked'} mark={frame < 42 ? null : 'sweat'}
      />
      <ChatInput x={winW / 2} y={winH - 150} width={winW - 80} text="search: that one idea" progress={ease(frame, [8, 56], [0, 1])} />
    </AppWindow>
  )
}

// 90-190: the cost, as a leaderboard nobody wants to win.
function Week() {
  const frame = useCurrentFrame()
  const { width: W, height: H } = useVideoConfig()
  const winW = W * 0.9
  const barW = winW - 90
  const grow = (to: number, at: number) => to * ease(frame, [at, at + 45], [0, 1])
  const bars = [
    { label: 'scrolling', color: 'coral', value: grow(0.92, 8) },
    { label: 'searching', color: 'yellow', value: grow(0.74, 14) },
    { label: 'actually writing', color: 'teal', value: grow(0.14, 20) },
  ]
  return (
    <>
      <Caption x={W / 2} y={H * 0.12} text={'Where your\\nweek went'} highlight={['week']} size={100} at={0} />
      <AppWindow x={W / 2} y={H * 0.51} width={winW} height={1040} title="Screen time" badge="live" at={4}>
        {bars.map((b, i) => (
          <RaceBar key={b.label} x={winW / 2} y={250 + i * 270} width={barW} value={b.value} color={b.color} rank={i + 1} label={b.label} height={84} />
        ))}
        <Character
          shape="triangle" color="coral" size={150} anchor="bottom" bob={0} seed={1}
          x={raceBarTip(winW / 2, barW, bars[0].value, true, 84) - 60} y={250 - 42}
          expression={frame < 55 ? 'shocked' : 'dizzy'} mark={frame < 55 ? '!!' : 'stars'}
        />
      </AppWindow>
    </>
  )
}

// 190-280: the product shows up and wins.
function Found() {
  const frame = useCurrentFrame()
  const { width: W, height: H } = useVideoConfig()
  const ground = H * 0.74
  const spots = podiumSpots(W / 2, ground, 780)
  const enterX = interpolate(frame, [0, 22], [W + 160, W * 0.78], CLAMP)
  const hop = interpolate(frame, [40, 54], [0, 1], CLAMP)
  const x = frame < 40 ? enterX : interpolate(hop, [0, 1], [W * 0.78, spots.first.x])
  const y = interpolate(hop, [0, 1], [ground, spots.first.y]) - Math.sin(hop * Math.PI) * 200
  const landing = frame >= 54 && frame < 62 ? (1 - (frame - 54) / 8) * 0.7 : 0
  return (
    <>
      <Ground y={ground} />
      <Podium x={W / 2} y={ground} width={780} />
      <Shake at={20} duration={14}>
        <Burst x={W / 2} y={ground - 860} text="FOUND IT!" size={500} at={18} />
      </Shake>
      <Character
        shape="triangle" color="coral" size={230} anchor="bottom" x={spots.second.x} y={spots.second.y} seed={1}
        expression={frame < 30 ? 'shocked' : 'love'} mark={frame < 30 ? '?!' : 'hearts'}
      />
      <Character shape="robot" color="teal" size={270} anchor="bottom" x={x} y={y} expression="happy" crown={frame > 58} squash={landing} bob={frame < 62 ? 0 : 4} seed={3} />
      <Confetti at={58} />
    </>
  )
}

// 280-360: the offer and the button.
function Offer({ assets }: { assets: Assets }) {
  const { width: W, height: H } = useVideoConfig()
  return (
    <>
      <Caption x={W / 2} y={H * 0.13} text={'Every idea.\\nOne search away.'} highlight={['one']} size={104} at={0} />
      {assets.productImage
        ? <ProductShot x={W / 2} y={H * 0.41} src={assets.productImage} size={680} at={8} />
        : <Character shape="robot" color="teal" size={420} x={W / 2} y={H * 0.41} expression="wink" crown />}
      <Logo x={W / 2} y={H * 0.63} src={assets.logo} text="Pagely" size={160} at={16} />
      <CtaButton x={W / 2} y={H * 0.735} text="Try it free" color="coral" at={24} pressAt={56} size={70} />
    </>
  )
}

export default function Ad({ assets }: { assets: Assets }) {
  return (
    <Stage>
      <Sequence durationInFrames={90}><Lost /></Sequence>
      <Sequence from={90} durationInFrames={100}><Week /></Sequence>
      <Sequence from={190} durationInFrames={90}><Found /></Sequence>
      <Sequence from={280}><Offer assets={assets} /></Sequence>
    </Stage>
  )
}
`
