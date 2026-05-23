import { createClient } from '@supabase/supabase-js'

export async function PATCH(
  request: Request,
  { params }: { params: { jobId: string } }
) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.slice(7)

  try {
    const { enabled } = await request.json()

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership
    const { data: job, error: fetchError } = await supabase
      .from('scheduled_jobs')
      .select('user_id')
      .eq('id', params.jobId)
      .single()

    if (fetchError || job?.user_id !== userData.user.id) {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }

    // Update job
    const { error } = await supabase
      .from('scheduled_jobs')
      .update({ enabled })
      .eq('id', params.jobId)

    if (error) {
      console.error('Update error:', error)
      return Response.json({ error: 'Failed to update job' }, { status: 500 })
    }

    return Response.json({ success: true })
  } catch (err) {
    console.error('Error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { jobId: string } }
) {
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

    // Verify ownership
    const { data: job, error: fetchError } = await supabase
      .from('scheduled_jobs')
      .select('user_id')
      .eq('id', params.jobId)
      .single()

    if (fetchError || job?.user_id !== userData.user.id) {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }

    // Soft delete
    const { error } = await supabase
      .from('scheduled_jobs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', params.jobId)

    if (error) {
      console.error('Delete error:', error)
      return Response.json({ error: 'Failed to delete job' }, { status: 500 })
    }

    return Response.json({ success: true })
  } catch (err) {
    console.error('Error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
