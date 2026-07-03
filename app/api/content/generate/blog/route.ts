import { generateBlogPost } from '@/lib/claude'
import { getUnsplashImage } from '@/lib/image-service'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { deductCredits } from '@/lib/deduct-credits'

const CREDIT_COST = 10

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

    const { topic, tone, length } = await request.json()

    if (!topic || !tone || !length) {
      return NextResponse.json(
        { error: 'Missing required fields: topic, tone, length' },
        { status: 400 }
      )
    }

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

    const result = await generateBlogPost(topic, tone, length)
    const imageQuery = result.featuredImagePrompt || topic
    const featuredImage = await getUnsplashImage(imageQuery)

    await deductCredits(supabase, userId, CREDIT_COST, balance, packCredits)

    await supabase.from('ugc_content').insert([{
      user_id: userId,
      content_type: 'blog',
      storage_url: null,
      metadata: { topic, tone, length, ...result, featuredImage, generatedAt: new Date().toISOString() },
      credit_cost: CREDIT_COST,
      status: 'completed',
    }])

    return NextResponse.json({ ...result, featuredImage, creditsUsed: CREDIT_COST })
  } catch (error) {
    console.error('Blog generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    )
  }
}
