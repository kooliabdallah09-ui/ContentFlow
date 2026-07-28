// Polar.sh billing config — credit packs + subscription plans.

export const POLAR_PRODUCTS = {
  // One-time credit packs
  pack500:        '136a78df-6765-49da-b321-c2d486c2b11d',
  pack1500:       '4542ac98-15df-4c2d-8611-4348aebf053c',
  pack5000:       '4ca60b1e-771f-49bb-9c8f-940c658009fb',
  // Subscription plans
  starter:        '7fe528e4-dfe5-4984-9a5a-10870ce625b7',
  starterAnnual:  '31cfdc2d-bec9-4f50-99c1-dd0dfcb09888',
  pro:            'a059ab83-1ac0-4116-9586-ec8824921d66',
  proAnnual:      '643543de-09f3-4ed2-8154-96a84ab48001',
  agency:         '48d34b36-008a-411a-a0dc-a94fc14b5290',
  agencyAnnual:   'da0d7a5e-d655-4c7b-bcdd-aebc949cf238',
} as const

export const POLAR_PRICES = {
  pack500:        '2af9da7d-72c0-4686-9aa2-9b0154f02111',
  pack1500:       '138e414d-91e0-4a87-a895-46aeca4c58a4',
  pack5000:       '06cb14e4-0001-4881-aa60-5343457c93d8',
  starter:        'fc2e903b-5a90-4caa-ae66-e30234cfdab4',
  starterAnnual:  '04ceeba2-98f3-4991-8954-8b8a5e91bddc',
  pro:            '916ac833-36f1-423f-abea-4c7ca76edcfb',
  proAnnual:      '8fef4880-968a-4664-975e-34be93e6b806',
  agency:         '6cbcc9cf-47eb-4838-85a0-d36a7c66e140',
  agencyAnnual:   '830e94c8-43e9-497e-9f44-5ca0cc8eda8d',
} as const

// Map product ID → credits to add on order.created (one-time packs)
export const POLAR_PACK_CREDIT_MAP: Record<string, number> = {
  [POLAR_PRODUCTS.pack500]:  500,
  [POLAR_PRODUCTS.pack1500]: 1500,
  [POLAR_PRODUCTS.pack5000]: 5000,
}

// Map product ID → plan info for subscription events
export const POLAR_PLAN_MAP: Record<string, { plan: string; monthly_credits: number }> = {
  [POLAR_PRODUCTS.starter]:       { plan: 'starter', monthly_credits: 800 },
  [POLAR_PRODUCTS.starterAnnual]: { plan: 'starter', monthly_credits: 800 },
  [POLAR_PRODUCTS.pro]:           { plan: 'pro',     monthly_credits: 2000 },
  [POLAR_PRODUCTS.proAnnual]:     { plan: 'pro',     monthly_credits: 2000 },
  [POLAR_PRODUCTS.agency]:        { plan: 'agency',  monthly_credits: 6500 },
  [POLAR_PRODUCTS.agencyAnnual]:  { plan: 'agency',  monthly_credits: 6500 },
}
