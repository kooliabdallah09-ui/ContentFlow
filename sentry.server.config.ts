import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,      // 10% of transactions traced — enough signal, low volume
  enabled: !!process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  ignoreErrors: [
    'Insufficient credits',   // Business-logic errors, not bugs — no need to page
    'Unauthorized',
    'Webhook signature',
    'No matching signature',
  ],
})
