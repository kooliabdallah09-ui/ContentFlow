import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

function base64URLEncode(buffer: Buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.cookies.get('cf_user_id')?.value || ''
    const state = crypto.randomBytes(32).toString('hex')
    const codeVerifier = base64URLEncode(crypto.randomBytes(32))
    const codeChallenge = base64URLEncode(
      crypto.createHash('sha256').update(codeVerifier).digest()
    )

    const url = `https://twitter.com/i/oauth2/authorize?${new URLSearchParams({
      response_type: 'code',
      client_id: process.env.TWITTER_CLIENT_ID!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/twitter/callback`,
      scope: 'tweet.read tweet.write users.read offline.access',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })}`

    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 600,
      path: '/',
    }
    const response = NextResponse.redirect(url)
    // Encode userId into state cookie so we don't need a separate cookie
    response.cookies.set('twitter_oauth_state', `${state}::${userId}`, cookieOpts)
    response.cookies.set('twitter_code_verifier', codeVerifier, cookieOpts)

    return response
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Connection failed' },
      { status: 500 }
    )
  }
}
