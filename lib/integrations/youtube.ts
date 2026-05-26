// YouTube Data API v3 — video upload + metadata

export async function publishToYouTube(params: {
  accessToken: string
  videoUrl: string   // public URL to the video file
  title: string
  description: string
  tags?: string[]
  privacyStatus?: 'public' | 'unlisted' | 'private'
}) {
  const { accessToken, videoUrl, title, description, tags = [], privacyStatus = 'public' } = params

  // Step 1: Fetch the video as a buffer
  const videoRes = await fetch(videoUrl)
  if (!videoRes.ok) throw new Error('Failed to fetch video for YouTube upload')

  const videoBuffer = await videoRes.arrayBuffer()
  const videoBytes = new Uint8Array(videoBuffer)
  const contentType = videoRes.headers.get('content-type') || 'video/mp4'

  // Step 2: Initiate resumable upload
  const initRes = await fetch(
    `https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': contentType,
        'X-Upload-Content-Length': videoBytes.byteLength.toString(),
      },
      body: JSON.stringify({
        snippet: {
          title: title.substring(0, 100),
          description: description.substring(0, 5000),
          tags: tags.slice(0, 30),
          categoryId: '22', // People & Blogs
        },
        status: {
          privacyStatus,
          selfDeclaredMadeForKids: false,
        },
      }),
    }
  )

  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({}))
    throw new Error(err?.error?.message || `YouTube upload init failed: ${initRes.status}`)
  }

  const uploadUrl = initRes.headers.get('location')
  if (!uploadUrl) throw new Error('YouTube did not return upload URL')

  // Step 3: Upload the video bytes
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Content-Length': videoBytes.byteLength.toString(),
    },
    body: videoBytes,
  })

  if (!uploadRes.ok) {
    throw new Error(`YouTube video upload failed: ${uploadRes.status}`)
  }

  const data = await uploadRes.json()
  const videoId = data.id
  if (!videoId) throw new Error('YouTube did not return video ID')

  return {
    success: true,
    postId: videoId,
    videoUrl: `https://youtu.be/${videoId}`,
    platform: 'youtube',
  }
}

export async function refreshYouTubeToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  const data = await res.json()
  if (!data.access_token) throw new Error('Failed to refresh YouTube token')
  return data.access_token
}
