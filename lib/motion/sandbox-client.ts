// App-side handle on the motion sandbox iframe: load an AI-written ad,
// snapshot stills for self-review, render the MP4. Browser-only.

import type { FromSandbox, SandboxAssets, ToSandbox } from './sandbox-protocol'

type Pending = { resolve: (value: FromSandbox) => void; reject: (err: Error) => void }

export class MotionSandbox {
  readonly iframe: HTMLIFrameElement
  private readonly ready: Promise<void>
  private readonly pending = new Map<string, Pending>()
  private readonly progress = new Map<string, (p: number) => void>()
  private runtimeErrorHandler: ((message: string) => void) | null = null
  private seq = 0

  constructor(container: HTMLElement) {
    const iframe = document.createElement('iframe')
    // allow-scripts only: an opaque origin, so ad code can't touch the app's
    // cookies, storage or DOM, can't navigate the page, open popups or submit forms.
    iframe.setAttribute('sandbox', 'allow-scripts')
    iframe.src = '/motion-sandbox/index.html'
    iframe.style.cssText = 'width:100%;height:100%;border:0;display:block;background:#111'
    container.appendChild(iframe)
    this.iframe = iframe
    this.ready = new Promise(resolve => { this.onReady = resolve })
    window.addEventListener('message', this.onMessage)
  }

  private onReady: () => void = () => {}

  private onMessage = (e: MessageEvent) => {
    if (e.source !== this.iframe.contentWindow) return
    const msg = e.data as FromSandbox
    if (msg.type === 'ready') { this.onReady(); return }
    if (msg.type === 'progress') { this.progress.get(msg.id)?.(msg.progress); return }
    if (msg.type === 'error' && msg.stage === 'runtime' && !this.pending.has(msg.id ?? '')) {
      this.runtimeErrorHandler?.(msg.message)
      return
    }
    const id = 'id' in msg ? msg.id : null
    const waiter = id ? this.pending.get(id) : undefined
    if (!id || !waiter) return
    this.pending.delete(id)
    this.progress.delete(id)
    if (msg.type === 'error') waiter.reject(new Error(`[${msg.stage}] ${msg.message}`))
    else waiter.resolve(msg)
  }

  private async request(msg: ToSandbox & { id: string }): Promise<FromSandbox> {
    await this.ready
    return new Promise((resolve, reject) => {
      this.pending.set(msg.id, { resolve, reject })
      this.iframe.contentWindow?.postMessage(msg, '*')
    })
  }

  /** Called when the loaded ad throws while playing in the preview. */
  onRuntimeError(handler: (message: string) => void) {
    this.runtimeErrorHandler = handler
  }

  /** Compiles and previews an ad. Resolves with its id and length; rejects with the compile error. */
  async load(code: string, opts: { width: number; height: number; fps?: number; assets?: SandboxAssets }) {
    const id = `ad-${++this.seq}`
    const res = await this.request({ type: 'load', id, code, width: opts.width, height: opts.height, fps: opts.fps ?? 30, assets: opts.assets ?? {} })
    if (res.type !== 'loaded') throw new Error('Unexpected sandbox reply')
    return { id, durationInFrames: res.durationInFrames }
  }

  async stills(id: string, frames: number[], scale = 0.5): Promise<Blob[]> {
    const res = await this.request({ type: 'stills', id, frames, scale })
    if (res.type !== 'stills') throw new Error('Unexpected sandbox reply')
    return res.images
  }

  async render(id: string, onProgress?: (progress: number) => void): Promise<Blob> {
    if (onProgress) this.progress.set(id, onProgress)
    const res = await this.request({ type: 'render', id })
    if (res.type !== 'rendered') throw new Error('Unexpected sandbox reply')
    return res.video
  }

  seek(frame: number) {
    this.iframe.contentWindow?.postMessage({ type: 'seek', frame } satisfies ToSandbox, '*')
  }

  destroy() {
    window.removeEventListener('message', this.onMessage)
    for (const p of this.pending.values()) p.reject(new Error('Sandbox closed'))
    this.pending.clear()
    this.iframe.remove()
  }
}
