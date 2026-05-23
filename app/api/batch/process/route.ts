import { createClient } from '@supabase/supabase-js'

interface BatchRequest {
  type: 'images' | 'voices' | 'videos'
  items: any[]
}

// In-memory rate limiting (in production, use Redis)
const rateLimits = new Map<
  string,
  { count: number; resetTime: number }
>()

function checkRateLimit(userId: string): boolean {
  const limit = rateLimits.get(userId)
  const now = Date.now()

  if (!limit || now > limit.resetTime) {
    rateLimits.set(userId, { count: 1, resetTime: now + 60 * 1000 })
    return true
  }

  if (limit.count >= 10) {
    // 10 batch jobs per minute
    return false
  }

  limit.count++
  return true
}

export async function POST(request: Request) {
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

    // Check rate limit
    if (!checkRateLimit(userData.user.id)) {
      return Response.json(
        { error: 'Rate limit exceeded. Maximum 10 batch jobs per minute.' },
        { status: 429 }
      )
    }

    const body: BatchRequest = await request.json()

    // Validate batch request
    if (!body.type || !Array.isArray(body.items) || body.items.length === 0) {
      return Response.json(
        { error: 'Invalid batch request. Must include type and items array.' },
        { status: 400 }
      )
    }

    if (body.items.length > 50) {
      return Response.json(
        { error: 'Batch size too large. Maximum 50 items per batch.' },
        { status: 400 }
      )
    }

    // Validate items have required fields
    const validItems = body.items.every((item) => {
      if (typeof item !== 'object' || item === null) return false

      switch (body.type) {
        case 'images':
          return item.prompt && typeof item.prompt === 'string'
        case 'voices':
          return item.text && typeof item.text === 'string'
        case 'videos':
          return item.script && typeof item.script === 'string'
        default:
          return false
      }
    })

    if (!validItems) {
      return Response.json(
        { error: `Invalid items for type ${body.type}` },
        { status: 400 }
      )
    }

    // Calculate estimated credits
    const creditCosts: Record<string, number> = {
      images: 80,
      voices: 150,
      videos: 300,
    }

    const estimatedCredits = body.items.length * (creditCosts[body.type] || 0)

    // Check user credits
    const { data: creditsData } = await supabase
      .from('user_credits')
      .select('balance')
      .eq('user_id', userData.user.id)
      .single()

    if (!creditsData || creditsData.balance < estimatedCredits) {
      return Response.json(
        {
          error: `Insufficient credits. Need ${estimatedCredits}, have ${creditsData?.balance || 0}`,
        },
        { status: 400 }
      )
    }

    // Create batch job record
    const { data: batchJob, error: insertError } = await supabase
      .from('batch_jobs')
      .insert([
        {
          user_id: userData.user.id,
          type: body.type,
          item_count: body.items.length,
          estimated_credits: estimatedCredits,
          status: 'queued',
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single()

    if (insertError || !batchJob) {
      console.error('Failed to create batch job:', insertError)
      return Response.json(
        { error: 'Failed to create batch job' },
        { status: 500 }
      )
    }

    // Store items for processing (in production, use a queue system)
    const { error: itemsError } = await supabase.from('batch_items').insert(
      body.items.map((item, idx) => ({
        batch_job_id: batchJob.id,
        item_index: idx,
        settings: JSON.stringify(item),
        status: 'pending',
      }))
    )

    if (itemsError) {
      console.error('Failed to store batch items:', itemsError)
      return Response.json(
        { error: 'Failed to store batch items' },
        { status: 500 }
      )
    }

    return Response.json(
      {
        jobId: batchJob.id,
        itemCount: body.items.length,
        estimatedCredits,
        status: 'queued',
      },
      { status: 202 }
    )
  } catch (err) {
    console.error('Error processing batch:', err)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
