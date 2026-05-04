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

export async function saveIntegrationToken(
  userId: string,
  platform: string,
  accessToken: string,
  refreshToken: string,
  additionalData?: Record<string, string>
) {
  const supabase = await createSupabaseClient()

  const { data, error } = await supabase
    .from('integrations')
    .insert([
      {
        user_id: userId,
        platform,
        access_token: accessToken,
        refresh_token: refreshToken,
        ...additionalData,
      },
    ])
    .select()

  if (error) throw error
  return data
}

export async function getIntegrationToken(
  userId: string,
  platform: string
) {
  const supabase = await createSupabaseClient()

  const { data, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('platform', platform)
    .single()

  if (error) throw error
  return data
}

export async function deleteIntegration(userId: string, platform: string) {
  const supabase = await createSupabaseClient()

  const { error } = await supabase
    .from('integrations')
    .delete()
    .eq('user_id', userId)
    .eq('platform', platform)

  if (error) throw error
}

export async function getUserIntegrations(userId: string) {
  const supabase = await createSupabaseClient()

  const { data, error } = await supabase
    .from('integrations')
    .select('platform, connected_at')
    .eq('user_id', userId)

  if (error) throw error
  return data
}
