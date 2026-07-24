// Web-search auto-discovery for Campaign Planner.
//
// Given brand + product + goal, we auto-generate 3-4 search queries with
// Haiku, hit Tavily's search API in parallel, pick the best URLs, then
// let the existing analyzeInspiration() fetch + parse them for Sonnet.
//
// Tavily is chosen because:
//   - Free tier is 1000 searches/month (more than enough)
//   - It returns AI-focused excerpts, not raw SERP HTML
//   - One env var: TAVILY_API_KEY
//
// If the key is missing we fail silently — the planner still works with
// just brand + product + user brief + user-pasted URLs.

import Anthropic from '@anthropic-ai/sdk'

const TAVILY_URL = 'https://api.tavily.com/search'
const MAX_QUERIES = 4
const MAX_RESULTS_PER_QUERY = 5
const MAX_URLS_TOTAL = 8

interface TavilyResult {
  title: string
  url: string
  content: string
  score?: number
}

interface TavilyResponse {
  results?: TavilyResult[]
}

// Ask Haiku for 3-4 punchy search queries covering competitor ads, trending
// hooks, and format patterns for this brand + product + goal.
async function generateQueries(params: {
  brand?: string
  productName?: string
  productDescription?: string
  category?: string
  goal?: string
  audience?: string
}): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return []
  try {
    const anthropic = new Anthropic({ apiKey })
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: `You draft targeted web-search queries for a UGC / social ad campaign planner.

You are given brand + product + goal + audience. Output ${MAX_QUERIES} DIFFERENT search queries that together will surface: (1) top-performing UGC ad examples in the product's category, (2) trending TikTok / Reels hooks used right now, (3) direct competitor ads worth studying, (4) creator playbooks for the audience.

Rules:
- Each query = one line, no numbering.
- Prefer specific phrasing: "top TikTok ads {category} 2026", "viral {audience} unboxing hooks", "{competitor} Meta Ad Library", "best {product_type} UGC creators".
- Never invent competitors that don't exist. If unsure, use the category, not a made-up brand.
- No preamble. Just the queries, one per line.`,
      messages: [{
        role: 'user',
        content: `BRAND: ${params.brand ?? '(unknown)'}
PRODUCT: ${params.productName ?? '(unknown)'} — ${params.productDescription ?? ''}
CATEGORY: ${params.category ?? '(infer from product)'}
GOAL: ${params.goal ?? 'awareness'}
AUDIENCE: ${params.audience ?? '(unspecified)'}

Return ${MAX_QUERIES} queries now.`,
      }],
    })
    const text = (msg.content[0] as { type: 'text'; text: string }).text
    return text
      .split('\n')
      .map(l => l.trim().replace(/^[-*\d.)\s]+/, '').trim())
      .filter(l => l.length > 3 && l.length < 200)
      .slice(0, MAX_QUERIES)
  } catch {
    return []
  }
}

async function tavilySearch(query: string): Promise<TavilyResult[]> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) return []
  try {
    const res = await fetch(TAVILY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: MAX_RESULTS_PER_QUERY,
        search_depth: 'basic',
        include_answer: false,
        include_raw_content: false,
      }),
    })
    if (!res.ok) return []
    const data = await res.json() as TavilyResponse
    return data.results ?? []
  } catch {
    return []
  }
}

// Public entry point. Called by /api/campaigns/plan before the Sonnet call.
// Returns compact "sources" the planner appends to Sonnet's user prompt AND
// stores in campaign.meta.sources for UI display.
export async function autoDiscoverTrendSources(params: {
  brand?: string
  productName?: string
  productDescription?: string
  category?: string
  goal?: string
  audience?: string
}): Promise<{
  queries: string[]
  sources: Array<{ url: string; title: string; excerpt: string; query: string }>
}> {
  // Fail early if no search key — the planner works fine without.
  if (!process.env.TAVILY_API_KEY) {
    return { queries: [], sources: [] }
  }

  const queries = await generateQueries(params)
  if (queries.length === 0) return { queries: [], sources: [] }

  const settled = await Promise.all(queries.map(async q => ({ q, results: await tavilySearch(q) })))

  // Flatten, dedupe by URL, keep highest-scoring hits first.
  const seen = new Set<string>()
  const flat: Array<{ url: string; title: string; excerpt: string; query: string; score: number }> = []
  for (const { q, results } of settled) {
    for (const r of results) {
      if (!r.url || seen.has(r.url)) continue
      seen.add(r.url)
      flat.push({
        url: r.url,
        title: r.title ?? '',
        excerpt: (r.content ?? '').slice(0, 800),
        query: q,
        score: r.score ?? 0,
      })
    }
  }
  flat.sort((a, b) => b.score - a.score)
  const top = flat.slice(0, MAX_URLS_TOTAL).map(({ url, title, excerpt, query }) => ({ url, title, excerpt, query }))
  return { queries, sources: top }
}

// Format the discovered sources as a compact prompt-ready string.
export function formatSourcesForPrompt(sources: Array<{ url: string; title: string; excerpt: string; query: string }>): string {
  if (sources.length === 0) return ''
  const blocks = sources.map((s, i) => `[${i + 1}] ${s.title || s.url}
Query: ${s.query}
URL: ${s.url}
Excerpt: ${s.excerpt}`)
  return `AUTO-DISCOVERED TREND & COMPETITOR SOURCES (${sources.length} sources, fetched via web search based on your brand + product + goal — extract patterns, hooks, and formats that are working right now; don't just quote them):\n\n${blocks.join('\n\n')}`
}
