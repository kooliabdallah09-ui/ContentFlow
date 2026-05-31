import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Use Claude to generate a rich, specific UGC image prompt tailored to the product
async function buildUGCImagePrompt(
  productName: string,
  productDescription: string,
  background: string,
): Promise<string> {
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 350,
    messages: [{
      role: 'user',
      content: `Write a single detailed image generation prompt for a photorealistic UGC-style social media video thumbnail.

Product: ${productName}
Description: ${productDescription}
Setting context: ${background}

First, figure out the natural usage action for this product. Examples:
- Sunscreen / moisturizer / serum → person applying it to their face or arms, mid-application
- Perfume / cologne → person spraying it on their wrist or neck, eyes slightly closed
- Shampoo / hair product → person running it through their hair in the shower or bathroom
- Makeup / foundation / lipstick → person applying it in front of a mirror, brush or fingers on face
- Food / drink / supplement → person taking a bite, sipping, or holding it up mid-taste with a reaction
- Fitness / gym product → person using it during or after a workout
- Tech / gadget → person using it naturally (typing, wearing, interacting)
- Clothing / shoes → person wearing it, styled naturally
- Cleaning product → person using it on a surface
- Any other product → person actively using it in the most natural, authentic way

Rules for the image prompt:
- Vertical 9:16 format, TikTok/Reels aesthetic
- A realistic person (randomize: age 20-32, gender, ethnicity, casual outfit matching the setting)
- The person is ACTIVELY USING the product — not just holding it. Show the specific usage action mid-gesture
- Their face shows a genuine reaction — eyes slightly engaged, natural expression caught mid-action
- The product is clearly visible and identifiable during the usage action
- Specific real-world environment matching the setting (describe room details: furniture, lighting, textures)
- Natural light from environment (window light, bathroom mirror light, outdoor sun — no studio flash)
- Handheld smartphone camera feel: slight motion blur, shallow depth of field, creator/influencer framing
- Ultra-realistic, 4K, authentic UGC quality — looks like a real TikTok frame, NOT a stock photo

Output ONLY the prompt text, no explanation, no quotes.`,
    }],
  })

  return (msg.content[0] as { text: string }).text.trim()
}

export async function generatePersonWithProduct(
  productName: string,
  productDescription: string,
  background: string = 'casual indoor setting',
): Promise<{ imageUrl: string }> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OpenAI API key not configured')

  const prompt = await buildUGCImagePrompt(productName, productDescription, background)

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
