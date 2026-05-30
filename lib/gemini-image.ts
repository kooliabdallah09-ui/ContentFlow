// Uses Pollinations.ai — free, no API key needed
export async function generateImage(prompt: string): Promise<{ imageUrl: string }> {
  const encoded = encodeURIComponent(prompt)
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&seed=${Date.now()}`

  // Verify the image is reachable
  const res = await fetch(url, { method: 'HEAD' })
  if (!res.ok) throw new Error('Image generation failed')

  return { imageUrl: url }
}
