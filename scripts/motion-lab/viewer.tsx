// The motion lab's page: plays a hand-written ad (motion-lab/runs/<slug>/ad.tsx)
// with the same compiler, kit, music and effects as the app. With ?stills=…
// or ?render=1 it renders headlessly and posts the results back to lab.mjs.
// Local dev tool only: the code it runs is ours, so it isn't sandboxed.

import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Player } from '@remotion/player'
import { renderMediaOnWeb, renderStillOnWeb } from '@remotion/web-renderer'
import { compileAd, type AdProps, type CompiledAd } from '../../lib/motion/runtime'
import { SFX_NAMES, motionTrack, sfxUrl } from '../../lib/motion/music'

const q = new URLSearchParams(location.search)
const slug = q.get('slug')!
const W = 1080, H = 1920, FPS = 30

async function blobUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null
  const r = await fetch(url)
  return r.ok ? URL.createObjectURL(await r.blob()) : null
}

async function load(): Promise<{ ad: CompiledAd; props: AdProps }> {
  const base = `/motion-lab/runs/${slug}/`
  const brief = await (await fetch(base + 'brief.json')).json()
  const ad = compileAd(await (await fetch(base + 'ad.tsx', { cache: 'no-store' })).text())
  const track = motionTrack(brief.trackKey)
  const [productImage, logo, siteShot, music, ...sfx] = await Promise.all([
    blobUrl(brief.hasProductImage ? base + brief.files.image : null),
    blobUrl(brief.hasLogo ? base + brief.files.logo : null),
    blobUrl(brief.hasSiteShot ? base + brief.files.siteShot : null),
    blobUrl(track?.url),
    ...SFX_NAMES.map(n => blobUrl(sfxUrl(n))),
  ])
  return {
    ad,
    props: {
      assets: { productImage, logo, siteShot },
      audio: {
        music: music && track ? { src: music, offset: track.offset } : null,
        sfx: Object.fromEntries(SFX_NAMES.flatMap((n, i) => (sfx[i] ? [[n, sfx[i]!]] : []))),
      },
    },
  }
}

const post = (path: string, body: BodyInit) => fetch(path, { method: 'POST', body })

async function headless(ad: CompiledAd, props: AdProps) {
  const composition = { id: 'ad', component: ad.Component, durationInFrames: ad.durationInFrames, fps: FPS, width: W, height: H, defaultProps: props }
  const stills = q.get('stills')
  if (stills) {
    const frames = stills === 'auto'
      ? Array.from({ length: 10 }, (_, i) => Math.round((i + 0.5) * ad.durationInFrames / 10))
      : stills.split(',').map(Number)
    for (const frame of frames) {
      const still = await renderStillOnWeb({ composition, inputProps: props, frame, scale: 0.5, licenseKey: 'free-license' })
      await post(`/save?name=still-${String(frame).padStart(3, '0')}.jpg`, await still.blob({ format: 'jpeg', quality: 0.85 }))
    }
  }
  if (q.get('render')) {
    const { getBlob } = await renderMediaOnWeb({ composition, inputProps: props, videoBitrate: 'high', licenseKey: 'free-license' })
    await post('/save?name=ad.mp4', await getBlob())
  }
}

function App() {
  const [state, setState] = useState<{ ad: CompiledAd; props: AdProps } | string | null>(null)
  useEffect(() => {
    const isHeadless = q.has('stills') || q.has('render')
    load()
      .then(async l => {
        setState(l)
        if (isHeadless) { await headless(l.ad, l.props); await post('/done', 'ok') }
      })
      .catch(async err => {
        const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
        setState(msg)
        if (isHeadless) await post('/done', 'ERROR ' + msg)
      })
  }, [])
  if (typeof state === 'string') return <pre style={{ color: '#f88', padding: 16 }}>{state}</pre>
  if (!state) return null
  return (
    <Player
      component={state.ad.Component} inputProps={state.props} durationInFrames={state.ad.durationInFrames}
      fps={FPS} compositionWidth={W} compositionHeight={H}
      acknowledgeRemotionLicense controls loop style={{ height: '100vh', aspectRatio: '9 / 16', margin: '0 auto', display: 'block' }}
    />
  )
}

createRoot(document.getElementById('root')!).render(<App />)
