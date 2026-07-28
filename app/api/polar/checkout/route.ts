import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { POLAR_PRODUCTS } from '@/lib/polar'

export const maxDuration = 30

const PRODUCT_KEY_MAP: Record<string, string> = {
  pack500:  POLAR_PRODUCTS.pack500,
  pack1500: POLAR_PRODUCTS.pack1500,
  pack5000: POLAR_PRODUCTS.pack5000,
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.POLAR_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Not configured' }, { status: 500 })

    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: userData } = await supabase.auth.getUser(authHeader.slice(7))
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { packKey } = await request.json() as { packKey: string }
    const productId = PRODUCT_KEY_MAP[packKey]
    if (!productId) return NextResponse.json({ error: 'Invalid pack' }, { status: 400 })

    const successUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://contentflow-web.com'}/billing?success=credits`

    const res = await fetch('https://api.polar.sh/v1/checkouts/custom/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_id: productId,
        metadata: { supabase_user_id: userData.user.id },
        customer_email: userData.user.email,
        success_url: successUrl,
        allow_discount_codes: true,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[polar/checkout] API error', err)
      return NextResponse.json({ error: 'Checkout creation failed' }, { status: 500 })
    }

    const checkout = await res.json() as { url: string }
    return NextResponse.json({ url: checkout.url })
  } catch (e) {
    console.error('[polar/checkout] error', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
