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

    // Get user's templates
    const { data: templates, error } = await supabase
      .from('templates')
      .select('*')
      .eq('user_id', userData.user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return Response.json({ error: 'Failed to fetch templates' }, { status: 500 })
    }

    return Response.json({ templates: templates || [] })
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
    const { name, description, type, settings } = await request.json()

    if (!name || !type || !settings) {
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

    const { data: template, error } = await supabase
      .from('templates')
      .insert([
        {
          user_id: userData.user.id,
          name,
          description,
          type,
          settings: JSON.stringify(settings),
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single()

    if (error) {
      console.error('Insert error:', error)
      return Response.json({ error: 'Failed to create template' }, { status: 500 })
    }

    return Response.json({ template }, { status: 201 })
  } catch (err) {
    console.error('Error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
