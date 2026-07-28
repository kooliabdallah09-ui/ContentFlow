// Polar.sh billing config — credit packs only (one-time purchases).
// Subscriptions remain on Paddle until that account is approved.

export const POLAR_PRODUCTS = {
  pack500:  '136a78df-6765-49da-b321-c2d486c2b11d',
  pack1500: '4542ac98-15df-4c2d-8611-4348aebf053c',
  pack5000: '4ca60b1e-771f-49bb-9c8f-940c658009fb',
} as const

export const POLAR_PRICES = {
  pack500:  '2af9da7d-72c0-4686-9aa2-9b0154f02111',
  pack1500: '138e414d-91e0-4a87-a895-46aeca4c58a4',
  pack5000: '06cb14e4-0001-4881-aa60-5343457c93d8',
} as const

// Map product ID → credits to add on order.created
export const POLAR_PRODUCT_CREDIT_MAP: Record<string, number> = {
  [POLAR_PRODUCTS.pack500]:  500,
  [POLAR_PRODUCTS.pack1500]: 1500,
  [POLAR_PRODUCTS.pack5000]: 5000,
}
