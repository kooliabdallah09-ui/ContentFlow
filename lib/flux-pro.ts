interface FluxProResponse {
  images: Array<{
    url: string
  }>
  request_id: string
}

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

  if (!apiKey) {
    throw new Error('Flux Pro API key not configured')
  }

  const [width, height] = size.split('x').map(Number)

  const requestBody = {
    prompt,
    model: 'flux-pro-1.0',
    width,
    height,
    num_outputs: Math.min(Math.max(quantity, 1), 4),
  }

  try {
    const response = await fetch('https://api.flux.ai/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        errorData.error?.message || `Flux Pro API error: ${response.statusText}`
      )
    }

    const data = (await response.json()) as FluxProResponse

    if (!data.images || data.images.length === 0) {
      throw new Error('No images returned from Flux Pro')
    }

    return {
      imageUrls: data.images.map((img) => img.url),
      generationId: data.request_id,
      timestamp: Date.now(),
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Failed to generate image with Flux Pro')
  }
}
