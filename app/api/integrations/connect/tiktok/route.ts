import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId') || ''
  const clientKey = process.env.TIKTOK_CLIENT_KEY
  const base = process.env.NEXT_PUBLIC_APP_URL
  if (!clientKey) return NextResponse.redirect(`${base}/settings/integrations?error=tiktok_not_configured`)

  const nonce = crypto.randomBytes(16).toString('hex')
  const statePayload = Buffer.from(JSON.stringify({ nonce, userId })).toString('base64url')
  const redirectUri = `${base}/api/integrations/callback/tiktok`

  const url = `https://www.tiktok.com/v2/auth/authorize/?${new URLSearchParams({
    client_key: clientKey,
    response_type: 'code',
    scope: 'user.info.basic,video.upload',
    redirect_uri: redirectUri,
    state: statePayload,
  })}`

  return NextResponse.redirect(url)
}
