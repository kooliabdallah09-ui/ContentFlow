export async function generatePersonWithProduct(
  productName: string,
  productDescription: string,
  background: string = 'casual indoor setting',
): Promise<{ imageUrl: string }> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OpenAI API key not configured')

  const prompt = `Photorealistic UGC-style portrait of a real-looking young adult holding "${productName}" (${productDescription}) in their hands, showing it to the camera. Natural expression, direct eye contact, casual authentic look. ${background}. Shot on iPhone, natural lighting, slightly imperfect framing — looks like real user-generated content, not a studio shoot. The product must be clearly visible and identifiable.`

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: '1024x1536', // portrait — closest to 9:16
      quality: 'medium',
      output_format: 'url',
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Image generation error: ${res.statusText}`)
  }

  const data = await res.json()
  const image = data.data?.[0]

  // gpt-image-1 returns b64_json by default, url if output_format: 'url'
  if (image?.url) {
    return { imageUrl: image.url }
  }
  if (image?.b64_json) {
    return { imageUrl: `data:image/png;base64,${image.b64_json}` }
  }

  throw new Error('OpenAI did not return an image')
}
