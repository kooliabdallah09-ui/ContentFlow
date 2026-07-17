// Preserve a completed Seedance render to the user's Google Drive.
//
// Replicate deletes prediction outputs within hours, so the client's status
// poller calls this the moment a render completes. We download the mp4
// server-side and push it into the user's ContentFlow Drive folder — the
// Library is Drive-backed, so the video shows up there permanently.
//
// If Drive isn't connected we return { needsDrive: true } so the UI can
// warn the user their video will expire.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getValidDriveToken, getOrCreateFolder, uploadBufferToDrive } from '@/lib/google-drive'

export const maxDuration = 300

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
    const predictionId = String(body?.predictionId ?? '').trim()
    const videoUrl = String(body?.videoUrl ?? '').trim()

    let parsed: URL
    try { parsed = new URL(videoUrl) } catch {
      return NextResponse.json({ error: 'Invalid videoUrl' }, { status: 400 })
    }
    if (parsed.protocol !== 'https:' || !/(^|\.)replicate\.(delivery|com)$/.test(parsed.hostname)) {
      return NextResponse.json({ error: 'Host not allowed' }, { status: 403 })
    }

    // Dedupe: if this prediction was already preserved, return the existing id.
    const { data: rows } = await supabase
      .from('ugc_content')
      .select('id, components')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(25)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = (rows ?? []).find((r: any) => r?.components?.video?.videoId === predictionId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingDriveId = (row as any)?.components?.video?.driveFileId
    if (existingDriveId) {
      return NextResponse.json({ fileId: existingDriveId, alreadyPreserved: true })
    }

    // Drive connected?
    const { data: integration } = await supabase
      .from('integrations')
      .select('is_connected')
      .eq('user_id', userId)
      .eq('platform', 'google-drive')
      .maybeSingle()
    if (!integration?.is_connected) {
      return NextResponse.json({ needsDrive: true })
    }

    // Download the render before Replicate deletes it.
    const videoRes = await fetch(videoUrl)
    if (!videoRes.ok) {
      return NextResponse.json(
        { error: `Source video fetch failed (${videoRes.status}) — it may have already expired.` },
        { status: 502 },
      )
    }
    const buffer = new Uint8Array(await videoRes.arrayBuffer())
    console.log(`[ugc/preserve] downloaded ${(buffer.length / 1024 / 1024).toFixed(1)} MB for ${predictionId}`)

    let accessToken: string
    try {
      accessToken = await getValidDriveToken(userId, supabase)
    } catch {
      return NextResponse.json({ needsDrive: true })
    }
    const folderId = await getOrCreateFolder(accessToken, userId, supabase)

    const filename = `ugc-${new Date().toISOString().slice(0, 10)}-${predictionId.slice(0, 8)}.mp4`
    const driveFile = await uploadBufferToDrive({
      accessToken, folderId, buffer, filename,
      mimeType: videoRes.headers.get('content-type') ?? 'video/mp4',
      appProperties: { contentType: 'video', source: 'ugc' },
    })

    // Persist the Drive pointer on the generation row so the editor +
    // library can use the permanent copy instead of the expiring URL.
    if (row) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const components: any = (row as any).components ?? {}
      await supabase
        .from('ugc_content')
        .update({
          components: {
            ...components,
            video: {
              ...components.video,
              driveFileId: driveFile.id,
              driveViewLink: driveFile.webViewLink,
              preservedUrl: `/api/drive/file/${driveFile.id}`,
            },
          },
        })
        .eq('id', row.id)
    }

    console.log(`[ugc/preserve] saved to Drive: ${driveFile.id}`)
    return NextResponse.json({ fileId: driveFile.id, viewLink: driveFile.webViewLink })
  } catch (err) {
    console.error('[ugc/preserve] failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Preserve failed' }, { status: 500 })
  }
}
