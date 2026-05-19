import { createClient } from '@supabase/supabase-js'
import { initializeUserCredits } from '@/lib/credits'

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      return Response.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { plan = 'free' } = await request.json()

    // Check if credits already initialized
    const { data: existingCredits } = await supabase
      .from('user_credits')
      .select('id')
      .eq('user_id', userData.user.id)
      .single()

    if (existingCredits) {
      return Response.json({ message: 'Credits already initialized', data: existingCredits })
    }

    // Initialize credits
    const credits = await initializeUserCredits(userData.user.id, plan)

    return Response.json({ data: credits }, { status: 201 })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to initialize credits' },
      { status: 500 }
    )
  }
}
