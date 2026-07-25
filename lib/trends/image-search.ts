// Image inspiration search — used by Product Studio's "Match a proven style"
// toggle. Given a product name + category, we query Tavily for 4-6 real
// campaign/ad images across Pinterest, Behance, brand sites, ad libraries,
// then download them so NB Pro can use them as visual style references.
//
// Requires TAVILY_API_KEY. Fails silently (returns empty) when missing —
// the caller decides whether to proceed without inspiration.

const TAVILY_URL = 'https://api.tavily.com/search'
const MAX_IMAGES = 6
const FETCH_TIMEOUT_MS = 6000

interface TavilyImageResult {
  url: string
  description?: string
}

interface TavilyResponse {
  results?: unknown[]
  images?: Array<string | TavilyImageResult>
}

// Compose 2 targeted queries — one leaning ad/marketing, one leaning
// aesthetic/editorial — so the returned inspo covers both angles.
function buildQueries(productName: string, category?: string): string[] {
  const cat = (category || productName).slice(0, 40)
  return [
    `${cat} product photography ad campaign 2025 2026`,
    `${cat} editorial product still life pinterest`,
  ]
}

async function tavilyImageSearch(query: string): Promise<string[]> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) return []
  try {
    const res = await fetch(TAVILY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: 5,
        search_depth: 'basic',
        include_images: true,
        include_image_descriptions: false,
        include_answer: false,
        include_raw_content: false,
      }),
    })
    if (!res.ok) return []
    const data = await res.json() as TavilyResponse
    return (data.images ?? [])
      .map(img => typeof img === 'string' ? img : img?.url)
      .filter((u): u is string => typeof u === 'string' && u.startsWith('http'))
  } catch { return [] }
}

async function fetchAsRef(url: string): Promise<{ base64: string; mimeType: string } | null> {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        'Accept': 'image/*,*/*;q=0.8',
      },
      redirect: 'follow',
    })
    if (!res.ok) return null
    const contentType = (res.headers.get('content-type') || 'image/jpeg').toLowerCase()
    if (!contentType.startsWith('image/')) return null
    const buf = Buffer.from(await res.arrayBuffer())
    // Cap at ~3MB — very large images blow up NB's reference budget without helping.
    if (buf.length < 5_000 || buf.length > 3_000_000) return null
    return { base64: buf.toString('base64'), mimeType: contentType.split(';')[0] }
  } catch { return null }
  finally { clearTimeout(timer) }
}

export interface InspoImage {
  base64: string
  mimeType: string
  sourceUrl: string
}

// Public entry — returns up to MAX_IMAGES fetched inspiration images ready
// to feed into NB Pro's referenceImages array. Sourced from Tavily's public
// web image index (Pinterest + brand sites + ad libraries + Behance).
export async function fetchStyleInspoImages(params: {
  productName: string
  productCategory?: string
}): Promise<{ images: InspoImage[]; sourceUrls: string[] }> {
  if (!process.env.TAVILY_API_KEY) return { images: [], sourceUrls: [] }

  const queries = buildQueries(params.productName, params.productCategory)
  const settled = await Promise.all(queries.map(tavilyImageSearch))
  const flat = [...new Set(settled.flat())].slice(0, MAX_IMAGES * 2) // dedupe, over-fetch (some will 404)

  const fetched: InspoImage[] = []
  for (const url of flat) {
    if (fetched.length >= MAX_IMAGES) break
    const img = await fetchAsRef(url)
    if (img) fetched.push({ ...img, sourceUrl: url })
  }

  return { images: fetched, sourceUrls: fetched.map(i => i.sourceUrl) }
}
