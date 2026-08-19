// Next.js 15+ instrumentation hook — loaded once at server boot.
// Wires Sentry into the server and edge runtimes.
// Client-side init lives in instrumentation-client.ts.

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export { captureRequestError as onRequestError } from '@sentry/nextjs'
