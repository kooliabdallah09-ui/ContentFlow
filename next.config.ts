import type { NextConfig } from "next";
import { withSentryConfig } from '@sentry/nextjs';
import { CSP_SOURCE, cspReportOnlyHeaders } from './lib/csp';

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        // Report-only: nothing is blocked, violations go to /api/csp-report
        source: CSP_SOURCE,
        headers: cspReportOnlyHeaders({
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          isDev: process.env.NODE_ENV !== 'production',
        }),
      },
    ]
  },
  async rewrites() {
    // New marketing landing is a static page in public/lp
    return {
      beforeFiles: [
        { source: '/', destination: '/lp/index.html' },
        { source: '/landing', destination: '/lp/index.html' },
      ],
    }
  },
  async redirects() {
    return [
      { source: '/refund', destination: '/refunds', permanent: true },
      // Comparison pages are paused until their competitor claims are verified
      { source: '/vs/:path*', destination: '/pricing', permanent: false },
    ]
  },
};

// Wrap with Sentry only if org/project/token are configured — otherwise it
// no-ops so local dev still works without Sentry env vars.
const sentryEnabled = !!process.env.SENTRY_ORG && !!process.env.SENTRY_PROJECT

export default sentryEnabled
  ? withSentryConfig(nextConfig, {
      silent: true,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      widenClientFileUpload: true,
      disableLogger: true,
      automaticVercelMonitors: true,
    })
  : nextConfig;
