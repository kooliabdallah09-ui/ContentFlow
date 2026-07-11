// Canonical mapping from Content Intelligence format tokens
// (grwm / before_after / hot_take / unboxing / review / tutorial / pov /
// storytime / other) to the ContentFlow generator that best represents it.
//
// The mapping is context-aware: a "tutorial" for a physical product is a
// talking-head UGC walkthrough, but for an app/SaaS product it's a screen
// demo. Pass the user's product type when known.
//
// Every entry we return matches DailySuggestion.contentType so the same
// value can be used both as the sessionStorage prefill and to look up
// CONTENT_HREF / CONTENT_ICONS in the calendar UI.

export type GeneratorContentType = 'ugc' | 'video' | 'image' | 'social' | 'voice' | 'screen-demo'

const ROUTES: Record<GeneratorContentType, string> = {
  ugc: '/generate/ugc',
  video: '/generate/video',
  image: '/generate/image',
  social: '/generate/social',
  voice: '/generate/voice',
  'screen-demo': '/generate/screen-demo',
}

// True for anything screen-recordable: app, saas, software, tool, platform,
// website, browser extension, plugin, mobile app, chrome ext.
function isSoftware(productType?: string | null): boolean {
  if (!productType) return false
  const p = productType.toLowerCase()
  return ['app', 'saas', 'software', 'tool', 'platform', 'website', 'web', 'mobile', 'extension', 'plugin']
    .some(k => p.includes(k))
}

export function formatToContentType(format: string, productType?: string | null): GeneratorContentType {
  const f = String(format ?? '').toLowerCase().trim()
  const software = isSoftware(productType)
  switch (f) {
    // Talking-head UGC — the flagship format for any product.
    case 'hot_take':
    case 'review':
    case 'storytime':
    case 'pov':
    case 'grwm':
      return 'ugc'
    // Tutorials: screen-demo only for software. For physical products a
    // "tutorial" is a talking-head walkthrough (UGC).
    case 'tutorial':
      return software ? 'screen-demo' : 'ugc'
    // Product-forward formats where the product needs to visually shine.
    // Video is the right home — it can take a product image + motion prompt.
    case 'unboxing':
    case 'before_after':
      return 'video'
    default:
      return 'ugc'
  }
}

export function formatToRoute(format: string, productType?: string | null): string {
  return ROUTES[formatToContentType(format, productType)]
}

export { ROUTES as GENERATOR_ROUTES }
