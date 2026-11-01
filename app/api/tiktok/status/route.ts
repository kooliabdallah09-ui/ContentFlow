import { NextRequest, NextResponse } from 'next/server'
import { userFromBearer } from '@/lib/oauth-state'
import { adminDb, fetchPostStatus, tiktokAccessToken } from '@/lib/integrations/tiktok'

// Latest status of a TikTok post the user made (polled by the Library).
export async function GET(req: NextRequest) {
  const userId = await userFromBearer(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const db = adminDb()
  const { data: post } = await db.from('social_posts')
    .select('id, publish_id, status, fail_reason').eq('id', id).eq('user_id', userId).maybeSingle()
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (post.status !== 'processing' || !post.publish_id) return NextResponse.json({ status: post.status, failReason: post.fail_reason })

  const token = await tiktokAccessToken(db, userId)
  if (!token) return NextResponse.json({ status: post.status })
  const { data, error } = await fetchPostStatus(token, post.publish_id)
  if (error.code !== 'ok' || !data) return NextResponse.json({ status: post.status })

  const status = data.status === 'PUBLISH_COMPLETE' ? 'published' : data.status === 'FAILED' ? 'failed' : 'processing'
  if (status !== post.status) {
    await db.from('social_posts').update({ status, fail_reason: data.fail_reason ?? null, updated_at: new Date().toISOString() }).eq('id', post.id)
  }
  return NextResponse.json({ status, failReason: data.fail_reason ?? null })
}
