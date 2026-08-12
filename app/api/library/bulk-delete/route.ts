import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.slice(7)

  try {
    const { ids } = await request.json()
    if (!Array.isArray(ids) || ids.length === 0) {
      return Response.json({ error: 'Invalid request' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('ugc_content')
      .delete()
      .in('id', ids)
      .eq('user_id', userData.user.id)

    if (error) {
      console.error('[bulk-delete]', error)
      return Response.json({ error: 'Failed to delete items' }, { status: 500 })
    }

    return Response.json({ success: true, deleted: ids.length })
  } catch (err) {
    console.error('[bulk-delete]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
