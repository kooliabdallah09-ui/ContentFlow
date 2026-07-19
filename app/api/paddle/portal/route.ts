// Paddle customer portal — lets subscribers manage/cancel their plan.
// Finds the Paddle customer by the signed-in user's email and creates a
// portal session.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const PADDLE_API = process.env.NEXT_PUBLIC_PADDLE_ENV === 'production'
  ? 'https://api.paddle.com'
  : 'https://sandbox-api.paddle.com'

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.PADDLE_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Not configured' }, { status: 500 })

    const header = request.headers.get('Authorization')
    if (!header?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: userData } = await supabase.auth.getUser(header.slice(7))
    const email = userData.user?.email
    if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const search = await fetch(`${PADDLE_API}/customers?search=${encodeURIComponent(email)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    }).then(r => r.json())
    const customerId: string | undefined = search?.data?.[0]?.id
    if (!customerId) return NextResponse.json({ error: 'No billing profile yet — subscribe first' }, { status: 404 })

    const session = await fetch(`${PADDLE_API}/customers/${customerId}/portal-sessions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: '{}',
    }).then(r => r.json())
    const url: string | undefined = session?.data?.urls?.general?.overview
    if (!url) throw new Error('Could not create portal session')

    return NextResponse.json({ url })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
