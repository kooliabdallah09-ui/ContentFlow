import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getValidDriveToken, getOrCreateFolder } from '@/lib/google-drive'

export const maxDuration = 60

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// POST — client uploads blob to Supabase first, then this route fetches it
// and pushes it to Google Drive (avoids CORS + Vercel body-size issues).
// Body: { storagePath, filename }
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const token = authHeader.slice(7)

  try {
    const supabase = getSupabase()
    const { data: userData, error } = await supabase.auth.getUser(token)
    if (error || !userData?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = userData.user.id

    const { storagePath, filename } = await request.json()
    if (!storagePath) return NextResponse.json({ error: 'Missing storagePath' }, { status: 400 })

    // Download from Supabase storage (server-side, no CORS issues)
    const { data: fileData, error: dlErr } = await supabase.storage
      .from('ugc-assets')
      .download(storagePath)
    if (dlErr || !fileData) throw new Error(`Supabase download failed: ${dlErr?.message}`)

    const arrayBuffer = await fileData.arrayBuffer()

    // Clean up temp file (fire and forget)
    supabase.storage.from('ugc-assets').remove([storagePath]).catch(() => {})

    // Upload to Drive
    const accessToken = await getValidDriveToken(userId, supabase)
    const folderId = await getOrCreateFolder(accessToken, userId, supabase)

    const boundary = 'CFBoundary' + Date.now()
    const meta = JSON.stringify({
      name: filename ?? `contentflow-edit-${Date.now()}.webm`,
      parents: [folderId],
      appProperties: { contentType: 'video', source: 'video-editor' },
    })

    const enc = new TextEncoder()
    const metaPart = enc.encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: video/webm\r\n\r\n`
    )
    const closing = enc.encode(`\r\n--${boundary}--`)
    const fileBytes = new Uint8Array(arrayBuffer)
    const body = new Uint8Array(metaPart.length + fileBytes.length + closing.length)
    body.set(metaPart, 0)
    body.set(fileBytes, metaPart.length)
    body.set(closing, metaPart.length + fileBytes.length)

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,name',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    )

    if (!uploadRes.ok) {
      const err = await uploadRes.text()
      throw new Error(`Drive upload failed (${uploadRes.status}): ${err.slice(0, 300)}`)
    }

    const driveFile = await uploadRes.json()
    return NextResponse.json({ success: true, fileId: driveFile.id, viewLink: driveFile.webViewLink })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed'
    if (msg === 'DRIVE_NOT_CONNECTED')
      return NextResponse.json({ error: 'Google Drive not connected. Go to Settings → Integrations.' }, { status: 400 })
    if (msg === 'DRIVE_TOKEN_EXPIRED')
      return NextResponse.json({ error: 'Google Drive session expired. Reconnect in Settings → Integrations.' }, { status: 400 })
    console.error('[drive/upload]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
