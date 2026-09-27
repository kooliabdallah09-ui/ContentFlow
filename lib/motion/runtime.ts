// Compiles an AI-written ad (a TSX module, as a string) into a component.
// Browser-only, and only ever run inside the motion sandbox iframe
// (motion-sandbox/main.tsx) — the code is model output, so it gets an opaque
// origin with no access to the app's session, cookies or storage.

import * as React from 'react'
import * as Remotion from 'remotion'
import { transform } from 'sucrase'
import * as Kit from './kit'

export type AdAssets = { productImage?: string | null; logo?: string | null }
export type AdProps = { assets: AdAssets }
export type CompiledAd = { Component: React.ComponentType<AdProps>; durationInFrames: number }

// The only modules an ad may import. Namespace objects are rebuilt as plain
// objects flagged __esModule so sucrase's interop helpers treat them as ES
// modules (default import of React included).
const MODULES: Record<string, unknown> = {
  react: { __esModule: true, default: React, ...React },
  remotion: { __esModule: true, ...Remotion },
  '@motion-kit': { __esModule: true, ...Kit },
}

// Remotion renders frames out of order and more than once, so an ad that
// calls Math.random() would flicker. The prompt forbids it; this makes it
// harmless anyway by handing the ad a seeded stand-in.
function seededMath(): Math {
  let s = 0x2f6b1d
  return Object.create(Math, {
    random: {
      value: () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff
        return s / 0x7fffffff
      },
    },
  })
}

export function compileAd(source: string): CompiledAd {
  const { code } = transform(source, {
    transforms: ['typescript', 'jsx', 'imports'],
    jsxRuntime: 'classic',
    production: true,
  })
  const mod = { exports: {} as Record<string, unknown> }
  const require = (name: string) => {
    if (name in MODULES) return MODULES[name]
    throw new Error(`Import "${name}" isn't available. Only react, remotion and @motion-kit can be imported.`)
  }
  new Function('require', 'module', 'exports', 'React', 'Math', code)(require, mod, mod.exports, React, seededMath())

  const Component = mod.exports.default
  if (typeof Component !== 'function') throw new Error('The ad must `export default` its component.')
  const duration = Number(mod.exports.durationInFrames)
  if (!Number.isFinite(duration) || duration < 60 || duration > 1800) {
    throw new Error('The ad must `export const durationInFrames` between 60 and 1800.')
  }
  return { Component: Component as React.ComponentType<AdProps>, durationInFrames: Math.round(duration) }
}
