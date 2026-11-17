// Content-Security-Policy for the app, sent as Content-Security-Policy-Report-Only
// (see next.config.ts). Report-only means the browser blocks nothing: it only
// posts what WOULD have been blocked to /api/csp-report. Once the reports are
// quiet, switching the header name to Content-Security-Policy enforces it.
//
// Imported by next.config.ts, so keep this file free of '@/...' imports.
//
// Known limits, on purpose for this first step:
// - script-src keeps 'unsafe-inline'. Next.js inlines its bootstrap scripts and
//   the static landing (public/lp) has an inline <script>; removing it needs
//   per-request nonces, which would make every page dynamic.
// - img-src / media-src allow any https host: generated media comes back from
//   several providers' CDNs and user-pasted product URLs.

export const CSP_REPORT_PATH = '/api/csp-report'

// Paths that carry their own, stricter policy and must not get this one.
// /motion-sandbox/ is an opaque-origin iframe with an enforced <meta> CSP.
export const CSP_SOURCE = '/((?!motion-sandbox/).*)'

interface CspOptions {
  supabaseUrl?: string
  isDev?: boolean
}

function supabaseSources(supabaseUrl?: string): string[] {
  try {
    if (supabaseUrl) {
      const { host } = new URL(supabaseUrl)
      return [`https://${host}`, `wss://${host}`]
    }
  } catch {
    // fall through to the wildcard
  }
  return ['https://*.supabase.co', 'wss://*.supabase.co']
}

export function cspDirectives({ supabaseUrl, isDev = false }: CspOptions = {}): Record<string, string[]> {
  return {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      "'unsafe-inline'",
      // Remotion's in-browser renderer compiles WebAssembly
      "'wasm-unsafe-eval'",
      'blob:',
      // Vercel Analytics / Speed Insights debug script (prod serves it from /_vercel)
      'https://va.vercel-scripts.com',
      // React Fast Refresh in `next dev` needs eval
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'media-src': ["'self'", 'data:', 'blob:', 'https:'],
    'connect-src': [
      "'self'",
      'data:',
      'blob:',
      ...supabaseSources(supabaseUrl),
      // Sentry error + replay ingestion
      'https://*.ingest.sentry.io',
      'https://*.ingest.us.sentry.io',
      'https://*.ingest.de.sentry.io',
      // Remotion loads Google Fonts with fetch()
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com',
      // Media the editor / end-card renderer pulls into blobs
      'https://files.heygen.ai',
      'https://files2.heygen.ai',
      'https://resource.heygen.ai',
      'https://assets.mixkit.co',
      'https://images.unsplash.com',
      ...(isDev ? ['ws:'] : []),
    ],
    'worker-src': ["'self'", 'blob:'],
    'frame-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'self'"],
    // report-uri only: every browser supports it and sends at once. Adding
    // report-to makes Chrome switch to the batched Reporting API instead.
    'report-uri': [CSP_REPORT_PATH],
  }
}

export function buildCsp(options: CspOptions = {}): string {
  return Object.entries(cspDirectives(options))
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ')
}

/** The header to attach: the policy in report-only mode. */
export function cspReportOnlyHeaders(options: CspOptions = {}): { key: string; value: string }[] {
  return [{ key: 'Content-Security-Policy-Report-Only', value: buildCsp(options) }]
}

// ---------------------------------------------------------------------------
// Report parsing (used by app/api/csp-report)

export interface CspViolation {
  directive: string
  blocked: string
  page: string
  source: string
}

function clip(value: unknown, max = 300): string {
  // Reports are attacker-controllable text headed for the logs: one line, capped.
  return String(value ?? '').replace(/[\r\n\t]+/g, ' ').slice(0, max)
}

function stripQuery(value: unknown): string {
  // Query strings can carry tokens (OAuth codes, signed URLs); never log them.
  return clip(String(value ?? '').split(/[?#]/)[0])
}

/**
 * Accepts both report formats browsers send:
 * - legacy `report-uri`:  { "csp-report": { "violated-directive": ... } }
 * - Reporting API:        [ { type: "csp-violation", body: { effectiveDirective: ... } } ]
 */
export function parseCspReports(payload: unknown, max = 10): CspViolation[] {
  const out: CspViolation[] = []
  const push = (r: Record<string, unknown>) => {
    const directive = clip(r['effective-directive'] ?? r['effectiveDirective'] ?? r['violated-directive'], 80)
    if (!directive) return
    out.push({
      directive,
      blocked: stripQuery(r['blocked-uri'] ?? r['blockedURL']),
      page: stripQuery(r['document-uri'] ?? r['documentURL']),
      source: stripQuery(r['source-file'] ?? r['sourceFile']),
    })
  }

  const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object'

  if (Array.isArray(payload)) {
    for (const item of payload.slice(0, max)) {
      if (isObject(item) && item.type === 'csp-violation' && isObject(item.body)) push(item.body)
    }
  } else if (isObject(payload)) {
    const legacy = payload['csp-report']
    if (isObject(legacy)) push(legacy)
  }
  return out
}
