import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)

    // Verify the token and get user info
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = user.id

    // Delete user data from every table that stores user-scoped rows.
    // Missing any of these leaves orphan data (GDPR / CCPA violation).
    // Wrap each delete in .then so one failure doesn't abort the batch.
    const tables = [
      'content',
      'content_analytics',
      'content_calendar',
      'user_credits',
      'user_subscriptions',
      'credit_transactions',
      'brand_profiles',
      'user_monthly_plans',
      'user_influencers',
      'user_products',
      'ugc_content',
      'campaigns',
      'campaign_shots',
      'scenes',
      'integrations',
      'youtube_publish_queue',
      'data_deletion_requests',
      'saved_actors',
      'brand_launches',
      'templates',
      'library_items',
    ]
    const results = await Promise.allSettled(
      tables.map(t => supabase.from(t).delete().eq('user_id', userId)),
    )
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.warn(`[user/delete] table ${tables[i]} delete failed:`, r.reason)
      }
    })

    // Delete storage objects (portraits, sheets, generated content, uploads)
    for (const bucket of ['ugc-assets', 'brand-uploads', 'user-uploads']) {
      try {
        const { data: files } = await supabase.storage.from(bucket).list(userId, { limit: 1000 })
        if (files?.length) {
          await supabase.storage.from(bucket).remove(files.map(f => `${userId}/${f.name}`))
        }
      } catch (storageErr) {
        console.warn(`[user/delete] storage cleanup ${bucket} failed:`, storageErr)
      }
    }

    // Delete the user account from Supabase Auth
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId)
    if (deleteError) {
      console.error('Error deleting user:', deleteError)
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Account deleted successfully' })
  } catch (error) {
    console.error('Delete account error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
