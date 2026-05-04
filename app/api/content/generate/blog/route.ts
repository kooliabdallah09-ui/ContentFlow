import { generateBlogPost } from '@/lib/claude'
import { getUnsplashImage } from '@/lib/image-service'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { topic, tone, length } = await request.json()

    if (!topic || !tone || !length) {
      return NextResponse.json(
        { error: 'Missing required fields: topic, tone, length' },
        { status: 400 }
      )
    }

    const result = await generateBlogPost(topic, tone, length)

    // Fetch featured image
    const imageQuery = result.featuredImagePrompt || topic
    const featuredImage = await getUnsplashImage(imageQuery)

    return NextResponse.json({
      ...result,
      featuredImage,
    })
  } catch (error) {
    console.error('Blog generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    )
  }
}
