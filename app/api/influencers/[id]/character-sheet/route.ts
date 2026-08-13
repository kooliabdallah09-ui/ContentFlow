// Generate (or regenerate) the multi-angle character sheet for an existing
// influencer. Used for influencers created before sheets existed, or when
// the user wants a fresh turnaround. 10 cr.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateCharacterSheet } from '@/lib/character-sheet'
import { deductCredits } from '@/lib/deduct-credits'
import { canAccessInfluencerStudio } from '@/lib/pov-access'

export const maxDuration = 300

export const SHEET_CR = 8      // 2K NB Pro turnaround ≈ $0.14 raw × 1.4
export const SHEET_4K_CR = 14  // 4K NB Pro turnaround ≈ $0.24 raw × 1.4

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const header = request.headers.get('Authorization')
    if (!header?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: userData } = await supabase.auth.getUser(header.slice(7))
    if (!userData.user || !canAccessInfluencerStudio(userData.user.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = userData.user.id
    const { id } = await params

    // Character sheets are always NB Pro at 4K now — the identity anchor
    // for every downstream shoot needs sharp face detail, and the 2K
    // fallback shipped visibly cheap renders. Body params are ignored.
    const body = await request.json().catch(() => ({}))
    const style: 'lifestyle' | 'turnaround' = body.style === 'turnaround' ? 'turnaround' : 'lifestyle'
    const resolution: '2K' | '4K' = '4K'
    const cost = SHEET_4K_CR

    const { data: influencer } = await supabase
      .from('user_influencers')
      .select('id, appearance_prompt, portrait_url')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()
    if (!influencer) return NextResponse.json({ error: 'Influencer not found' }, { status: 404 })

    const { data: credits } = await supabase
      .from('user_credits')
      .select('balance, pack_credits')
      .eq('user_id', userId)
      .maybeSingle()
    if (!credits || credits.balance < cost) {
      return NextResponse.json({ error: `Insufficient credits. Need ${cost}.` }, { status: 402 })
    }

    const sheetUrl = await generateCharacterSheet({
      supabase, userId,
      influencerId: influencer.id,
      appearancePrompt: influencer.appearance_prompt,
      portraitUrl: influencer.portrait_url,
      resolution,
      style,
    })

    const { newBalance, newPackCredits } = await deductCredits(
      supabase, userId, cost, credits.balance, credits.pack_credits ?? 0,
    )
    await supabase.from('user_credits')
      .update({ balance: newBalance, pack_credits: newPackCredits })
      .eq('user_id', userId)

    return NextResponse.json({ characterSheetUrl: sheetUrl, creditsCharged: cost })
  } catch (err) {
    console.error('[influencers/character-sheet] failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
