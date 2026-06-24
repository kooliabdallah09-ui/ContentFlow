import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Extract the usable media URL from a storage_url field that may be a raw URL
// or a JSON blob like { video: { videoUrl: "..." } } or { url: "..." }
function extractMediaUrl(storageUrl: string): string {
  if (!storageUrl) return ''
  try {
    const parsed = JSON.parse(storageUrl)
    return (
      parsed?.video?.videoUrl ||
      parsed?.audio?.audioUrl ||
      parsed?.image?.imageUrl ||
      parsed?.url ||
      parsed?.videoUrl ||
      ''
    )
  } catch {
    // Already a plain URL
    return storageUrl
  }
}

export async function GET(request: NextRequest) {
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

    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = userData.user.id

    // Read from ugc_content — the source of truth for all generations
    const { data: rows, error: dbErr } = await supabase
      .from('ugc_content')
      .select('id, content_type, storage_url, external_id, metadata, credit_cost, created_at, status')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(200)

    if (dbErr) {
      console.error('[library] DB error:', dbErr)
      return NextResponse.json({ error: 'Failed to load library' }, { status: 500 })
    }

    const items = (rows ?? [])
      .map(row => ({ ...row, storage_url: extractMediaUrl(row.storage_url) }))
      .filter(row => row.storage_url) // drop rows where URL couldn't be resolved

    return NextResponse.json({ items, driveConnected: false })
  } catch (err) {
    console.error('[library]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
