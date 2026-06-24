import { createClient } from '@supabase/supabase-js'
import { initializeUserCredits } from '@/lib/credits'
import { sendWelcomeEmail } from '@/lib/email'

export async function POST(request: Request) {
  try {
    const { email, password, fullName } = await request.json()

    if (!email || !password || !fullName) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      return Response.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Sign up user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { full_name: fullName },
      email_confirm: true,
    })

    if (authError) {
      return Response.json({ error: authError.message }, { status: 400 })
    }

    if (!authData.user) {
      return Response.json({ error: 'Failed to create user' }, { status: 500 })
    }

    // Initialize credits for new user
    try {
      await initializeUserCredits(authData.user.id, 'free')
    } catch (creditsError) {
      console.error('Failed to initialize credits:', creditsError)
    }

    // Welcome email — fire and forget, never block signup
    sendWelcomeEmail(email, fullName).catch(() => {})

    return Response.json(
      {
        user: authData.user,
        message: 'Signup successful',
      },
      { status: 201 }
    )
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Signup failed' },
      { status: 500 }
    )
  }
}
