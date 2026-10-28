import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { PLANNER_DURATIONS } from '@/lib/planner-cost'
import { PLAN_FORMATS } from '@/lib/planner-playbook'

// Edit one plan item, or approve the plan.
//   PATCH { itemId, ...fields }  edit an item (hook, format, length, quality, on/off,
//                                status, result, winner). Nothing here spends credits.
//   PATCH { planId, status }     approve (or un-approve) the plan.

const STATUSES = ['idle', 'generating', 'ready', 'failed']

export async function PATCH(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    const header = request.headers.get('Authorization')
    if (!header?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const supabase = createClient(url, key)
    const { data: userData } = await supabase.auth.getUser(header.slice(7))
    const userId = userData.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const now = new Date().toISOString()

    if (typeof body.planId === 'string') {
      const status = body.status === 'approved' ? 'approved' : 'draft'
      const { error } = await supabase.from('weekly_plans')
        .update({ status, updated_at: now }).eq('id', body.planId).eq('user_id', userId)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }

    if (typeof body.itemId !== 'string') return NextResponse.json({ error: 'Missing itemId' }, { status: 400 })

    const { data: current } = await supabase.from('weekly_plan_items')
      .select('id, kind, alts, status').eq('id', body.itemId).eq('user_id', userId).maybeSingle()
    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const patch: Record<string, unknown> = { updated_at: now }
    if (typeof body.hook === 'string' && body.hook.trim()) {
      patch.hook = body.hook.trim().slice(0, 160)
      const alts: string[] = Array.isArray(current.alts) ? current.alts : []
      if (!alts.includes(patch.hook as string)) patch.alts = [patch.hook, ...alts].slice(0, 3)
    }
    if (typeof body.format === 'string' && PLAN_FORMATS.some(f => f.label === body.format && f.kind === current.kind)) patch.format = body.format
    if (current.kind === 'video') {
      if ((PLANNER_DURATIONS as readonly number[]).includes(Number(body.duration_s))) patch.duration_s = Number(body.duration_s)
      if (body.quality === 'draft' || body.quality === 'full') patch.quality = body.quality
    }
    if (typeof body.enabled === 'boolean') patch.enabled = body.enabled
    if (typeof body.is_winner === 'boolean') patch.is_winner = body.is_winner
    if (typeof body.status === 'string' && STATUSES.includes(body.status)) patch.status = body.status
    if (body.result !== undefined) patch.result = body.result

    const { data, error } = await supabase.from('weekly_plan_items')
      .update(patch).eq('id', body.itemId).eq('user_id', userId).select('*').single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ item: data })
  } catch (err) {
    console.error('[planner] items', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not save' }, { status: 500 })
  }
}
