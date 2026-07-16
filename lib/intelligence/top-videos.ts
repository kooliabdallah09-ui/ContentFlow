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

// Apify's REST API expects actor IDs in `username~actor-name` form. Env
// values with `/` (the URL slug used on apify.com) would break routing, so
// we normalise once here.
function normaliseActorId(id: string): string {
  return id.replace('/', '~').trim()
}

// Instagram hashtag scraper rejects hashtags containing spaces, commas,
// dashes, or punctuation. Split multi-word keywords into individual words,
// keep only [a-zA-Z0-9_] chunks, drop empties, dedupe, cap at N.
function sanitiseHashtags(keywords: string[], max: number): string[] {
  const out = new Set<string>()
  for (const k of keywords) {
    const words = String(k).toLowerCase().replace(/[^a-z0-9_ ]+/g, ' ').split(/\s+/)
    for (const w of words) {
      const clean = w.trim().replace(/[^a-z0-9_]/g, '')
      if (clean.length >= 3) out.add(clean)
      if (out.size >= max) break
    }
    if (out.size >= max) break
  }
  return [...out]
}

// ---------- TikTok via Apify actor ----------
async function fetchTopTikTok(keywords: string[]): Promise<{ result: TopVideoCandidate | null; reason?: string }> {
  const token = process.env.APIFY_TOKEN
  const rawActor = process.env.APIFY_TIKTOK_ACTOR_ID
  const actorId = rawActor ? normaliseActorId(rawActor) : ''
  if (!token) return { result: null, reason: 'APIFY_TOKEN not set' }
  if (!actorId) return { result: null, reason: 'APIFY_TIKTOK_ACTOR_ID not set' }
  if (!keywords.length) return { result: null, reason: 'no keywords' }
  const tiktokHashtags = sanitiseHashtags(keywords, 3)
  if (!tiktokHashtags.length) return { result: null, reason: 'no valid hashtags after sanitising' }
  try {
    const controller = new AbortController()
    // TikTok scrapers routinely need 40-60s to scrape + download videos.
    // We're inside a 180s route so 90s here still leaves room for Gemini.
    const timeout = setTimeout(() => controller.abort(), 90_000)
    const res = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          hashtags: tiktokHashtags,
          resultsPerHashtag: 5,
          // Force the actor to include a downloadable video URL. Without
          // this flag the scraper only returns metadata + cover image, so
          // downstream Gemini analysis has nothing to watch.
          shouldDownloadVideos: true,
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
      mediaUrls?: string[]
      videoUrl?: string
      videoMeta?: { downloadAddr?: string; playAddr?: string }
      text?: string
      playCount?: number
      diggCount?: number
      hashtags?: Array<{ name?: string }>
      authorMeta?: { name?: string }
    }>
    if (!items.length) return { result: null, reason: 'Apify TikTok returned 0 items' }
    const top = items.slice().sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0))[0]
    // Log the actual field shape from the actor so we can adapt to actor
    // version drift — Apify actors regularly rename fields between versions.
    console.log('[top-videos:tiktok] top item keys:', Object.keys(top).join(','))
    console.log('[top-videos:tiktok] video-ish fields:', JSON.stringify({
      mediaUrls: top.mediaUrls?.slice(0, 1),
      videoUrl: top.videoUrl,
      videoMeta_downloadAddr: top.videoMeta?.downloadAddr,
      videoMeta_playAddr: top.videoMeta?.playAddr,
    }))
    // clockworks/tiktok-scraper exposes the direct mp4 in one of several
    // fields depending on the actor version + input flags — probe all of them.
    const directVideo =
      top.mediaUrls?.[0]
      ?? top.videoMeta?.downloadAddr
      ?? top.videoMeta?.playAddr
      ?? top.videoUrl
    return {
      result: {
        platform: 'tiktok',
        sourceUrl: top.webVideoUrl ?? '',
        videoUrl: directVideo,
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
  const rawActor = process.env.APIFY_INSTAGRAM_ACTOR_ID
  const actorId = rawActor ? normaliseActorId(rawActor) : ''
  if (!token) return { result: null, reason: 'APIFY_TOKEN not set' }
  if (!actorId) return { result: null, reason: 'APIFY_INSTAGRAM_ACTOR_ID not set' }
  if (!keywords.length) return { result: null, reason: 'no keywords' }
  const reelHashtags = sanitiseHashtags(keywords, 3)
  if (!reelHashtags.length) return { result: null, reason: 'no valid hashtags after sanitising' }
  try {
    const controller = new AbortController()
    // Reels scraper is faster than TikTok but still needs generous headroom.
    const timeout = setTimeout(() => controller.abort(), 60_000)
    const res = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          // apify/instagram-hashtag-scraper rejects hashtags containing
          // spaces, commas, hyphens, or punctuation with HTTP 400. We
          // pre-sanitise to [a-z0-9_] single words at the top of this fn.
          hashtags: reelHashtags,
          resultsType: 'reels',
          resultsLimit: 5,
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
    if (!reels.length) {
      console.log('[top-videos:reels] Apify returned', items.length, 'items but 0 were video. First item keys:', items[0] ? Object.keys(items[0]).join(',') : '(empty)')
      return { result: null, reason: `Apify Reels returned 0 video items (${items.length} total items)` }
    }
    const top = reels.sort((a, b) => (b.videoViewCount ?? b.likesCount ?? 0) - (a.videoViewCount ?? a.likesCount ?? 0))[0]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyTop = top as any
    console.log('[top-videos:reels] top item keys:', Object.keys(top).join(','))
    console.log('[top-videos:reels] video-ish fields:', JSON.stringify({
      videoUrl: anyTop.videoUrl,
      videoUrlBackup: anyTop.videoUrlBackup,
      displayUrl: anyTop.displayUrl,
    }))
    const directVideo = anyTop.videoUrl ?? anyTop.videoUrlBackup ?? anyTop.displayUrl
    return {
      result: {
        platform: 'reels',
        sourceUrl: top.url ?? '',
        videoUrl: directVideo,
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
