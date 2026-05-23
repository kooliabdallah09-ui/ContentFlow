import { createClient } from '@supabase/supabase-js'

export async function GET(
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

    // Get batch job
    const { data: job, error: jobError } = await supabase
      .from('batch_jobs')
      .select('*')
      .eq('id', params.jobId)
      .eq('user_id', userData.user.id)
      .single()

    if (jobError || !job) {
      return Response.json({ error: 'Batch job not found' }, { status: 404 })
    }

    // Get batch items with status
    const { data: items, error: itemsError } = await supabase
      .from('batch_items')
      .select('*')
      .eq('batch_job_id', params.jobId)

    if (itemsError) {
      console.error('Failed to fetch batch items:', itemsError)
      return Response.json(
        { error: 'Failed to fetch batch items' },
        { status: 500 }
      )
    }

    // Calculate progress
    const completed = items?.filter((i) => i.status === 'completed').length || 0
    const failed = items?.filter((i) => i.status === 'failed').length || 0
    const pending = items?.filter((i) => i.status === 'pending').length || 0
    const total = items?.length || 0

    return Response.json({
      jobId: job.id,
      status: job.status,
      type: job.type,
      itemCount: job.item_count,
      estimatedCredits: job.estimated_credits,
      progress: {
        completed,
        failed,
        pending,
        total,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      },
      createdAt: job.created_at,
      completedAt: job.completed_at,
    })
  } catch (err) {
    console.error('Error:', err)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
