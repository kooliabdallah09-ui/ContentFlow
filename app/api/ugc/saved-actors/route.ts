// Saved actors API — the CRUD surface for reusable AI characters.
//
// GET  → list the signed-in user's saved actors, most-recently-used first.
// POST → save the currently-picked hero frame + character prompt with a
//        user-provided nickname. Body: { name, heroFrameUrl,
//        characterImagePrompt, characterIdea?, personaLocks? }.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 30

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function auth(request: NextRequest): Promise<string | null> {
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return null
  const { data } = await supabase().auth.getUser(header.slice(7))
  return data.user?.id ?? null
}

export async function GET(request: NextRequest) {
  try {
    const userId = await auth(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase()
      .from('user_saved_actors')
      .select('id, name, hero_frame_url, character_idea, persona_locks, created_at, last_used_at')
      .eq('user_id', userId)
      .order('last_used_at', { ascending: false })
      .limit(50)
    if (error) throw error

    return NextResponse.json({ actors: data ?? [] })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to list actors' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await auth(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const name = String(body?.name ?? '').trim().slice(0, 80)
    const heroFrameUrl = String(body?.heroFrameUrl ?? '').trim()
    const characterImagePrompt = String(body?.characterImagePrompt ?? '').trim()
    const characterIdea = typeof body?.characterIdea === 'string' ? body.characterIdea.slice(0, 300) : null
    const personaLocks = body?.personaLocks && typeof body.personaLocks === 'object' ? body.personaLocks : {}

    if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 })
    if (!heroFrameUrl.startsWith('http')) return NextResponse.json({ error: 'Missing heroFrameUrl' }, { status: 400 })
    if (!characterImagePrompt) return NextResponse.json({ error: 'Missing characterImagePrompt' }, { status: 400 })

    const { data, error } = await supabase()
      .from('user_saved_actors')
      .insert({
        user_id: userId,
        name,
        hero_frame_url: heroFrameUrl,
        character_image_prompt: characterImagePrompt,
        character_idea: characterIdea,
        persona_locks: personaLocks,
      })
      .select('id, name, hero_frame_url, character_idea, persona_locks, created_at, last_used_at')
      .single()
    if (error) throw error

    return NextResponse.json({ actor: data }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save actor' },
      { status: 500 },
    )
  }
}
