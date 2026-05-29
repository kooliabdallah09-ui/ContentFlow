import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const base = process.env.NEXT_PUBLIC_APP_URL

  if (error) return NextResponse.redirect(`${base}/settings/integrations?error=${error}`)

  if (!code || !state)
    return NextResponse.redirect(`${base}/settings/integrations?error=missing_params`)

  let userId: string
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'))
    userId = decoded.userId
  } catch {
    return NextResponse.redirect(`${base}/settings/integrations?error=invalid_state`)
  }
  if (!userId)
    return NextResponse.redirect(`${base}/settings/integrations?error=not_authenticated`)

  try {
    const redirectUri = `${base}/api/integrations/callback/instagram`

    // Exchange code via Facebook Graph API (Instagram Graph API uses FB token exchange)
    const tokenRes = await fetch('https://graph.facebook.com/v18.0/oauth/access_token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: process.env.FACEBOOK_APP_ID!,
        client_secret: process.env.FACEBOOK_APP_SECRET!,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code,
      }),
    })
    const tokenData = await tokenRes.json()
    if (!tokenData.access_token)
      throw new Error(tokenData.error?.message || 'Failed to get access token')

    // Get Facebook Pages managed by the user, then find linked Instagram Business account
    const pagesRes = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,instagram_business_account&access_token=${tokenData.access_token}`
    )
    const pagesData = await pagesRes.json()

    let igAccountId: string | null = null
    let igUsername: string | null = null

    if (pagesData.data?.length > 0) {
      for (const page of pagesData.data) {
        if (page.instagram_business_account?.id) {
          igAccountId = page.instagram_business_account.id
          // Fetch IG username
          const igRes = await fetch(
            `https://graph.facebook.com/v18.0/${igAccountId}?fields=id,username&access_token=${tokenData.access_token}`
          )
          const igData = await igRes.json()
          igUsername = igData.username || igAccountId
          break
        }
      }
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    await supabase.from('integrations').upsert({
      user_id: userId,
      platform: 'instagram',
      account_id: igAccountId,
      account_name: igUsername,
      access_token: tokenData.access_token,
      is_connected: true,
      connected_at: new Date().toISOString(),
    }, { onConflict: 'user_id,platform' })

    return NextResponse.redirect(`${base}/settings/integrations?success=instagram`)
  } catch (err) {
    console.error('Instagram callback error:', err)
    return NextResponse.redirect(`${base}/settings/integrations?error=callback_error`)
  }
}
