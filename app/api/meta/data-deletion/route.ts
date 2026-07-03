import { NextRequest, NextResponse } from 'next/server'
import { createHmac, randomBytes } from 'crypto'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function base64UrlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4))
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

function parseSignedRequest(signedRequest: string, secret: string): { user_id?: string } | null {
  const [encodedSig, payload] = signedRequest.split('.')
  if (!encodedSig || !payload) return null
  const expected = createHmac('sha256', secret).update(payload).digest()
  const provided = base64UrlDecode(encodedSig)
  if (expected.length !== provided.length) return null
  let ok = 0
  for (let i = 0; i < expected.length; i++) ok |= expected[i] ^ provided[i]
  if (ok !== 0) return null
  try {
    return JSON.parse(base64UrlDecode(payload).toString('utf8'))
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.FACEBOOK_APP_SECRET
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://contentflow-web.com'

  if (!secret) return NextResponse.json({ error: 'app not configured' }, { status: 500 })

  const form = await request.formData()
  const signedRequest = form.get('signed_request')?.toString()
  if (!signedRequest) return NextResponse.json({ error: 'missing signed_request' }, { status: 400 })

  const data = parseSignedRequest(signedRequest, secret)
  if (!data?.user_id) return NextResponse.json({ error: 'invalid signature' }, { status: 400 })

  const confirmationCode = randomBytes(12).toString('hex')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  await supabase.from('data_deletion_requests').insert({
    confirmation_code: confirmationCode,
    provider: 'facebook',
    provider_user_id: data.user_id,
    status: 'pending',
  })

  await supabase
    .from('integrations')
    .update({ is_connected: false, access_token: null })
    .in('platform', ['facebook', 'instagram'])
    .eq('account_id', data.user_id)

  return NextResponse.json({
    url: `${base}/data-deletion?code=${confirmationCode}`,
    confirmation_code: confirmationCode,
  })
}
