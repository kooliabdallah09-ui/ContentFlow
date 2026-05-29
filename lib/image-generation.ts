// Nanobanana (Google Gemini Image Generation) Integration
export async function generateImageForSocialPost(
  postContent: string,
  platform: string
): Promise<string | null> {
  try {
    // Use Google Gemini API directly
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${process.env.GOOGLE_GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: generateImagePrompt(postContent, platform),
                },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.7,
          },
        }),
      }
    )

    if (!response.ok) {
      console.error('Image generation failed:', response.statusText)
      return null
    }

    const data = await response.json()

    // Extract base64 image from response
    if (
      data.candidates &&
      data.candidates[0]?.content?.parts &&
      data.candidates[0].content.parts[0]?.inlineData
    ) {
      const base64Image = data.candidates[0].content.parts[0].inlineData.data
      return `data:image/jpeg;base64,${base64Image}`
    }

    return null
  } catch (error) {
    console.error('Image generation error:', error)
    return null
  }
}

function generateImagePrompt(postContent: string, platform: string): string {
  // Extract key themes from the post
  const themes = extractThemes(postContent)

  const platformSpecificInstructions = {
    twitter:
      'Create a vibrant, eye-catching 1024x512 social media graphic with bold typography. Include the main message in large text. Use modern design with gradients and illustrations.',
    instagram:
      'Create a 1080x1080 visually stunning square image with vibrant colors, artistic elements, and clear typography. Make it highly engaging for social sharing.',
    facebook:
      'Create a 1200x628 Facebook-optimized image with clear hierarchy, readable text, and engaging visuals. Include call-to-action elements if relevant.',
    tiktok:
      'Create a 1080x1920 vertical mobile-first image with bold, eye-catching design. Use trending colors and typography. Make it thumb-stopping.',
  }

  const instruction =
    platformSpecificInstructions[platform as keyof typeof platformSpecificInstructions] ||
    platformSpecificInstructions.instagram

  return `Generate a professional social media image for ${platform} with the following requirements:
${instruction}

Content themes: ${themes}
Post excerpt: "${postContent.substring(0, 150)}..."

Style: Modern, professional, on-brand
Resolution: Optimized for ${platform}
Include: Clear typography, professional colors, visual interest
Avoid: Text-heavy design, cluttered layout, watermarks

Make it ready to post immediately on ${platform}.`
}

function extractThemes(content: string): string {
  // Simple theme extraction - in production, could use NLP
  const words = content.toLowerCase().split(/\s+/)

  const commonThemes: Record<string, string[]> = {
    business: ['business', 'growth', 'success', 'profit', 'strategy', 'company'],
    technology: ['tech', 'ai', 'software', 'digital', 'innovation', 'app'],
    marketing: ['marketing', 'brand', 'campaign', 'social', 'engagement', 'audience'],
    health: ['health', 'wellness', 'fitness', 'medical', 'care', 'life'],
    education: ['learning', 'education', 'course', 'training', 'skill', 'knowledge'],
    lifestyle: ['lifestyle', 'travel', 'food', 'fashion', 'inspiration', 'daily'],
  }

  const foundThemes: string[] = []

  for (const [theme, keywords] of Object.entries(commonThemes)) {
    if (keywords.some((keyword) => words.includes(keyword))) {
      foundThemes.push(theme)
    }
  }

  return foundThemes.length > 0 ? foundThemes.join(', ') : 'general, engaging'
}
