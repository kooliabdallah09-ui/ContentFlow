// Messages between the app and the motion sandbox iframe
// (public/motion-sandbox/, built from motion-sandbox/main.tsx).
//
// The iframe is sandboxed without allow-same-origin, so it has an opaque
// origin: AI-written ad code runs there with no access to the app's
// session, cookies or storage. Assets cross as Blobs, videos and stills
// come back as Blobs.

import type { SfxName } from './music'

export type SandboxAssets = {
  productImage?: Blob | null
  logo?: Blob | null
  siteShot?: Blob | null
  music?: { blob: Blob; offset: number } | null
  sfx?: Partial<Record<SfxName, Blob>>
}

export type ToSandbox =
  | { type: 'load'; id: string; code: string; width: number; height: number; fps: number; assets: SandboxAssets }
  | { type: 'seek'; frame: number }
  | { type: 'stills'; id: string; frames: number[]; scale?: number }
  | { type: 'render'; id: string }

export type SandboxStage = 'compile' | 'runtime' | 'stills' | 'render'

export type FromSandbox =
  | { type: 'ready' }
  | { type: 'loaded'; id: string; durationInFrames: number }
  | { type: 'stills'; id: string; images: Blob[] }
  | { type: 'progress'; id: string; progress: number }
  | { type: 'rendered'; id: string; video: Blob }
  | { type: 'error'; id: string | null; stage: SandboxStage; message: string }
