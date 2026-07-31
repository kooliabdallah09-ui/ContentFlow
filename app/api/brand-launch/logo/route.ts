import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { deductCredits } from '@/lib/deduct-credits'
import { generateNanoBananaImage } from '@/lib/nanobanana'

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

    const prompt = `Minimal wordmark logo for a brand called "${name}"${niche ? ` in the ${niche} space` : ''}. The brand name "${name}" in bold clean sans-serif typography, color ${primaryColor} on a pure white background. Flat vector style. No icons, no decorative elements, no background shapes — just the typographic wordmark. Professional, modern, ready for packaging and digital use.`

    const result = await generateNanoBananaImage(prompt, {
      ratio: '1:1',
      style: 'professional',
      model: 'nb2',
      raw: false,
    })

    // Upload base64 to Supabase Storage
    const buffer = Buffer.from(result.imageBase64, 'base64')
    const ext = result.mimeType.includes('png') ? 'png' : 'jpg'
    const path = `brand-logos/${userId}/${Date.now()}.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('ugc-media')
      .upload(path, buffer, { contentType: result.mimeType, upsert: false })

    if (uploadErr) throw uploadErr

    const { data: urlData } = supabase.storage.from('ugc-media').getPublicUrl(path)

    await deductCredits(supabase, userId, LOGO_CR, credits.balance, credits.pack_credits ?? 0)

    return NextResponse.json({ logoUrl: urlData.publicUrl, creditsCharged: LOGO_CR })
  } catch (err) {
    console.error('[brand-launch/logo]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
