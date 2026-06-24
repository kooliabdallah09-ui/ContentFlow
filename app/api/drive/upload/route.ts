import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getValidDriveToken, getOrCreateFolder } from '@/lib/google-drive'

export const maxDuration = 30

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// POST — returns a Drive resumable upload URL.
// The client then uploads the blob directly to Drive (bypasses Vercel body limit).
// Body: { filename, mimeType, fileSize }
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

    const { filename, mimeType, fileSize } = await request.json()
    if (!filename) return NextResponse.json({ error: 'Missing filename' }, { status: 400 })

    const accessToken = await getValidDriveToken(userId, supabase)
    const folderId = await getOrCreateFolder(accessToken, userId, supabase)

    // Initiate a resumable upload session — Drive returns an upload URL
    const initRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': mimeType ?? 'video/webm',
          ...(fileSize ? { 'X-Upload-Content-Length': String(fileSize) } : {}),
        },
        body: JSON.stringify({
          name: filename,
          parents: [folderId],
          appProperties: { contentType: 'video', source: 'video-editor' },
        }),
      },
    )

    if (!initRes.ok) {
      const errText = await initRes.text()
      console.error('[drive/upload] initiate failed:', errText)
      return NextResponse.json({ error: `Drive session failed: ${initRes.status}` }, { status: 500 })
    }

    const uploadUrl = initRes.headers.get('location')
    if (!uploadUrl) return NextResponse.json({ error: 'No upload URL from Drive' }, { status: 500 })

    return NextResponse.json({ uploadUrl })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed'
    if (msg === 'DRIVE_NOT_CONNECTED') {
      return NextResponse.json({ error: 'Google Drive not connected. Go to Settings → Integrations to connect.' }, { status: 400 })
    }
    if (msg === 'DRIVE_TOKEN_EXPIRED') {
      return NextResponse.json({ error: 'Google Drive session expired. Reconnect in Settings → Integrations.' }, { status: 400 })
    }
    console.error('[drive/upload]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
