// Trend fetchers for the Content Intelligence Engine.
// All three fail-soft: if the API key is missing OR the fetch errors, we return
// null and let Claude generate the plan from whatever data we do have. That
// keeps onboarding working before Reddit/SerpAPI/Apify keys are provisioned.

export interface TrendSnapshot {
  tiktok: TikTokTrends | null
  google: GoogleTrends | null
  reddit: RedditTrends | null
  gatheredAt: string
}

export interface TikTokTrends {
  topHashtags: Array<{ tag: string; postCount?: number; growth?: string }>
  peakHours?: number[]
  raw?: unknown
}

export interface GoogleTrends {
  risingQueries: string[]
  relatedTopics: string[]
  raw?: unknown
}

export interface RedditTrends {
  topPostTitles: string[]
  subreddits: string[]
  raw?: unknown
}

// ---------- TikTok (Apify actor as pragmatic fallback) ----------
// TikTok Business API needs partner approval. Apify's TikTok Scraper is a
// paid workaround that returns similar data.
async function fetchTikTok(keywords: string[]): Promise<TikTokTrends | null> {
  const apifyToken = process.env.APIFY_TOKEN
  if (!apifyToken || !keywords.length) return null
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    // Kept as a stub — the actual Apify actor endpoint varies by actor.
    // We return null unless configured for a specific actor id.
    const actorId = process.env.APIFY_TIKTOK_ACTOR_ID
    if (!actorId) { clearTimeout(timeout); return null }
    const res = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${apifyToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hashtags: keywords.slice(0, 5), resultsPerHashtag: 10 }),
        signal: controller.signal,
      },
    )
    clearTimeout(timeout)
    if (!res.ok) return null
    const items = await res.json() as Array<{ hashtag?: string; playCount?: number }>
    const grouped: Record<string, number> = {}
    for (const item of items) {
      if (!item.hashtag) continue
      grouped[item.hashtag] = (grouped[item.hashtag] ?? 0) + (item.playCount ?? 1)
    }
    const topHashtags = Object.entries(grouped)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag: `#${tag}`, postCount: count }))
    return { topHashtags }
  } catch {
    return null
  }
}

// ---------- Google Trends (SerpAPI) ----------
async function fetchGoogle(keywords: string[]): Promise<GoogleTrends | null> {
  const serpKey = process.env.SERPAPI_KEY
  if (!serpKey || !keywords.length) return null
  try {
    const q = keywords.slice(0, 3).join(',')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(
      `https://serpapi.com/search.json?engine=google_trends&q=${encodeURIComponent(q)}&data_type=RELATED_QUERIES&api_key=${serpKey}`,
      { signal: controller.signal },
    )
    clearTimeout(timeout)
    if (!res.ok) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await res.json() as any
    const rising: string[] = []
    const related: string[] = []
    for (const g of data?.related_queries ?? []) {
      for (const r of g?.rising ?? []) if (typeof r?.query === 'string') rising.push(r.query)
      for (const t of g?.top ?? []) if (typeof t?.query === 'string') related.push(t.query)
    }
    return {
      risingQueries: rising.slice(0, 15),
      relatedTopics: related.slice(0, 15),
    }
  } catch {
    return null
  }
}

// ---------- Reddit (public JSON, no auth required for top posts) ----------
// The public .json endpoint is fine for our light usage. For higher volume,
// swap to REDDIT_CLIENT_ID/SECRET OAuth flow.
async function fetchReddit(subreddits: string[]): Promise<RedditTrends | null> {
  if (!subreddits.length) return null
  try {
    const cleaned = subreddits
      .map(s => s.replace(/^r\//i, '').replace(/[^a-zA-Z0-9_]/g, ''))
      .filter(Boolean)
      .slice(0, 5)
    if (!cleaned.length) return null

    const results = await Promise.all(
      cleaned.map(async sub => {
        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 5000)
          const res = await fetch(
            `https://www.reddit.com/r/${sub}/top.json?t=week&limit=15`,
            { headers: { 'User-Agent': 'contentflow-web/1.0' }, signal: controller.signal },
          )
          clearTimeout(timeout)
          if (!res.ok) return []
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = await res.json() as any
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (data?.data?.children ?? []).map((c: any) => c?.data?.title).filter(Boolean) as string[]
        } catch { return [] }
      }),
    )
    const titles = results.flat().slice(0, 40)
    if (!titles.length) return null
    return { topPostTitles: titles, subreddits: cleaned }
  } catch {
    return null
  }
}

// ---------- Orchestrator ----------
export async function gatherTrends(input: {
  keywords: string[]
  subreddits: string[]
}): Promise<TrendSnapshot> {
  const [tiktok, google, reddit] = await Promise.all([
    fetchTikTok(input.keywords),
    fetchGoogle(input.keywords),
    fetchReddit(input.subreddits),
  ])
  return {
    tiktok,
    google,
    reddit,
    gatheredAt: new Date().toISOString(),
  }
}
