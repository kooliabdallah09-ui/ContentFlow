import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { canAccessFormats } from '@/lib/pov-access'
import { getFormatById, type StateMachineSegment } from '@/lib/formats'
import { submitBackgroundRemovalJob, getBackgroundRemovalStatus, transcribeWithReplicate } from '@/lib/replicate'
import { renderAppDemo, getAppDemoRenderStatus } from '@/lib/formats/app-demo-renderer'

export const maxDuration = 300

interface RenderInput {
  klingRawUrl: string        // rendered Kling talking-head clip (native background, native audio)
  brollUrl?: string          // background video for State A (b_roll)
  appUiUrl?: string          // background video for State C (app_ui)
  // The 3 substituted lines (hook, pivot, demo) — total should match the
  // template's totalSeconds when read aloud.
  hookLine: string
  pivotLine: string
  demoLine: string
  avatarSide?: 'left' | 'right' | 'center'
}

// POST /api/formats/app-demo/render
// Orchestrates the App Demo Composite pipeline end-to-end.
//   1. Whisper transcribes the Kling clip → per-word timestamps
//   2. Replicate background-removal produces the alpha-channel avatar clip
//   3. Shotstack composites everything using the format's state machine
//
// The full render takes 2-4 minutes. This endpoint returns immediately with
// { predictionId, renderId? }; the client polls
// /api/formats/app-demo/status?renderId=X to get the final URL.
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
    if (!canAccessFormats(userData.user.email)) {
      return NextResponse.json({ error: 'App Demo Composite is still in beta' }, { status: 403 })
    }

    const format = getFormatById('app-demo-composite')
    if (!format?.stateMachine) {
      return NextResponse.json({ error: 'Template missing stateMachine' }, { status: 500 })
    }

    const body = (await request.json()) as RenderInput
    if (!body.klingRawUrl?.startsWith('http')) {
      return NextResponse.json({ error: 'Missing klingRawUrl' }, { status: 400 })
    }

    // 1. Whisper per-word timings from the Kling audio track. If Whisper
    // fails we synthesize evenly-distributed timings from the spoken lines
    // so the render still lands (captions will still show, just approximate).
    let words: Array<{ text: string; start: number; end: number }>
    try {
      const wx = await transcribeWithReplicate(body.klingRawUrl)
      words = wx.words.map(w => ({ text: w.word, start: w.start, end: w.end }))
      if (!words.length) throw new Error('empty word list')
    } catch (e) {
      console.warn('[app-demo] Whisper failed, synthesizing timings:', e instanceof Error ? e.message : e)
      words = synthesizeWords(format.stateMachine.segments, {
        1: body.hookLine,
        2: body.pivotLine,
        3: body.demoLine,
      })
    }
    if (!words.length) {
      return NextResponse.json({ error: 'No caption timings' }, { status: 400 })
    }

    // 2. Background removal. This runs async on Replicate; we spawn it and
    // poll. Timeout budget ~120s for a 16s source.
    const { predictionId } = await submitBackgroundRemovalJob(body.klingRawUrl)
    const deadline = Date.now() + 150_000
    let keyedUrl: string | undefined
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 4000))
      const st = await getBackgroundRemovalStatus(predictionId)
      if (st.status === 'completed' && st.videoUrl) { keyedUrl = st.videoUrl; break }
      if (st.status === 'failed') {
        return NextResponse.json({ error: `Background removal failed: ${st.error ?? 'unknown'}` }, { status: 500 })
      }
    }
    if (!keyedUrl) {
      return NextResponse.json({ error: 'Background removal timed out' }, { status: 504 })
    }

    // 3. Substitute the user's lines into the state-machine segments.
    const segments: StateMachineSegment[] = format.stateMachine.segments.map(s => {
      const line =
        s.id === 1 ? body.hookLine :
        s.id === 2 ? body.pivotLine :
                     body.demoLine
      return { ...s, spokenText: line }
    })

    // 4. Kick off Shotstack.
    const { renderId } = await renderAppDemo({
      segments,
      captions: format.stateMachine.captions,
      triggers: format.stateMachine.triggers,
      totalSeconds: format.stateMachine.totalSeconds,
      canvas: format.stateMachine.canvas,
      fps: format.stateMachine.fps,
      klingRawUrl: body.klingRawUrl,
      avatarKeyedUrl: keyedUrl,
      brollUrl: body.brollUrl,
      appUiUrl: body.appUiUrl,
      words,
      avatarSide: body.avatarSide ?? 'right',
    })

    return NextResponse.json({ renderId, keyedUrl })
  } catch (err) {
    console.error('app-demo/render error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Render failed' },
      { status: 500 },
    )
  }
}

// Distribute a spoken line's tokens evenly across its segment window.
// Punctuation stays attached to the preceding token so caption emoji triggers
// (which match on cleaned lowercase) still fire on "cash," / "app!" etc.
function synthesizeWords(
  segments: StateMachineSegment[],
  linesBySegmentId: Record<number, string>,
): Array<{ text: string; start: number; end: number }> {
  const out: Array<{ text: string; start: number; end: number }> = []
  for (const seg of segments) {
    const line = linesBySegmentId[seg.id]?.trim()
    if (!line) continue
    const tokens = line.split(/\s+/)
    if (!tokens.length) continue
    const dur = seg.endSeconds - seg.startSeconds
    const per = dur / tokens.length
    tokens.forEach((tok, i) => {
      out.push({
        text: tok,
        start: seg.startSeconds + i * per,
        end: seg.startSeconds + (i + 1) * per,
      })
    })
  }
  return out
}

// GET /api/formats/app-demo/render?renderId=xxx
// Polls Shotstack for the final MP4 URL. When it completes, the caller can
// hit /api/formats/app-demo/save to persist to library.
export async function GET(request: NextRequest) {
  try {
    const renderId = request.nextUrl.searchParams.get('renderId')
    if (!renderId) return NextResponse.json({ error: 'Missing renderId' }, { status: 400 })
    const status = await getAppDemoRenderStatus(renderId)
    return NextResponse.json(status)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Poll failed' },
      { status: 500 },
    )
  }
}
