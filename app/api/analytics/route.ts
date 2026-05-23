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

    // Get content generation stats
    const { data: content, error } = await supabase
      .from('ugc_content')
      .select('content_type, credit_cost, created_at')
      .eq('user_id', userData.user.id)

    if (error) {
      console.error('Database error:', error)
      return Response.json({ error: 'Failed to fetch analytics' }, { status: 500 })
    }

    // Calculate analytics
    const totalGenerated = content?.length || 0
    const totalCreditsUsed = content?.reduce((sum, item) => sum + (item.credit_cost || 0), 0) || 0

    const generationsByType: Record<string, number> = {}
    const creditsByType: Record<string, number> = {}
    const recentActivity: Array<{ type: string; date: string; credits: number }> = []

    content?.forEach((item) => {
      generationsByType[item.content_type] = (generationsByType[item.content_type] || 0) + 1
      creditsByType[item.content_type] = (creditsByType[item.content_type] || 0) + (item.credit_cost || 0)

      if (recentActivity.length < 20) {
        recentActivity.push({
          type: item.content_type,
          date: item.created_at,
          credits: item.credit_cost,
        })
      }
    })

    return Response.json({
      totalGenerated,
      totalCreditsUsed,
      generationsByType,
      creditsByType,
      recentActivity: recentActivity.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
    })
  } catch (err) {
    console.error('Error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
