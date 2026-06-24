import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Returns a signed upload URL so the browser can PUT the video file
// directly to Supabase storage — bypassing the Vercel 4.5 MB body limit.
export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data: userData, error: userErr } = await supabase.auth.getUser(authHeader.slice(7))
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const storagePath = `screen-demo/${userData.user.id}-${Date.now()}.mp4`
    const { data, error } = await supabase.storage
      .from('ugc-assets')
      .createSignedUploadUrl(storagePath)

    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: error?.message ?? 'Could not create upload URL' }, { status: 500 })
    }

    return NextResponse.json({ signedUrl: data.signedUrl, storagePath })
  } catch (err) {
    console.error('[screen-demo/upload-url]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create upload URL' },
      { status: 500 },
    )
  }
}
