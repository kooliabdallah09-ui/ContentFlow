import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  const state = crypto.randomBytes(16).toString('hex')
  const clientKey = process.env.TIKTOK_CLIENT_KEY
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/callback/tiktok`

  if (!clientKey) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=tiktok_not_configured`)
  }

  const url = `https://www.tiktok.com/v2/auth/authorize/?${new URLSearchParams({
    client_key: clientKey,
    response_type: 'code',
    scope: 'user.info.basic,video.publish',
    redirect_uri: redirectUri,
    state,
  })}`

  const response = NextResponse.redirect(url)
  response.cookies.set('tiktok_oauth_state', state, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 600 })
  return response
}
