import { createClient } from '@supabase/supabase-js'

export function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase configuration')
  }

  return createClient(supabaseUrl, supabaseAnonKey)
}

let cachedSupabase: any = null

export function getSupabase() {
  if (typeof window === 'undefined') return null
  if (cachedSupabase) return cachedSupabase
  cachedSupabase = getSupabaseClient()
  return cachedSupabase
}

export async function signup(email: string, password: string, fullName: string) {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not available')

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  })

  if (error) throw error
  return data
}

export async function login(email: string, password: string) {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not available')

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) throw error
  return data
}

// Starts the Google OAuth flow. Supabase redirects the user to Google's
// consent screen, then back to /auth/callback with a session in the URL.
// The callback page consumes the session and runs one-time user init.
export async function signInWithGoogle() {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not available')

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: { access_type: 'offline', prompt: 'select_account' },
    },
  })
  if (error) throw error
}

export async function logout() {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not available')

  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
