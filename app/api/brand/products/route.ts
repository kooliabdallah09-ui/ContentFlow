import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Returns the user's products from user_studio_products (Product Studio).
// Brand settings no longer manages products — Product Studio is the canonical source.
//
// GET → { products: [{ id, name, image_url, created_at }] }

async function authedClient(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error('Server not configured')
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Unauthorized')
  const supabase = createClient(supabaseUrl, supabaseKey)
  const { data: userData, error } = await supabase.auth.getUser(authHeader.slice(7))
  if (error || !userData?.user) throw new Error('Unauthorized')
  return { supabase, userId: userData.user.id }
}

export async function GET(req: NextRequest) {
  try {
    const { supabase, userId } = await authedClient(req)
    const { data, error } = await supabase
      .from('user_studio_products')
      .select('id, name, photo_urls, product_type, created_at')
      .eq('user_id', userId)
      .order('last_used_at', { ascending: false, nullsFirst: false })
    if (error) throw error
    const products = (data ?? []).map(p => ({
      id: p.id,
      name: p.name,
      image_url: Array.isArray(p.photo_urls) && p.photo_urls.length > 0 ? p.photo_urls[0] : null,
      product_type: p.product_type ?? 'physical',
      created_at: p.created_at,
    }))
    return NextResponse.json({ products })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load products' },
      { status: 500 },
    )
  }
}
