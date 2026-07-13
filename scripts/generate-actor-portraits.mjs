#!/usr/bin/env node
// One-time generator for the UGC actor library portraits.
// Reads ACTORS below, generates a hyper-realistic portrait per actor via
// Nano Banana Pro on Replicate, and writes /public/actors/<id>.jpg.
//
// Usage:
//   REPLICATE_API_TOKEN=r8_... node scripts/generate-actor-portraits.mjs
//   REPLICATE_API_TOKEN=r8_... node scripts/generate-actor-portraits.mjs --force
//
// Idempotent by default — skips actors whose portrait file already exists.
// Pass --force to regenerate everything.

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

// Each actor has:
//   base:     age / gender / ethnicity / hair / features / outfit
//   scene:    the environment they're standing in
//   lighting: the mood + direction of light (drives the aesthetic)
//   vibe:     a short energy note that colours the expression
// Deliberate variety: no two actors share the same scene + lighting combo.
const ACTORS = [
  // Personal-care / bathroom / vanity
  { id: 'maya',    age: 'early 20s', gender: 'woman', ethnicity: 'Northern European',        hair: 'shoulder-length chestnut wavy hair', features: 'light freckles, doe eyes',        outfit: 'white ribbed tank top', scene: 'a bright modern bathroom with a big mirror behind her',                lighting: 'soft warm morning light through a frosted window',                  vibe: 'fresh, glowy, just-out-of-shower' },
  { id: 'sophie',  age: 'early 20s', gender: 'woman', ethnicity: 'Northern European',        hair: 'blonde beach-wave hair',              features: 'dimples',                          outfit: 'oversized cream hoodie', scene: 'a sunny minimalist bedroom with sheer curtains billowing gently',     lighting: 'breezy mid-morning window light',                                  vibe: 'soft, breezy, effortless' },
  { id: 'zara',    age: 'early 20s', gender: 'woman', ethnicity: 'East Asian',               hair: 'straight jet-black hair with soft bangs', features: 'dewy skin, subtle lash',      outfit: 'cropped white tee, small stud earrings', scene: 'a chic apartment vanity with a big round mirror',                    lighting: 'clean bright morning window light',                                vibe: 'polished, minimalist, editorial-lite' },

  // Kitchen — varied styles
  { id: 'jin',     age: 'late 20s',  gender: 'man',   ethnicity: 'East Asian',               hair: 'clean short black hair, side-parted', features: 'clear skin, refined features',   outfit: 'crisp light-blue linen button-up with sleeves rolled', scene: 'a modern minimalist kitchen with white cabinets and a marble island', lighting: 'cool bright late-morning light from a large picture window',        vibe: 'refined, understated, quietly confident' },
  { id: 'elena',   age: 'mid-20s',   gender: 'woman', ethnicity: 'Mediterranean (Southern European)', hair: 'shoulder-length dark brown curly hair', features: 'olive skin, high cheekbones', outfit: 'natural linen apron over a soft white tee, sleeves rolled', scene: 'a rustic Tuscan-style kitchen with hanging herbs and copper pots', lighting: 'warm golden afternoon light angling in from a side window',      vibe: 'warm, capable, home-cook glow' },
  { id: 'hana',    age: 'late 20s',  gender: 'woman', ethnicity: 'East Asian',               hair: 'long straight warm brown hair',       features: 'delicate features, clear skin',   outfit: 'oversized cream linen shirt, delicate gold necklace', scene: 'a Scandinavian minimalist kitchen with pale wood + a few potted plants', lighting: 'soft cool morning light with a clean shadow',                       vibe: 'serene, wellness-morning, grounded' },
  { id: 'oliver',  age: 'mid-20s',   gender: 'man',   ethnicity: 'Northern European',        hair: 'light brown hair, effortlessly styled with a slight sweep', features: 'sharp jawline, sun-kissed skin', outfit: 'ivory henley shirt with sleeves rolled', scene: 'a sun-drenched Mediterranean apartment kitchen with white shutters', lighting: 'bright warm morning light through open shutters',                   vibe: 'European charm, magazine-cover' },

  // Living room / cozy hangout
  { id: 'marcus',  age: 'early 20s', gender: 'man',   ethnicity: 'Black / African American', hair: 'short well-shaped coily hair',         features: 'clear skin, sharp jawline, small gold stud earring', outfit: 'oatmeal knit crewneck', scene: 'a warm living room with a wool throw draped on the couch behind him', lighting: 'warm afternoon lamp light with a soft window glow',              vibe: 'kind, thoughtful, effortlessly stylish' },
  { id: 'carlos',  age: 'mid-20s',   gender: 'man',   ethnicity: 'Latin American',           hair: 'short black hair with a modern taper', features: 'short well-kept beard, warm brown eyes', outfit: 'olive henley shirt', scene: 'a leafy backyard patio with warm string lights and a wooden bench',   lighting: 'warm golden-hour side light with soft haze',                        vibe: 'relaxed, charismatic, easy smile' },

  // Home office / work
  { id: 'liam',    age: 'late 20s',  gender: 'man',   ethnicity: 'Northern European',        hair: 'dark brown wavy hair, well-styled',   features: 'short well-groomed beard, sharp jawline', outfit: 'charcoal crewneck', scene: 'a golden-hour rooftop terrace with a soft-focus city skyline behind him', lighting: 'warm sunset side light, subtle lens haze',                          vibe: 'chill, confident, magazine-cover' },
  { id: 'isabela', age: 'early 20s', gender: 'woman', ethnicity: 'Latin American',           hair: 'dark brown wavy hair, glossy',        features: 'warm smile, expressive eyes',     outfit: 'ribbed knit turtleneck', scene: 'a cozy plant-filled home office with a wooden desk and warm lamp',    lighting: 'warm side-lamp light, evening',                                     vibe: 'creator-cozy, inviting' },
  { id: 'priya',   age: 'late 20s',  gender: 'woman', ethnicity: 'South Asian',              hair: 'long straight glossy black hair',     features: 'sharp cheekbones, subtle winged eyeliner', outfit: 'silk camisole under an unbuttoned cardigan, small hoop earrings', scene: 'a bright airy home office with a big window and a mid-century desk', lighting: 'soft morning window light from the left',                            vibe: 'polished, confident, tech-professional' },
  { id: 'naomi',   age: 'late 20s',  gender: 'woman', ethnicity: 'Black / African American', hair: 'natural coily medium-length hair, well-defined',  features: 'gold hoop earrings, radiant skin', outfit: 'fitted ribbed cream turtleneck', scene: 'a chic loft office with an exposed brick wall behind her',            lighting: 'cool natural side light from a large window',                       vibe: 'sophisticated, editorial' },

  // Café / outdoor lifestyle
  { id: 'leila',   age: 'mid-20s',   gender: 'woman', ethnicity: 'Middle Eastern',           hair: 'long dark brown straight hair with subtle balayage', features: 'long lashes, warm brown eyes', outfit: 'soft camel-tone knit top, small gold earrings', scene: 'an outdoor café patio with bougainvillea vines hanging above', lighting: 'warm afternoon side light with dappled shade',                      vibe: 'curious, warm, café-Sunday' },
  { id: 'mia',     age: 'early 20s', gender: 'woman', ethnicity: 'Southeast Asian (Filipino)', hair: 'long straight dark brown hair, glossy', features: 'expressive doe eyes, subtle blush', outfit: 'cropped cardigan over a plain tank, cross-body strap over one shoulder', scene: 'a coffee-shop window seat with a warm terracotta wall behind her', lighting: 'warm autumn afternoon cross-glow',                                  vibe: 'sweet, curious, student energy' },
  { id: 'kai',     age: 'mid-20s',   gender: 'man',   ethnicity: 'Pacific Islander',         hair: 'medium wavy black hair, effortlessly styled', features: 'sun-kissed tan skin, defined jawline', outfit: 'unbuttoned linen shirt over a plain tee, thin cord necklace', scene: 'a beach-house patio with palm shadows on a whitewashed wall', lighting: 'bright warm afternoon sun',                                         vibe: 'laid-back, easy, coastal' },
  { id: 'noah',    age: 'early 20s', gender: 'man',   ethnicity: 'mixed race',               hair: 'dark brown curly hair, textured',     features: 'small ear piercing, sharp cheekbones', outfit: 'black bomber jacket over a hoodie, black cap', scene: 'a dusk city street with soft neon signage glow blurred behind him', lighting: 'blue-hour ambient light + gentle warm neon rim',                    vibe: 'cool, streetwear, quietly confident' },

  // Fitness
  { id: 'diego',   age: 'late 20s',  gender: 'man',   ethnicity: 'Latin American',           hair: 'black straight hair, longer on top, tapered sides', features: 'visible arm tattoo, athletic build, sharp jawline', outfit: 'grey athletic tank showing arms', scene: 'a sun-drenched rooftop outdoor gym with a clear blue sky',            lighting: 'bright midday sun with a slight bounce off the concrete',            vibe: 'confident, magnetic, athlete' },
  { id: 'jamal',   age: 'late 20s',  gender: 'man',   ethnicity: 'Black / African American', hair: 'clean low fade',                       features: 'sharp jawline, neat goatee, sport watch on wrist', outfit: 'fitted black athletic tank', scene: 'a modern home gym with a big mirror wall and clean matte black weights', lighting: 'bright natural midday light through a large gym window',            vibe: 'focused, disciplined, cover-of-mens-health' },
  { id: 'amara',   age: 'late 20s',  gender: 'woman', ethnicity: 'West African',             hair: 'natural black afro, well-shaped',      features: 'radiant skin, high cheekbones',   outfit: 'matching sage-green yoga set', scene: 'a sun-drenched yoga studio with a wood floor and big potted plants',   lighting: 'soft mid-morning sun streaming in through floor-to-ceiling windows', vibe: 'calm, radiant, wellness' },
]

function buildPrompt(a) {
  const features = a.features ? `, ${a.features}` : ''
  return `Hyper-realistic photograph of a ${a.age} ${a.ethnicity} ${a.gender}, ${a.hair}${features}, wearing ${a.outfit}, in ${a.scene}. ${a.lighting}. Looking directly at the camera lens with eyes locked on the viewer, subtle warm expression — a small natural smile or a soft relaxed mouth (${a.vibe}). Naturally attractive: good bone structure, clear healthy skin with real texture (pores, small imperfections, faint sun spots), well-groomed hair with a few natural flyaways, confident relaxed posture. NO beauty filter, NO commercial gloss, NO glass-skin polish, NO plastic AI-perfect look. It reads like a real person, well-photographed.

Vertical 9:16 portrait framing, head and upper shoulders visible, subject centred, background softly out of focus (shallow depth of field).

The final image is a bare photograph only — NO phone bezel, NO status bar, NO camera-app UI, NO shutter button, NO timestamps, NO icons, NO captions, NO watermark, NO on-screen chrome.`
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
