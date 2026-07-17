// Async sensitivity retry for Seedance UGC renders.
//
// Seedance can accept a job at submit time and only flag it as sensitive
// (E005) mid-render. The submit-time grid ladder in /api/ugc/animate can't
// catch those — so the client's status poller calls this endpoint when it
// sees a failed render with a sensitivity error. We regridify the anchor
// frame with the NEXT parameter set from the ladder, re-attach the product
// reference, resubmit Seedance with the same prompt, and hand the new
// prediction id back so polling continues seamlessly. No extra credits are
// charged — the user already paid for this render.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { submitSeedanceJob } from '@/lib/replicate'
import { gridify, GRID_RETRIES, attachProductReference, isSensitivityFlag } from '@/lib/gridify'

export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: userData } = await supabase.auth.getUser(authHeader.slice(7))
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = userData.user.id

    const body = await request.json()
    const failedPredictionId = String(body?.failedPredictionId ?? '').trim()
    if (!failedPredictionId) {
      return NextResponse.json({ error: 'Missing failedPredictionId' }, { status: 400 })
    }

    // Find the generation row that owns this prediction.
    const { data: rows, error: qErr } = await supabase
      .from('ugc_content')
      .select('id, components')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(25)
    if (qErr) throw qErr
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = (rows ?? []).find((r: any) => r?.components?.video?.videoId === failedPredictionId)
    if (!row) return NextResponse.json({ error: 'Generation not found' }, { status: 404 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const components: any = row.components ?? {}
    const ctx = components.retryContext
    if (!ctx?.anchorFrameUrl || !ctx?.prompt) {
      return NextResponse.json({ error: 'No retry context on this generation', exhausted: true }, { status: 409 })
    }

    const attempt = Number(components.grid?.attempt ?? 1) // 1-based
    if (attempt >= GRID_RETRIES.length) {
      return NextResponse.json({ error: 'Grid retry ladder exhausted', exhausted: true }, { status: 409 })
    }
    const nextParams = GRID_RETRIES[attempt] // attempt is 1-based → next 0-based index

    console.log(`[ugc/retry] regridifying with attempt ${attempt + 1}/${GRID_RETRIES.length}`, nextParams)

    // Rebuild the grid from the stored anchor frame.
    const anchorRes = await fetch(ctx.anchorFrameUrl)
    if (!anchorRes.ok) throw new Error(`Fetch anchor frame failed ${anchorRes.status}`)
    const anchorBuf = Buffer.from(await anchorRes.arrayBuffer())
    let gridBuf = await gridify(anchorBuf, nextParams)

    // Re-attach the product reference panel if we stored one.
    if (typeof ctx.productRefUrl === 'string' && ctx.productRefUrl.startsWith('http')) {
      try {
        const prodRes = await fetch(ctx.productRefUrl)
        if (prodRes.ok) {
          gridBuf = await attachProductReference(gridBuf, Buffer.from(await prodRes.arrayBuffer()))
        }
      } catch (err) {
        console.warn('[ugc/retry] product re-attach failed, grid-only:', err instanceof Error ? err.message : err)
      }
    }

    const filename = `hero-frames/${userId}-${Date.now()}-grid-retry${attempt + 1}.png`
    const { error: upErr } = await supabase.storage
      .from('ugc-assets')
      .upload(filename, gridBuf, { contentType: 'image/png', upsert: false })
    if (upErr) throw new Error(`Grid upload failed: ${upErr.message}`)
    const gridUrl = supabase.storage.from('ugc-assets').getPublicUrl(filename).data.publicUrl

    let newPrediction: { predictionId: string }
    try {
      newPrediction = await submitSeedanceJob({
        prompt: String(ctx.prompt),
        durationSeconds: Number(ctx.durationSeconds) || 10,
        aspectRatio: ctx.aspectRatio ?? '9:16',
        startImageUrl: gridUrl,
        resolution: ctx.resolution ?? '1080p',
        enableAudio: true,
        engine: ctx.engine === 'seedance-mini' ? 'seedance-mini' : 'seedance-2',
      })
    } catch (err) {
      // If even the resubmit is flagged at submit time, surface exhaustion
      // state so the client can stop retrying if the ladder is done.
      if (isSensitivityFlag(err) && attempt + 1 >= GRID_RETRIES.length) {
        return NextResponse.json({ error: 'Flagged again on final grid attempt', exhausted: true }, { status: 409 })
      }
      throw err
    }

    // Update the row: new prediction id + advanced ladder position.
    const updatedComponents = {
      ...components,
      video: { ...components.video, videoId: newPrediction.predictionId, status: 'processing' },
      grid: {
        ...components.grid,
        attempt: attempt + 1,
        params: nextParams,
        url: gridUrl,
        sensitivityRetries: [
          ...(components.grid?.sensitivityRetries ?? []),
          { attempt, error: 'async E005 during render', async: true },
        ],
      },
    }
    await supabase
      .from('ugc_content')
      .update({ components: updatedComponents })
      .eq('id', row.id)

    console.log(`[ugc/retry] resubmitted as ${newPrediction.predictionId} (grid attempt ${attempt + 1})`)
    return NextResponse.json({
      videoId: newPrediction.predictionId,
      attempt: attempt + 1,
      maxAttempts: GRID_RETRIES.length,
    })
  } catch (err) {
    console.error('[ugc/retry] failed:', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Retry failed' },
      { status: 500 },
    )
  }
}
