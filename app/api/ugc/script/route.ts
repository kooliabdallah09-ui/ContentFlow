import { generateUGCScript } from '@/lib/ugc-script'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

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

    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.slice(7))
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = userData.user.id
    const body = await request.json()
    const {
      productName,
      productDescription,
      benefits,
      callToAction,
      productImageBase64,
      productImageMimeType,
      duration,
      character,
      customInstructions,
      language: languageRaw,
      productType,
      formatKey,
      hasSecondCharacter,
    } = body

    if (!productName || !productDescription || !benefits) {
      return NextResponse.json({ error: 'Missing required fields: productName, productDescription, benefits' }, { status: 400 })
    }

    const { getLanguage } = await import('@/lib/languages')
    const language = getLanguage(typeof languageRaw === 'string' ? languageRaw : undefined)

    let safeCustomInstructions = typeof customInstructions === 'string'
      ? customInstructions.slice(0, 1500).trim() || undefined
      : undefined

    // Pull brand context (audience + tone) — non-fatal if it fails.
    try {
      const { data: brand } = await supabase
        .from('brand_profiles')
        .select('target_audience, tone_of_voice')
        .eq('user_id', userId)
        .maybeSingle()
      const audience = brand?.target_audience?.trim()
      const tone = brand?.tone_of_voice?.trim()
      if (audience || tone) {
        const brandLines = [
          audience ? `Target audience: ${audience}` : '',
          tone ? `Tone of voice: ${tone}` : '',
        ].filter(Boolean).join('\n')
        safeCustomInstructions = safeCustomInstructions
          ? `${brandLines}\n\n${safeCustomInstructions}`
          : brandLines
        if (safeCustomInstructions.length > 1500) {
          safeCustomInstructions = safeCustomInstructions.slice(0, 1500)
        }
      }
    } catch { /* non-fatal */ }

    const forcedScene = character?.scene?.trim() ? (character.scene as string).toLowerCase() : undefined
    const targetDuration = typeof duration === 'number' ? duration : 10

    const script = await generateUGCScript(
      productName,
      productDescription,
      benefits,
      callToAction || 'Try it today',
      productImageBase64,
      productImageMimeType,
      targetDuration,
      forcedScene,
      safeCustomInstructions,
      { name: language.name, code: language.code },
      (productType === 'software' || productType === 'physical') ? productType : undefined,
      typeof formatKey === 'string' ? formatKey : undefined,
      !!hasSecondCharacter,
    )

    return NextResponse.json({ script })
  } catch (error) {
    console.error('UGC script generation error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Script generation failed' }, { status: 500 })
  }
}
