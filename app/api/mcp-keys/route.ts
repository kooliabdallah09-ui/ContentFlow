import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateApiKey } from '@/lib/mcp/auth'

async function auth(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data: userData } = await supabase.auth.getUser(authHeader.slice(7))
  return userData.user ? { user: userData.user, supabase } : null
}

export async function GET(req: NextRequest) {
  const ctx = await auth(req)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await ctx.supabase
    .from('mcp_api_keys')
    .select('id, name, key_prefix, created_at, last_used_at, revoked_at')
    .eq('user_id', ctx.user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ keys: data ?? [] })
}

export async function POST(req: NextRequest) {
  const ctx = await auth(req)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name } = await req.json()
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'Missing name' }, { status: 400 })
  }

  const { plaintext, prefix, hash } = generateApiKey()
  const { data, error } = await ctx.supabase
    .from('mcp_api_keys')
    .insert({ user_id: ctx.user.id, name: name.slice(0, 60), key_prefix: prefix, key_hash: hash })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Return the plaintext ONCE — never stored, never shown again.
  return NextResponse.json({ id: data.id, key: plaintext, prefix })
}

export async function DELETE(req: NextRequest) {
  const ctx = await auth(req)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await ctx.supabase
    .from('mcp_api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', ctx.user.id)
    .eq('id', id)

  return NextResponse.json({ success: true })
}
