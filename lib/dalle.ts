export async function generatePersonWithProduct(
  productName: string,
  productDescription: string,
  background: string = 'casual indoor setting',
): Promise<{ imageUrl: string; revisedPrompt: string }> {
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
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1792', // portrait — matches 9:16 video
      quality: 'standard',
      response_format: 'url',
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `DALL-E error: ${res.statusText}`)
  }

  const data = await res.json()
  const image = data.data?.[0]
  if (!image?.url) throw new Error('DALL-E did not return an image')

  return {
    imageUrl: image.url,
    revisedPrompt: image.revised_prompt ?? prompt,
  }
}
