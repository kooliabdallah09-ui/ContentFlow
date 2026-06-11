import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Use Claude to generate a rich, specific UGC image prompt tailored to the product
async function buildUGCImagePrompt(
  productName: string,
  productDescription: string,
  background: string,
  imageBase64?: string,
  imageMimeType?: string,
): Promise<string> {
  const textPrompt = `Write a single detailed image generation prompt for a photorealistic UGC-style social media video thumbnail.

Product: ${productName}
Description: ${productDescription}
Setting context: ${background}
${imageBase64 ? '\nThe image above shows the actual product — use its exact appearance, colors, packaging, shape, and any visible branding in the prompt.' : ''}
Rules:
- Vertical 9:16 format, TikTok/Reels aesthetic
- A realistic person (randomize: age 20-32, gender, ethnicity, casual outfit matching the setting)
- They are holding the product clearly with both hands or one hand extended toward the camera — product branding must be legible
- Their face shows a genuine, enthusiastic expression — direct eye contact, mid-smile, as if about to start talking
- Specific real-world environment matching the setting (describe room/location details: furniture, lighting, textures, colors)
- Natural light from environment (window light, lamp, outdoor sun — no studio flash)
- Handheld smartphone camera feel: slight handheld motion blur, shallow depth of field, creator/influencer framing
- Ultra-realistic, 4K, authentic UGC quality — looks like a real TikTok first frame, NOT a stock photo or advertisement

Output ONLY the prompt text, no explanation, no quotes.`

  const content: Anthropic.MessageParam['content'] = imageBase64
    ? [
        { type: 'image', source: { type: 'base64', media_type: (imageMimeType ?? 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp', data: imageBase64 } },
        { type: 'text', text: textPrompt },
      ]
    : textPrompt

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 350,
    messages: [{ role: 'user', content }],
  })

  return (msg.content[0] as { text: string }).text.trim()
}

export async function generatePersonWithProduct(
  productName: string,
  productDescription: string,
  background: string = 'casual indoor setting',
  imageBase64?: string,
  imageMimeType?: string,
): Promise<{ imageUrl: string }> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OpenAI API key not configured')

  const prompt = await buildUGCImagePrompt(productName, productDescription, background, imageBase64, imageMimeType)

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
      size: '1024x1536',
      quality: 'medium',
      output_format: 'png',
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Image generation error: ${res.statusText}`)
  }

  const data = await res.json()
  const image = data.data?.[0]

  if (image?.url) return { imageUrl: image.url }
  if (image?.b64_json) return { imageUrl: `data:image/png;base64,${image.b64_json}` }

  throw new Error('OpenAI did not return an image')
}
