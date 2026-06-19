#!/usr/bin/env node
// One-time generator for the UGC actor library portraits.
// Reads ACTORS from lib/actors.ts (via tsx-friendly path), generates a
// hyper-realistic portrait per actor via Nano Banana Pro on Replicate,
// and writes /public/actors/<id>.jpg.
//
// Usage:
//   REPLICATE_API_TOKEN=r8_... node scripts/generate-actor-portraits.mjs
//
// Idempotent: skips actors whose portrait file already exists. Pass --force to regenerate.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'public', 'actors')

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN
if (!REPLICATE_API_TOKEN) {
  console.error('REPLICATE_API_TOKEN not set')
  process.exit(1)
}

const FORCE = process.argv.includes('--force')
const NANO_BANANA_MODEL = 'google/nano-banana-pro'

// Mirror of lib/actors.ts ACTORS — kept in sync manually. Generating from the
// .ts file directly would need tsx/ts-node; this is simpler.
const ACTORS = [
  { id: 'maya',    age: 'late 20s', gender: 'woman', ethnicity: 'South Asian',           hair: 'black wavy hair', features: 'freckles',         scene: 'bathroom',     outfit: 'white tank top' },
  { id: 'liam',    age: 'late 20s', gender: 'man',   ethnicity: 'Northern European',     hair: 'dark brown wavy hair', features: 'short beard', scene: 'home office',  outfit: 'casual t-shirt and glasses' },
  { id: 'amara',   age: 'early 30s', gender: 'woman', ethnicity: 'West African',          hair: 'natural black afro',   features: '',             scene: 'yoga studio',  outfit: 'yoga set' },
  { id: 'diego',   age: 'late 20s', gender: 'man',   ethnicity: 'Latin American',        hair: 'black straight hair',  features: 'visible arm tattoo', scene: 'gym',     outfit: 'athletic wear' },
  { id: 'sophie',  age: 'early 20s', gender: 'woman', ethnicity: 'Northern European',     hair: 'blonde wavy hair',     features: 'dimples',      scene: 'bedroom',      outfit: 'oversized hoodie' },
  { id: 'jin',     age: 'early 30s', gender: 'man',   ethnicity: 'East Asian',            hair: 'black straight hair',  features: '',             scene: 'kitchen',      outfit: 'button-up shirt and watch' },
  { id: 'isabela', age: '40s',      gender: 'woman', ethnicity: 'Latin American',        hair: 'dark brown wavy hair', features: '',             scene: 'kitchen',      outfit: 'cozy sweater' },
  { id: 'noah',    age: 'early 20s', gender: 'man',   ethnicity: 'mixed race',            hair: 'dark brown curly hair', features: 'small ear piercing', scene: 'city street', outfit: 'streetwear and a cap' },
  { id: 'leila',   age: 'late 20s', gender: 'woman', ethnicity: 'Middle Eastern',        hair: 'dark brown straight hair', features: '',         scene: 'café',         outfit: 'smart casual top with earrings' },
  { id: 'marcus',  age: '40s',      gender: 'man',   ethnicity: 'Black / African American', hair: 'short coily hair',    features: 'salt-and-pepper beard', scene: 'living room', outfit: 'cozy sweater' },
]

function buildPrompt(a) {
  const features = a.features ? `, ${a.features}` : ''
  return `Hyper-realistic phone-camera portrait of a ${a.age} ${a.ethnicity} ${a.gender}, ${a.hair}${features}, wearing ${a.outfit}, in a ${a.scene}, candid mid-expression, soft natural lighting, real skin texture with pores and slight imperfections, natural hair with flyaways, looking slightly off-camera, no beauty filter, no studio polish, no commercial gloss. Should read as a real moment captured on a phone. Vertical 9:16 portrait framing, head and upper shoulders visible.`
}

async function submitPrediction(prompt) {
  const res = await fetch(`https://api.replicate.com/v1/models/${NANO_BANANA_MODEL}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
      Prefer: 'respond-async',
    },
    body: JSON.stringify({
      input: { prompt, aspect_ratio: '9:16', output_format: 'jpg' },
    }),
  })
  if (!res.ok) {
    throw new Error(`Submit failed ${res.status}: ${await res.text()}`)
  }
  const data = await res.json()
  return data.id
}

async function pollPrediction(id) {
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2000))
    const res = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}` },
    })
    const data = await res.json()
    if (data.status === 'succeeded') {
      return Array.isArray(data.output) ? data.output[0] : data.output
    }
    if (data.status === 'failed' || data.status === 'canceled') {
      throw new Error(`Prediction ${data.status}: ${data.error ?? 'unknown'}`)
    }
  }
  throw new Error('Timed out')
}

async function generateOne(actor) {
  const outPath = path.join(OUT_DIR, `${actor.id}.jpg`)
  if (!FORCE && fs.existsSync(outPath)) {
    console.log(`  ↳ skip (exists): ${actor.id}`)
    return
  }
  console.log(`  ↳ generating: ${actor.id}`)
  const prompt = buildPrompt(actor)
  const predictionId = await submitPrediction(prompt)
  const imageUrl = await pollPrediction(predictionId)
  const imgRes = await fetch(imageUrl)
  if (!imgRes.ok) throw new Error(`Download failed: ${imgRes.status}`)
  const buf = Buffer.from(await imgRes.arrayBuffer())
  fs.writeFileSync(outPath, buf)
  console.log(`    ✓ wrote ${outPath} (${(buf.length / 1024).toFixed(1)} KB)`)
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  console.log(`Generating ${ACTORS.length} actor portraits → ${OUT_DIR}${FORCE ? ' (force)' : ''}\n`)
  for (const actor of ACTORS) {
    try {
      await generateOne(actor)
    } catch (err) {
      console.error(`    ✗ ${actor.id} failed:`, err.message)
    }
  }
  console.log('\nDone.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
