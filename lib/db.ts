import { getSupabase } from './auth'

export async function saveContent(
  contentType: string,
  title: string,
  body: string,
  metadata: any = {}
) {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not initialized')

  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error('User not authenticated')

  const { data, error } = await supabase
    .from('content')
    .insert({
      user_id: user.user.id,
      content_type: contentType,
      title,
      body,
      metadata,
    })
    .select()

  if (error) throw error
  return data?.[0]
}

export async function getUserContent(contentType?: string) {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not initialized')

  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error('User not authenticated')

  let query = supabase
    .from('content')
    .select('*')
    .eq('user_id', user.user.id)
    .order('created_at', { ascending: false })

  if (contentType) {
    query = query.eq('content_type', contentType)
  }

  const { data, error } = await query

  if (error) throw error
  return data || []
}

export async function updateContent(
  contentId: string,
  title: string,
  body: string,
  metadata: any = {}
) {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not initialized')

  const { data, error } = await supabase
    .from('content')
    .update({
      title,
      body,
      metadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contentId)
    .select()

  if (error) throw error
  return data?.[0]
}

export async function deleteContent(contentId: string) {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not initialized')

  const { error } = await supabase
    .from('content')
    .delete()
    .eq('id', contentId)

  if (error) throw error
  return true
}

export async function publishContent(contentId: string) {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not initialized')

  const { data, error } = await supabase
    .from('content')
    .update({
      published: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contentId)
    .select()

  if (error) throw error
  return data?.[0]
}
