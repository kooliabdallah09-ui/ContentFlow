import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

async function getUser(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data } = await supabase.auth.getUser(authHeader.slice(7))
  return data.user ? { supabase, userId: data.user.id } : null
}

// PATCH — inline-edit a shot. Accepts { selected?, spec? (partial) } and
// merges spec into the existing jsonb column. Preserves credit_hint but
// allows the client to overwrite it if it recomputed.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; shotId: string }> },
) {
  const ctx = await getUser(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { shotId } = await params
  const body = await request.json()

  // Fetch existing to merge spec.
  const { data: existing } = await ctx.supabase
    .from('user_campaign_shots')
    .select('spec')
    .eq('id', shotId)
    .eq('user_id', ctx.userId)
    .maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.selected === 'boolean') patch.selected = body.selected
  if (typeof body.credit_hint === 'number') patch.credit_hint = body.credit_hint
  if (typeof body.status === 'string') patch.status = body.status.slice(0, 40)
  if (body.spec && typeof body.spec === 'object') {
    const merged = { ...(existing.spec as Record<string, unknown>), ...body.spec }
    // Clamp long strings for safety.
    if (typeof merged.hook === 'string') merged.hook = merged.hook.slice(0, 500)
    if (typeof merged.caption === 'string') merged.caption = merged.caption.slice(0, 800)
    if (typeof merged.setting === 'string') merged.setting = merged.setting.slice(0, 400)
    if (typeof merged.notes === 'string') merged.notes = merged.notes.slice(0, 400)
    patch.spec = merged
  }

  const { error } = await ctx.supabase
    .from('user_campaign_shots')
    .update(patch)
    .eq('id', shotId)
    .eq('user_id', ctx.userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; shotId: string }> },
) {
  const ctx = await getUser(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { shotId } = await params
  const { error } = await ctx.supabase
    .from('user_campaign_shots')
    .delete()
    .eq('id', shotId)
    .eq('user_id', ctx.userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
