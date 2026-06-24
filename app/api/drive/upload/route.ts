import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getValidDriveToken, getOrCreateFolder } from '@/lib/google-drive'

export const maxDuration = 60

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// POST — uploads a video blob to the user's ContentFlow Google Drive folder
// Body: FormData with `file` (Blob) and optional `filename`
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

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const filename = (formData.get('filename') as string | null) ?? `contentflow-edit-${Date.now()}.webm`
    if (!file) return NextResponse.json({ error: 'Missing file' }, { status: 400 })

    const accessToken = await getValidDriveToken(userId, supabase)
    const folderId = await getOrCreateFolder(accessToken, userId, supabase)

    const arrayBuffer = await file.arrayBuffer()

    // Multipart upload to Drive
    const boundary = '-------ContentFlowBoundary'
    const metadata = JSON.stringify({
      name: filename,
      parents: [folderId],
      appProperties: {
        contentType: 'video',
        source: 'video-editor',
      },
    })

    const metaPart = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      metadata,
      `--${boundary}`,
      `Content-Type: ${file.type || 'video/webm'}`,
      '',
    ].join('\r\n')

    const closing = `\r\n--${boundary}--`

    const metaBytes = new TextEncoder().encode(metaPart)
    const closingBytes = new TextEncoder().encode(closing)
    const fileBytes = new Uint8Array(arrayBuffer)

    const body = new Uint8Array(metaBytes.length + fileBytes.length + closingBytes.length)
    body.set(metaBytes, 0)
    body.set(fileBytes, metaBytes.length)
    body.set(closingBytes, metaBytes.length + fileBytes.length)

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,name',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'Content-Length': String(body.length),
        },
        body,
      },
    )

    if (!uploadRes.ok) {
      const errText = await uploadRes.text()
      console.error('[drive/upload] Drive error:', errText)
      return NextResponse.json({ error: `Drive upload failed: ${uploadRes.status}` }, { status: 500 })
    }

    const driveFile = await uploadRes.json()
    return NextResponse.json({ success: true, fileId: driveFile.id, viewLink: driveFile.webViewLink, name: driveFile.name })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Upload failed'
    if (msg === 'DRIVE_NOT_CONNECTED') {
      return NextResponse.json({ error: 'Google Drive not connected. Connect it in Settings → Integrations.' }, { status: 400 })
    }
    if (msg === 'DRIVE_TOKEN_EXPIRED') {
      return NextResponse.json({ error: 'Google Drive session expired. Reconnect in Settings → Integrations.' }, { status: 400 })
    }
    console.error('[drive/upload]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
