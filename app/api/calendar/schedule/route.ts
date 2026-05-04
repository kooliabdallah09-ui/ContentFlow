import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { schedulePublish } from '@/lib/scheduler'

export async function POST(request: NextRequest) {
  try {
    const { contentId, scheduledDate, platforms } = await request.json()

    if (!contentId || !scheduledDate || !platforms) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await schedulePublish({
      contentId,
      userId: user.id,
      scheduledDate: new Date(scheduledDate),
      platforms,
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Schedule error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scheduling failed' },
      { status: 500 }
    )
  }
}
