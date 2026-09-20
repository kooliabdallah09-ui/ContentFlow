import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { initializeUserCredits } from '@/lib/credits'
import { sendWelcomeEmail } from '@/lib/email'
import { NextRequest } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

// Seed source: whichever admin owns the canonical Sloane Mercer record.
// Overridable via env for staging / test environments.
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'abdallah.kooli@icloud.com'
// Seeded to every new user account as a default starter influencer.
const DEFAULT_INFLUENCER_HANDLE = '@sloanemerc'

async function copyDefaultInfluencers(supabase: SupabaseClient, newUserId: string) {
  // Find admin's user ID by email
  const { data: adminList } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const adminUser = adminList?.users?.find(u => u.email === ADMIN_EMAIL)
  if (!adminUser) {
    console.warn('[signup] admin user not found:', ADMIN_EMAIL)
    return
  }

  // Fetch Sloane Mercer by handle (unique, avoids name collisions)
  const { data: influencer } = await supabase
    .from('user_influencers')
    .select('name, handle, bio, personality, niche, appearance_prompt, portrait_url, character_sheet_url, reference_urls')
    .eq('user_id', adminUser.id)
    .eq('handle', DEFAULT_INFLUENCER_HANDLE)
    .maybeSingle()

  if (!influencer) {
    console.warn('[signup] default influencer not found in admin account:', DEFAULT_INFLUENCER_HANDLE)
    return
  }

  const { error } = await supabase.from('user_influencers').insert({
    user_id: newUserId,
    name: influencer.name,
    handle: influencer.handle,
    bio: influencer.bio,
    personality: influencer.personality,
    niche: influencer.niche,
    appearance_prompt: influencer.appearance_prompt,
    portrait_url: influencer.portrait_url,
    character_sheet_url: influencer.character_sheet_url,
    reference_urls: influencer.reference_urls,
    is_seed: true,
  })
  if (error) console.error('[signup] insert default influencer failed:', error.message)
}

// Max 5 signups per IP per 10 minutes. Shared across instances — each free
// account grants signup credits, so this is a spend control, not just hygiene.
const RATE_LIMIT = 5
const RATE_WINDOW_MS = 10 * 60 * 1000

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function POST(request: NextRequest) {
  const limit = await checkRateLimit(
    'signup', getClientIp(request), RATE_LIMIT, RATE_WINDOW_MS,
  )
  if (!limit.ok) {
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

    // Copy Sloane Mercer + Marco Vell from admin account to every new user
    copyDefaultInfluencers(supabase, authData.user.id).catch(err =>
      console.error('[signup] copyDefaultInfluencers failed:', err)
    )

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
