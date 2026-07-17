// Product Studio — detail + delete.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 30

function supa() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function authUser(request: NextRequest): Promise<string | null> {
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return null
  const { data } = await supa().auth.getUser(header.slice(7))
  return data.user?.id ?? null
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await authUser(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const supabase = supa()
    const [{ data: product }, { data: photos }] = await Promise.all([
      supabase.from('user_studio_products').select('*').eq('id', id).eq('user_id', userId).maybeSingle(),
      supabase.from('user_studio_product_photos').select('id, concept, image_url, created_at')
        .eq('product_id', id).eq('user_id', userId)
        .order('created_at', { ascending: false }).limit(120),
    ])
    if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ product, photos: photos ?? [] })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await authUser(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const { error } = await supa()
      .from('user_studio_products')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
