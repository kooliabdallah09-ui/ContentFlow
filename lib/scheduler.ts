import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function createSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set(name, value, options)
          } catch {
            // Silently fail
          }
        },
        remove(name: string) {
          try {
            cookieStore.delete(name)
          } catch {
            // Silently fail
          }
        },
      },
    }
  )
}

export interface ScheduleOptions {
  contentId: string
  userId: string
  scheduledDate: Date
  platforms: string[]
}

export async function schedulePublish(options: ScheduleOptions) {
  const supabase = await createSupabaseClient()

  const { data, error } = await supabase
    .from('content_calendar')
    .insert([
      {
        user_id: options.userId,
        content_id: options.contentId,
        scheduled_date: options.scheduledDate.toISOString(),
        platforms: options.platforms,
        status: 'scheduled',
      },
    ])
    .select()

  if (error) throw error
  return data?.[0]
}

export async function rescheduleContent(
  contentId: string,
  userId: string,
  newDate: Date
) {
  const supabase = await createSupabaseClient()

  const { data, error } = await supabase
    .from('content_calendar')
    .update({
      scheduled_date: newDate.toISOString(),
      status: 'scheduled',
    })
    .eq('content_id', contentId)
    .eq('user_id', userId)
    .select()

  if (error) throw error
  return data?.[0]
}

export async function getScheduledContent(
  userId: string,
  startDate?: Date,
  endDate?: Date
) {
  const supabase = await createSupabaseClient()

  let query = supabase
    .from('content_calendar')
    .select(
      `
      *,
      content:content_id(id, title, content_type, body, metadata)
    `
    )
    .eq('user_id', userId)
    .eq('status', 'scheduled')
    .order('scheduled_date', { ascending: true })

  if (startDate) {
    query = query.gte('scheduled_date', startDate.toISOString())
  }

  if (endDate) {
    query = query.lte('scheduled_date', endDate.toISOString())
  }

  const { data, error } = await query

  if (error) throw error
  return data
}

export async function getDuePublishes() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set(name, value, options)
          } catch {
            // Silently fail
          }
        },
        remove(name: string) {
          try {
            cookieStore.delete(name)
          } catch {
            // Silently fail
          }
        },
      },
    }
  )

  const now = new Date()
  const { data, error } = await supabase
    .from('content_calendar')
    .select(
      `
      *,
      content:content_id(id, title, content_type, body, metadata)
    `
    )
    .eq('status', 'scheduled')
    .lte('scheduled_date', now.toISOString())
    .order('scheduled_date', { ascending: true })

  if (error) throw error
  return data
}

export async function updatePublishStatus(
  calendarId: string,
  status: 'publishing' | 'published' | 'failed',
  errorMessage?: string
) {
  const supabase = await createSupabaseClient()

  const { data, error } = await supabase
    .from('content_calendar')
    .update({
      status,
      ...(status === 'published' && { published_date: new Date().toISOString() }),
      ...(errorMessage && { error_message: errorMessage }),
    })
    .eq('id', calendarId)
    .select()

  if (error) throw error
  return data?.[0]
}

export async function deleteScheduledContent(
  contentId: string,
  userId: string
) {
  const supabase = await createSupabaseClient()

  const { error } = await supabase
    .from('content_calendar')
    .delete()
    .eq('content_id', contentId)
    .eq('user_id', userId)

  if (error) throw error
}
