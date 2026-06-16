#!/usr/bin/env node
// Test Sora 2 end-to-end from the command line.
// Usage:  OPENAI_API_KEY=sk-... node scripts/test-sora.mjs ~/Desktop/hero.png ~/Desktop/sora-prompt.txt
//
// Reads a reference image + a prompt text file, submits to OpenAI Sora 2,
// polls until complete, downloads the result MP4 to ./sora-output.mp4.

import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const [, , imagePath, promptPath] = process.argv
if (!imagePath || !promptPath) {
  console.error('Usage: node scripts/test-sora.mjs <reference-image> <prompt-file>')
  process.exit(1)
}
const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) {
  console.error('OPENAI_API_KEY env var is required')
  process.exit(1)
}

// Sora 2 single-clip durations are restricted to 4, 8, or 12 seconds — and sent as STRINGS.
const REQUESTED_SECONDS = Number(process.env.SORA_SECONDS ?? 12)
const VALID = [4, 8, 12]
const SECONDS = VALID.includes(REQUESTED_SECONDS)
  ? REQUESTED_SECONDS
  : VALID.reduce((best, v) => Math.abs(v - REQUESTED_SECONDS) < Math.abs(best - REQUESTED_SECONDS) ? v : best, 4)
if (SECONDS !== REQUESTED_SECONDS) {
  console.log(`⚠ SORA_SECONDS=${REQUESTED_SECONDS} not allowed — clamping to ${SECONDS} (valid: 4, 8, 12)`)
}
const SIZE = process.env.SORA_SIZE ?? '720x1280'         // 9:16 vertical default
const MODEL = process.env.SORA_MODEL ?? 'sora-2'

// Sora 2 requires the reference image dimensions to EXACTLY match the requested `size` (it
// inpaints from the reference). Auto-resize via sharp: scale + center-crop, no distortion.
const [targetW, targetH] = SIZE.split('x').map(Number)
const sourcePath = path.resolve(imagePath.replace(/^~/, process.env.HOME))
const sourceMeta = await sharp(sourcePath).metadata()
console.log(`▸ Source image: ${sourceMeta.width}×${sourceMeta.height}`)
const resizedBuf = await sharp(sourcePath)
  .resize(targetW, targetH, { fit: 'cover', position: 'center' })
  .png()
  .toBuffer()
if (sourceMeta.width !== targetW || sourceMeta.height !== targetH) {
  console.log(`  Resized → ${targetW}×${targetH} (cover, center-crop)`)
}
const imageBuf = resizedBuf
const imageMime = 'image/png'
const imageB64 = imageBuf.toString('base64')
const dataUrl = `data:${imageMime};base64,${imageB64}`
const prompt = fs.readFileSync(path.resolve(promptPath.replace(/^~/, process.env.HOME)), 'utf-8').trim()

console.log(`▸ Submitting Sora job (${MODEL}, ${SECONDS}s, ${SIZE})`)
console.log(`  Prompt: ${prompt.slice(0, 100)}${prompt.length > 100 ? '…' : ''}`)
console.log(`  Reference: ${imagePath} (${(imageBuf.length / 1024).toFixed(0)} KB)`)

// input_reference must be an object — OpenAI's standard image-input shape with image_url.
// Base sora-2 generates native audio; sora-2-pro is silent / worse. Stick with sora-2.
const requestBody = {
  model: MODEL,
  prompt,
  input_reference: {
    image_url: dataUrl,
  },
  seconds: String(SECONDS), // API requires string, not int
  size: SIZE,
}

const submitRes = await fetch('https://api.openai.com/v1/videos', {
  method: 'POST',
  headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(requestBody),
})

if (!submitRes.ok) {
  const err = await submitRes.text()
  console.error(`✗ Submit failed (${submitRes.status}):\n${err}`)
  process.exit(1)
}

const submitData = await submitRes.json()
const videoId = submitData.id
console.log(`✓ Submitted. video_id = ${videoId}`)
console.log(`  Polling every 15s…\n`)

// Poll for completion
let videoUrl = null
let attempt = 0
while (!videoUrl) {
  attempt++
  await new Promise(r => setTimeout(r, 15_000))

  const statusRes = await fetch(`https://api.openai.com/v1/videos/${videoId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!statusRes.ok) {
    console.error(`✗ Status check failed: ${statusRes.status} ${statusRes.statusText}`)
    process.exit(1)
  }
  const status = await statusRes.json()
  console.log(`  [${new Date().toISOString().slice(11, 19)}] poll #${attempt} → status=${status.status}`)

  if (status.status === 'completed' || status.status === 'succeeded') {
    console.log(`\n✓ Render done. Fetching video bytes…`)
    break
  }
  if (status.status === 'failed' || status.status === 'error') {
    console.error(`✗ Sora job failed:\n${JSON.stringify(status, null, 2)}`)
    process.exit(1)
  }
}

// Download the MP4 from /v1/videos/{id}/content
const videoRes = await fetch(`https://api.openai.com/v1/videos/${videoId}/content`, {
  headers: { Authorization: `Bearer ${apiKey}` },
})
if (!videoRes.ok) {
  const err = await videoRes.text()
  console.error(`✗ Download failed (${videoRes.status}):\n${err}`)
  process.exit(1)
}
const videoBuf = Buffer.from(await videoRes.arrayBuffer())
const outPath = path.resolve(`./sora-output-${videoId}.mp4`)
fs.writeFileSync(outPath, videoBuf)
console.log(`✓ Saved to ${outPath} (${(videoBuf.length / 1024 / 1024).toFixed(1)} MB)`)
console.log(`\nOpen it: open "${outPath}"`)
