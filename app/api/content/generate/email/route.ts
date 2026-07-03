import { generateEmailSequence } from '@/lib/claude'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { deductCredits } from '@/lib/deduct-credits'

const CREDIT_PER_EMAIL = 3

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

    const { sequenceType, product, audience, emailCount } = await request.json()

    if (!sequenceType || !product || !audience || !emailCount) {
      return NextResponse.json(
        { error: 'Missing required fields: sequenceType, product, audience, emailCount' },
        { status: 400 }
      )
    }

    const count = Math.max(1, Math.min(20, Number(emailCount) || 1))
    const totalCost = count * CREDIT_PER_EMAIL

    const { data: credits } = await supabase
      .from('user_credits')
      .select('balance, pack_credits')
      .eq('user_id', userId)
      .maybeSingle()
    const balance = credits?.balance ?? 0
    const packCredits = credits?.pack_credits ?? 0
    if (balance < totalCost) {
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 })
    }

    const result = await generateEmailSequence(sequenceType, product, audience, count)
    await deductCredits(supabase, userId, totalCost, balance, packCredits)

    await supabase.from('ugc_content').insert([{
      user_id: userId,
      content_type: 'email',
      storage_url: null,
      metadata: { sequenceType, product, audience, emailCount: count, result, generatedAt: new Date().toISOString() },
      credit_cost: totalCost,
      status: 'completed',
    }])

    return NextResponse.json({ ...result, creditsUsed: totalCost })
  } catch (error) {
    console.error('Email generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    )
  }
}
