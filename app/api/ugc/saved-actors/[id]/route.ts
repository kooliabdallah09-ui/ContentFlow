// DELETE /api/ugc/saved-actors/[id] — remove a saved actor.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 30

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const header = request.headers.get('Authorization')
    if (!header?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: userData } = await supabase.auth.getUser(header.slice(7))
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await ctx.params
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const { error } = await supabase
      .from('user_saved_actors')
      .delete()
      .eq('id', id)
      .eq('user_id', userData.user.id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Delete failed' },
      { status: 500 },
    )
  }
}
