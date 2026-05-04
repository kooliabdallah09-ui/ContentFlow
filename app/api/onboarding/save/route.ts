import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { companyName, description, targetAudience, toneOfVoice, voiceSamples } =
      await request.json()

    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.error('Auth error:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('brand_profiles')
      .insert([
        {
          user_id: user.id,
          company_name: companyName,
          description,
          target_audience: targetAudience,
          tone_of_voice: toneOfVoice,
          voice_samples: voiceSamples ? [voiceSamples] : [],
        },
      ])
      .select()

    if (error) {
      console.error('Supabase insert error:', error)
      throw error
    }

    return NextResponse.json({ success: true, data: data?.[0] })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to save profile'
    console.error('Onboarding save error:', errorMessage, error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
