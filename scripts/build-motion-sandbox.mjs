// Bundles the motion sandbox (motion-sandbox/main.tsx + the kit + Remotion)
// into public/motion-sandbox/. It's a standalone page, not a Next route, so
// it gets none of the app's layout, auth listener or session — it must run
// with an opaque origin inside a sandboxed iframe. Runs before `next dev`
// and `next build`; the output is gitignored.

import { build } from 'esbuild'
import { copyFile, mkdir } from 'node:fs/promises'

const out = 'public/motion-sandbox'
await mkdir(out, { recursive: true })
await build({
  entryPoints: ['motion-sandbox/main.tsx'],
  outfile: `${out}/sandbox.js`,
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2022',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
})
await copyFile('motion-sandbox/index.html', `${out}/index.html`)
console.log('motion sandbox built →', out)
