import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const base = process.env.NEXT_PUBLIC_APP_URL
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const statePayload = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) return NextResponse.redirect(`${base}/settings/integrations?error=${error}`)
    if (!code || !statePayload) return NextResponse.redirect(`${base}/settings/integrations?error=missing_params`)

    // Decode state payload — contains nonce, userId, codeVerifier
    let userId: string
    let codeVerifier: string
    try {
      const decoded = JSON.parse(Buffer.from(statePayload, 'base64url').toString('utf8'))
      userId = decoded.userId
      codeVerifier = decoded.codeVerifier
    } catch {
      return NextResponse.redirect(`${base}/settings/integrations?error=invalid_state`)
    }

    if (!userId) return NextResponse.redirect(`${base}/settings/integrations?error=missing_user`)
    if (!codeVerifier) return NextResponse.redirect(`${base}/settings/integrations?error=missing_code_verifier`)

    // Exchange code for tokens
    const tokenResponse = await fetch('https://api.x.com/2/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.TWITTER_CLIENT_ID!,
        redirect_uri: `${base}/api/integrations/twitter/callback`,
        code_verifier: codeVerifier,
      }).toString(),
    })

    const tokens = await tokenResponse.json()
    if (!tokens.access_token)
      return NextResponse.redirect(`${base}/settings/integrations?error=token_exchange_failed`)

    // Get Twitter username
    const userRes = await fetch('https://api.x.com/2/users/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const userData = await userRes.json()
    const username = userData?.data?.username || null

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    await supabase.from('integrations').upsert({
      user_id: userId,
      platform: 'twitter',
      account_name: username,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      connected_at: new Date().toISOString(),
      is_connected: true,
    }, { onConflict: 'user_id,platform' })

    return NextResponse.redirect(`${base}/settings/integrations?success=twitter`)
  } catch (error) {
    console.error('[twitter/callback] error:', error)
    return NextResponse.redirect(`${base}/settings/integrations?error=callback_error`)
  }
}
