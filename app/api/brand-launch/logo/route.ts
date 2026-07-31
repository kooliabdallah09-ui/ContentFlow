import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { deductCredits } from '@/lib/deduct-credits'

export const maxDuration = 60

const LOGO_CR = 5

function supa() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function authUser(request: NextRequest): Promise<string | null> {
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return null
  const { data } = await supa().auth.getUser(header.slice(7))
  return data.user?.id ?? null
}

export async function POST(request: NextRequest) {
  try {
    const userId = await authUser(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = supa()
    const { data: credits } = await supabase
      .from('user_credits')
      .select('balance, pack_credits')
      .eq('user_id', userId)
      .maybeSingle()

    if (!credits || credits.balance < LOGO_CR) {
      return NextResponse.json({ error: `Insufficient credits. Need ${LOGO_CR}.` }, { status: 402 })
    }

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 40) : ''
    const primaryColor = typeof body.primaryColor === 'string' ? body.primaryColor.trim() : '#1a1a1a'
    const niche = typeof body.niche === 'string' ? body.niche.trim().slice(0, 100) : ''

    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Image API not configured' }, { status: 500 })

    const prompt = `Minimal wordmark logo for brand "${name}". ${niche ? `Brand sells ${niche} products.` : ''} Clean bold sans-serif typography, the brand name in ${primaryColor} color on pure white background. Flat vector style, professional brand logo, no gradients, no shadows, no decorative elements, just the typographic wordmark. Ultra clean, modern, ready for packaging.`

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
        size: '1024x1024',
        quality: 'medium',
        output_format: 'png',
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error?.message || `Image API error: ${res.statusText}`)
    }

    const data = await res.json()
    const image = data.data?.[0]

    let logoUrl: string
    if (image?.url) {
      logoUrl = image.url
    } else if (image?.b64_json) {
      // Upload to Supabase Storage
      const buffer = Buffer.from(image.b64_json, 'base64')
      const path = `brand-logos/${userId}/${Date.now()}.png`
      const { error: uploadErr } = await supabase.storage
        .from('ugc-media')
        .upload(path, buffer, { contentType: 'image/png', upsert: false })
      if (uploadErr) throw uploadErr
      const { data: urlData } = supabase.storage.from('ugc-media').getPublicUrl(path)
      logoUrl = urlData.publicUrl
    } else {
      throw new Error('No image returned')
    }

    await deductCredits(supabase, userId, LOGO_CR, credits.balance, credits.pack_credits ?? 0)

    return NextResponse.json({ logoUrl, creditsCharged: LOGO_CR })
  } catch (err) {
    console.error('[brand-launch/logo]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
