// Admin-only: list + update abuse_reports rows.
// GET  → returns rows (optionally filtered by ?status=)
// PATCH → update status/notes on a specific row

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdminEmail } from '@/lib/pov-access'

export const maxDuration = 15

async function requireAdmin(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return { error: 'Unauthorized', status: 401 as const }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data: userData } = await supabase.auth.getUser(authHeader.slice(7))
  if (!userData.user) return { error: 'Unauthorized', status: 401 as const }
  if (!isAdminEmail(userData.user.email)) return { error: 'Forbidden', status: 403 as const }
  return { supabase, user: userData.user }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const url = new URL(request.url)
  const status = url.searchParams.get('status')
  let query = auth.supabase
    .from('abuse_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)
  if (status && ['new', 'reviewing', 'actioned', 'dismissed'].includes(status)) {
    query = query.eq('status', status)
  }
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reports: data ?? [] })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json().catch(() => ({}))
  const id = String(body.id ?? '')
  const status = String(body.status ?? '')
  const notes = typeof body.notes === 'string' ? body.notes.slice(0, 2000) : null
  if (!id || !['new', 'reviewing', 'actioned', 'dismissed'].includes(status)) {
    return NextResponse.json({ error: 'id and valid status required' }, { status: 400 })
  }
  const { error } = await auth.supabase
    .from('abuse_reports')
    .update({
      status,
      notes,
      reviewed_at: new Date().toISOString(),
      reviewed_by: auth.user.email ?? null,
    })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
