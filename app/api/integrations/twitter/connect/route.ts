import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

function base64URLEncode(buffer: Buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId') || request.cookies.get('cf_user_id')?.value || ''
    const nonce = crypto.randomBytes(16).toString('hex')
    const codeVerifier = base64URLEncode(crypto.randomBytes(32))
    const codeChallenge = base64URLEncode(
      crypto.createHash('sha256').update(codeVerifier).digest()
    )

    // Encode everything in state — no cookies needed, works reliably on production
    // Format: nonce|userId|codeVerifier (pipe-separated, base64url encoded)
    const statePayload = Buffer.from(JSON.stringify({ nonce, userId, codeVerifier })).toString('base64url')

    const url = `https://twitter.com/i/oauth2/authorize?${new URLSearchParams({
      response_type: 'code',
      client_id: process.env.TWITTER_CLIENT_ID!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/twitter/callback`,
      scope: 'tweet.read tweet.write users.read offline.access',
      state: statePayload,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })}`

    return NextResponse.redirect(url)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Connection failed' },
      { status: 500 }
    )
  }
}
