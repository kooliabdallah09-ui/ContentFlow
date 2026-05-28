import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const statePayload = searchParams.get('state')
  const error = searchParams.get('error')
  const base = process.env.NEXT_PUBLIC_APP_URL

  if (error) return NextResponse.redirect(`${base}/settings/integrations?error=${error}`)
  if (!code || !statePayload) return NextResponse.redirect(`${base}/settings/integrations?error=missing_params`)

  let userId: string
  try {
    const decoded = JSON.parse(Buffer.from(statePayload, 'base64url').toString('utf8'))
    userId = decoded.userId
  } catch {
    return NextResponse.redirect(`${base}/settings/integrations?error=invalid_state`)
  }
  if (!userId) return NextResponse.redirect(`${base}/settings/integrations?error=not_authenticated`)

  try {
    const redirectUri = `${base}/api/integrations/callback/tiktok`
    const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY!,
        client_secret: process.env.TIKTOK_CLIENT_SECRET!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    })
    const tokenData = await tokenRes.json()
    const token = tokenData.data ?? tokenData
    if (!token.access_token) throw new Error(`No access token: ${JSON.stringify(tokenData)}`)

    const userRes = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=display_name,avatar_url', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    })
    const userData = await userRes.json()
    const displayName = userData.data?.user?.display_name || token.open_id

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    await supabase.from('integrations').upsert({
      user_id: userId,
      platform: 'tiktok',
      account_id: token.open_id,
      account_name: displayName,
      access_token: token.access_token,
      refresh_token: token.refresh_token || null,
      is_connected: true,
      connected_at: new Date().toISOString(),
    }, { onConflict: 'user_id,platform' })

    return NextResponse.redirect(`${base}/settings/integrations?success=tiktok`)
  } catch (err) {
    console.error('TikTok callback error:', err)
    return NextResponse.redirect(`${base}/settings/integrations?error=callback_error`)
  }
}
