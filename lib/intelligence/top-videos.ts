// Fetch the top 1 short-form video per platform (TikTok, Instagram Reels,
// YouTube Shorts) for a given niche. All fetchers fail-soft: if the API
// key is missing OR the request errors we return null. The onboarding
// pipeline still proceeds.

export interface TopVideoCandidate {
  platform: 'tiktok' | 'reels'
  sourceUrl: string             // original URL for humans
  videoUrl?: string             // direct mp4 for Gemini analysis
  caption?: string
  hashtags?: string[]
  views?: number
  likes?: number
  authorHandle?: string
}

// ---------- TikTok via Apify actor ----------
async function fetchTopTikTok(keywords: string[]): Promise<TopVideoCandidate | null> {
  const token = process.env.APIFY_TOKEN
  const actorId = process.env.APIFY_TIKTOK_ACTOR_ID
  if (!token || !actorId || !keywords.length) return null
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 25_000)
    const res = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          hashtags: keywords.slice(0, 3),
          resultsPerHashtag: 5,
        }),
      },
    )
    clearTimeout(timeout)
    if (!res.ok) return null
    const items = await res.json() as Array<{
      webVideoUrl?: string
      videoUrl?: string
      text?: string
      playCount?: number
      diggCount?: number
      hashtags?: Array<{ name?: string }>
      authorMeta?: { name?: string }
    }>
    if (!items.length) return null
    const top = items.slice().sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0))[0]
    return {
      platform: 'tiktok',
      sourceUrl: top.webVideoUrl ?? '',
      videoUrl: top.videoUrl,
      caption: top.text,
      hashtags: (top.hashtags ?? []).map(h => `#${h.name}`).filter(Boolean).slice(0, 8),
      views: top.playCount,
      likes: top.diggCount,
      authorHandle: top.authorMeta?.name,
    }
  } catch { return null }
}

// ---------- Instagram Reels via Apify actor ----------
async function fetchTopReels(keywords: string[]): Promise<TopVideoCandidate | null> {
  const token = process.env.APIFY_TOKEN
  const actorId = process.env.APIFY_INSTAGRAM_ACTOR_ID
  if (!token || !actorId || !keywords.length) return null
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 25_000)
    const res = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          hashtags: keywords.slice(0, 3).map(k => k.replace(/^#/, '')),
          resultsLimit: 5,
          searchType: 'hashtag',
        }),
      },
    )
    clearTimeout(timeout)
    if (!res.ok) return null
    const items = await res.json() as Array<{
      url?: string
      videoUrl?: string
      caption?: string
      likesCount?: number
      videoViewCount?: number
      hashtags?: string[]
      ownerUsername?: string
      productType?: string
      isVideo?: boolean
    }>
    const reels = items.filter(x => x.isVideo || x.productType === 'clips' || x.videoUrl)
    if (!reels.length) return null
    const top = reels.sort((a, b) => (b.videoViewCount ?? b.likesCount ?? 0) - (a.videoViewCount ?? a.likesCount ?? 0))[0]
    return {
      platform: 'reels',
      sourceUrl: top.url ?? '',
      videoUrl: top.videoUrl,
      caption: top.caption,
      hashtags: (top.hashtags ?? []).map(h => `#${h}`).slice(0, 8),
      views: top.videoViewCount,
      likes: top.likesCount,
      authorHandle: top.ownerUsername,
    }
  } catch { return null }
}

// Orchestrator — fires both in parallel. Returns whichever succeeded.
export async function fetchTopVideosAcrossPlatforms(input: {
  keywords: string[]
}): Promise<TopVideoCandidate[]> {
  const [tiktok, reels] = await Promise.all([
    fetchTopTikTok(input.keywords),
    fetchTopReels(input.keywords),
  ])
  return [tiktok, reels].filter((x): x is TopVideoCandidate => !!x)
}
