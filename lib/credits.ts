import { getSupabase } from './auth'

export const CREDIT_COSTS = {
  blog: 100,
  social: 50,
  email: 75,
  image: 80,
  video: 300,
  voice: 150,
} as const

export const PLAN_CREDITS = {
  free: { monthly: 50, signup_bonus: 150 },
  starter: { monthly: 1000 },
  pro: { monthly: 4000 },
  agency: { monthly: 15000 },
} as const

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

export async function addCredits(userId: string, amount: number, transactionType: string = 'purchase', description?: string) {
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
