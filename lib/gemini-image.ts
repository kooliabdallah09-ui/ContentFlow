export async function generateImage(
  prompt: string,
  referenceImageBase64?: string,
  referenceImageMimeType?: string,
): Promise<{ imageUrl: string }> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY
  if (!apiKey) throw new Error('Gemini API key not configured')

  const parts: object[] = []
  if (referenceImageBase64) {
    parts.push({ inlineData: { mimeType: referenceImageMimeType ?? 'image/jpeg', data: referenceImageBase64 } })
  }
  parts.push({ text: prompt })

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Gemini error: ${res.statusText}`)
  }

  const data = await res.json()
  const parts = data?.candidates?.[0]?.content?.parts ?? []
  const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'))
  if (!imagePart) throw new Error('Gemini did not return an image')

  return {
    imageUrl: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`,
  }
}
