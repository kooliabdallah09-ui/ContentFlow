import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const base = process.env.NEXT_PUBLIC_APP_URL

  if (error) return NextResponse.redirect(`${base}/settings/integrations?error=${error}`)

  const storedStateFull = request.cookies.get('linkedin_oauth_state')?.value || ''
  const [, userIdFromState] = storedStateFull.split('::')
  if (!state || state !== storedStateFull) return NextResponse.redirect(`${base}/settings/integrations?error=invalid_state`)
  if (!code) return NextResponse.redirect(`${base}/settings/integrations?error=no_code`)

  try {
    const redirectUri = `${base}/api/integrations/callback/linkedin`
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
        redirect_uri: redirectUri,
      }),
    })
    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) throw new Error('Failed to get access token')

    const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const profile = await profileRes.json()

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const userId = userIdFromState || null
    if (!userId) return NextResponse.redirect(`${base}/settings/integrations?error=not_authenticated`)

    await supabase.from('integrations').upsert({
      user_id: userId,
      platform: 'linkedin',
      account_id: profile.sub,
      account_name: profile.name || profile.email || 'LinkedIn User',
      access_token: tokenData.access_token,
      is_connected: true,
      connected_at: new Date().toISOString(),
    }, { onConflict: 'user_id,platform' })

    const response = NextResponse.redirect(`${base}/settings/integrations?success=linkedin`)
    response.cookies.delete('linkedin_oauth_state')
    return response
  } catch (err) {
    console.error('LinkedIn callback error:', err)
    return NextResponse.redirect(`${base}/settings/integrations?error=callback_error`)
  }
}
