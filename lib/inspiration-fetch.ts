// URL extractor + fetcher used by the Campaign Planner's inspiration input.
// When the user pastes competitor / trend / reference URLs, we fetch each
// one, extract meaningful text (page title, meta description, og tags,
// visible body text), and feed a compact summary into Sonnet alongside the
// user's freeform notes.

const URL_RE = /https?:\/\/[^\s)>\]"'`]+/gi
const MAX_URLS = 6
const FETCH_TIMEOUT_MS = 8000
const MAX_TEXT_PER_URL = 3500

interface FetchedUrl {
  url: string
  ok: boolean
  title?: string
  description?: string
  text?: string
  error?: string
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function pickMeta(html: string, prop: string): string | undefined {
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
    ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'))
  return m ? m[1].trim() : undefined
}

export function extractUrls(text: string): string[] {
  if (!text) return []
  const matches = text.match(URL_RE) ?? []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of matches) {
    const clean = raw.replace(/[.,;:!?)\]}>]+$/, '')
    if (!seen.has(clean)) { seen.add(clean); out.push(clean) }
    if (out.length >= MAX_URLS) break
  }
  return out
}

async function fetchOne(url: string): Promise<FetchedUrl> {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      headers: {
        // Browser-like UA so pages don't serve empty bot pages.
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    })
    if (!res.ok) return { url, ok: false, error: `HTTP ${res.status}` }
    const html = (await res.text()).slice(0, 250_000) // hard cap on raw HTML
    const title = (html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? '').trim() || pickMeta(html, 'og:title')
    const description = pickMeta(html, 'og:description') ?? pickMeta(html, 'description') ?? pickMeta(html, 'twitter:description')
    const bodyMatch = html.match(/<body[\s\S]*?>([\s\S]*)<\/body>/i)?.[1] ?? html
    const text = stripHtml(bodyMatch).slice(0, MAX_TEXT_PER_URL)
    return { url, ok: true, title, description, text }
  } catch (err) {
    return { url, ok: false, error: err instanceof Error ? err.message : 'fetch failed' }
  } finally {
    clearTimeout(timer)
  }
}

// Public entry point. Given the raw inspiration text, extract every URL,
// fetch them in parallel, and return a compact multi-block string ready
// to append to the Sonnet prompt. Also returns the parsed URLs for logging.
export async function analyzeInspiration(rawText: string): Promise<{
  urls: string[]
  summary: string
}> {
  const urls = extractUrls(rawText)
  if (urls.length === 0) return { urls: [], summary: '' }

  const results = await Promise.all(urls.map(fetchOne))
  const blocks: string[] = []
  for (const r of results) {
    if (!r.ok) {
      blocks.push(`[SOURCE] ${r.url}\n(fetch failed: ${r.error})`)
      continue
    }
    const parts: string[] = [`[SOURCE] ${r.url}`]
    if (r.title) parts.push(`Title: ${r.title}`)
    if (r.description) parts.push(`Description: ${r.description}`)
    if (r.text) parts.push(`Excerpt:\n${r.text}`)
    blocks.push(parts.join('\n'))
  }
  return { urls, summary: blocks.join('\n\n---\n\n') }
}
