import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getValidDriveToken } from '@/lib/google-drive'

export const maxDuration = 60

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// Proxy a Drive file download — needed for files without a public sourceUrl.
// Accepts auth via Authorization header OR ?token= query param (needed for <video src=...>).
// Supports Range requests so <video> seeking works.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authHeader = request.headers.get('authorization')
  const queryToken = request.nextUrl.searchParams.get('token')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : queryToken
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = getSupabase()
    const { data: userData, error } = await supabase.auth.getUser(token)
    if (error || !userData?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accessToken = await getValidDriveToken(userData.user.id, supabase)
    const { id: fileId } = await params

    const rangeHeader = request.headers.get('range')
    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(rangeHeader ? { Range: rangeHeader } : {}),
        },
      }
    )

    if (!driveRes.ok && driveRes.status !== 206) {
      return NextResponse.json({ error: `Drive fetch failed: ${driveRes.status}` }, { status: driveRes.status })
    }

    const headers = new Headers()
    const passThrough = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control']
    passThrough.forEach(h => {
      const v = driveRes.headers.get(h)
      if (v) headers.set(h, v)
    })
    headers.set('cache-control', 'private, max-age=3600')

    return new NextResponse(driveRes.body, { status: driveRes.status, headers })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed'
    console.error('[drive/file]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
