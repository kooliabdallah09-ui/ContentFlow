import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId') || request.cookies.get('cf_user_id')?.value || ''
  const nonce = crypto.randomBytes(16).toString('hex')
  const statePayload = Buffer.from(JSON.stringify({ nonce, userId })).toString('base64url')
  const appId = process.env.FACEBOOK_APP_ID
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/callback/facebook`
  const scopes = ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list'].join(',')
  const url = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${statePayload}&response_type=code`
  return NextResponse.redirect(url)
}
