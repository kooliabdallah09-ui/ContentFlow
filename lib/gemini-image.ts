export async function generateImage(prompt: string): Promise<{ imageUrl: string }> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY
  if (!apiKey) throw new Error('Gemini API key not configured')

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1 },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Imagen error: ${res.statusText}`)
  }

  const data = await res.json()
  const prediction = data?.predictions?.[0]
  if (!prediction?.bytesBase64Encoded) throw new Error('Imagen did not return an image')

  return {
    imageUrl: `data:${prediction.mimeType || 'image/png'};base64,${prediction.bytesBase64Encoded}`,
  }
}
