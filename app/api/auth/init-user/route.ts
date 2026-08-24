// Idempotent one-time user init. Called by /auth/callback right after a
// Google (OAuth) sign-in completes — those users don't hit the /signup
// endpoint that normally seeds credits + copies the Sloane Mercer influencer.
//
// Safe to call multiple times: if the user already has a user_credits row,
// we short-circuit and don't re-seed anything.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { initializeUserCredits } from '@/lib/credits'
import { sendWelcomeEmail } from '@/lib/email'
import { NextRequest } from 'next/server'

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'abdallah.kooli@icloud.com'
const DEFAULT_INFLUENCER_HANDLE = '@sloanemerc'

async function copyDefaultInfluencers(supabase: SupabaseClient, newUserId: string) {
  const { data: adminList } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const adminUser = adminList?.users?.find(u => u.email === ADMIN_EMAIL)
  if (!adminUser) return

  const { data: influencer } = await supabase
    .from('user_influencers')
    .select('name, handle, bio, personality, niche, appearance_prompt, portrait_url, character_sheet_url, reference_urls')
    .eq('user_id', adminUser.id)
    .eq('handle', DEFAULT_INFLUENCER_HANDLE)
    .maybeSingle()
  if (!influencer) return

  // Skip if the user already has this handle (idempotent).
  const { data: existing } = await supabase
    .from('user_influencers')
    .select('id')
    .eq('user_id', newUserId)
    .eq('handle', DEFAULT_INFLUENCER_HANDLE)
    .maybeSingle()
  if (existing) return

  await supabase.from('user_influencers').insert({
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
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    return Response.json({ error: 'Server not configured' }, { status: 500 })
  }
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const token = authHeader.slice(7)
  const supabase = createClient(supabaseUrl, supabaseKey)
  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = userData.user
  const email = user.email ?? ''
  // Fall back to the local-part of the email if Google didn't return a name
  // (rare but possible). Better than "there" which reads as a broken template.
  const emailLocal = email.split('@')[0] || 'friend'
  const fullName = (user.user_metadata?.full_name ?? user.user_metadata?.name ?? emailLocal).toString()

  // Idempotency check — if the user already has a credits row, this ran before.
  const { data: existingCredits } = await supabase
    .from('user_credits')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (existingCredits) {
    return Response.json({ ok: true, alreadyInitialized: true })
  }

  try {
    await initializeUserCredits(user.id, 'free')
  } catch (e) {
    console.error('[init-user] initializeUserCredits failed:', e)
  }

  // Welcome email — fire and forget, non-blocking
  if (email) sendWelcomeEmail(email, fullName).catch(() => {})

  // Seed Sloane Mercer
  await copyDefaultInfluencers(supabase, user.id).catch(err =>
    console.error('[init-user] copyDefaultInfluencers failed:', err)
  )

  return Response.json({ ok: true, alreadyInitialized: false })
}
