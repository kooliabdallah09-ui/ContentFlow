import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// List + replace the user's product catalog. Each product is { id, name, image_url, created_at }.
// Stored in brand_profiles.products (JSONB) — see migrations/005_add_brand_products.sql.
//
// GET  → { products: [...] }
// POST → upserts the full array { products: [...] } (caller sends the whole list)

interface Product {
  id: string
  name: string
  image_url: string | null
  created_at: string
}

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
      .from('brand_profiles')
      .select('products')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) {
      // If `products` column doesn't exist yet (migration not run), return empty.
      if (error.code === '42703' || /column.*products/i.test(error.message)) {
        return NextResponse.json({ products: [], migrationPending: true })
      }
      throw error
    }
    const products: Product[] = Array.isArray(data?.products) ? data!.products : []
    return NextResponse.json({ products })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load products' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const { supabase, userId } = await authedClient(req)
    const body = await req.json()
    const list = Array.isArray(body?.products) ? body.products : []
    // Sanitize: cap at 50, validate fields.
    const sanitized: Product[] = list.slice(0, 50).map((p: Product) => ({
      id: String(p.id ?? crypto.randomUUID()),
      name: String(p.name ?? '').slice(0, 120).trim() || 'Untitled product',
      image_url: typeof p.image_url === 'string' ? p.image_url : null,
      created_at: String(p.created_at ?? new Date().toISOString()),
    }))

    // Ensure the brand_profiles row exists (Brand page creates it). Upsert products only.
    const { error } = await supabase
      .from('brand_profiles')
      .upsert({ user_id: userId, products: sanitized, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })

    if (error) {
      if (error.code === '42703' || /column.*products/i.test(error.message)) {
        return NextResponse.json(
          { error: 'The products column has not been added yet — run migrations/005_add_brand_products.sql in Supabase first.' },
          { status: 400 },
        )
      }
      throw error
    }

    return NextResponse.json({ success: true, products: sanitized })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Save failed' },
      { status: 500 },
    )
  }
}
