// Server-render entry for the motion lab: real Chrome, so the full CSS set
// (filters, blur, blend modes, 3D transforms) works. `lab-ad` is aliased to
// motion-lab/runs/<slug>/ad.tsx by lab.mjs.
import { Composition, registerRoot } from 'remotion'
// @ts-expect-error resolved by the bundler alias
import Ad, { durationInFrames } from 'lab-ad'
import { AudioAssetsContext, type AudioAssets } from '../../lib/motion/kit/audio'

type Props = { assets: Record<string, unknown>; audio: AudioAssets }

function Comp({ assets, audio }: Props) {
  return (
    <AudioAssetsContext.Provider value={audio}>
      <Ad assets={assets} />
    </AudioAssetsContext.Provider>
  )
}

registerRoot(() => (
  <Composition id="ad" component={Comp} durationInFrames={durationInFrames} fps={30} width={1080} height={1920}
    defaultProps={{ assets: {}, audio: { music: null, sfx: {} } } as Props} />
))
