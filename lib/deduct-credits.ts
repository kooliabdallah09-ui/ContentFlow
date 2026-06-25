import { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = SupabaseClient<any, any, any>

interface DeductResult {
  newBalance: number
  newPackCredits: number
}

/**
 * Deduct credits from the two-pool system:
 *   1. Monthly credits are consumed first.
 *   2. Pack credits are only touched after monthly credits are exhausted.
 *
 * This ensures pack_credits always reflects exactly how many one-time
 * purchased credits remain, so monthly renewals can restore the correct
 * balance = monthly_credits + pack_credits without estimation.
 */
export async function deductCredits(
  supabase: Supa,
  userId: string,
  cost: number,
  currentBalance: number,
  currentPackCredits: number,
): Promise<DeductResult> {
  const monthlyRemaining = currentBalance - currentPackCredits
  let newPackCredits = currentPackCredits

  if (cost > monthlyRemaining) {
    // Monthly pool exhausted — take the remainder from pack credits
    const packSpend = cost - Math.max(0, monthlyRemaining)
    newPackCredits = Math.max(0, currentPackCredits - packSpend)
  }

  const newBalance = currentBalance - cost

  await supabase
    .from('user_credits')
    .update({ balance: newBalance, pack_credits: newPackCredits })
    .eq('user_id', userId)

  return { newBalance, newPackCredits }
}
