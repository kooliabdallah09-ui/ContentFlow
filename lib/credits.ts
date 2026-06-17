import { getSupabase } from './auth'
import { CREDIT_COSTS as PLAN_CREDIT_COSTS } from './planConfig'

// Single source of truth — delegate to planConfig.
// Note: UGC video pricing is dynamic (tier + duration); see lib/tiers.ts.
// The 'video' entry below is a legacy fallback for the standalone HeyGen
// video generator (pre-UGC). Kept at 40cr so the legacy form doesn't break.
export const CREDIT_COSTS = {
  blog: PLAN_CREDIT_COSTS.blog,
  social: PLAN_CREDIT_COSTS.social,
  email: PLAN_CREDIT_COSTS.email,
  image: PLAN_CREDIT_COSTS.image,
  video: 40,
  voice: PLAN_CREDIT_COSTS.voice,
} as const

// Free tier intentionally has NO monthly refill — 60cr signup is one-shot.
// Sized to cover ~1 Standard 4s video (52cr) + a few product images (3cr each).
// Prevents free users from indefinitely consuming Sora calls.
export const PLAN_CREDITS = {
  free: { monthly: 0, signup_bonus: 60 },
  starter: { monthly: 800 },
  pro: { monthly: 2000 },
  agency: { monthly: 6500 },
} as const

// Pay-as-you-go credit packs. Sold on the billing page, no subscription.
// Per-credit price intentionally above subscription rate to push commit.
export const CREDIT_PACKS = [
  { id: 'small',  credits: 500,  priceUSD: 15,  perCredit: 0.030 },
  { id: 'medium', credits: 1500, priceUSD: 40,  perCredit: 0.027, bonus: 11 },
  { id: 'large',  credits: 5000, priceUSD: 120, perCredit: 0.024, bonus: 20 },
] as const

export async function getUserCredits(userId: string) {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not available')

  const { data, error } = await supabase
    .from('user_credits')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) throw error
  return data
}

export async function initializeUserCredits(userId: string, plan: keyof typeof PLAN_CREDITS = 'free') {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not available')

  const monthlyCredits = PLAN_CREDITS[plan].monthly
  const resetDate = new Date()
  resetDate.setMonth(resetDate.getMonth() + 1)
  resetDate.setDate(1)

  const { data, error } = await supabase
    .from('user_credits')
    .insert({
      user_id: userId,
      balance: monthlyCredits + (plan === 'free' ? PLAN_CREDITS.free.signup_bonus : 0),
      plan,
      monthly_credits: monthlyCredits,
      reset_date: resetDate.toISOString(),
    })
    .select()
    .single()

  if (error) throw error

  // Log signup bonus transaction for free plan
  if (plan === 'free') {
    await logCreditTransaction(userId, PLAN_CREDITS.free.signup_bonus, 'bonus', undefined, 'Signup bonus')
  }

  return data
}

export async function deductCredits(
  userId: string,
  amount: number,
  contentType: string,
  contentId?: string,
  description?: string
) {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not available')

  // Check if user has enough credits
  const credits = await getUserCredits(userId)
  if (credits.balance < amount) {
    throw new Error('Insufficient credits')
  }

  // Deduct credits
  const { error: updateError } = await supabase
    .from('user_credits')
    .update({ balance: credits.balance - amount })
    .eq('user_id', userId)

  if (updateError) throw updateError

  // Log transaction
  await logCreditTransaction(
    userId,
    amount,
    'generation',
    contentType,
    contentId,
    description || `${contentType} generation`
  )

  return { newBalance: credits.balance - amount }
}

export async function addCredits(userId: string, amount: number, transactionType: 'generation' | 'purchase' | 'refund' | 'monthly_reset' | 'bonus' = 'purchase', description?: string) {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not available')

  const credits = await getUserCredits(userId)

  const { error: updateError } = await supabase
    .from('user_credits')
    .update({ balance: credits.balance + amount })
    .eq('user_id', userId)

  if (updateError) throw updateError

  await logCreditTransaction(userId, amount, transactionType, undefined, undefined, description || `${transactionType}: +${amount} credits`)

  return { newBalance: credits.balance + amount }
}

export async function logCreditTransaction(
  userId: string,
  amount: number,
  transactionType: 'generation' | 'purchase' | 'refund' | 'monthly_reset' | 'bonus',
  contentType?: string,
  contentId?: string,
  description?: string
) {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not available')

  const { error } = await supabase.from('credit_transactions').insert({
    user_id: userId,
    amount,
    transaction_type: transactionType,
    content_type: contentType,
    related_content_id: contentId,
    description: description || `${transactionType}: ${amount} credits`,
  })

  if (error) throw error
}

export async function resetMonthlyCredits(userId: string) {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not available')

  const credits = await getUserCredits(userId)
  const resetDate = new Date()
  resetDate.setMonth(resetDate.getMonth() + 1)
  resetDate.setDate(1)

  const { error } = await supabase
    .from('user_credits')
    .update({
      balance: credits.monthly_credits,
      reset_date: resetDate.toISOString(),
    })
    .eq('user_id', userId)

  if (error) throw error

  await logCreditTransaction(userId, credits.monthly_credits, 'monthly_reset', undefined, undefined, 'Monthly credit reset')
}

export function getCreditCost(contentType: string): number {
  return CREDIT_COSTS[contentType as keyof typeof CREDIT_COSTS] || 100
}
