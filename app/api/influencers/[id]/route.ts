// Influencer detail + delete. Admin-gated.

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

async function authAdmin(request: NextRequest): Promise<string | null> {
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return null
  const { data } = await supa().auth.getUser(header.slice(7))
  if (!data.user || !canAccessInfluencerStudio(data.user.email)) return null
  return data.user.id
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await authAdmin(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    const supabase = supa()
    const [{ data: influencer }, { data: photos }] = await Promise.all([
      supabase.from('user_influencers').select('*').eq('id', id).eq('user_id', userId).maybeSingle(),
      supabase.from('user_influencer_photos').select('id, scene, image_url, created_at')
        .eq('influencer_id', id).eq('user_id', userId)
        .order('created_at', { ascending: false }).limit(100),
    ])
    if (!influencer) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ influencer, photos: photos ?? [] })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await authAdmin(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    const { error } = await supa()
      .from('user_influencers')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
