import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId') || ''
  const clientId = process.env.GOOGLE_CLIENT_ID
  const base = process.env.NEXT_PUBLIC_APP_URL
  if (!clientId) return NextResponse.redirect(`${base}/settings/integrations?error=drive_not_configured`)

  const nonce = crypto.randomBytes(16).toString('hex')
  const statePayload = Buffer.from(JSON.stringify({ nonce, userId })).toString('base64url')
  const redirectUri = `${base}/api/integrations/callback/google-drive`

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    // drive.file — only access files created by ContentFlow (least-privilege)
    scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile',
    access_type: 'offline',
    state: statePayload,
    prompt: 'consent',
  })}`

  return NextResponse.redirect(url)
}
