import { createClient } from '@supabase/supabase-js'
import { initializeUserCredits } from '@/lib/credits'
import { sendWelcomeEmail } from '@/lib/email'
import { NextRequest } from 'next/server'

// Simple in-process rate limiter: max 5 signups per IP per 10 minutes
const signupAttempts = new Map<string, { count: number; reset: number }>()
const RATE_LIMIT = 5
const RATE_WINDOW_MS = 10 * 60 * 1000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = signupAttempts.get(ip)
  if (!entry || now > entry.reset) {
    signupAttempts.set(ip, { count: 1, reset: now + RATE_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return Response.json({ error: 'Too many signup attempts. Try again later.' }, { status: 429 })
  }

  try {
    const body = await request.json()
    const { email, password, fullName } = body

    if (!email || !password || !fullName) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (typeof email !== 'string' || !EMAIL_RE.test(email) || email.length > 320) {
      return Response.json({ error: 'Invalid email address' }, { status: 400 })
    }

    if (typeof password !== 'string' || password.length < 8) {
      return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    if (password.length > 128) {
      return Response.json({ error: 'Password too long' }, { status: 400 })
    }

    if (typeof fullName !== 'string' || fullName.trim().length < 1 || fullName.length > 120) {
      return Response.json({ error: 'Invalid name' }, { status: 400 })
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
