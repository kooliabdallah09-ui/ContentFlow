// Standalone Nano Banana image generator — used by the /generate/image page.
// Same provider as the rest of the app (Replicate google/nano-banana) so we only depend on
// REPLICATE_API_TOKEN. Returns a data URL so the existing image-preview component (which
// renders {imageUrl} directly into an <img>) needs no changes.

const REPLICATE_BASE = 'https://api.replicate.com/v1'
const NANO_BANANA_MODEL = 'google/nano-banana'

export async function generateImage(
  prompt: string,
  referenceImageBase64?: string,
  referenceImageMimeType?: string,
): Promise<{ imageUrl: string }> {
  const apiKey = process.env.REPLICATE_API_TOKEN
  if (!apiKey) throw new Error('REPLICATE_API_TOKEN not configured')

  const input: Record<string, unknown> = {
    prompt,
    output_format: 'png',
  }
  if (referenceImageBase64) {
    input.image_input = [`data:${referenceImageMimeType ?? 'image/jpeg'};base64,${referenceImageBase64}`]
  }

  // Sync mode — image gen is fast (~5-8s)
  const res = await fetch(`${REPLICATE_BASE}/models/${NANO_BANANA_MODEL}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',
    },
    body: JSON.stringify({ input }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Nano Banana error ${res.status}: ${err.slice(0, 400)}`)
  }

  const data = await res.json()
  if (data.error) throw new Error(`Nano Banana failed: ${data.error}`)

  let output = data.output
  // Fallback poll if Prefer: wait didn't complete in time
  if (data.status !== 'succeeded') {
    const id = data.id
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const poll = await fetch(`${REPLICATE_BASE}/predictions/${id}`, { headers: { Authorization: `Bearer ${apiKey}` } })
      const pollData = await poll.json()
      if (pollData.status === 'succeeded') { output = pollData.output; break }
      if (pollData.status === 'failed' || pollData.status === 'canceled') {
        throw new Error(`Nano Banana failed during poll: ${JSON.stringify(pollData).slice(0, 300)}`)
      }
    }
    if (!output) throw new Error('Nano Banana did not complete within 60s')
  }

  const imageUrl = Array.isArray(output) ? output[0] : output
  if (typeof imageUrl !== 'string') {
    throw new Error(`Nano Banana returned unexpected output: ${JSON.stringify(output).slice(0, 300)}`)
  }

  // Convert Replicate's CDN URL to a data URL so the existing image-preview component renders
  // it directly. Also makes the image survive Replicate's temp URL expiration.
  const imgRes = await fetch(imageUrl)
  if (!imgRes.ok) throw new Error(`Failed to fetch Nano Banana output: ${imgRes.statusText}`)
  const buf = Buffer.from(await imgRes.arrayBuffer())
  const mimeType = imgRes.headers.get('content-type') || 'image/png'
  return { imageUrl: `data:${mimeType};base64,${buf.toString('base64')}` }
}
