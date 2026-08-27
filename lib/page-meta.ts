// Central registry of page titles + mobile shell variants. Used by the
// root layout to render the right MobileShell variant per route.
//
// If a path isn't in the registry, it falls back to:
//   - variant: 'app' (full shell with header + bottom nav)
//   - title:   the last URL segment title-cased
//
// This means adding a new page = it just works on mobile. Registering
// here only matters if you need a custom title or variant.

export type MobileVariant = 'app' | 'canvas' | 'flow' | 'public'

interface PageMeta {
  title: string
  variant: MobileVariant
}

// Ordered list of route matchers. First match wins. Prefix matching so
// nested routes inherit their parent's variant unless overridden earlier.
const REGISTRY: Array<{ match: (p: string) => boolean; meta: PageMeta }> = [
  // ── Public / marketing / legal — no app chrome ───────────────
  { match: p => p === '/',                        meta: { title: 'ContentFlow', variant: 'public' } },
  { match: p => p === '/landing',                 meta: { title: 'ContentFlow', variant: 'public' } },
  { match: p => p.startsWith('/pricing'),         meta: { title: 'Pricing',     variant: 'public' } },
  { match: p => p.startsWith('/privacy'),         meta: { title: 'Privacy',     variant: 'public' } },
  { match: p => p.startsWith('/terms'),           meta: { title: 'Terms',       variant: 'public' } },
  { match: p => p.startsWith('/refunds'),         meta: { title: 'Refunds',     variant: 'public' } },
  { match: p => p.startsWith('/cookies'),         meta: { title: 'Cookies',     variant: 'public' } },
  { match: p => p.startsWith('/about'),           meta: { title: 'About',       variant: 'public' } },
  { match: p => p.startsWith('/contact'),         meta: { title: 'Contact',     variant: 'public' } },
  { match: p => p.startsWith('/help'),            meta: { title: 'Help',        variant: 'public' } },
  { match: p => p.startsWith('/blog'),            meta: { title: 'Blog',        variant: 'public' } },
  { match: p => p.startsWith('/data-deletion'),   meta: { title: 'Data',        variant: 'public' } },
  { match: p => p.startsWith('/report'),          meta: { title: 'Report',      variant: 'public' } },
  { match: p => p === '/presentation',            meta: { title: '',            variant: 'public' } },

  // ── Auth / onboarding — flow variant, no bottom nav ─────────
  { match: p => p.startsWith('/auth'),            meta: { title: '',            variant: 'flow' } },
  { match: p => p.startsWith('/onboarding'),      meta: { title: '',            variant: 'flow' } },

  // ── Canvas-style tools that need the full viewport ─────────
  { match: p => p.startsWith('/editor'),          meta: { title: 'Editor',       variant: 'canvas' } },
  { match: p => p.startsWith('/studio'),          meta: { title: 'Studio',       variant: 'canvas' } },

  // ── App pages — friendly titles for the mobile header ──────
  { match: p => p === '/dashboard',               meta: { title: 'Home',         variant: 'app' } },
  { match: p => p.startsWith('/library'),         meta: { title: 'Library',      variant: 'app' } },
  { match: p => p.startsWith('/generate/ugc'),    meta: { title: 'UGC Package',  variant: 'app' } },
  { match: p => p.startsWith('/generate/social'), meta: { title: 'Social',       variant: 'app' } },
  { match: p => p.startsWith('/generate/image'),  meta: { title: 'Image',        variant: 'app' } },
  { match: p => p.startsWith('/generate/video'),  meta: { title: 'Video',        variant: 'app' } },
  { match: p => p.startsWith('/generate/voice'),  meta: { title: 'Voice',        variant: 'app' } },
  { match: p => p.startsWith('/generate/blog'),   meta: { title: 'Blog Post',    variant: 'app' } },
  { match: p => p.startsWith('/generate/email'),  meta: { title: 'Email',        variant: 'app' } },
  { match: p => p.startsWith('/generate/business-card'), meta: { title: 'Business Card', variant: 'app' } },
  { match: p => p.startsWith('/generate/podcast-ad'),    meta: { title: 'Podcast Ad',    variant: 'app' } },
  { match: p => p.startsWith('/generate/screen-demo'),   meta: { title: 'Screen Demo',   variant: 'app' } },
  { match: p => p.startsWith('/generate/products'),      meta: { title: 'Product Studio', variant: 'app' } },
  { match: p => p.startsWith('/generate'),        meta: { title: 'Generate',     variant: 'app' } },
  { match: p => p.startsWith('/influencers'),     meta: { title: 'Influencers',  variant: 'app' } },
  { match: p => p.startsWith('/scenes'),          meta: { title: 'Scenes',       variant: 'app' } },
  { match: p => p.startsWith('/campaigns'),       meta: { title: 'Campaigns',    variant: 'app' } },
  { match: p => p.startsWith('/analytics'),       meta: { title: 'Analytics',    variant: 'app' } },
  { match: p => p.startsWith('/brand'),           meta: { title: 'Brand',        variant: 'app' } },
  { match: p => p.startsWith('/settings/billing'),      meta: { title: 'Billing',      variant: 'app' } },
  { match: p => p.startsWith('/settings/account'),      meta: { title: 'Account',      variant: 'app' } },
  { match: p => p.startsWith('/settings/brand'),        meta: { title: 'Brand',        variant: 'app' } },
  { match: p => p.startsWith('/settings/integrations'), meta: { title: 'Integrations', variant: 'app' } },
  { match: p => p.startsWith('/settings'),        meta: { title: 'Settings',     variant: 'app' } },
  { match: p => p.startsWith('/ask'),             meta: { title: 'Chat',         variant: 'app' } },
  { match: p => p.startsWith('/admin'),           meta: { title: 'Admin',        variant: 'app' } },
]

function fallback(path: string): PageMeta {
  const seg = path.split('/').filter(Boolean).pop() ?? 'ContentFlow'
  const title = seg.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase())
  return { title, variant: 'app' }
}

function resolve(path: string | null | undefined): PageMeta {
  if (!path) return { title: '', variant: 'public' }
  const hit = REGISTRY.find(r => r.match(path))
  return hit ? hit.meta : fallback(path)
}

export function resolveMobileVariant(path: string | null | undefined): MobileVariant {
  return resolve(path).variant
}

export function resolveMobileTitle(path: string | null | undefined): string {
  return resolve(path).title
}

// Re-exported so app/layout.tsx can keep using this for document.title.
export const PAGE_TITLES: Record<string, string> = Object.fromEntries(
  REGISTRY
    .filter(r => r.meta.title)
    .map((r, i) => [`__meta_${i}`, r.meta.title]),
)
