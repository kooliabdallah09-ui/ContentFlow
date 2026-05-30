interface GenerationResult {
  imageUrls: string[]
  generationId: string
  timestamp: number
}

export async function generateImage(
  prompt: string,
  size: string = '1024x1024',
  quantity: number = 1
): Promise<GenerationResult> {
  const apiKey = process.env.FLUX_PRO_API_KEY
  if (!apiKey) throw new Error('Flux Pro API key not configured')

  const [width, height] = size.split('x').map(Number)

  const taskRes = await fetch('https://api.bfl.ml/v1/flux-pro-1.1', {
    method: 'POST',
    headers: {
      'x-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      width: width || 1024,
      height: height || 1024,
      num_images: Math.min(Math.max(quantity, 1), 4),
    }),
  })

  if (!taskRes.ok) {
    const err = await taskRes.json().catch(() => ({}))
    throw new Error(err.detail || `Flux API error: ${taskRes.statusText}`)
  }

  const { id } = await taskRes.json()

  // Poll for result (BFL is async)
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 2000))
    const pollRes = await fetch(`https://api.bfl.ml/v1/get_result?id=${id}`, {
      headers: { 'x-key': apiKey },
    })
    const result = await pollRes.json()
    if (result.status === 'Ready') {
      const urls: string[] = Array.isArray(result.result?.sample)
        ? result.result.sample
        : [result.result?.sample].filter(Boolean)
      return { imageUrls: urls, generationId: id, timestamp: Date.now() }
    }
    if (result.status === 'Error' || result.status === 'Failed') {
      throw new Error(result.result?.error || 'Image generation failed')
    }
  }

  throw new Error('Image generation timed out')
}
