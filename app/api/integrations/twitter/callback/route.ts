import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const base = process.env.NEXT_PUBLIC_APP_URL
  try {
    const cookieStore = await cookies()
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) return NextResponse.redirect(`${base}/settings/integrations?error=${error}`)
    if (!code || !state) return NextResponse.redirect(`${base}/settings/integrations?error=missing_params`)

    const storedStateFull = cookieStore.get('twitter_oauth_state')?.value || ''
    const [storedState, userId] = storedStateFull.split('::')
    if (!storedState || storedState !== state)
      return NextResponse.redirect(`${base}/settings/integrations?error=invalid_state`)
    if (!userId)
      return NextResponse.redirect(`${base}/settings/integrations?error=missing_user`)

    const codeVerifier = cookieStore.get('twitter_code_verifier')?.value
    if (!codeVerifier)
      return NextResponse.redirect(`${base}/settings/integrations?error=missing_code_verifier`)

    // Exchange code for tokens (PKCE — no client_secret needed)
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

    const { data: existing } = await supabase
      .from('integrations')
      .select('id')
      .eq('user_id', userId)
      .eq('platform', 'twitter')
      .single()

    if (existing?.id) {
      await supabase.from('integrations').update({
        account_name: username,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        connected_at: new Date().toISOString(),
      }).eq('id', existing.id)
    } else {
      await supabase.from('integrations').insert({
        user_id: userId,
        platform: 'twitter',
        account_name: username,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        connected_at: new Date().toISOString(),
      })
    }

    const response = NextResponse.redirect(`${base}/settings/integrations?success=twitter`)
    response.cookies.delete('twitter_oauth_state')
    response.cookies.delete('twitter_code_verifier')
    return response
  } catch (error) {
    return NextResponse.redirect(`${base}/settings/integrations?error=callback_error`)
  }
}
