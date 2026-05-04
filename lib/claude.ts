import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function generateBlogPost(topic: string, tone: string, length: string) {
  const systemPrompt = `You are an expert blog writer and SEO strategist.

Generate a high-quality, SEO-optimized blog post about the given topic.

Return valid JSON (no markdown code blocks, just pure JSON) with this structure:
{
  "headline": "SEO-optimized headline (60 chars max)",
  "metaDescription": "Meta description (160 chars max)",
  "outline": ["Section 1", "Section 2", ...],
  "content": "Full blog post (2000+ words)",
  "faqs": [{"question": "...", "answer": "..."}],
  "internalLinkSuggestions": ["link 1", "link 2"],
  "featuredImagePrompt": "Image description for Unsplash"
}

Tone: ${tone}
Length: ${length === 'long' ? '2000-3000 words' : length === 'medium' ? '1200-1800 words' : '600-1000 words'}

Write compelling, engaging content that ranks in search results.`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4000,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Write a blog post about: ${topic}`,
      },
    ],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type')

  let jsonText = content.text.trim()
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '')
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '')
  }

  return JSON.parse(jsonText)
}

export async function generateSocialContent(
  topic: string,
  platforms: string[]
) {
  const prompts = {
    twitter: 'Generate 3 Twitter posts (280 chars max) with hooks and emojis. Return as JSON array.',
    linkedin:
      'Generate 3 LinkedIn posts (professional, long-form). Return as JSON array.',
    instagram: 'Generate 3 Instagram captions with hashtags. Return as JSON array.',
    facebook: 'Generate 3 Facebook posts (community tone). Return as JSON array.',
    tiktok: 'Generate 3 TikTok scripts (hook + main message + CTA). Return as JSON array.',
  }

  const platformsText = platforms.map((p) => `${p}: ${prompts[p as keyof typeof prompts]}`).join('\n')

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    system: `You are a social media expert. Generate content for each platform.

${platformsText}

Return valid JSON (no markdown) with this structure:
{
  "twitter": ["post 1", "post 2", "post 3"],
  "linkedin": ["post 1", "post 2", "post 3"],
  ...
}`,
    messages: [
      {
        role: 'user',
        content: `Create social media content about: ${topic}`,
      },
    ],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type')

  let jsonText = content.text.trim()
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '')
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '')
  }

  return JSON.parse(jsonText)
}

export async function generateEmailSequence(
  sequenceType: string,
  product: string,
  audience: string,
  emailCount: number
) {
  const guides = {
    welcome: 'New subscriber welcome sequence. Build excitement, provide value, include offer.',
    nurture: 'Educational sequence teaching about the product/service.',
    launch: 'Product launch sequence. Build anticipation, overcome objections, create urgency.',
    sales: 'Sales sequence. Problem → Solution → Social proof → CTA.',
    reengagement: 'Re-engagement sequence for inactive subscribers.',
  }

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 3000,
    system: `You are an expert email copywriter. Generate a ${emailCount}-email ${sequenceType} sequence.

${guides[sequenceType as keyof typeof guides]}

Product: ${product}
Target Audience: ${audience}

Return valid JSON (no markdown):
{
  "emails": [
    {
      "subject": "Subject line",
      "preheader": "Preview text",
      "body": "Email body (200-300 words)",
      "cta": "Button text",
      "ctaUrl": "where-button-goes"
    }
  ]
}

Requirements:
- Compelling subject lines (40-50 characters)
- Conversational tone
- Include {{firstName}} and {{companyName}} placeholders
- One clear CTA per email
- Personalization where appropriate`,
    messages: [
      {
        role: 'user',
        content: `Generate a ${sequenceType} email sequence for ${product}`,
      },
    ],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type')

  let jsonText = content.text.trim()
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '')
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '')
  }

  return JSON.parse(jsonText)
}
