import { generateImage } from '@/lib/flux-pro'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { deductCredits } from '@/lib/deduct-credits'

const CREDIT_COST = 3

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.slice(7)
    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = userData.user.id

    const { post, platform } = await request.json()

    if (!post || !platform) {
      return NextResponse.json(
        { error: 'Missing required fields: post, platform' },
        { status: 400 }
      )
    }

    const imagePrompt = generateImagePrompt(post, platform)
    const sizeMap: Record<string, string> = {
      twitter: '1024x512',
      linkedin: '1200x628',
      instagram: '1024x1024',
      facebook: '1200x628',
      tiktok: '768x1024',
    }

    const size = sizeMap[platform] || '1024x1024'

    const { data: credits } = await supabase
      .from('user_credits')
      .select('balance, pack_credits')
      .eq('user_id', userId)
      .maybeSingle()
    const balance = credits?.balance ?? 0
    const packCredits = credits?.pack_credits ?? 0
    if (balance < CREDIT_COST) {
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 })
    }

    try {
      const result = await generateImage(imagePrompt, size, 1)
      const imageUrl = result.imageUrls[0]

      await deductCredits(supabase, userId, CREDIT_COST, balance, packCredits)

      return NextResponse.json({ image: imageUrl, creditsUsed: CREDIT_COST })
    } catch (error) {
      console.error('Flux Pro image generation failed:', error)
      return NextResponse.json(
        {
          error: 'Image generation not available',
          image: '',
        },
        { status: 200 }
      )
    }
  } catch (error) {
    console.error('Image generation error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Image generation failed',
        image: '',
      },
      { status: 200 }
    )
  }
}

function generateImagePrompt(postContent: string, platform: string): string {
  const platformDimensions: Record<string, string> = {
    twitter: '1024x512',
    linkedin: '1200x628',
    instagram: '1080x1080',
    facebook: '1200x628',
    tiktok: '1080x1920',
  }

  const dimensions = platformDimensions[platform] || '1080x1080'

  const platformSpecificInstructions: Record<string, string> = {
    twitter:
      'Create a vibrant, eye-catching graphic with bold typography. Include the main message in large text. Use modern design with gradients and illustrations.',
    linkedin:
      'Create a professional image with clean design, corporate colors, and the key message prominently displayed. Include relevant business icons.',
    instagram:
      'Create a visually stunning square image with vibrant colors, artistic elements, and clear typography. Make it highly engaging for social sharing.',
    facebook:
      'Create a Facebook-optimized image with clear hierarchy, readable text, and engaging visuals. Include call-to-action elements if relevant.',
    tiktok:
      'Create a vertical mobile-first image with bold, eye-catching design. Use trending colors and typography. Make it thumb-stopping.',
  }

  const instruction =
    platformSpecificInstructions[platform] ||
    platformSpecificInstructions['instagram']

  // Extract key themes
  const words = postContent.toLowerCase().split(/\s+/)
  const themes: string[] = []

  const themeKeywords: Record<string, string[]> = {
    business: ['business', 'growth', 'success', 'profit', 'strategy'],
    technology: ['tech', 'ai', 'software', 'digital', 'innovation'],
    marketing: ['marketing', 'brand', 'campaign', 'social', 'engagement'],
    lifestyle: ['lifestyle', 'travel', 'food', 'fashion', 'inspiration'],
    education: ['learning', 'education', 'course', 'training', 'skill'],
  }

  for (const [theme, keywords] of Object.entries(themeKeywords)) {
    if (keywords.some((kw) => words.includes(kw))) {
      themes.push(theme)
    }
  }

  const themeText = themes.length > 0 ? themes.join(', ') : 'engaging, modern'

  return `Generate a professional ${platform} social media image with these specifications:

Resolution: ${dimensions}
Platform: ${platform}

Design Instructions:
${instruction}

Content: Create an image inspired by this post:
"${postContent.substring(0, 200)}..."

Visual Elements:
- Themes: ${themeText}
- Style: Modern, professional, on-brand
- Typography: Bold, readable, eye-catching
- Colors: Vibrant, cohesive palette
- Avoid: Text-heavy design, cluttered layout, watermarks

Make it ready to post immediately on ${platform}. The image should enhance the post's message and grab attention in the user's feed.`
}
