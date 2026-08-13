import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Server not configured')
  return createClient(url, key)
}

export async function POST(_request: NextRequest) {
  return NextResponse.json({ error: 'Payments are temporarily unavailable. Please try again later.' }, { status: 503 })
  // eslint-disable-next-line no-unreachable
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
    }

    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabase()
    const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.slice(7))
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { priceId, mode, successUrl, cancelUrl } = await request.json()
    if (!priceId || !mode) {
      return NextResponse.json({ error: 'Missing priceId or mode' }, { status: 400 })
    }

    // Get or create Stripe customer
    const { data: credits } = await supabase
      .from('user_credits')
      .select('stripe_customer_id')
      .eq('user_id', userData.user.id)
      .single()

    let customerId: string | undefined = credits?.stripe_customer_id ?? undefined

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userData.user.email,
        metadata: { supabase_user_id: userData.user.id },
      })
      customerId = customer.id
      await supabase
        .from('user_credits')
        .update({ stripe_customer_id: customerId })
        .eq('user_id', userData.user.id)
    }

    const origin = request.headers.get('origin') ?? 'https://contentflow.ai'
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: mode as 'subscription' | 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl ?? `${origin}/settings/billing?success=1`,
      cancel_url: cancelUrl ?? `${origin}/settings/billing`,
      metadata: { supabase_user_id: userData.user.id },
      ...(mode === 'subscription' ? {
        subscription_data: { metadata: { supabase_user_id: userData.user.id } },
      } : {}),
    })

    return NextResponse.json({ url: session.url })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('[stripe/checkout]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
