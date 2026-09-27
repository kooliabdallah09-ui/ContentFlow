// The motion sandbox: runs AI-written ad compositions inside an iframe with
// an opaque origin (sandbox="allow-scripts", no allow-same-origin). It
// previews the ad with the Remotion Player, snapshots stills for the
// model's self-review, and renders the final MP4 with WebCodecs.
//
// Built by scripts/build-motion-sandbox.mjs into public/motion-sandbox/.

import './storage-shim'
import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Player, type PlayerRef } from '@remotion/player'
import { renderMediaOnWeb, renderStillOnWeb } from '@remotion/web-renderer'
import { compileAd, type AdProps, type CompiledAd } from '../lib/motion/runtime'
import type { FromSandbox, SandboxStage, ToSandbox } from '../lib/motion/sandbox-protocol'

type Loaded = { id: string; ad: CompiledAd; width: number; height: number; fps: number; props: AdProps }

function send(msg: FromSandbox) {
  window.parent.postMessage(msg, '*')
}

function errorText(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`
  return String(err)
}

function composition(l: Loaded) {
  return {
    id: 'ad',
    component: l.ad.Component,
    durationInFrames: l.ad.durationInFrames,
    fps: l.fps,
    width: l.width,
    height: l.height,
    defaultProps: l.props,
  }
}

function ErrorReport({ id, error }: { id: string; error: Error }) {
  useEffect(() => { send({ type: 'error', id, stage: 'runtime', message: errorText(error) }) }, [id, error])
  return <div style={{ color: '#fff', font: '14px system-ui', padding: 16 }}>{error.message}</div>
}

function App() {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const current = useRef<Loaded | null>(null)
  const assetUrls = useRef<string[]>([])
  const player = useRef<PlayerRef>(null)

  useEffect(() => {
    const fail = (id: string | null, stage: SandboxStage, err: unknown) => send({ type: 'error', id, stage, message: errorText(err) })

    async function onMessage(e: MessageEvent) {
      if (e.source !== window.parent) return
      const msg = e.data as ToSandbox

      if (msg.type === 'load') {
        try {
          const ad = compileAd(msg.code)
          assetUrls.current.forEach(u => URL.revokeObjectURL(u))
          assetUrls.current = []
          const toUrl = (b?: Blob | null) => {
            if (!b) return null
            const u = URL.createObjectURL(b)
            assetUrls.current.push(u)
            return u
          }
          const next: Loaded = {
            id: msg.id, ad, width: msg.width, height: msg.height, fps: msg.fps,
            props: { assets: { productImage: toUrl(msg.assets.productImage), logo: toUrl(msg.assets.logo) } },
          }
          current.current = next
          setLoaded(next)
          send({ type: 'loaded', id: msg.id, durationInFrames: ad.durationInFrames })
        } catch (err) {
          fail(msg.id, 'compile', err)
        }
        return
      }

      if (msg.type === 'seek') {
        player.current?.pause()
        player.current?.seekTo(msg.frame)
        return
      }

      const l = current.current
      if (!l || l.id !== msg.id) {
        fail(msg.id, msg.type === 'stills' ? 'stills' : 'render', new Error('No ad loaded with that id'))
        return
      }

      if (msg.type === 'stills') {
        try {
          const images: Blob[] = []
          for (const frame of msg.frames) {
            const still = await renderStillOnWeb({
              composition: composition(l), inputProps: l.props, frame,
              scale: msg.scale ?? 0.5, licenseKey: 'free-license',
            })
            images.push(await still.blob({ format: 'jpeg', quality: 0.85 }))
          }
          send({ type: 'stills', id: msg.id, images })
        } catch (err) {
          fail(msg.id, 'stills', err)
        }
        return
      }

      if (msg.type === 'render') {
        try {
          const { getBlob } = await renderMediaOnWeb({
            composition: composition(l), inputProps: l.props,
            muted: true, videoBitrate: 'high', licenseKey: 'free-license',
            onProgress: p => send({ type: 'progress', id: msg.id, progress: p.progress }),
          })
          send({ type: 'rendered', id: msg.id, video: await getBlob() })
        } catch (err) {
          fail(msg.id, 'render', err)
        }
      }
    }

    window.addEventListener('message', onMessage)
    send({ type: 'ready' })
    return () => window.removeEventListener('message', onMessage)
  }, [])

  if (!loaded) return null
  return (
    <Player
      key={loaded.id}
      ref={player}
      component={loaded.ad.Component}
      inputProps={loaded.props}
      durationInFrames={loaded.ad.durationInFrames}
      fps={loaded.fps}
      compositionWidth={loaded.width}
      compositionHeight={loaded.height}
      acknowledgeRemotionLicense
      controls
      loop
      autoPlay
      style={{ width: '100%', height: '100%' }}
      errorFallback={({ error }) => <ErrorReport id={loaded.id} error={error} />}
    />
  )
}

createRoot(document.getElementById('root')!).render(<App />)
