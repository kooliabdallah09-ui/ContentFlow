import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Check for errors from Facebook
  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=${error}`
    )
  }

  // Verify state for CSRF protection
  const storedState = request.cookies.get('oauth_state')?.value
  if (!state || state !== storedState) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=invalid_state`
    )
  }

  if (!code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=no_code`
    )
  }

  try {
    // Exchange code for access token
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/callback/facebook`
    const tokenResponse = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token`,
      {
        method: 'POST',
        body: new URLSearchParams({
          client_id: process.env.FACEBOOK_APP_ID!,
          client_secret: process.env.FACEBOOK_APP_SECRET!,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
          code,
        }),
      }
    )

    const tokenData = await tokenResponse.json()

    if (!tokenData.access_token) {
      throw new Error(tokenData.error?.message || 'Failed to get access token')
    }

    // Get user's Facebook pages
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?fields=id,name&access_token=${tokenData.access_token}`
    )

    const pagesData = await pagesResponse.json()

    if (!pagesData.data || pagesData.data.length === 0) {
      throw new Error('No Facebook pages found. Please create a page first.')
    }

    // Use first page as default
    const page = pagesData.data[0]

    // Store token in Supabase
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            try {
              cookieStore.set(name, value, options)
            } catch {
              // Silently fail
            }
          },
          remove(name: string) {
            try {
              cookieStore.delete(name)
            } catch {
              // Silently fail
            }
          },
        },
      }
    )
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=not_authenticated`
      )
    }

    // Upsert integration
    const { error: dbError } = await supabase
      .from('integrations')
      .upsert(
        {
          user_id: user.id,
          platform: 'facebook',
          account_id: page.id,
          account_name: page.name,
          access_token: tokenData.access_token,
          is_connected: true,
          connected_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,platform',
        }
      )

    if (dbError) {
      console.error('Database error:', dbError)
      throw dbError
    }

    // Redirect back with success
    const response = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?success=facebook`
    )
    response.cookies.delete('oauth_state')

    return response
  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=callback_error`
    )
  }
}
