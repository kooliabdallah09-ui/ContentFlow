import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { submitSeedanceJob } from '@/lib/replicate'
import { buildShotPrompt, PODCAST_SHOT_DURATIONS, type PodcastScript, type PodcastCharacter } from '@/lib/podcast-ad'
import { deductCredits } from '@/lib/deduct-credits'
import { SEEDANCE_CR_PER_SECOND } from '@/lib/ugc-pricing'

export const maxDuration = 180

// Podcast Ad — kicks off all 6 Seedance jobs at once.
// Returns 6 predictionIds; client polls each via /api/ugc/video-status.
//
// Shot 6 is the product-reveal outro — it wants shot 5's LAST frame as its
// start_image, but we don't have that yet at kickoff time. Workaround for v1:
// use the influencer portraits as reference anchors and let Seedance
// synthesise the seated composition. Once we add frame-extraction from a
// finished Seedance video, shot 6 can chain from shot 5 properly.

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: userData } = await supabase.auth.getUser(authHeader.slice(7))
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = userData.user.id

    const body = await request.json()
    const {
      script,
      hostInfluencerId,
      expertInfluencerId,
      productName,
      productDescription,
      productImageUrl,
      resolution,
    } = body as {
      script?: PodcastScript
      hostInfluencerId?: string
      expertInfluencerId?: string
      productName?: string
      productDescription?: string
      productImageUrl?: string
      resolution?: '720p' | '1080p'
    }

    if (!script || typeof script !== 'object') return NextResponse.json({ error: 'Script required' }, { status: 400 })
    if (!hostInfluencerId || !expertInfluencerId) return NextResponse.json({ error: 'Host + Expert influencers required' }, { status: 400 })
    if (!productName) return NextResponse.json({ error: 'Product name required' }, { status: 400 })

    // Load both influencers for character sheets + portraits.
    const { data: infs } = await supabase
      .from('user_influencers')
      .select('id, name, appearance_prompt, portrait_url, character_sheet_url')
      .in('id', [hostInfluencerId, expertInfluencerId])
      .eq('user_id', userId)
    const byId = new Map((infs ?? []).map(r => [String(r.id), r]))
    const hostRow = byId.get(hostInfluencerId)
    const expertRow = byId.get(expertInfluencerId)
    if (!hostRow || !expertRow) return NextResponse.json({ error: 'Both influencers must exist in your library' }, { status: 404 })

    const host: PodcastCharacter = { role: 'host', name: hostRow.name, appearanceLine: hostRow.appearance_prompt.slice(0, 400) }
    const expert: PodcastCharacter = { role: 'expert', name: expertRow.name, appearanceLine: expertRow.appearance_prompt.slice(0, 400) }

    // Reference images for Seedance — character sheet + portrait per person.
    // Cap the list to prevent overrunning the reference budget.
    const refUrls: string[] = []
    if (hostRow.character_sheet_url) refUrls.push(hostRow.character_sheet_url)
    if (hostRow.portrait_url) refUrls.push(hostRow.portrait_url)
    if (expertRow.character_sheet_url) refUrls.push(expertRow.character_sheet_url)
    if (expertRow.portrait_url) refUrls.push(expertRow.portrait_url)

    // Cost — Seedance per-second at chosen resolution × sum of shot durations.
    const totalSeconds = Object.values(PODCAST_SHOT_DURATIONS).reduce((a, b) => a + b, 0)
    const res: '720p' | '1080p' = resolution === '1080p' ? '1080p' : '720p'
    const perSec = SEEDANCE_CR_PER_SECOND[res]
    const totalCost = Math.ceil(perSec * totalSeconds)

    const { data: credits } = await supabase
      .from('user_credits')
      .select('balance, pack_credits')
      .eq('user_id', userId)
      .maybeSingle()
    if (!credits || credits.balance < totalCost) {
      return NextResponse.json({ error: `Insufficient credits. Need ${totalCost}.` }, { status: 402 })
    }

    // Submit all 6 shots in parallel.
    const shotIndices = [1, 2, 3, 4, 5, 6] as const
    const submits = await Promise.allSettled(shotIndices.map(async idx => {
      const prompt = buildShotPrompt({
        host, expert,
        productName,
        productDescription,
        script,
        shotIndex: idx,
      })
      const { predictionId } = await submitSeedanceJob({
        prompt,
        durationSeconds: PODCAST_SHOT_DURATIONS[idx],
        aspectRatio: '9:16',
        resolution: res,
        enableAudio: true,   // podcast ad needs native dialogue audio
        engine: 'seedance-2',
        // Shot 6 wants product image as anchor for the reveal; shots 1-5
        // use the character references.
        referenceImageUrls: idx === 6 && productImageUrl ? [...refUrls.slice(0, 4), productImageUrl] : refUrls.slice(0, 4),
      })
      return { shot: idx, predictionId }
    }))

    const jobs: Array<{ shot: number; predictionId: string | null; error?: string }> = submits.map((r, i) => {
      if (r.status === 'fulfilled') return { shot: shotIndices[i], predictionId: r.value.predictionId }
      return { shot: shotIndices[i], predictionId: null, error: r.reason instanceof Error ? r.reason.message : 'submit failed' }
    })

    const succeeded = jobs.filter(j => j.predictionId).length
    if (succeeded === 0) {
      return NextResponse.json({ error: 'All shots failed to submit', jobs }, { status: 500 })
    }

    // Charge proportionally — only for shots that submitted.
    const charged = Math.ceil((totalCost * succeeded) / shotIndices.length)
    const { newBalance, newPackCredits } = await deductCredits(
      supabase, userId, charged, credits.balance, credits.pack_credits ?? 0,
    )
    await supabase.from('user_credits')
      .update({ balance: newBalance, pack_credits: newPackCredits })
      .eq('user_id', userId)

    return NextResponse.json({
      jobs,
      creditsCharged: charged,
      newBalance,
      totalShots: shotIndices.length,
      submitted: succeeded,
    })
  } catch (err) {
    console.error('podcast-ad/render error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Render failed' }, { status: 500 })
  }
}
