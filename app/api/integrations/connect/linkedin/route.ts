import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId') || ''
  const clientId = process.env.LINKEDIN_CLIENT_ID
  const base = process.env.NEXT_PUBLIC_APP_URL
  if (!clientId) return NextResponse.redirect(`${base}/settings/integrations?error=linkedin_not_configured`)

  const nonce = crypto.randomBytes(16).toString('hex')
  const statePayload = Buffer.from(JSON.stringify({ nonce, userId })).toString('base64url')
  const redirectUri = `${base}/api/integrations/callback/linkedin`

  const url = `https://www.linkedin.com/oauth/v2/authorization?${new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'openid profile w_member_social',
    state: statePayload,
  })}`

  return NextResponse.redirect(url)
}
