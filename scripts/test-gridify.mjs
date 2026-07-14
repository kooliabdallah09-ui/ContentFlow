#!/usr/bin/env node
// Quick standalone tester for lib/gridify.ts.
//
// Usage:
//   node scripts/test-gridify.mjs <input.jpg> [attempt]
//
// Examples:
//   node scripts/test-gridify.mjs public/actors/maya.jpg
//   node scripts/test-gridify.mjs ~/Downloads/photo.jpg 3       // attempt 3 params
//   node scripts/test-gridify.mjs ~/Downloads/photo.jpg all     // one output per retry-ladder attempt
//
// Outputs go to ./output/gridify/ so you can eyeball them before wiring
// gridify into the Seedance pipeline. Nothing is uploaded, no API is called.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'output', 'gridify')

// Inline copy of the retry ladder + gridify() — kept in sync with lib/gridify.ts.
// (Duplicated so this script has no ts / import build step.)
const GRID_RETRIES = [
  { cols: 7,  rows: 10, gap: 18 },
  { cols: 8,  rows: 10, gap: 16 },
  { cols: 6,  rows: 10, gap: 20 },
  { cols: 7,  rows: 12, gap: 15 },
  { cols: 8,  rows: 11, gap: 15 },
]

async function gridify(sourceBuf, params) {
  const { cols, rows, gap } = params
  const meta = await sharp(sourceBuf).metadata()
  const canvasW = meta.width
  const canvasH = meta.height
  const tileW = Math.max(1, Math.floor((canvasW - (cols + 1) * gap) / cols))
  const tileH = Math.max(1, Math.floor((canvasH - (rows + 1) * gap) / rows))

  const overlays = []
  const hBar = await sharp({
    create: { width: canvasW, height: gap, channels: 3, background: { r: 255, g: 255, b: 255 } },
  }).png().toBuffer()
  for (let r = 0; r <= rows; r++) {
    const y = Math.min(canvasH - gap, r * (tileH + gap))
    overlays.push({ input: hBar, left: 0, top: y })
  }
  const vBar = await sharp({
    create: { width: gap, height: canvasH, channels: 3, background: { r: 255, g: 255, b: 255 } },
  }).png().toBuffer()
  for (let c = 0; c <= cols; c++) {
    const x = Math.min(canvasW - gap, c * (tileW + gap))
    overlays.push({ input: vBar, left: x, top: 0 })
  }

  return sharp(sourceBuf).composite(overlays).png().toBuffer()
}

function paramLabel(p, idx) {
  return `attempt${idx + 1}_${p.cols}x${p.rows}_gap${p.gap}`
}

async function main() {
  const [inputPath, attemptArg] = process.argv.slice(2)
  if (!inputPath) {
    console.error('Usage: node scripts/test-gridify.mjs <input.jpg> [attempt|all]')
    process.exit(1)
  }
  const resolved = path.resolve(inputPath.replace(/^~/, process.env.HOME || ''))
  if (!fs.existsSync(resolved)) {
    console.error(`No such file: ${resolved}`)
    process.exit(1)
  }
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const srcBuf = fs.readFileSync(resolved)
  const baseName = path.basename(resolved, path.extname(resolved))

  const runOne = async (params, idx) => {
    const label = paramLabel(params, idx)
    const out = path.join(OUT_DIR, `${baseName}_${label}.png`)
    console.log(`  ↳ ${label}`)
    const grid = await gridify(srcBuf, params)
    fs.writeFileSync(out, grid)
    console.log(`    ✓ ${out} (${(grid.length / 1024).toFixed(1)} KB)`)
  }

  if (attemptArg === 'all') {
    console.log(`Running all ${GRID_RETRIES.length} retry-ladder attempts on ${resolved}\n`)
    for (let i = 0; i < GRID_RETRIES.length; i++) {
      await runOne(GRID_RETRIES[i], i)
    }
  } else {
    const idx = attemptArg ? Math.max(0, Math.min(GRID_RETRIES.length - 1, parseInt(attemptArg, 10) - 1)) : 0
    console.log(`Running attempt ${idx + 1} on ${resolved}\n`)
    await runOne(GRID_RETRIES[idx], idx)
  }

  console.log(`\nOutputs in ${OUT_DIR}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
