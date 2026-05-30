// Uses Pollinations.ai — free, no API key needed
export async function generateImage(prompt: string): Promise<{ imageUrl: string }> {
  const encoded = encodeURIComponent(prompt)
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&seed=${Date.now()}`

  // Fetch and convert to base64 so it works reliably in the browser
  const res = await fetch(url)
  if (!res.ok) throw new Error('Image generation failed')

  const buffer = await res.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  const mimeType = res.headers.get('content-type') || 'image/jpeg'

  return { imageUrl: `data:${mimeType};base64,${base64}` }
}
