import { NextRequest, NextResponse } from 'next/server'
import { signToken, userFromBearer } from '@/lib/oauth-state'
import { checkRateLimit } from '@/lib/rate-limit'
import { adminDb, appUrl, initDirectPost, queryCreatorInfo, tiktokAccessToken, tiktokErrorMessage } from '@/lib/integrations/tiktok'

type Body = {
  contentId?: string
  title?: string
  privacyLevel?: string
  allowComment?: boolean
  allowDuet?: boolean
  allowStitch?: boolean
  disclose?: boolean
  brandOrganic?: boolean
  brandedContent?: boolean
  consent?: boolean
}

// Direct Post to the user's TikTok. Every rule from TikTok's Content Sharing
// Guidelines that the UI enforces is enforced here again, against fresh
// creator info, so a crafted request can't skip them.
export async function POST(req: NextRequest) {
  const userId = await userFromBearer(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const b = (await req.json().catch(() => ({}))) as Body
  if (!b.contentId || typeof b.contentId !== 'string') return NextResponse.json({ error: 'Missing video.' }, { status: 400 })
  if (b.consent !== true) return NextResponse.json({ error: 'Confirm before posting.' }, { status: 400 })
  const title = typeof b.title === 'string' ? b.title.slice(0, 2200) : ''
  const disclose = !!b.disclose
  const brandOrganic = disclose && !!b.brandOrganic
  const brandedContent = disclose && !!b.brandedContent
  if (disclose && !brandOrganic && !brandedContent) {
    return NextResponse.json({ error: 'You need to indicate if your content promotes yourself, a third party, or both.' }, { status: 400 })
  }
  if (brandedContent && b.privacyLevel === 'SELF_ONLY') {
    return NextResponse.json({ error: 'Branded content visibility cannot be set to private.' }, { status: 400 })
  }

  const limit = await checkRateLimit('tiktok-post', userId, 20, 3600 * 1000)
  if (!limit.ok) return NextResponse.json({ error: 'Too many posts this hour. Try again later.' }, { status: 429 })

  const db = adminDb()
  const { data: item } = await db.from('ugc_content')
    .select('id, status, storage_url, metadata')
    .eq('id', b.contentId).eq('user_id', userId).maybeSingle()
  if (!item || item.status !== 'completed' || !/^https:\/\//.test(item.storage_url ?? '')) {
    return NextResponse.json({ error: 'This video is not ready to post.' }, { status: 400 })
  }

  const token = await tiktokAccessToken(db, userId)
  if (!token) return NextResponse.json({ error: 'Connect TikTok first.', code: 'not_connected' }, { status: 409 })

  const info = await queryCreatorInfo(token)
  if (info.error.code !== 'ok') return NextResponse.json({ error: tiktokErrorMessage(info.error.code), code: info.error.code }, { status: 409 })
  const creator = info.data
  if (!b.privacyLevel || !creator.privacy_level_options?.includes(b.privacyLevel)) {
    return NextResponse.json({ error: 'Choose who can view this video.' }, { status: 400 })
  }
  const duration = Number(item.metadata?.duration)
  if (duration && creator.max_video_post_duration_sec && duration > creator.max_video_post_duration_sec) {
    return NextResponse.json({ error: `This account can post videos up to ${creator.max_video_post_duration_sec} seconds.` }, { status: 400 })
  }

  // TikTok downloads the file from our verified domain through a 1-hour signed link.
  const mediaToken = signToken({ c: item.id, u: userId }, 60 * 60 * 1000)
  const videoUrl = `${appUrl()}/api/tiktok/media/${mediaToken}`

  const { data, error } = await initDirectPost(token, {
    title,
    privacyLevel: b.privacyLevel,
    disableComment: creator.comment_disabled || !b.allowComment,
    disableDuet: creator.duet_disabled || !b.allowDuet,
    disableStitch: creator.stitch_disabled || !b.allowStitch,
    brandOrganic,
    brandedContent,
    videoUrl,
  })
  if (error.code !== 'ok' || !data?.publish_id) {
    console.error('[tiktok/post] init failed', error)
    return NextResponse.json({ error: tiktokErrorMessage(error.code), code: error.code }, { status: 502 })
  }

  const { data: row } = await db.from('social_posts').insert({
    user_id: userId, content_id: item.id, platform: 'tiktok',
    publish_id: data.publish_id, status: 'processing', privacy: b.privacyLevel,
  }).select('id').maybeSingle()

  return NextResponse.json({ postId: row?.id ?? null, publishId: data.publish_id })
}
