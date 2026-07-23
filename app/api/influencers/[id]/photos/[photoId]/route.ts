// DELETE a single Influencer Studio photo — used by the "remove picture"
// button in the influencer detail lightbox.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { canAccessInfluencerStudio } from '@/lib/pov-access'

export const maxDuration = 30

function supa() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function pathFromPublicUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null
  const m = url.match(/\/object\/public\/ugc-assets\/(.+)$/)
  return m ? m[1] : null
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  try {
    const header = request.headers.get('Authorization')
    if (!header?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const supabase = supa()
    const { data: userData } = await supabase.auth.getUser(header.slice(7))
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!canAccessInfluencerStudio(userData.user.email)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = userData.user.id
    const { id, photoId } = await params

    const { data: photo } = await supabase
      .from('user_influencer_photos')
      .select('id, image_url, influencer_id, user_id')
      .eq('id', photoId)
      .eq('influencer_id', id)
      .eq('user_id', userId)
      .maybeSingle()
    if (!photo) return NextResponse.json({ error: 'Photo not found' }, { status: 404 })

    const storagePath = pathFromPublicUrl(photo.image_url)
    if (storagePath) {
      const { error } = await supabase.storage.from('ugc-assets').remove([storagePath])
      if (error) console.warn('[influencers/photos/delete] storage cleanup:', error.message)
    }

    const { error: delErr } = await supabase
      .from('user_influencer_photos')
      .delete()
      .eq('id', photoId)
      .eq('user_id', userId)
    if (delErr) throw delErr
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[influencers/photos/delete] failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
