// DELETE a scene. Storage objects (hero + references) are best-effort cleanup.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 30

function supa() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const header = request.headers.get('Authorization')
    if (!header?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const supabase = supa()
    const { data: userData } = await supabase.auth.getUser(header.slice(7))
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = userData.user.id
    const { id } = await params

    const { data: scene } = await supabase
      .from('user_scenes')
      .select('id, hero_image_url, reference_urls')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()
    if (!scene) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Best-effort storage cleanup — extract path segment after the bucket name.
    const paths: string[] = []
    const grabPath = (url: unknown) => {
      if (typeof url !== 'string') return
      const m = url.match(/\/object\/public\/ugc-assets\/(.+)$/)
      if (m) paths.push(m[1])
    }
    grabPath(scene.hero_image_url)
    if (Array.isArray(scene.reference_urls)) scene.reference_urls.forEach(grabPath)
    if (paths.length) {
      const { error } = await supabase.storage.from('ugc-assets').remove(paths)
      if (error) console.warn('[scenes/delete] storage cleanup:', error.message)
    }

    const { error: delErr } = await supabase
      .from('user_scenes')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
    if (delErr) throw delErr
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[scenes/delete] failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
