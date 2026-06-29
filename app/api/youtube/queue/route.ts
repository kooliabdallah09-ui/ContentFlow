import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function getUser(authHeader: string | null) {
  if (!authHeader?.startsWith('Bearer ')) return null
  const supabase = getSupabase()
  const { data } = await supabase.auth.getUser(authHeader.slice(7))
  return data?.user ?? null
}

// GET /api/youtube/queue — list the current user's scheduled jobs
export async function GET(req: NextRequest) {
  const user = await getUser(req.headers.get('Authorization'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('youtube_publish_queue')
    .select('*')
    .eq('user_id', user.id)
    .order('scheduled_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ jobs: data ?? [] })
}

// POST /api/youtube/queue — add a new scheduled job
export async function POST(req: NextRequest) {
  const user = await getUser(req.headers.get('Authorization'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { video_url, title, description = '', tags = [], privacy = 'public', scheduled_at, calendar_date } = body

  if (!video_url) return NextResponse.json({ error: 'video_url is required' }, { status: 400 })
  if (!title?.trim()) return NextResponse.json({ error: 'title is required' }, { status: 400 })
  if (!scheduled_at) return NextResponse.json({ error: 'scheduled_at is required' }, { status: 400 })
  if (!['public', 'unlisted', 'private'].includes(privacy)) {
    return NextResponse.json({ error: 'privacy must be public, unlisted, or private' }, { status: 400 })
  }

  const scheduledDate = new Date(scheduled_at)
  if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
    return NextResponse.json({ error: 'scheduled_at must be a valid future datetime' }, { status: 400 })
  }

  // Check YouTube is connected
  const supabase = getSupabase()
  const { data: integration } = await supabase
    .from('integrations')
    .select('is_connected')
    .eq('user_id', user.id)
    .eq('platform', 'youtube')
    .single()

  if (!integration?.is_connected) {
    return NextResponse.json(
      { error: 'YouTube not connected — go to Settings → Integrations' },
      { status: 400 },
    )
  }

  const { data, error } = await supabase
    .from('youtube_publish_queue')
    .insert({
      user_id: user.id,
      video_url,
      title: title.trim().slice(0, 100),
      description: description.trim().slice(0, 5000),
      tags: Array.isArray(tags) ? tags.slice(0, 30) : [],
      privacy,
      scheduled_at: scheduledDate.toISOString(),
      calendar_date: calendar_date ?? null,
      status: 'queued',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ job: data }, { status: 201 })
}

// DELETE /api/youtube/queue?id=<uuid> — cancel a queued job
export async function DELETE(req: NextRequest) {
  const user = await getUser(req.headers.get('Authorization'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const supabase = getSupabase()
  const { error } = await supabase
    .from('youtube_publish_queue')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'queued') // only allow deleting queued (not already uploading/published)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
