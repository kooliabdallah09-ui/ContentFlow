import { createHash, randomBytes } from 'crypto'
import { createClient } from '@supabase/supabase-js'

export function generateApiKey(): { plaintext: string; prefix: string; hash: string } {
  const raw = randomBytes(24).toString('base64url')
  const plaintext = `cf_live_${raw}`
  const prefix = plaintext.slice(0, 16) // "cf_live_xxxxxxxx"
  const hash = createHash('sha256').update(plaintext).digest('hex')
  return { plaintext, prefix, hash }
}

export function hashApiKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex')
}

// Look up API key. Returns user_id if valid, null otherwise. Also updates
// last_used_at as a side effect so users can see when their key was used last.
export async function resolveApiKey(plaintext: string): Promise<string | null> {
  if (!plaintext.startsWith('cf_live_')) return null
  const hash = hashApiKey(plaintext)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data } = await supabase
    .from('mcp_api_keys')
    .select('id, user_id, revoked_at')
    .eq('key_hash', hash)
    .maybeSingle()
  if (!data || data.revoked_at) return null
  supabase.from('mcp_api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', data.id).then(() => {})
  return data.user_id
}
