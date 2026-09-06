// Lightweight product-URL scraper for the public /try preview generator.
// Pulls OG title, image, description — works for Shopify, WooCommerce,
// TikTok Shop, Amazon (partially), and any site with decent OG tags.

export interface ScrapedProduct {
  productName: string
  productImageUrl?: string
  productDescription?: string
  siteName?: string
}

const UA = 'Mozilla/5.0 (compatible; ContentFlowPreviewBot/1.0)'

function pickMeta(html: string, name: string): string | null {
  const re1 = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i')
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:name|property)=["']${name}["']`, 'i')
  const m = html.match(re1) ?? html.match(re2)
  return m?.[1]?.trim() || null
}

function pickTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)
  return m?.[1]?.trim().replace(/\s+/g, ' ') || null
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

export async function scrapeProductUrl(rawUrl: string): Promise<ScrapedProduct> {
  let url: URL
  try {
    url = new URL(rawUrl)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('bad protocol')
  } catch {
    throw new Error('Invalid URL')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  let html = ''
  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      signal: controller.signal,
      redirect: 'follow',
    })
    if (!res.ok) throw new Error(`Fetch ${res.status}`)
    html = (await res.text()).slice(0, 400_000)
  } finally {
    clearTimeout(timer)
  }

  const ogTitle = pickMeta(html, 'og:title') ?? pickMeta(html, 'twitter:title')
  const ogImage = pickMeta(html, 'og:image') ?? pickMeta(html, 'twitter:image')
  const ogDesc  = pickMeta(html, 'og:description') ?? pickMeta(html, 'description')
  const siteName = pickMeta(html, 'og:site_name') ?? url.hostname.replace(/^www\./, '')
  const title = ogTitle ?? pickTitle(html)

  if (!title) throw new Error("Couldn't read that product page")

  const productName = decodeEntities(title).slice(0, 100)
  const productDescription = ogDesc ? decodeEntities(ogDesc).slice(0, 400) : undefined
  let productImageUrl: string | undefined
  if (ogImage) {
    try {
      productImageUrl = new URL(ogImage, url).toString()
    } catch { productImageUrl = undefined }
  }

  return {
    productName,
    productImageUrl,
    productDescription,
    siteName: siteName ? decodeEntities(siteName).slice(0, 60) : undefined,
  }
}
