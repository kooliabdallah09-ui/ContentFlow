import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { initializeWordPressPublisher } from '@/lib/integrations/wordpress'

export async function POST(request: NextRequest) {
  try {
    const { siteUrl, username, appPassword } = await request.json()

    if (!siteUrl || !username || !appPassword) {
      return NextResponse.json(
        { error: 'Missing siteUrl, username, or appPassword' },
        { status: 400 }
      )
    }

    // Verify credentials by testing the connection
    const publisher = initializeWordPressPublisher(siteUrl, username, appPassword)
    const isValid = await publisher.verifyCredentials()

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid WordPress credentials. Please check your site URL, username, and application password.' },
        { status: 401 }
      )
    }

    // Get user from Supabase
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
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Store or update integration in database
    const { data: existingIntegration } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', 'wordpress')
      .single()

    let result

    if (existingIntegration) {
      // Update existing
      result = await supabase
        .from('integrations')
        .update({
          access_token: appPassword,
          account_id: username,
          metadata: { siteUrl },
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingIntegration.id)
        .select()
    } else {
      // Create new
      result = await supabase
        .from('integrations')
        .insert({
          user_id: user.id,
          platform: 'wordpress',
          access_token: appPassword,
          account_id: username,
          metadata: { siteUrl },
        })
        .select()
    }

    if (result.error) {
      return NextResponse.json(
        { error: 'Failed to save integration' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'WordPress integration connected successfully',
      integration: result.data?.[0],
    })
  } catch (error) {
    console.error('WordPress connection error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Connection failed' },
      { status: 500 }
    )
  }
}
