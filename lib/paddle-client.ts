'use client'

// Lazy-loads Paddle.js from the CDN and opens the overlay checkout.
// custom_data.supabase_user_id is how the webhook links payments to users.

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Paddle?: any
  }
}

let initPromise: Promise<void> | null = null

function loadPaddle(): Promise<void> {
  if (initPromise) return initPromise
  initPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js'
    script.onload = () => {
      const env = process.env.NEXT_PUBLIC_PADDLE_ENV ?? 'sandbox'
      if (env === 'sandbox') window.Paddle.Environment.set('sandbox')
      window.Paddle.Initialize({ token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? '' })
      resolve()
    }
    script.onerror = () => reject(new Error('Failed to load Paddle.js'))
    document.head.appendChild(script)
  })
  return initPromise
}

export async function openPaddleCheckout(opts: {
  priceId: string
  userId: string
  email?: string
}): Promise<void> {
  await loadPaddle()
  window.Paddle.Checkout.open({
    items: [{ priceId: opts.priceId, quantity: 1 }],
    customData: { supabase_user_id: opts.userId },
    ...(opts.email ? { customer: { email: opts.email } } : {}),
    settings: {
      displayMode: 'overlay',
      theme: 'light',
      successUrl: `${window.location.origin}/settings/billing?checkout=success`,
    },
  })
}
