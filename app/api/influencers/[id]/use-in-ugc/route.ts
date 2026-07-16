// Bridge an influencer into the UGC pipeline: inserts a row into
// user_saved_actors (which the UGC builder's character step already lists)
// using the influencer's canonical portrait + appearance prompt. Idempotent
// per influencer — re-running refreshes the existing actor row.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { canAccessInfluencerStudio } from '@/lib/pov-access'

export const maxDuration = 30

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const header = request.headers.get('Authorization')
    if (!header?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: userData } = await supabase.auth.getUser(header.slice(7))
    if (!userData.user || !canAccessInfluencerStudio(userData.user.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = userData.user.id
    const { id } = await params

    const { data: influencer } = await supabase
      .from('user_influencers')
      .select('name, portrait_url, appearance_prompt, niche, personality')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()
    if (!influencer) return NextResponse.json({ error: 'Influencer not found' }, { status: 404 })

    // Refresh if this influencer was already bridged (matched by name+prompt).
    const { data: existing } = await supabase
      .from('user_saved_actors')
      .select('id')
      .eq('user_id', userId)
      .eq('name', influencer.name)
      .maybeSingle()

    const actorRow = {
      user_id: userId,
      name: influencer.name,
      hero_frame_url: influencer.portrait_url,
      character_image_prompt: influencer.appearance_prompt,
      character_idea: [influencer.niche, influencer.personality].filter(Boolean).join(' — ').slice(0, 300) || null,
      persona_locks: {},
      last_used_at: new Date().toISOString(),
    }

    const { data: actor, error } = existing
      ? await supabase.from('user_saved_actors').update(actorRow).eq('id', existing.id)
          .select('id, name, hero_frame_url').single()
      : await supabase.from('user_saved_actors').insert(actorRow)
          .select('id, name, hero_frame_url').single()
    if (error) throw error

    await supabase.from('user_influencers')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', id)

    return NextResponse.json({ actor })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
