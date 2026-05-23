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

    const { data: items, error } = await supabase
      .from('ugc_content')
      .select('*')
      .eq('user_id', userData.user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return Response.json({ error: 'Failed to fetch library' }, { status: 500 })
    }

    return Response.json({ items: items || [] })
  } catch (err) {
    console.error('Error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
