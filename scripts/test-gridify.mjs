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
  { cols: 7,  rows: 10, gap: 6,  tileW: 90,  tileH: 150 },
  { cols: 8,  rows: 10, gap: 6,  tileW: 80,  tileH: 140 },
  { cols: 6,  rows: 10, gap: 8,  tileW: 100, tileH: 160 },
  { cols: 7,  rows: 12, gap: 5,  tileW: 90,  tileH: 130 },
  { cols: 8,  rows: 11, gap: 5,  tileW: 80,  tileH: 130 },
]

async function gridify(sourceBuf, params) {
  const { cols, rows, gap, tileW, tileH } = params
  const canvasW = cols * tileW + (cols + 1) * gap
  const canvasH = rows * tileH + (rows + 1) * gap
  const sampledW = cols * tileW
  const sampledH = rows * tileH
  const sampled = await sharp(sourceBuf)
    .resize(sampledW, sampledH, { fit: 'cover', position: 'center' })
    .toBuffer()
  const composites = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = await sharp(sampled)
        .extract({ left: c * tileW, top: r * tileH, width: tileW, height: tileH })
        .toBuffer()
      composites.push({
        input: tile,
        left: gap + c * (tileW + gap),
        top:  gap + r * (tileH + gap),
      })
    }
  }
  return sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer()
}

function paramLabel(p, idx) {
  return `attempt${idx + 1}_${p.cols}x${p.rows}_g${p.gap}_${p.tileW}x${p.tileH}`
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
