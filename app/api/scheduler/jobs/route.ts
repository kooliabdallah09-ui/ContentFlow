import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.slice(7)

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: jobs, error } = await supabase
      .from('scheduled_jobs')
      .select('*')
      .eq('user_id', userData.user.id)
      .eq('deleted_at', null)
      .order('scheduled_time', { ascending: true })

    if (error) {
      console.error('Database error:', error)
      return Response.json({ error: 'Failed to fetch jobs' }, { status: 500 })
    }

    return Response.json({ jobs: jobs || [] })
  } catch (err) {
    console.error('Error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.slice(7)

  try {
    const { name, type, scheduledTime, recurring, settings } = await request.json()

    if (!name || !type || !scheduledTime) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: job, error } = await supabase
      .from('scheduled_jobs')
      .insert([
        {
          user_id: userData.user.id,
          name,
          type,
          scheduled_time: scheduledTime,
          recurring: recurring || 'once',
          settings: JSON.stringify(settings || {}),
          enabled: true,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single()

    if (error) {
      console.error('Insert error:', error)
      return Response.json({ error: 'Failed to create job' }, { status: 500 })
    }

    return Response.json({ job }, { status: 201 })
  } catch (err) {
    console.error('Error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
