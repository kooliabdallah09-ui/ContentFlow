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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getUser(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const [{ data: campaign }, { data: shots }] = await Promise.all([
    ctx.supabase.from('user_campaigns').select('*').eq('id', id).eq('user_id', ctx.userId).maybeSingle(),
    ctx.supabase.from('user_campaign_shots').select('*').eq('campaign_id', id).eq('user_id', ctx.userId).order('position', { ascending: true }),
  ])
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ campaign, shots: shots ?? [] })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getUser(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { error } = await ctx.supabase.from('user_campaigns').delete().eq('id', id).eq('user_id', ctx.userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// PATCH — rename the campaign.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getUser(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await request.json()
  const patch: Record<string, unknown> = {}
  if (typeof body.name === 'string') patch.name = body.name.slice(0, 120)
  if (typeof body.status === 'string') patch.status = body.status.slice(0, 40)
  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true })
  const { error } = await ctx.supabase.from('user_campaigns').update(patch).eq('id', id).eq('user_id', ctx.userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
