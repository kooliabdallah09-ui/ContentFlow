import { createClient } from '@supabase/supabase-js'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.slice(7)
  const { id } = await params

  try {
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
      .eq('id', id)
      .eq('user_id', userData.user.id)

    if (error) {
      console.error('[library/delete]', error)
      return Response.json({ error: 'Failed to delete' }, { status: 500 })
    }

    return Response.json({ success: true })
  } catch (err) {
    console.error('[library/delete]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
