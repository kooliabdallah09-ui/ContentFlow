// TikTok Content Posting API

export async function publishToTikTok(params: {
  accessToken: string
  videoUrl: string   // public URL to the video file
  title: string
  privacyLevel?: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY'
}) {
  const { accessToken, videoUrl, title, privacyLevel = 'PUBLIC_TO_EVERYONE' } = params

  // Step 1: Fetch the video to get its size
  const headRes = await fetch(videoUrl, { method: 'HEAD' })
  const contentLength = parseInt(headRes.headers.get('content-length') || '0')
  if (!contentLength) throw new Error('Could not determine video file size')

  // Step 2: Initialize upload
  const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      post_info: {
        title: title.substring(0, 2200),
        privacy_level: privacyLevel,
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        video_url: videoUrl,
      },
    }),
  })

  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({}))
    throw new Error(err?.error?.message || `TikTok publish failed: ${initRes.status}`)
  }

  const initData = await initRes.json()
  const publishId = initData?.data?.publish_id
  if (!publishId) throw new Error('TikTok did not return publish ID')

  return { success: true, postId: publishId, platform: 'tiktok' }
}

export async function refreshTikTokToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  const data = await res.json()
  if (!data?.data?.access_token) throw new Error('Failed to refresh TikTok token')
  return data.data.access_token
}
