import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Server-side image upload for the Brand profile.
// Browser-side .upload() against the ugc-assets bucket hit RLS denial
// ("new row violates row-level security policy") because the bucket is locked
// to service-role writes. We bypass RLS by uploading from the server with the
// service-role key, then return the public URL the Brand page persists in
// brand_profiles.logo_url.

export const maxDuration = 30
const MAX_BYTES = 5 * 1024 * 1024 // 5MB
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])

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
    const userId = userData.user.id

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Image must be under 5MB' }, { status: 400 })
    }
    const mime = file.type || 'image/png'
    if (!ALLOWED.has(mime)) {
      return NextResponse.json({ error: 'Only JPG, PNG, or WEBP' }, { status: 400 })
    }

    const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png'
    const filename = `brand/${userId}-${Date.now()}.${ext}`
    const buf = Buffer.from(await file.arrayBuffer())

    const { error: upErr } = await supabase.storage
      .from('ugc-assets')
      .upload(filename, buf, { contentType: mime, upsert: true })
    if (upErr) {
      console.error('brand upload-image error:', upErr.message)
      return NextResponse.json({ error: upErr.message }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage.from('ugc-assets').getPublicUrl(filename)
    return NextResponse.json({ url: publicUrl })
  } catch (err) {
    console.error('brand/upload-image error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
