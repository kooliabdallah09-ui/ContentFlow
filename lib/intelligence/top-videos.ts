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
async function fetchTopTikTok(keywords: string[]): Promise<{ result: TopVideoCandidate | null; reason?: string }> {
  const token = process.env.APIFY_TOKEN
  const actorId = process.env.APIFY_TIKTOK_ACTOR_ID
  if (!token) return { result: null, reason: 'APIFY_TOKEN not set' }
  if (!actorId) return { result: null, reason: 'APIFY_TIKTOK_ACTOR_ID not set' }
  if (!keywords.length) return { result: null, reason: 'no keywords' }
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
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { result: null, reason: `Apify TikTok HTTP ${res.status}: ${body.slice(0, 200)}` }
    }
    const items = await res.json() as Array<{
      webVideoUrl?: string
      videoUrl?: string
      text?: string
      playCount?: number
      diggCount?: number
      hashtags?: Array<{ name?: string }>
      authorMeta?: { name?: string }
    }>
    if (!items.length) return { result: null, reason: 'Apify TikTok returned 0 items' }
    const top = items.slice().sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0))[0]
    return {
      result: {
        platform: 'tiktok',
        sourceUrl: top.webVideoUrl ?? '',
        videoUrl: top.videoUrl,
        caption: top.text,
        hashtags: (top.hashtags ?? []).map(h => `#${h.name}`).filter(Boolean).slice(0, 8),
        views: top.playCount,
        likes: top.diggCount,
        authorHandle: top.authorMeta?.name,
      },
    }
  } catch (err) { return { result: null, reason: `Apify TikTok error: ${err instanceof Error ? err.message : 'unknown'}` } }
}

// ---------- Instagram Reels via Apify actor ----------
async function fetchTopReels(keywords: string[]): Promise<{ result: TopVideoCandidate | null; reason?: string }> {
  const token = process.env.APIFY_TOKEN
  const actorId = process.env.APIFY_INSTAGRAM_ACTOR_ID
  if (!token) return { result: null, reason: 'APIFY_TOKEN not set' }
  if (!actorId) return { result: null, reason: 'APIFY_INSTAGRAM_ACTOR_ID not set' }
  if (!keywords.length) return { result: null, reason: 'no keywords' }
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
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { result: null, reason: `Apify Reels HTTP ${res.status}: ${body.slice(0, 200)}` }
    }
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
    if (!reels.length) return { result: null, reason: 'Apify Reels returned 0 video items' }
    const top = reels.sort((a, b) => (b.videoViewCount ?? b.likesCount ?? 0) - (a.videoViewCount ?? a.likesCount ?? 0))[0]
    return {
      result: {
        platform: 'reels',
        sourceUrl: top.url ?? '',
        videoUrl: top.videoUrl,
        caption: top.caption,
        hashtags: (top.hashtags ?? []).map(h => `#${h}`).slice(0, 8),
        views: top.videoViewCount,
        likes: top.likesCount,
        authorHandle: top.ownerUsername,
      },
    }
  } catch (err) { return { result: null, reason: `Apify Reels error: ${err instanceof Error ? err.message : 'unknown'}` } }
}

// Orchestrator — fires both in parallel. Returns candidates plus per-platform
// debug reasons so the onboarding UI/logs can tell us why nothing came back.
export async function fetchTopVideosAcrossPlatforms(input: {
  keywords: string[]
}): Promise<{ candidates: TopVideoCandidate[]; debug: Record<string, string | undefined> }> {
  const [tiktok, reels] = await Promise.all([
    fetchTopTikTok(input.keywords),
    fetchTopReels(input.keywords),
  ])
  const candidates: TopVideoCandidate[] = []
  if (tiktok.result) candidates.push(tiktok.result)
  if (reels.result) candidates.push(reels.result)
  return {
    candidates,
    debug: { tiktok: tiktok.reason, reels: reels.reason, keywords: input.keywords.join(', ') },
  }
}
