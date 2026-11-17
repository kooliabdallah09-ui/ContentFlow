import { describe, expect, it } from 'vitest'
import { buildCsp, cspDirectives, cspReportOnlyHeaders, parseCspReports, CSP_SOURCE } from '../lib/csp'

describe('CSP policy', () => {
  it('locks down the directives that have no fallback', () => {
    const d = cspDirectives()
    expect(d['object-src']).toEqual(["'none'"])
    expect(d['base-uri']).toEqual(["'self'"])
    expect(d['form-action']).toEqual(["'self'"])
    expect(d['frame-ancestors']).toEqual(["'self'"])
  })

  it('never allows eval in production, only in dev', () => {
    expect(cspDirectives({ isDev: false })['script-src']).not.toContain("'unsafe-eval'")
    expect(cspDirectives({ isDev: true })['script-src']).toContain("'unsafe-eval'")
    expect(cspDirectives({ isDev: false })['connect-src']).not.toContain('ws:')
  })

  it('pins Supabase to the project host when the URL is known', () => {
    const connect = cspDirectives({ supabaseUrl: 'https://abc.supabase.co' })['connect-src']
    expect(connect).toContain('https://abc.supabase.co')
    expect(connect).toContain('wss://abc.supabase.co')
    expect(connect).not.toContain('https://*.supabase.co')
    expect(cspDirectives({ supabaseUrl: 'not a url' })['connect-src']).toContain('https://*.supabase.co')
  })

  it('is sent report-only with a report endpoint', () => {
    const headers = cspReportOnlyHeaders()
    expect(headers.map(h => h.key)).toEqual(['Content-Security-Policy-Report-Only'])
    expect(buildCsp()).toContain('report-uri /api/csp-report')
    expect(buildCsp()).not.toMatch(/[\r\n]/)
  })

  it('skips the motion sandbox, which has its own policy', () => {
    const re = new RegExp(`^${CSP_SOURCE}$`)
    expect(re.test('/dashboard')).toBe(true)
    expect(re.test('/')).toBe(true)
    expect(re.test('/motion-sandbox/index.html')).toBe(false)
  })
})

describe('parseCspReports', () => {
  it('reads the legacy report-uri format and drops query strings', () => {
    const [v] = parseCspReports({
      'csp-report': {
        'violated-directive': 'script-src-elem',
        'blocked-uri': 'https://evil.example/x.js?token=secret',
        'document-uri': 'https://contentflow-web.com/api/integrations/callback/tiktok?code=abc',
      },
    })
    expect(v.directive).toBe('script-src-elem')
    expect(v.blocked).toBe('https://evil.example/x.js')
    expect(v.page).toBe('https://contentflow-web.com/api/integrations/callback/tiktok')
  })

  it('reads the Reporting API format and caps the batch', () => {
    const item = { type: 'csp-violation', body: { effectiveDirective: 'img-src', blockedURL: 'https://a.example/i.png', documentURL: 'https://contentflow-web.com/' } }
    expect(parseCspReports([item, { type: 'deprecation', body: {} }])).toHaveLength(1)
    expect(parseCspReports(Array(50).fill(item))).toHaveLength(10)
  })

  it('keeps log lines to one line and ignores junk', () => {
    const [v] = parseCspReports({ 'csp-report': { 'violated-directive': 'img-src\n[csp] fake', 'blocked-uri': 'x' } })
    expect(v.directive).not.toMatch(/\n/)
    expect(parseCspReports(null)).toEqual([])
    expect(parseCspReports('nope')).toEqual([])
    expect(parseCspReports({ 'csp-report': {} })).toEqual([])
  })
})
