import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const state = Math.random().toString(36).substring(7)
  const appId = process.env.FACEBOOK_APP_ID
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/callback/instagram`

  // For development testing, use minimal scopes
  const scopes = 'pages_read_engagement,pages_manage_posts'

  const facebookOAuthUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${state}&response_type=code`

  // Store state in cookie for CSRF protection
  const response = NextResponse.redirect(facebookOAuthUrl)
  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
  })

  return response
}
