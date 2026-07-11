// Persist an App Demo Composite render to the user's library.
// The library is Google-Drive-backed. We fetch the finished Shotstack MP4,
// upload it to Supabase storage (so the library thumbnail/preview can load
// it), then push it into the user's ContentFlow Drive folder.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getValidDriveToken, getOrCreateFolder } from '@/lib/google-drive'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const token = authHeader.slice(7)

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: userData, error: uerr } = await supabase.auth.getUser(token)
    if (uerr || !userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = userData.user.id

    const { videoUrl, filename } = (await request.json()) as { videoUrl?: string; filename?: string }
    if (!videoUrl?.startsWith('http')) return NextResponse.json({ error: 'Missing videoUrl' }, { status: 400 })

    // Fetch the finished MP4 from Shotstack's CDN.
    const dl = await fetch(videoUrl)
    if (!dl.ok) throw new Error(`Fetch mp4 failed ${dl.status}`)
    const bytes = new Uint8Array(await dl.arrayBuffer())

    // Store a copy in Supabase storage — library thumbnails / previews use it.
    const finalName = filename ?? `app-demo-${Date.now()}.mp4`
    const permanentPath = `format-renders/${userId}/${finalName}`
    await supabase.storage.from('ugc-assets').remove([permanentPath]).catch(() => {})
    const { error: uploadErr } = await supabase.storage
      .from('ugc-assets')
      .upload(permanentPath, bytes, { contentType: 'video/mp4', upsert: true })
    if (uploadErr) throw new Error(`Supabase upload failed: ${uploadErr.message}`)

    // Push to Drive too, so it appears in the library UI (which reads Drive).
    const accessToken = await getValidDriveToken(userId, supabase)
    const folderId = await getOrCreateFolder(accessToken, userId, supabase)

    const boundary = 'CFBoundary' + Date.now()
    const meta = JSON.stringify({
      name: finalName,
      parents: [folderId],
      appProperties: {
        contentType: 'video',
        source: 'app-demo-composite',
        storagePath: permanentPath,
      },
    })
    const enc = new TextEncoder()
    const metaPart = enc.encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: video/mp4\r\n\r\n`,
    )
    const closing = enc.encode(`\r\n--${boundary}--`)
    const body = new Uint8Array(metaPart.length + bytes.length + closing.length)
    body.set(metaPart, 0)
    body.set(bytes, metaPart.length)
    body.set(closing, metaPart.length + bytes.length)

    const up = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,name',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    )
    if (!up.ok) {
      const err = await up.text()
      throw new Error(`Drive upload failed (${up.status}): ${err.slice(0, 300)}`)
    }
    const drive = await up.json()
    return NextResponse.json({ success: true, fileId: drive.id, viewLink: drive.webViewLink, storagePath: permanentPath })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'save failed'
    if (msg === 'DRIVE_NOT_CONNECTED') {
      return NextResponse.json({ error: 'Google Drive not connected. Settings → Integrations.' }, { status: 400 })
    }
    console.error('[app-demo/save]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
